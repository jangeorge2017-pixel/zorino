import type { ProductMatchTier } from "@/lib/search/relevance";
import {
  getProviderDisplayName,
  LIVE_PROVIDER_IDS,
  PROVIDER_IDS,
} from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/registry";
import {
  isUsableRemoteProductImageUrl,
  normalizeProductImageUrl,
} from "@/lib/images/product-image";

export const MAX_PRODUCTS_PER_STORE = 5;

export type ProductCard = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image_url: string;
  product_url: string;
  provider: string;
  store_name: string;
  store_badge: string;
};

export type ProductCardSource = {
  id?: string | null;
  externalId?: string | null;
  name?: string | null;
  title?: string | null;
  imageSrc?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  price?: number | string | null;
  currency?: string | null;
  productUrl?: string | null;
  product_url?: string | null;
  affiliateUrl?: string | null;
  affiliate_url?: string | null;
  provider?: string | null;
  providerId?: string | null;
  store?: string | null;
  storeName?: string | null;
  store_name?: string | null;
  storeSlug?: string | null;
  store_slug?: string | null;
  store_badge?: string | null;
  storeInitial?: string | null;
};

function normalizeHttpsProductUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "#" || trimmed.startsWith("/")) return undefined;
  const candidate = /^http:\/\//i.test(trimmed)
    ? `https://${trimmed.slice(7)}`
    : trimmed.startsWith("//")
      ? `https:${trimmed}`
      : trimmed;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function isUsableProductUrl(value?: string | null): boolean {
  return Boolean(normalizeHttpsProductUrl(value));
}

export function toProductCard(input: ProductCardSource): ProductCard | null {
  const imageUrl = normalizeProductImageUrl(
    input.image_url ?? input.imageSrc ?? input.imageUrl,
  );
  if (!isUsableRemoteProductImageUrl(imageUrl)) return null;

  const productUrl = normalizeHttpsProductUrl(
    input.product_url ?? input.productUrl ?? input.affiliate_url ?? input.affiliateUrl,
  );
  if (!productUrl) return null;

  const title = (input.title ?? input.name)?.trim();
  if (!title) return null;

  const price = typeof input.price === "string" ? Number(input.price) : input.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return null;

  const provider =
    input.provider?.trim() ||
    input.providerId?.trim() ||
    input.storeSlug?.trim() ||
    input.store_slug?.trim() ||
    input.store_name?.trim() ||
    input.storeName?.trim() ||
    input.store?.trim();
  if (!provider) return null;

  const storeName =
    input.store_name?.trim() ||
    input.storeName?.trim() ||
    input.store?.trim() ||
    getProviderDisplayName(provider);
  const id = input.id?.trim() || input.externalId?.trim() || productUrl;

  return {
    id,
    title,
    price,
    currency: input.currency?.trim() ?? "",
    image_url: imageUrl,
    product_url: productUrl,
    provider,
    store_name: storeName,
    store_badge:
      input.store_badge?.trim() ||
      input.storeInitial?.trim() ||
      storeName.slice(0, 2).toUpperCase(),
  };
}

export function interleaveByStore<T>(
  items: readonly T[],
  storeKey: (item: T) => string,
  limitPerStore: number = MAX_PRODUCTS_PER_STORE,
): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = storeKey(item).trim().toLowerCase() || "unknown";
    const bucket = buckets.get(key) ?? [];
    if (bucket.length >= limitPerStore) continue;
    bucket.push(item);
    buckets.set(key, bucket);
  }

  const result: T[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const bucket of buckets.values()) {
      const item = bucket.shift();
      if (!item) continue;
      result.push(item);
      progressed = true;
    }
  }
  return result;
}

/** All marketplace providers the engine can fan out to. */
export const SEARCH_PROVIDER_IDS: readonly ProviderId[] = PROVIDER_IDS;

export type SearchProviderId = ProviderId;

/**
 * Providers currently live in production (credentials configured on Vercel,
 * connector returns verified real product data, tested in live deployment).
 *
 * Derived from the canonical provider registry (status === "active") —
 * no provider can be live here without being registered there.
 * Runtime availability is checked by getActiveSearchConnectors() via each
 * connector's isAvailable() — that is the runtime source of truth.
 */
export const LIVE_SEARCH_PROVIDER_IDS: readonly ProviderId[] = LIVE_PROVIDER_IDS;

export type LiveSearchProviderId = (typeof LIVE_SEARCH_PROVIDER_IDS)[number];

/** Universal sort modes the search engine accepts. */
export type SearchSortMode = "relevance" | "price";

/**
 * Product condition class (from the source's own condition field when it has
 * one, otherwise derived from the listing title). Used by the condition-
 * diversity guardrail to keep any single source's Refurbished/Used inventory
 * from monopolizing the search viewport.
 */
export type ListingCondition = "new" | "refurbished" | "used";

export const SEARCH_ENGINE_DEFAULTS = {
  PAGE_SIZE: 50,
  /** Max API pages per provider (50 × 12 = 600 listings). */
  MAX_PAGES_PER_PROVIDER: 12,
  /**
   * Strict cap on raw listings a SINGLE source may contribute per search query
   * (requirement: fetching limit per source). Applied after parallel fetch +
   * dedupe so no single provider's volume can flood the ranking pool. Raised
   * from 50 → 80 to widen the search surface (deep used-phone marketplaces can
   * contribute their genuine volume) while the marketplace balancer and the
   * 40% viewport caps still prevent a single source from owning a page.
   */
  MAX_LISTINGS_PER_SOURCE: 80,
  /** Minimum raw listings to collect before stopping pagination. */
  MIN_FETCH_COUNT: 100,
  /** Target pool size for ranking depth. */
  TARGET_FETCH_COUNT: 300,
  /** Default results returned to the search UI. */
  DEFAULT_LIMIT: 200,
  /** Max results the UI can receive from one search. */
  MAX_DISPLAY_LIMIT: 200,
  MIN_DEVICES_BEFORE_ACCESSORIES: 6,
  DUPLICATE_TITLE_THRESHOLD: 0.55,
  DUPLICATE_STRONG_THRESHOLD: 0.72,
} as const;

/** Raw listing shape returned by any provider connector before normalization. */
export type RawProviderListing = {
  providerId: SearchProviderId;
  externalId: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  discount: number;
  currency: string;
  storeName: string;
  category: string;
  rating: number;
  reviewCount: number;
  salesCount?: number;
  shipping?: string;
  inStock: boolean;
  productUrl: string;
  affiliateUrl?: string;
  /** Real country code for this listing when the source provides one. */
  countryCode?: string;
  /** Listing condition class ("new" | "refurbished" | "used"). Absent → treated
   * as "new" by the diversity guardrail unless derivable from the title.
   */
  condition?: ListingCondition;
  /**
   * Universal product identifiers a connector can attach (ASIN, MPN, EAN, UPC,
   * GTIN, ISBN). Strict clustering (lib/search/cluster.ts) prefers a shared
   * identifier over any title-derived signature — same identifier ⇒ same
   * product, and offers group for comparison instead of fragmenting.
   */
  identifiers?: ProductUniversalIdentifiers;
};

/**
 * Universal identifier fields a provider connector can attach to a listing.
 * Mirrors the identifier-first tier of the clustering engine: when two offers
 * share ANY identifier the pair is the same product, period.
 */
export type ProductUniversalIdentifiers = {
  asin?: string;
  mpn?: string;
  ean?: string;
  upc?: string;
  gtin?: string;
  isbn?: string;
};

/** Provider-agnostic normalized listing used by ranking and deduplication. */
export type NormalizedSearchListing = RawProviderListing & {
  id: string;
  storeSlug: string;
  relevanceScore: number;
  matchTier: ProductMatchTier;
  isDevice: boolean;
};

/** Cross-store product group with multiple offers for price comparison. */
export type UnifiedSearchProduct = {
  canonicalId: string;
  title: string;
  imageUrl: string;
  emoji: string;
  category: string;
  rating: number;
  reviewCount: number;
  salesCount?: number;
  inStock: boolean;
  price: number;
  originalPrice: number;
  discount: number;
  currency: string;
  offers: NormalizedSearchListing[];
  providerCount: number;
  relevanceScore: number;
  matchTier: ProductMatchTier;
  isDevice: boolean;
};

export type SearchProviderStats = {
  providerId: SearchProviderId;
  fetched: number;
  normalized: number;
  error?: string;
  durationMs: number;
};

export type SearchEngineResult = {
  products: UnifiedSearchProduct[];
  totalFetched: number;
  totalRanked: number;
  totalUnified: number;
  providers: SearchProviderStats[];
  query: string;
};
