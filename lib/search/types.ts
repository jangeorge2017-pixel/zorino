import type { ProductMatchTier } from "@/lib/search/relevance";

/** All marketplace providers the engine can fan out to. */
export const SEARCH_PROVIDER_IDS = [
  "aliexpress",
  "ebay",
  "amazon",
  "walmart",
  "bestbuy",
  "temu",
  "noon",
  "jumia",
] as const;

export type SearchProviderId = (typeof SEARCH_PROVIDER_IDS)[number];

/** Providers with live connector implementations. */
export const LIVE_SEARCH_PROVIDER_IDS = ["aliexpress", "ebay"] as const;

export type LiveSearchProviderId = (typeof LIVE_SEARCH_PROVIDER_IDS)[number];

export const SEARCH_ENGINE_DEFAULTS = {
  PAGE_SIZE: 50,
  /** Max API pages per provider (50 × 12 = 600 listings). */
  MAX_PAGES_PER_PROVIDER: 12,
  /** Minimum raw listings to collect before stopping pagination. */
  MIN_FETCH_COUNT: 100,
  /** Target pool size for ranking depth. */
  TARGET_FETCH_COUNT: 300,
  DEFAULT_LIMIT: 24,
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
