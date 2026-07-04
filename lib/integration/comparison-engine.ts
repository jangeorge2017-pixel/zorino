import type { CatalogFetchResult, NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { externalProductsToCatalogItems } from "@/lib/integration/normalize";
import { buildProviderSyncContext } from "@/lib/integration/provider-context";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";
import { createEbayProvider } from "@/lib/sync/providers/ebay";
import { titleSimilarity } from "@/lib/marketplace-engine/utils";
import type { ExternalProduct } from "@/lib/sync/types";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";

const MATCH_THRESHOLD = 0.52;

function isProviderConfigured(providerId: ProductionProviderId): boolean {
  if (providerId === "aliexpress") return isAliExpressConfigured();
  return isEbayConfigured();
}

async function fetchExternalProducts(
  providerId: ProductionProviderId,
): Promise<ExternalProduct[]> {
  const ctx = buildProviderSyncContext(providerId);

  if (providerId === "aliexpress") {
    return createAliExpressProvider().fetchProducts(ctx);
  }

  return createEbayProvider().fetchProducts(ctx);
}

/** Fetch and normalize listings from a single marketplace provider. */
export async function fetchProviderCatalog(
  providerId: ProductionProviderId,
): Promise<{ items: NormalizedCatalogItem[]; error?: string }> {
  if (!isProviderConfigured(providerId)) {
    return { items: [], error: "not_configured" };
  }

  try {
    const external = await fetchExternalProducts(providerId);
    return { items: externalProductsToCatalogItems(providerId, external) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider fetch failed";
    return { items: [], error: message };
  }
}

function pickBetterItem(
  current: NormalizedCatalogItem,
  candidate: NormalizedCatalogItem,
): NormalizedCatalogItem {
  const offers = [...current.offers, ...candidate.offers];
  const providerIds = [
    ...new Set([...current.providerIds, ...candidate.providerIds]),
  ] as ProductionProviderId[];

  const lowest = offers.reduce((best, offer) =>
    offer.price < best.price ? offer : best,
  );

  const originalPrice = Math.max(
    current.originalPrice,
    candidate.originalPrice,
    ...offers.map((o) => o.originalPrice),
  );

  const price = lowest.price;
  const discount =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : 0;

  return {
    ...current,
    price,
    originalPrice,
    discount,
    offers,
    providerIds,
    rating: Math.max(current.rating, candidate.rating),
    reviewCount: Math.max(current.reviewCount, candidate.reviewCount),
    imageUrl: current.imageUrl || candidate.imageUrl,
  };
}

function itemsMatch(a: NormalizedCatalogItem, b: NormalizedCatalogItem): boolean {
  if (a.slug === b.slug) return true;
  return titleSimilarity(a.title, b.title) >= MATCH_THRESHOLD;
}

/**
 * Merge catalog items from multiple providers.
 * Groups similar products and attaches cross-provider offers for comparison.
 */
export function mergeProviderCatalogs(
  batches: NormalizedCatalogItem[][],
): NormalizedCatalogItem[] {
  const merged: NormalizedCatalogItem[] = [];

  for (const batch of batches) {
    for (const item of batch) {
      const existingIndex = merged.findIndex((entry) => itemsMatch(entry, item));
      if (existingIndex === -1) {
        merged.push({ ...item, offers: [...item.offers], providerIds: [...item.providerIds] });
        continue;
      }
      merged[existingIndex] = pickBetterItem(merged[existingIndex], item);
    }
  }

  return merged;
}

/** Fan-out across AliExpress + eBay, normalize, and merge for comparison. */
export async function fetchMergedCatalog(): Promise<CatalogFetchResult> {
  const providers: CatalogFetchResult["providers"] = {};
  const batches: NormalizedCatalogItem[][] = [];

  await Promise.all(
    PRODUCTION_PROVIDER_IDS.map(async (providerId) => {
      const result = await fetchProviderCatalog(providerId);
      providers[providerId] = {
        count: result.items.length,
        error: result.error,
      };
      if (result.items.length > 0) {
        batches.push(result.items);
      }
    }),
  );

  return {
    items: mergeProviderCatalogs(batches),
    providers,
  };
}

export function isAnyProductionProviderConfigured(): boolean {
  return PRODUCTION_PROVIDER_IDS.some((id) => isProviderConfigured(id));
}

export function getConfiguredProductionProviders(): ProductionProviderId[] {
  return PRODUCTION_PROVIDER_IDS.filter((id) => isProviderConfigured(id));
}
