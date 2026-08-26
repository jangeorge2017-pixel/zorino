import type { SearchResultItem } from "@/lib/data/homepage";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { Product, Store } from "@/lib/types/entities";
import type { CompareProductResult } from "@/services/compare";
import { getAliExpressProductDetail } from "@/services/aliexpress/search";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import { marketplaceDisplayName } from "@/lib/search/price-comparison";

const STORE_META: Record<string, Pick<Store, "id" | "name" | "slug" | "website" | "logoInitial">> = {
  aliexpress: {
    id: "aliexpress",
    name: "AliExpress",
    slug: "aliexpress",
    website: "https://www.aliexpress.com",
    logoInitial: "AE",
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    slug: "ebay",
    website: "https://www.ebay.com",
    logoInitial: "EB",
  },
  walmart: {
    id: "walmart",
    name: "Walmart",
    slug: "walmart",
    website: "https://www.walmart.com",
    logoInitial: "WM",
  },
  temu: {
    id: "temu",
    name: "Temu",
    slug: "temu",
    website: "https://www.temu.com",
    logoInitial: "TM",
  },
  bestbuy: {
    id: "bestbuy",
    name: "Best Buy",
    slug: "best-buy",
    website: "https://www.bestbuy.com",
    logoInitial: "BB",
  },
  noon: {
    id: "noon",
    name: "Noon",
    slug: "noon",
    website: "https://www.noon.com",
    logoInitial: "NN",
  },
  jumia: {
    id: "jumia",
    name: "Jumia",
    slug: "jumia",
    website: "https://www.jumia.com",
    logoInitial: "JM",
  },
  amazon: {
    id: "amazon",
    name: "Amazon",
    slug: "amazon",
    website: "https://www.amazon.eg",
    logoInitial: "AZ",
  },
  "amazon-eg": {
    id: "amazon-eg",
    name: "Amazon Egypt",
    slug: "amazon-eg",
    website: "https://www.amazon.eg",
    logoInitial: "AZ",
  },
};

export function buildStore(slug: string, displayName?: string): Store {
  const meta = STORE_META[slug] ?? {
    id: slug,
    name: displayName || slug,
    slug,
    website: `https://www.${slug}.com`,
    logoInitial: slug.slice(0, 2).toUpperCase(),
  };
  const integrationType: Store["integrationType"] =
    slug === "aliexpress" ||
    slug === "ebay" ||
    slug === "amazon" ||
    slug === "amazon-eg" ||
    slug === "walmart" ||
    slug === "temu" ||
    slug === "noon"
      ? (slug as Store["integrationType"])
      : "partner";
  return {
    ...meta,
    integrationType,
    commissionRate: 0,
    supportedRegions: ["US"],
    supportedCurrencies: ["USD"],
    isActive: true,
  };
}

export function parseMarketplaceProductId(id: string): {
  providerId: SearchProviderId | "unknown";
  externalId: string;
} {
  const trimmed = id.trim().split("#")[0]!.split("?")[0]!.trim();
  for (const provider of SEARCH_PROVIDER_IDS) {
    const prefix = `${provider}-`;
    if (trimmed.toLowerCase().startsWith(prefix)) {
      return {
        providerId: provider,
        externalId: decodeURIComponent(trimmed.slice(prefix.length)),
      };
    }
  }
  // Legacy bare AliExpress numeric ids
  if (/^\d{6,}$/.test(trimmed)) {
    return { providerId: "aliexpress", externalId: trimmed };
  }
  return { providerId: "unknown", externalId: decodeURIComponent(trimmed) };
}

function rawListingToSearchItem(listing: RawProviderListing): SearchResultItem {
  return {
    id: `${listing.providerId}-${listing.externalId}`,
    name: listing.title,
    imageSrc: listing.imageUrl,
    emoji: "🛍️",
    price: listing.price,
    originalPrice: listing.originalPrice,
    discount: listing.discount,
    store: marketplaceDisplayName(listing.providerId),
    storeSlug: listing.providerId,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    salesCount: listing.salesCount,
    shipping: listing.shipping,
    inStock: listing.inStock,
    category: listing.category,
    affiliateUrl: listing.affiliateUrl ?? listing.productUrl,
  };
}

export function searchItemToProduct(item: SearchResultItem): Product {
  const { externalId } = parseMarketplaceProductId(item.id);
  return {
    id: item.id,
    name: item.name,
    slug: externalId.replace(/\|/g, "-"),
    description: item.name,
    imageUrl: item.imageSrc,
    emoji: item.emoji,
    categorySlug: (item.category || "general").toLowerCase().replace(/\s+/g, "-"),
    brand: item.store,
    rating: item.rating,
    reviewCount: item.salesCount ?? item.reviewCount,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    tags: item.category ? [item.category] : [],
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function searchItemToCompareResult(item: SearchResultItem): CompareProductResult {
  const product = searchItemToProduct(item);
  const store = buildStore(item.storeSlug || "aliexpress", item.store);
  const discountPercent = item.discount;
  const offer = {
    id: `price-${item.id}`,
    productId: item.id,
    storeId: store.id,
    price: item.price,
    originalPrice: item.originalPrice,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    isCurrent: true,
    recordedAt: new Date().toISOString(),
    store,
    provider: store.slug,
    discountPercent,
    isLowest: true,
    isHighestDiscount: true,
    externalUrl: item.affiliateUrl,
  };

  return {
    product,
    offers: [offer],
    lowestPrice: item.price,
    highestPrice: item.price,
    highestDiscount: discountPercent,
    savingsVsHighest: 0,
    savingsPercent: 0,
    providerCount: 1,
    cheapestStoreName: item.store,
    highestDiscountStoreName: item.store,
  };
}

export function searchItemToProductDetail(item: SearchResultItem): ProductDetail {
  const comparison = searchItemToCompareResult(item);
  return {
    product: comparison.product,
    categoryName: item.category || "General",
    comparison,
    images: [item.imageSrc],
    specifications: {
      Store: item.store,
      Category: item.category || "General",
      Rating: item.rating > 0 ? `${item.rating} / 5` : "—",
      Sales: String(item.salesCount ?? item.reviewCount ?? 0),
      Shipping: item.shipping ?? "Shipping varies by seller",
      Availability: item.inStock ? "In Stock" : "Out of Stock",
    },
    variants: [],
    priceHistory: [
      {
        id: `ph-${item.id}`,
        productId: item.id,
        price: item.price,
        currency: "USD",
        recordedAt: new Date().toISOString(),
      },
    ],
  };
}

async function getEbayProductDetail(externalId: string): Promise<ProductDetail | null> {
  const { loadEbayCredentials } = await import("@/services/ebay/credentials");
  const { createEbayClientFromEnv, isEbayConfigured } = await import(
    "@/lib/integrations/ebay"
  );

  await loadEbayCredentials();
  if (!isEbayConfigured()) return null;

  const client = createEbayClientFromEnv();
  if (!client) return null;

  try {
    const items = await client.getItemsByIds([externalId], "US");
    const raw = items[0];
    if (!raw) return null;
    const listing = normalizeEbayRaw(raw);
    if (!listing) return null;
    return searchItemToProductDetail(rawListingToSearchItem(listing));
  } catch (error) {
    console.error(
      "[ebay-detail]",
      error instanceof Error ? error.message : "eBay product detail failed",
    );
    return null;
  }
}

/**
 * PDP for Admitad/DB-sourced catalog items (`db-<product_id>` ids).
 * Reads the lowest_prices_today row so homepage cards can open a real
 * product page with a working affiliate compare table.
 */
async function getDatabaseProductDetail(productId: string): Promise<ProductDetail | null> {
  try {
    const { getDatabaseSearchItemByProductId } = await import(
      "@/lib/integration/database-catalog"
    );
    const item = await getDatabaseSearchItemByProductId(productId);
    if (!item) return null;
    return searchItemToProductDetail(item);
  } catch (error) {
    console.error(
      "[db-detail]",
      error instanceof Error ? error.message : "DB product detail failed",
    );
    return null;
  }
}

const cjDetailCache = new Map<
  string,
  { at: number; detail: Promise<ProductDetail | null> }
>();
const CJ_DETAIL_TTL_MS = 60_000;
const CJ_QPS_DELAY_MS = 1_300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCjProductDetail(externalId: string): Promise<ProductDetail | null> {
  const cached = cjDetailCache.get(externalId);
  if (cached && Date.now() - cached.at < CJ_DETAIL_TTL_MS) {
    return cached.detail;
  }

  const detail = resolveCjProductDetail(externalId).finally(() => {
    const entry = cjDetailCache.get(externalId);
    if (entry?.detail === detail) {
      cjDetailCache.set(externalId, { at: Date.now(), detail });
    }
  });
  cjDetailCache.set(externalId, { at: Date.now(), detail });
  return detail;
}

async function resolveCjProductDetail(externalId: string): Promise<ProductDetail | null> {
  let detail: ProductDetail | null = null;
  try {
    const apiKey = process.env.CJDROPSHIPPING_API_KEY?.trim();
    if (!apiKey) return null;

    const { CJdropshippingClient } = await import(
      "@/lib/sync/providers/cjdropshipping/client"
    );
    const { normalizeCJRaw } = await import("@/lib/search/normalization");

    const client = new CJdropshippingClient(apiKey);

    for (let attempt = 0; attempt < 3 && !detail; attempt += 1) {
      if (attempt > 0) await sleep(CJ_QPS_DELAY_MS);
      try {
        const products = await client.getProductsByIds([externalId]);
        const raw = products[0];
        if (!raw) {
          if (attempt === 2) {
            console.error(
              "[cjdropshipping-detail]",
              `CJ query returned no product for ${externalId} after retries`,
            );
          }
          continue;
        }
        const listing = normalizeCJRaw(raw);
        if (listing) {
          detail = searchItemToProductDetail(rawListingToSearchItem(listing));
        }
      } catch (error) {
        if (attempt === 2) {
          console.error(
            "[cjdropshipping-detail]",
            error instanceof Error ? error.message : "CJdropshipping product detail failed",
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "[cjdropshipping-detail]",
      error instanceof Error ? error.message : "CJdropshipping product detail failed",
    );
  }

  return detail;
}

const amazonDetailCache = new Map<
  string,
  { at: number; detail: Promise<ProductDetail | null> }
>();
const AMAZON_DETAIL_TTL_MS = 60_000;

function getAmazonProductDetail(externalId: string): Promise<ProductDetail | null> {
  const cached = amazonDetailCache.get(externalId);
  if (cached && Date.now() - cached.at < AMAZON_DETAIL_TTL_MS) {
    return cached.detail;
  }

  const detail = resolveAmazonProductDetail(externalId).finally(() => {
    const entry = amazonDetailCache.get(externalId);
    if (entry?.detail === detail) {
      amazonDetailCache.set(externalId, { at: Date.now(), detail });
    }
  });
  amazonDetailCache.set(externalId, { at: Date.now(), detail });
  return detail;
}

async function resolveAmazonProductDetail(externalId: string): Promise<ProductDetail | null> {
  try {
    const { isAmazonConfigured } = await import("@/lib/integrations/amazon");
    const { createAmazonClientFromEnv } = await import(
      "@/lib/integrations/amazon/client"
    );

    if (!isAmazonConfigured()) return null;

    const client = createAmazonClientFromEnv();
    if (!client) return null;

    const raw = await client.getByASIN(externalId);
    if (!raw) return null;

    const listing: RawProviderListing = {
      providerId: "amazon",
      externalId: raw.asin,
      title: raw.title,
      storeName: "Amazon",
      imageUrl: raw.imageUrl,
      price: raw.price,
      originalPrice: raw.originalPrice,
      discount: raw.originalPrice > raw.price
        ? Math.round(((raw.originalPrice - raw.price) / raw.originalPrice) * 100)
        : 0,
      currency: raw.currency,
      productUrl: raw.productUrl,
      affiliateUrl: raw.affiliateUrl,
      rating: raw.rating,
      reviewCount: raw.reviewCount,
      inStock: raw.inStock,
      category: raw.category,
    };

    return searchItemToProductDetail(rawListingToSearchItem(listing));
  } catch (error) {
    console.error(
      "[amazon-detail]",
      error instanceof Error ? error.message : "Amazon product detail failed",
    );
    return null;
  }
}

/**
 * Resolve PDP for any supported marketplace.
 */
export async function resolveMarketplaceProductDetail(
  id: string,
): Promise<ProductDetail | null> {
  const detail = await resolveMarketplaceProductDetailBase(id);
  if (!detail) return null;
  // Attach real cross-store offers so the compare table shows more than
  // one merchant when genuine matches exist on other providers.
  try {
    const { enrichCompareResult } = await import("@/lib/data/multi-store-comparison");
    const comparison = await enrichCompareResult(detail.comparison);
    if (comparison !== detail.comparison) {
      return { ...detail, comparison };
    }
  } catch {
    // Enrichment is best-effort; the base detail remains valid.
  }
  return detail;
}

async function resolveMarketplaceProductDetailBase(
  id: string,
): Promise<ProductDetail | null> {
  // DB-sourced Admitad catalog items: `db-<lowest_prices_today.product_id>`
  const trimmedId = id.trim().split("#")[0]!.split("?")[0]!.trim();
  if (/^db-/i.test(trimmedId)) {
    return getDatabaseProductDetail(trimmedId.slice(3));
  }

  const { providerId, externalId } = parseMarketplaceProductId(id);

  if (providerId === "amazon") {
    return getAmazonProductDetail(externalId);
  }

  if (providerId === "ebay") {
    return getEbayProductDetail(externalId);
  }

  if (providerId === "cjdropshipping") {
    return getCjProductDetail(externalId);
  }

  if (providerId === "aliexpress" || providerId === "unknown") {
    const ae = await getAliExpressProductDetail(
      providerId === "aliexpress" ? `aliexpress-${externalId}` : id,
    );
    if (ae) return ae;
    if (providerId === "unknown") {
      // Last resort: try eBay Browse for raw ids that look like Browse item ids
      if (externalId.includes("|") || externalId.startsWith("v1")) {
        return getEbayProductDetail(externalId);
      }
    }
    return null;
  }

  // Walmart / Temu / others: no dedicated detail API yet — try sync-bridged search cache miss
  // Prefer notFound over fake Amazon/mock data.
  return null;
}
