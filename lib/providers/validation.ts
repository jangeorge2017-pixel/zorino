/**
 * Zod validation schemas for the canonical provider data model.
 *
 * Every provider adapter normalizer MUST validate its output through these
 * schemas before passing data downstream. Invalid data is rejected with
 * structured error messages — never fabricated or approximated.
 *
 * Uses Zod 4 (v4.4.3) — import from "zod".
 */
import { z } from "zod";

// ─── Product Image ──────────────────────────────────────────────────────────

export const ProductImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  isPrimary: z.boolean().optional(),
});

// ─── Location ───────────────────────────────────────────────────────────────

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const ProductLocationSchema = z.object({
  country: z.string().min(2).max(3).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  coordinates: CoordinatesSchema.optional(),
});

// ─── Pricing ────────────────────────────────────────────────────────────────

export const ProductDiscountSchema = z.object({
  amount: z.number().min(0),
  percentage: z.number().min(0).max(100),
});

// ─── Availability ───────────────────────────────────────────────────────────

export const AvailabilitySchema = z.enum([
  "in_stock",
  "out_of_stock",
  "limited",
  "unknown",
]);

// ─── Cancellation ───────────────────────────────────────────────────────────

export const CancellationPolicySchema = z.object({
  isRefundable: z.boolean(),
  policy: z.string().optional(),
  deadline: z.string().optional(),
});

// ─── Seller ─────────────────────────────────────────────────────────────────

export const SellerInfoSchema = z.object({
  name: z.string().min(1),
  rating: z.number().min(0).max(5).optional(),
  verified: z.boolean().optional(),
});

// ─── Provider Metadata ──────────────────────────────────────────────────────

export const ProviderMetadataSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  externalItemId: z.string().min(1),
  externalUrl: z.string().url(),
  fetchedAt: z.string().datetime(),
});

// ─── Shipping ───────────────────────────────────────────────────────────────

export const ShippingSchema = z.object({
  freeShipping: z.boolean(),
  estimatedDays: z.number().int().positive().optional(),
  cost: z.number().min(0).optional(),
  currency: z.string().optional(),
});

// ─── Canonical Listing ─────────────────────────────────────────────────────

/**
 * Core validation: a CanonicalListing must have all required fields present
 * and valid. Optional fields are validated when present.
 *
 * The `.strict()` call ensures no unknown keys leak through from provider
 * raw responses — a safeguard against schema drift.
 */
export const CanonicalListingSchema = z
  .object({
    // Identity — required
    providerId: z.string().min(1),
    canonicalItemId: z.string().min(1),

    // Core — required
    title: z.string().min(1).max(1000),
    description: z.string().optional(),

    // Categorization — required
    category: z.string().min(1),
    subcategory: z.string().optional(),
    productType: z.enum(["product", "service", "booking", "rental"]).optional(),

    // Location — optional
    location: ProductLocationSchema.optional(),

    // Media — required (at least thumbnail)
    images: z.array(ProductImageSchema).min(0),
    thumbnailUrl: z.string().url(),

    // Pricing — required
    price: z.number().positive(),
    originalPrice: z.number().positive().optional(),
    currency: z.string().min(3).max(3),
    discount: ProductDiscountSchema.optional(),

    // Availability — required
    availability: AvailabilitySchema,
    availableFrom: z.string().optional(),
    availableUntil: z.string().optional(),

    // Ratings — optional
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).optional(),
    salesCount: z.number().int().min(0).optional(),

    // Features — optional
    amenities: z.array(z.string()).optional(),
    specifications: z.record(z.string(), z.string()).optional(),

    // Links — required
    productUrl: z.string().url(),
    affiliateUrl: z.string().url().optional(),
    bookingUrl: z.string().url().optional(),

    // Provider metadata — required
    providerMetadata: ProviderMetadataSchema,

    // Cancellation — optional
    cancellation: CancellationPolicySchema.optional(),

    // Seller — optional
    seller: SellerInfoSchema.optional(),

    // Shipping — optional
    shipping: ShippingSchema.optional(),

    // Country code — optional
    countryCode: z.string().min(2).max(3).optional(),
  })
  .strict();

// ─── Search Result Types ────────────────────────────────────────────────────

export const PaginationInfoSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  hasMore: z.boolean(),
  cursor: z.string().optional(),
});

export const ProviderStatSchema = z.object({
  providerId: z.string().min(1),
  fetchedCount: z.number().int().min(0),
  normalizedCount: z.number().int().min(0),
  filteredCount: z.number().int().min(0),
  error: z.string().optional(),
  durationMs: z.number().min(0),
});

export const DeduplicationStatsSchema = z.object({
  totalRaw: z.number().int().min(0),
  totalNormalized: z.number().int().min(0),
  totalDeduplicated: z.number().int().min(0),
});

export const SearchResultSetSchema = z.object({
  query: z.string(),
  items: z.array(CanonicalListingSchema),
  pagination: PaginationInfoSchema,
  providerStats: z.array(ProviderStatSchema),
  deduplicationStats: DeduplicationStatsSchema,
});

// ─── Comparison Types ───────────────────────────────────────────────────────

export const CompareOfferSchema = z.object({
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  currency: z.string().min(3).max(3),
  affiliateUrl: z.string().url().optional(),
  productUrl: z.string().url(),
  availability: AvailabilitySchema,
  seller: SellerInfoSchema.optional(),
  fetchedAt: z.string().datetime(),
});

export const CompareProductResultSchema = z.object({
  canonicalItemId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url(),
  category: z.string().min(1),
  offers: z.array(CompareOfferSchema).min(1),
  lowestPrice: z.number().positive(),
  highestPrice: z.number().positive(),
  savingsAmount: z.number().min(0),
  savingsPercent: z.number().min(0).max(100),
  providerCount: z.number().int().min(1),
});

// ─── Provider Configuration ─────────────────────────────────────────────────

export const ProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(["active", "configured", "stub"]),
  integrationType: z.string().min(1),
  requiredEnvVars: z.array(z.string()),
  supportedCurrencies: z.array(z.string().min(3).max(3)),
  supportedCountries: z.array(z.string().min(2).max(3)),
  rateLimit: z
    .object({
      requests: z.number().int().positive(),
      perSeconds: z.number().positive(),
    })
    .optional(),
  maxPageSize: z.number().int().positive().optional(),
});

// ─── Validation Helpers ─────────────────────────────────────────────────────

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

/**
 * Validate a CanonicalListing. Returns structured success/error result.
 * Use this in every provider normalizer before emitting data.
 */
export function validateCanonicalListing(
  input: unknown
): ValidationResult<z.infer<typeof CanonicalListingSchema>> {
  const result = CanonicalListingSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    ),
  };
}

/**
 * Validate a batch of CanonicalListings.
 * Returns only valid items; logs errors for invalid ones.
 */
export function validateCanonicalListings(
  inputs: unknown[]
): {
  valid: z.infer<typeof CanonicalListingSchema>[];
  invalidCount: number;
  errors: Array<{ index: number; errors: string[] }>;
} {
  const valid: z.infer<typeof CanonicalListingSchema>[] = [];
  const errors: Array<{ index: number; errors: string[] }> = [];
  let invalidCount = 0;

  for (let i = 0; i < inputs.length; i++) {
    const result = validateCanonicalListing(inputs[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalidCount++;
      errors.push({ index: i, errors: result.errors });
    }
  }

  return { valid, invalidCount, errors };
}

/**
 * Compute discount from original and current price.
 * Returns undefined when there is no discount.
 */
export function computeDiscount(
  originalPrice: number | undefined,
  currentPrice: number
): z.infer<typeof ProductDiscountSchema> | undefined {
  if (originalPrice == null || originalPrice <= currentPrice) return undefined;
  const amount = originalPrice - currentPrice;
  const percentage = Math.round((amount / originalPrice) * 10000) / 100;
  return { amount, percentage: Math.min(100, Math.max(0, percentage)) };
}

/**
 * Derive a canonical item ID from a provider ID and external item ID.
 * Stable, deterministic hash for cross-session deduplication.
 */
export function deriveCanonicalItemId(
  providerId: string,
  externalItemId: string
): string {
  const input = `${providerId}:${externalItemId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `zorino-${Math.abs(hash).toString(36)}`;
}
