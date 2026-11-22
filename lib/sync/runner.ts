import {
  buildProviderSyncContext,
  getSyncStoreMeta,
} from "@/lib/integration/provider-context";
import type { ProductionProviderId } from "@/lib/integration/constants";
import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { saveCatalogItemsAs } from "@/lib/integration/catalog-saver";
import {
  isUsableRemoteProductImageUrl,
  normalizeProductImageUrl,
} from "@/lib/images/product-image";
import { getSearchConnector } from "@/lib/search/connectors/registry";
import type { RawProviderListing } from "@/lib/search/types";
import { getProviderAdapter, isImportProviderId } from "@/lib/sync/providers";
import { slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { rawListingToExternalProduct } from "@/lib/sync/providers/shared/storefront-catalog";
import { fetchFallbackProducts } from "@/lib/sync/scraper";
import type { ExternalProduct } from "@/lib/sync/types";

export type ProviderStoreSyncOptions = {
  providerId: ProductionProviderId;
  queries?: string[];
  maxProducts?: number;
  countryCode?: string;
  currency?: string;
};

export type ProviderStoreSyncResult = {
  listings: number;
  saved: number;
  source: "adapter" | "connector" | "scraper";
  error?: string;
};

const STORE_WEBSITES: Partial<Record<ProductionProviderId, string>> = {
  amazon: "https://www.amazon.com",
  "amazon-eg": "https://www.amazon.eg",
  aliexpress: "https://www.aliexpress.com",
  ebay: "https://www.ebay.com",
  cjdropshipping: "https://cjdropshipping.com",
  admitad: "https://admitad.com",
  walmart: "https://www.walmart.com",
  bestbuy: "https://www.bestbuy.com",
  temu: "https://www.temu.com",
  noon: "https://www.noon.com/egypt-en/",
  jumia: "https://www.jumia.com.eg",
  carrefour: "https://www.carrefouregypt.com",
  btech: "https://btech.com",
  twob: "https://www.2b.com.eg",
  dubaiphone: "https://www.dubaiphone.net",
  raneen: "https://www.raneen.com",
  eldokan: "https://www.eldokan.com",
};

function sanitizeProduct(product: ExternalProduct): ExternalProduct | null {
  if (!product.externalId || !product.title || !product.productUrl) return null;
  if (!Number.isFinite(product.price) || product.price <= 0) return null;
  if (!/^https?:\/\//i.test(product.productUrl)) return null;

  const imageUrl = normalizeProductImageUrl(product.imageUrl);
  if (!isUsableRemoteProductImageUrl(imageUrl)) return null;

  return {
    ...product,
    imageUrl,
    imageUrls: [imageUrl, ...(product.imageUrls ?? []).filter((url) => url !== product.imageUrl)],
    currency: product.currency || "EGP",
    countryCode: product.countryCode || "EG",
  };
}

function sanitizeAndDedupe(products: ExternalProduct[]): ExternalProduct[] {
  const seen = new Set<string>();
  return products
    .map((product) => sanitizeProduct(product))
    .filter((product): product is ExternalProduct => product !== null)
    .filter((product) => {
      if (seen.has(product.externalId)) return false;
      seen.add(product.externalId);
      return true;
    });
}

function toCatalogItems(
  providerId: ProductionProviderId,
  products: ExternalProduct[],
  maxProducts: number,
): NormalizedCatalogItem[] {
  const meta = getSyncStoreMeta(providerId);
  const seen = new Set<string>();
  const items: NormalizedCatalogItem[] = [];

  for (const product of products) {
    if (items.length >= maxProducts) break;
    const externalId = slugifyTitle(product.externalId) || slugifyTitle(product.title);
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    const price = product.price;
    const originalPrice =
      Number.isFinite(product.originalPrice ?? 0) && (product.originalPrice ?? 0) > price
        ? (product.originalPrice as number)
        : price;
    const discount =
      Number.isFinite(product.discount ?? 0) && (product.discount ?? 0) > 0
        ? (product.discount as number)
        : originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

    items.push({
      id: `${providerId}-${externalId}`,
      slug: `${providerId}-${externalId}`,
      title: product.title,
      imageUrl: product.imageUrl,
      emoji: "",
      categorySlug: product.categorySlug || "general",
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      countryCode: product.countryCode,
      currency: product.currency,
      price,
      originalPrice,
      discount,
      discountType: product.discountType ?? "percentage",
      offers: [
        {
          providerId,
          storeSlug: meta.storeSlug,
          storeName: meta.name,
          externalId,
          price,
          originalPrice,
          currency: product.currency,
          countryCode: product.countryCode,
          productUrl: product.productUrl,
          affiliateUrl: product.affiliateUrl || product.productUrl,
          inStock: product.inStock !== false,
        },
      ],
      providerIds: [providerId],
      fetchedAt: new Date().toISOString(),
    });
  }

  return items;
}

export async function runProviderSyncStore(
  options: ProviderStoreSyncOptions,
): Promise<ProviderStoreSyncResult> {
  const { providerId } = options;
  const queries = (options.queries ?? []).filter(Boolean);
  const maxProducts = Math.max(options.maxProducts ?? 150, 1);
  const ctx = buildProviderSyncContext(providerId, {
    countryCode: options.countryCode ?? "EG",
    currency: options.currency ?? "EGP",
    jobConfig: {
      keywords: queries,
      maxPages: 2,
      pageSize: 24,
    },
  });

  let source: ProviderStoreSyncResult["source"] = "adapter";
  let products: ExternalProduct[] = [];
  let stepError: string | undefined;

  if (isImportProviderId(providerId)) {
    const adapter = getProviderAdapter(providerId);
    if (!adapter.isConfigured()) {
      stepError = "adapter-not-configured";
    } else {
      try {
        products = await adapter.fetchProducts(ctx);
      } catch (error) {
        stepError = error instanceof Error ? error.message.slice(0, 200) : "adapter-failed";
      }
    }
  } else {
    source = "connector";
    const connector = getSearchConnector(providerId);
    if (!connector) {
      stepError = "connector-not-found";
    } else if (!(await connector.isAvailable())) {
      stepError = "connector-unavailable";
    } else {
      const raw: RawProviderListing[] = [];
      for (const query of queries) {
        try {
          raw.push(
            ...(await connector.search(query, {
              pageSize: 24,
              maxPages: 2,
              countryCode: ctx.countryCode,
              currency: ctx.currency,
            })),
          );
        } catch {
          continue;
        }
      }

      products = raw
        .map((listing) => rawListingToExternalProduct(providerId, listing, ctx))
        .filter((product): product is ExternalProduct => product !== null);
    }
  }

  let usable = sanitizeAndDedupe(products);
  if (usable.length === 0) {
    try {
      const fallback = await fetchFallbackProducts(providerId, ctx);
      const fallbackUsable = sanitizeAndDedupe(fallback);
      if (fallbackUsable.length > 0) {
        products = fallback;
        usable = fallbackUsable;
        source = "scraper";
        stepError = undefined;
      }
    } catch (error) {
      stepError = error instanceof Error ? error.message.slice(0, 200) : "scraper-failed";
    }
  }

  const items = toCatalogItems(providerId, usable, maxProducts);
  if (items.length === 0) {
    return { listings: products.length, saved: 0, source, error: stepError ?? "no-usable-listings" };
  }

  const meta = getSyncStoreMeta(providerId);
  const saved = await saveCatalogItemsAs(items, {
    providerId,
    store: {
      slug: meta.storeSlug,
      name: meta.name,
      website: STORE_WEBSITES[providerId] ?? "https://www.zorino.com",
      integrationType: meta.integrationType,
      supportedRegions: [ctx.countryCode],
      supportedCurrencies: [ctx.currency],
    },
  });

  return { listings: products.length, saved, source };
}
