import type { CatalogFetchResult, NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  CATALOG_FETCH_DEFAULTS,
  PRODUCTION_PROVIDER_IDS,
  type ProductionProviderId,
} from "@/lib/integration/constants";
import { HOMEPAGE_CATALOG_FETCH } from "@/lib/integration/homepage-fetch-profile";
import { externalProductsToCatalogItems } from "@/lib/integration/normalize";
import {
  buildProviderSyncContext,
  getProviderStoreMeta,
} from "@/lib/integration/provider-context";
import {
  getConfiguredProductionProviders,
  isProductionProviderConfigured,
} from "@/lib/integration/provider-config";
import { titleSimilarity } from "@/lib/marketplace-engine/utils";
import { DEFAULT_IMPORT_KEYWORDS } from "@/lib/sync/providers/shared/import-config";
import type { ExternalProduct } from "@/lib/sync/types";
import type { PartnerConnector } from "@/lib/sync/types";
import { createAliExpressProvider } from "@/lib/sync/providers/aliexpress";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
import { createEbayProvider } from "@/lib/sync/providers/ebay";
import { createTemuProvider } from "@/lib/sync/providers/temu";
import { createWalmartProvider } from "@/lib/sync/providers/walmart";

const MATCH_THRESHOLD = 0.52;

function getSyncConnector(providerId: ProductionProviderId): PartnerConnector | null {
  switch (providerId) {
    case "aliexpress":
      return createAliExpressProvider();
    case "ebay":
      return createEbayProvider();
    case "amazon":
      return createAmazonProvider();
    case "walmart":
      return createWalmartProvider();
    case "temu":
      return createTemuProvider();
    default:
      return null;
  }
}

async function fetchExternalProducts(
  providerId: ProductionProviderId,
): Promise<ExternalProduct[]> {
  const connector = getSyncConnector(providerId);
  if (!connector) return [];

  const keywords = DEFAULT_IMPORT_KEYWORDS[providerId] ?? ["electronics", "deals"];
  const limitedKeywords = keywords.slice(0, HOMEPAGE_CATALOG_FETCH.maxKeywords);

  const ctx = buildProviderSyncContext(providerId, {
    jobConfig: {
      keywords: limitedKeywords,
      maxPages: CATALOG_FETCH_DEFAULTS.maxPages,
      pageSize: CATALOG_FETCH_DEFAULTS.pageSize,
    },
  });

  return connector.fetchProducts(ctx);
}

/** Fetch and normalize listings from a single marketplace provider. */
export async function fetchProviderCatalog(
  providerId: ProductionProviderId,
): Promise<{ items: NormalizedCatalogItem[]; error?: string }> {
  if (!isProductionProviderConfigured(providerId)) {
    return { items: [], error: "not_configured" };
  }

  const connector = getSyncConnector(providerId);
  if (!connector) {
    return { items: [], error: "connector_pending" };
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

/** Fan-out across all configured providers, normalize, and merge for comparison. */
export async function fetchMergedCatalog(): Promise<CatalogFetchResult> {
  const providers: CatalogFetchResult["providers"] = {};
  const batches: NormalizedCatalogItem[][] = [];

  await Promise.all(
    PRODUCTION_PROVIDER_IDS.map(async (providerId) => {
      try {
        const result = await fetchProviderCatalog(providerId);
        providers[providerId] = {
          count: result.items.length,
          error: result.error,
        };
        if (result.items.length > 0) {
          batches.push(result.items);
        }
      } catch (error) {
        providers[providerId] = {
          count: 0,
          error: error instanceof Error ? error.message : "fetch_failed",
        };
      }
    }),
  );

  return {
    items: mergeProviderCatalogs(batches),
    providers,
  };
}

export function isAnyProductionProviderConfigured(): boolean {
  return getConfiguredProductionProviders().length > 0;
}

export function getConfiguredProductionProvidersList(): ProductionProviderId[] {
  return getConfiguredProductionProviders();
}

export { getProviderStoreMeta };
