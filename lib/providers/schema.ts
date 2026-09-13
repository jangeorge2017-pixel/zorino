/**
 * Canonical normalized data schema for Zorino.
 *
 * Every provider adapter converts its native response into this schema.
 * The frontend, search engine, comparison engine, and homepage all consume
 * ONLY these types — never provider-specific response formats.
 */

// ─── Product Image ──────────────────────────────────────────────────────────

export type ProductImage = {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  isPrimary?: boolean;
};

// ─── Location ───────────────────────────────────────────────────────────────

export type ProductLocation = {
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
};

// ─── Pricing ────────────────────────────────────────────────────────────────

export type ProductDiscount = {
  amount: number;
  percentage: number;
};

// ─── Availability ───────────────────────────────────────────────────────────

export type Availability = "in_stock" | "out_of_stock" | "limited" | "unknown";

// ─── Cancellation ───────────────────────────────────────────────────────────

export type CancellationPolicy = {
  isRefundable: boolean;
  policy?: string;
  deadline?: string;
};

// ─── Seller ─────────────────────────────────────────────────────────────────

export type SellerInfo = {
  name: string;
  rating?: number;
  verified?: boolean;
};

// ─── Provider Metadata ──────────────────────────────────────────────────────

export type ProviderMetadata = {
  providerId: string;
  providerName: string;
  externalItemId: string;
  externalUrl: string;
  fetchedAt: string; // ISO 8601
};

// ─── Canonical Listing ─────────────────────────────────────────────────────

/**
 * The single internal representation every provider produces.
 * All downstream consumers (search, comparison, homepage, API) use this type.
 */
export type CanonicalListing = {
  // Identity
  providerId: string;
  canonicalItemId: string; // hash of providerId + externalItemId

  // Core
  title: string;
  description?: string;

  // Categorization
  category: string;
  subcategory?: string;
  productType?: "product" | "service" | "booking" | "rental";

  // Location
  location?: ProductLocation;

  // Media
  images: ProductImage[];
  thumbnailUrl: string;

  // Pricing
  price: number;
  originalPrice?: number;
  currency: string;
  discount?: ProductDiscount;

  // Availability
  availability: Availability;
  availableFrom?: string;
  availableUntil?: string;

  // Ratings
  rating?: number;
  reviewCount?: number;
  salesCount?: number;

  // Features
  amenities?: string[];
  specifications?: Record<string, string>;

  // Links
  productUrl: string;
  affiliateUrl?: string;
  bookingUrl?: string;

  // Provider metadata
  providerMetadata: ProviderMetadata;

  // Cancellation (if applicable)
  cancellation?: CancellationPolicy;

  // Seller
  seller?: SellerInfo;

  // Shipping
  shipping?: {
    freeShipping: boolean;
    estimatedDays?: number;
    cost?: number;
    currency?: string;
  };

  // Country code at listing level (for geographic filtering)
  countryCode?: string;
};

// ─── Search Result Types ────────────────────────────────────────────────────

export type PaginationInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  hasMore: boolean;
  cursor?: string;
};

export type ProviderStat = {
  providerId: string;
  fetchedCount: number;
  normalizedCount: number;
  filteredCount: number;
  error?: string;
  durationMs: number;
};

export type DeduplicationStats = {
  totalRaw: number;
  totalNormalized: number;
  totalDeduplicated: number;
};

export type SearchResultSet = {
  query: string;
  items: CanonicalListing[];
  pagination: PaginationInfo;
  providerStats: ProviderStat[];
  deduplicationStats: DeduplicationStats;
};

// ─── Comparison Types ───────────────────────────────────────────────────────

export type CompareOffer = {
  providerId: string;
  providerName: string;
  price: number;
  originalPrice?: number;
  currency: string;
  affiliateUrl?: string;
  productUrl: string;
  availability: Availability;
  seller?: SellerInfo;
  fetchedAt: string;
};

export type CompareProductResult = {
  canonicalItemId: string;
  title: string;
  description?: string;
  imageUrl: string;
  category: string;
  offers: CompareOffer[];
  lowestPrice: number;
  highestPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  providerCount: number;
};

// ─── Provider Configuration ─────────────────────────────────────────────────

export type ProviderStatus = "active" | "configured" | "stub";

export type ProviderConfig = {
  id: string;
  name: string;
  version: string;
  /**
   * Runtime status:
   * - "active"     — currently returning real products in production
   * - "configured" — real data path wired; activates when credentials appear
   * - "stub"       — placeholder only, no data path
   */
  status: ProviderStatus;
  /**
   * DB stores.integration_type CHECK-compatible value used by the sync layer.
   */
  integrationType: string;
  requiredEnvVars: string[];
  supportedCurrencies: string[];
  supportedCountries: string[];
  rateLimit?: { requests: number; perSeconds: number };
  maxPageSize?: number;
};
