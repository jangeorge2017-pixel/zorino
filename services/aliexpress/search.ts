import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { Product, Store } from "@/lib/types/entities";
import type { CompareProductResult } from "@/services/compare";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { HOMEPAGE_POPULAR_SEARCH_FETCH } from "@/lib/integration/homepage-fetch-profile";

const ALIEXPRESS_STORE: Store = {
  id: "aliexpress",
  name: "AliExpress",
  slug: "aliexpress",
  website: "https://www.aliexpress.com",
  integrationType: "aliexpress",
  commissionRate: 5,
  supportedRegions: ["US", "GB", "DE", "FR", "ES", "IT", "AE", "SA", "EG"],
  supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR", "EGP"],
  isActive: true,
  logoInitial: "AE",
};

/** Filters for search/products pages — AliExpress only (no mock stores). */
export const ALIEXPRESS_SEARCH_FILTERS = {
  categories: [] as { value: string; label: string }[],
  stores: [{ value: "aliexpress", label: "AliExpress" }],
};

function upgradeImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
}

function parseRating(evaluateRate?: string): number {
  if (!evaluateRate) return 0;
  const numeric = parseFloat(evaluateRate.replace("%", ""));
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 5) return Math.min(5, Math.round((numeric / 20) * 10) / 10);
  return Math.min(5, Math.round(numeric * 10) / 10);
}

function parseSalesCount(volume?: string | number): number {
  if (volume == null) return 0;
  const n = typeof volume === "number" ? volume : parseInt(volume, 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRawToSearchItem(raw: AliExpressRawProduct): SearchResultItem | null {
  const productId = raw.product_id != null ? String(raw.product_id) : "";
  if (!productId || !raw.product_title) return null;

  const price = parseFloat(raw.target_sale_price ?? "0");
  if (!price || price <= 0) return null;

  const original = parseFloat(raw.target_original_price ?? "0");
  const originalPrice = original > price ? original : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const affiliateLink =
    raw.promotion_link?.trim() ||
    raw.product_detail_url?.trim() ||
    raw.shop_url?.trim() ||
    "";
  if (!affiliateLink) return null;

  const imageSrc = upgradeImageUrl(raw.product_main_image_url ?? "");
  // Live pipeline only — no local placeholder / mock image assets.
  if (!imageSrc.startsWith("http")) return null;

  const salesCount = parseSalesCount(raw.lastest_volume);
  const storeName = raw.shop_title?.trim() || "AliExpress";
  const category = raw.first_level_category_name?.trim() || "General";

  return {
    id: `aliexpress-${productId}`,
    name: raw.product_title.trim(),
    imageSrc,
    emoji: "🛍️",
    price,
    originalPrice,
    discount,
    store: storeName,
    storeSlug: "aliexpress",
    rating: parseRating(raw.evaluate_rate),
    reviewCount: salesCount,
    salesCount,
    inStock: true,
    category,
    affiliateUrl: affiliateLink,
  };
}

async function getClient() {
  const { getAliExpressCredentialStatus } = await import(
    "@/lib/integrations/aliexpress/config"
  );

  await loadAliExpressCredentials();

  const status = getAliExpressCredentialStatus();
  if (!status.configured) {
    // Expected when marketplace keys are not set — fall back to empty results.
    return null;
  }

  return createAliExpressClientFromEnv();
}

/**
 * Live AliExpress Affiliates product search.
 * Exact user query → API `keywords` (no rewrite, no mock/demo/fallback catalog).
 * Returns [] when credentials are missing, the API errors, or no relevant products match.
 */
export async function searchAliExpressLive(
  query: string,
  limit = 24
): Promise<SearchResultItem[]> {
  const { searchProducts } = await import("@/lib/search/engine");
  return searchProducts(query, limit);
}

/** Browse live AliExpress catalog using a single lightweight affiliate query. */
export async function browseAliExpressLive(limit = 24): Promise<SearchResultItem[]> {
  const client = await getClient();
  if (!client) return [];

  const { keyword, maxPages, pageSize } = HOMEPAGE_POPULAR_SEARCH_FETCH;
  const cappedLimit = Math.min(limit, pageSize);

  const rawProducts = await client.searchProducts(
    { keywords: [keyword], maxPages, pageSize: cappedLimit },
    "USD",
  );

  const results: SearchResultItem[] = [];
  for (const raw of rawProducts) {
    const item = mapRawToSearchItem(raw);
    if (item) results.push(item);
    if (results.length >= limit) break;
  }

  return results;
}
export function searchItemToProduct(item: SearchResultItem): Product {
  const externalId = item.id.replace(/^aliexpress-/, "");
  return {
    id: item.id,
    name: item.name,
    slug: externalId,
    description: item.name,
    imageUrl: item.imageSrc,
    emoji: item.emoji,
    categorySlug: item.category.toLowerCase().replace(/\s+/g, "-"),
    brand: item.store,
    rating: item.rating,
    reviewCount: item.salesCount ?? item.reviewCount,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    tags: [item.category],
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function searchItemToCompareResult(item: SearchResultItem): CompareProductResult {
  const product = searchItemToProduct(item);
  const discountPercent = item.discount;
  const offer = {
    id: `price-${item.id}`,
    productId: item.id,
    storeId: ALIEXPRESS_STORE.id,
    price: item.price,
    originalPrice: item.originalPrice,
    currency: "USD",
    countryCode: "US",
    inStock: item.inStock,
    isCurrent: true,
    recordedAt: new Date().toISOString(),
    store: ALIEXPRESS_STORE,
    provider: "aliexpress" as const,
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
    categoryName: item.category,
    comparison,
    images: [item.imageSrc],
    specifications: {
      Store: item.store,
      Category: item.category,
      Rating: item.rating > 0 ? `${item.rating} / 5` : "—",
      Sales: String(item.salesCount ?? item.reviewCount ?? 0),
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

/** Resolve a live AliExpress product by id (`aliexpress-{productId}` or raw id). */
export async function getAliExpressProductDetail(
  id: string
): Promise<ProductDetail | null> {
  const externalId = id.replace(/^aliexpress-/, "").trim();
  if (!externalId) return null;

  try {
    const client = await getClient();
    if (!client) return null;

    const products = await client.getProductsByIds([externalId], "USD");
    const item = products.map(mapRawToSearchItem).find(Boolean);
    return item ? searchItemToProductDetail(item) : null;
  } catch (err) {
    console.error(
      "[aliexpress-detail]",
      err instanceof Error ? err.message : "AliExpress product detail failed"
    );
    return null;
  }
}

export function filtersFromSearchResults(results: SearchResultItem[]) {
  const categories = [
    ...new Map(
      results
        .filter((r) => r.category)
        .map((r) => [r.category, { value: r.category, label: r.category }])
    ).values(),
  ];
  const stores = [
    ...new Map(
      results
        .filter((r) => r.storeSlug)
        .map((r) => [r.storeSlug, { value: r.storeSlug, label: r.store }])
    ).values(),
  ];
  return {
    categories,
    stores: stores.length > 0 ? stores : ALIEXPRESS_SEARCH_FILTERS.stores,
  };
}
