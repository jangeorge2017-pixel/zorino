import type { ProductMatchTier } from "@/lib/search/relevance";

/** All marketplace providers the engine can fan out to. */
export const SEARCH_PROVIDER_IDS = [
  "aliexpress",
  "ebay",
  "amazon",
  "cjdropshipping",
  "walmart",
  "bestbuy",
  "temu",
  "noon",
  "jumia",
  "admitad",
] as const;

export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number];

/**
 * Providers confirmed active in production (credentials configured on Vercel,
 * connector returns verified real product data, tested in live deployment).
 *
 * This is the type-level source of truth for "which providers are live".
 * Runtime availability is checked by getActiveSearchConnectors() via each
 * connector's isAvailable() — that is the runtime source of truth.
 *
 * Admitad is active: ADMITAD_FEED_URL env var is set, feed returns ~120K
 * real Alibaba marketplace products. Display name "Alibaba" in UI.
 */
export const LIVE_SEARCH_PROVIDER_IDS = ["aliexpress", "ebay", "cjdropshipping", "admitad"] as const;

export type LiveSearchProviderId = (typeof LIVE_SEARCH_PROVIDER_IDS)[number];

export const SEARCH_ENGINE_DEFAULTS = {
  PAGE_SIZE: 50,
  /** Max API pages per provider (50 × 12 = 600 listings). */
  MAX_PAGES_PER_PROVIDER: 12,
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
