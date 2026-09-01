import type { SearchResultItem } from "@/lib/data/homepage";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { Product, Store } from "@/lib/types/entities";
import type { CompareProductResult } from "@/services/compare";
import { getAliExpressProductDetail } from "@/services/aliexpress/search";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import type { RawProviderListing, SearchProviderId } from "@/lib/search/types";
import { SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import { marketplaceDisplayName } from "@/lib/search/price-comparison";
import {
  isValidProductDestinationUrl,
  isAlibabaHostUrl,
  resolveAlibabaProduct,
} from "@/lib/affiliate/product-url";
import { resolveStoreLogoSrc } from "@/lib/assets";
import type { AdmitadFeedOffer } from "@/lib/integrations/admitad/types";
import type { OxylabsAmazonMarketplaceKey } from "@/lib/integrations/oxylabs";

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
    // Canonical real store logo asset (only initials are a final fallback).
    logoUrl: resolveStoreLogoSrc(meta.slug),
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
  // Prefer the MOST specific (longest) provider prefix so closely-named
  // providers (e.g. "amazon" vs "amazon-eg", "ebay" vs "ebay-motors") never
  // shadow one another regardless of SEARCH_PROVIDER_IDS ordering.
  let bestProvider: (typeof SEARCH_PROVIDER_IDS)[number] | null = null;
  let bestPrefixLen = -1;
  for (const provider of SEARCH_PROVIDER_IDS) {
    const prefix = `${provider}-`;
    if (trimmed.toLowerCase().startsWith(prefix) && prefix.length > bestPrefixLen) {
      bestProvider = provider;
      bestPrefixLen = prefix.length;
    }
  }
  if (bestProvider) {
    const prefix = `${bestProvider}-`;
    return {
      providerId: bestProvider,
      externalId: decodeURIComponent(trimmed.slice(prefix.length)),
    };
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
    currency: listing.currency,
    countryCode: listing.countryCode,
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
    currency: item.currency ?? "",
    countryCode: item.countryCode ?? null,
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
    currency: item.currency ?? (store.supportedCurrencies?.[0] ?? ""),
    countryCode: item.countryCode ?? null,
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
        currency: item.currency ?? "USD",
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
 * Whether a DB-sourced catalog item originates from the Alibaba program
 * (through the Admitad "Alibaba WW" feed). Detected from the real store name /
 * provider slug or a native Alibaba host in the stored destination URL.
 */
function isAlibabaSourcedRow(item: SearchResultItem): boolean {
  const haystack = `${item.store || ""} ${item.storeSlug || ""} ${item.id || ""}`.toLowerCase();
  if (haystack.includes("alibaba")) return true;
  if (item.id?.toLowerCase().startsWith("admitad-")) return true;
  return isAlibabaHostUrl(item.affiliateUrl);
}

/**
 * PDP for Admitad/DB-sourced catalog items (`db-<product_id>` ids).
 * Reads the lowest_prices_today row so homepage cards can open a real
 * product page with a working affiliate compare table.
 *
 * The persisted DB row may store only a merchant HOMEPAGE (e.g.
 * https://www.alibaba.com/) or an opaque Admitad tracking URL in
 * external_url/affiliate_url instead of the deep product link. NEVER expose
 * either as a Shop destination.
 *
 * Alibaba rows resolve LIVE-FEED-FIRST: (1) by the canonical `product_slug`,
 * then (2) by a strong/exact live-feed product-title match — each live offer
 * requires a real Alibaba product URL, real image, and positive price. Only
 * when the live feed yields nothing AND the stored URL is a natively-valid
 * Alibaba product URL does the stored row become the destination. If no real
 * deep product URL can be proven, the offer is left unavailable (returns null).
 */
async function getDatabaseProductDetail(productId: string): Promise<ProductDetail | null> {
  try {
    const { getDatabaseSearchItemByProductId } = await import(
      "@/lib/integration/database-catalog"
    );
    const item = await getDatabaseSearchItemByProductId(productId);
    if (!item) return null;

    if (isAlibabaSourcedRow(item)) {
      // LIVE-FEED-FIRST: prefer the real live Alibaba feed product.
      // 1) Canonical product_slug → live-feed exact offer match.
      const { getDatabaseProductSlug } = await import(
        "@/lib/integration/database-catalog"
      );
      const slug = await getDatabaseProductSlug(productId);
      let live: ProductDetail | null = null;
      if (slug) {
        live = await getAdmitadLiveProductDetail(slug);
      }
      // 2) Strong/exact live-feed product-TITLE match (real URL/image/price).
      if (!live) {
        live = await getAdmitadLiveProductDetailByTitle(item.name);
      }

      // LIVE-FEED-FIRST: live product preferred; else the stored row only when
      // its URL is a natively-valid Alibaba product URL; else unavailable.
      const decision = resolveAlibabaProduct(item.affiliateUrl, live !== null);
      if (decision === "live") return live;
      if (decision === "stored") return searchItemToProductDetail(item);
      return null;
    }

    // Non-Alibaba Admitad/DB rows keep the original behavior: use the stored
    // URL when it is a real product destination, else leave unavailable.
    if (!isValidProductDestinationUrl(item.affiliateUrl)) return null;
    return searchItemToProductDetail(item);
  } catch (error) {
    console.error(
      "[db-detail]",
      error instanceof Error ? error.message : "DB product detail failed",
    );
    return null;
  }
}

/**
 * Canonical database resolution for an internal ZORINO product id that carries
 * no marketplace prefix (e.g. a raw UUID from lowest_prices_today.product_id).
 *
 * Reads the canonical SearchResultItem via getDatabaseSearchItemByProductId and
 * only routes onward when that record PROVES a real provider (non-empty
 * storeSlug). The canonical DB resolver then derives the real external product
 * slug + product URL from the persisted row (live-feed fallback when the stored
 * URL is a merchant homepage), so the internal UUID is NEVER sent to an
 * external provider API. Returns null when no canonical record exists, so the
 * caller keeps its safe fallback behavior.
 */
async function getCanonicalProductDetailFromDatabase(
  rawId: string,
): Promise<ProductDetail | null> {
  try {
    const { getDatabaseSearchItemByProductId } = await import(
      "@/lib/integration/database-catalog"
    );
    const canonical = await getDatabaseSearchItemByProductId(rawId);
    // No canonical record / no proof of provider → do NOT manufacture one.
    if (!canonical || !canonical.storeSlug) return null;
    return getDatabaseProductDetail(rawId);
  } catch {
    return null;
  }
}

type AdmitadFeed = {
  offers: AdmitadFeedOffer[];
  feedName: string;
  feedSlug: string;
};

/**
 * Build a validated SearchResultItem from a live Admitad feed offer.
 *
 * Real-data-only: the offer is only returned when it has a positive price, a
 * real (non-placeholder) image, and a real product-level URL (the URL MUST pass
 * isValidProductDestinationUrl — a merchant homepage like https://www.alibaba.com/
 * never qualifies). Never fabricates an Alibaba product id: the external id is
 * the feed's real offer id, campaign-qualified to `admitad-<campaignId>-<offerId>`.
 */
async function buildAdmitadSearchItemFromFeed(
  feed: AdmitadFeed,
  offer: AdmitadFeedOffer,
): Promise<SearchResultItem | null> {
  if (!offer.url || offer.price <= 0) return null;
  // NEVER surface a merchant homepage / bare marketplace root as a destination.
  if (!isValidProductDestinationUrl(offer.url)) return null;

  const { normalizeAdmitadRaw } = await import("@/lib/search/normalization");
  const { normalizeProductImageUrl, PRODUCT_IMAGE_PLACEHOLDER } = await import(
    "@/lib/images/product-image"
  );
  const image = normalizeProductImageUrl(offer.image || "");
  if (!image || image === PRODUCT_IMAGE_PLACEHOLDER) return null;

  const listing = normalizeAdmitadRaw(
    {
      id: offer.id,
      name: offer.name,
      price: offer.price,
      oldprice: offer.oldprice,
      currencyId: offer.currencyId,
      url: offer.url,
      image,
      vendor: offer.vendor,
    },
    feed.feedName,
  );
  if (!listing) return null;
  // Campaign-qualified, prefix-free external id → final product id
  // becomes `admitad-<campaignId>-<offerId>`, matching homepage/search.
  listing.externalId = `${feed.feedSlug.replace(/^admitad-/, "")}-${offer.id}`;
  return rawListingToSearchItem(listing);
}

function normalizeTitleForMatch(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * PDP for live Admitad feed products (`admitad-<campaignId>-<offerId>`).
 *
 * Homepage/deals/search surface live Admitad products with real merchant
 * names, images, prices and URLs (fed through `fetchAdmitadFeedProducts`). The
 * persisted `lowest_prices_today` rows for these can lag behind (empty images
 * until the cron backfill patches them), so resolve first through the SAME
 * canonical live-feed path the homepage uses — which carries the real
 * merchant name, image, price and affiliate URL — and only fall back to the
 * persisted row by `product_slug` when the feed is unavailable. Never
 * fabricates data: every field comes from the real Admitad feed or a real DB row.
 */
async function getAdmitadLiveProductDetail(fullSlug: string): Promise<ProductDetail | null> {
  try {
    const query = fullSlug.trim();
    if (!query) return null;

    const { fetchAdmitadFeedProducts } = await import(
      "@/lib/integrations/admitad/feed-fetcher"
    );
    const feeds = await fetchAdmitadFeedProducts();
    for (const feed of feeds) {
      for (const offer of feed.offers) {
        if (`${feed.feedSlug}-${offer.id}` !== query) continue;
        const item = await buildAdmitadSearchItemFromFeed(feed, offer);
        if (!item) return null;
        return searchItemToProductDetail(item);
      }
    }

    // Cold-feed fallback: resolve from the persisted canonical row by slug.
    const { getDatabaseSearchItemByProductSlug } = await import(
      "@/lib/integration/database-catalog"
    );
    const item = await getDatabaseSearchItemByProductSlug(query);
    return item ? searchItemToProductDetail(item) : null;
  } catch (error) {
    console.error(
      "[admitad-detail]",
      error instanceof Error ? error.message : "Admitad product detail failed",
    );
    return null;
  }
}

/**
 * Resolve a DB-sourced product's deep product URL by a strong/exact live-feed
 * product-TITLE match (used when the canonical product_slug cannot be matched
 * to a live feed). The matched live offer must have a real URL (passing
 * isValidProductDestinationUrl), a real image, and a positive price. Never
 * fabricates an id and never falls back to a merchant homepage.
 */
async function getAdmitadLiveProductDetailByTitle(
  title: string,
): Promise<ProductDetail | null> {
  const query = normalizeTitleForMatch(title);
  if (!query) return null;

  try {
    const { fetchAdmitadFeedProducts } = await import(
      "@/lib/integrations/admitad/feed-fetcher"
    );
    const feeds = await fetchAdmitadFeedProducts();
    for (const feed of feeds) {
      for (const offer of feed.offers) {
        const name = normalizeTitleForMatch(offer.name);
        if (!name) continue;
        // Strong/exact match: either the titles are equal, or one fully
        // contains the other with enough distinctive length to avoid junk
        // matches (accessories, unrelated items).
        const exact = name === query;
        const strong =
          name.length >= 8 &&
          query.length >= 8 &&
          (name.includes(query) || query.includes(name));
        if (!exact && !strong) continue;
        const item = await buildAdmitadSearchItemFromFeed(feed, offer);
        if (!item) continue;
        return searchItemToProductDetail(item);
      }
    }
    return null;
  } catch (error) {
    console.error(
      "[admitad-title-detail]",
      error instanceof Error ? error.message : "Admitad title match failed",
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

function getAmazonProductDetail(
  externalId: string,
  marketplace: OxylabsAmazonMarketplaceKey,
): Promise<ProductDetail | null> {
  const cacheKey = `${marketplace}:${externalId}`;
  const cached = amazonDetailCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AMAZON_DETAIL_TTL_MS) {
    return cached.detail;
  }

  const detail = resolveAmazonProductDetail(externalId, marketplace).finally(() => {
    const entry = amazonDetailCache.get(cacheKey);
    if (entry?.detail === detail) {
      amazonDetailCache.set(cacheKey, { at: Date.now(), detail });
    }
  });
  amazonDetailCache.set(cacheKey, { at: Date.now(), detail });
  return detail;
}

async function resolveAmazonProductDetail(
  externalId: string,
  marketplace: OxylabsAmazonMarketplaceKey,
): Promise<ProductDetail | null> {
  // Preferred source: Amazon Creators API — only available when credentials
  // are configured. Bails out gracefully (no throw) when they aren't, so real
  // Amazon product data can still resolve through the credentials-free path.
  try {
    const { isAmazonConfigured } = await import("@/lib/integrations/amazon");
    if (isAmazonConfigured()) {
      const { createAmazonClientFromEnv } = await import(
        "@/lib/integrations/amazon/client"
      );
      const client = createAmazonClientFromEnv();
      if (client) {
        const raw = await client.getByASIN(externalId);
        if (raw) {
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
        }
      }
    }
  } catch (error) {
    console.error(
      "[amazon-detail]",
      error instanceof Error ? error.message : "Amazon product detail failed",
    );
  }

  // Credentials-free fallback: real Amazon product data via Oxylabs — the same
  // source the search engine uses. This keeps product detail pages working for
  // valid Amazon.com / Amazon.eg products even when Creators credentials are
  // not configured on the running environment.
  try {
    const { fetchOxylabsAmazonProduct, isOxylabsConfigured } = await import(
      "@/lib/integrations/oxylabs"
    );
    const { normalizeOxylabsAmazonRaw } = await import(
      "@/lib/search/normalization"
    );
    if (!isOxylabsConfigured()) return null;
    const raw = await fetchOxylabsAmazonProduct(externalId, marketplace);
    if (!raw) return null;
    const item = normalizeOxylabsAmazonRaw(raw, marketplace);
    if (!item) return null;
    return searchItemToProductDetail(rawListingToSearchItem(item));
  } catch (error) {
    console.error(
      "[amazon-detail] oxylabs fallback failed:",
      error instanceof Error ? error.message : String(error),
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

  if (providerId === "amazon" || providerId === "amazon-eg") {
    const marketplace: OxylabsAmazonMarketplaceKey =
      providerId === "amazon-eg" ? "amazon-eg" : "amazon-storefront";
    return getAmazonProductDetail(externalId, marketplace);
  }

  if (providerId === "ebay") {
    return getEbayProductDetail(externalId);
  }

  if (providerId === "cjdropshipping") {
    return getCjProductDetail(externalId);
  }

  if (providerId === "admitad") {
    // Full slug (`admitad-<campaignId>-<offerId>`) matches homepage/search ids
    // and the persisted product_slug on lowest_prices_today.
    return getAdmitadLiveProductDetail(trimmedId);
  }

  if (providerId === "aliexpress") {
    // Real AliExpress numeric product id — safe to call the API directly.
    return getAliExpressProductDetail(`aliexpress-${externalId}`);
  }

  if (providerId === "unknown") {
    // Internal ZORINO product id (a raw database UUID with no marketplace
    // prefix). AliExpress productdetail.get requires the REAL external
    // AliExpress numeric id and errors (407) when handed an internal UUID.
    // Resolve the real provider + external identity through the canonical
    // database catalog FIRST so an internal UUID is never forwarded to an
    // external provider API.
    const canonical = await getCanonicalProductDetailFromDatabase(trimmedId);
    if (canonical) return canonical;
    // Last resort: try eBay Browse for raw ids that look like Browse item ids.
    if (externalId.includes("|") || externalId.startsWith("v1")) {
      return getEbayProductDetail(externalId);
    }
    return null;
  }

  // Walmart / Temu / others: no dedicated detail API yet — try sync-bridged search cache miss
  // Prefer notFound over fake Amazon/mock data.
  return null;
}

/** Rough Amazon ASIN shape for validating redirect targets (10-char alnum, >=1 letter). */
function looksLikeAsin(id: string): boolean {
  const t = id.trim().toUpperCase();
  return /^[A-Z0-9]{6,12}$/.test(t) && /[A-Z]/.test(t);
}

/**
 * Outbound redirect target for marketplaces that genuinely cannot serve an
 * internal product-detail page without extra credentials (Amazon US / Egypt).
 *
 * Returns the REAL Amazon product URL with the existing affiliate tag when the
 * id is a valid ASIN, and null otherwise (so unrelated ids still 404 cleanly).
 * This is the correct existing outbound flow — never a fabricated detail page
 * and never a made-up tracking URL.
 */
export async function resolveMarketplaceRedirectUrl(
  id: string,
): Promise<string | null> {
  const trimmedId = id.trim().split("#")[0]!.split("?")[0]!.trim();
  if (/^db-/i.test(trimmedId)) return null;

  const { providerId, externalId } = parseMarketplaceProductId(trimmedId);
  if (providerId !== "amazon" && providerId !== "amazon-eg") return null;
  if (!looksLikeAsin(externalId)) return null;

  try {
    if (providerId === "amazon-eg") {
      return `https://www.amazon.eg/dp/${externalId}?tag=zorinoeg-21`;
    }
    const { getAmazonAssociateTag } = await import(
      "@/lib/integrations/amazon/config"
    );
    const tag = getAmazonAssociateTag();
    // Real tag (zorino-20 by default) — never a placeholder.
    const safeTag =
      tag && tag.toLowerCase() !== "placeholder" && tag.trim()
        ? tag.trim()
        : "zorino-20";
    return `https://www.amazon.com/dp/${externalId}?tag=${encodeURIComponent(safeTag)}`;
  } catch {
    return null;
  }
}
