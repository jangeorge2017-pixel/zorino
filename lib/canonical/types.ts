/**
 * Canonical Offer / Product types for the ZORINO re-architecture (Phase 1).
 *
 * This module is ADDITIVE: nothing in the live runtime imports from it yet.
 * It will be wired into the pipeline in a later phase behind the ARCH_CANONICAL
 * feature flag (default off). Types here replace the "3-model sprawl"
 * (RawProviderListing / NormalizedCatalogItem / CanonicalListing) with ONE
 * canonical model that both DIRECT and INDIRECT acquisition converge into.
 *
 * Identity rules:
 * - Real data only. If a field cannot be reliably obtained it is `undefined`
 *   (unknown), never fabricated.
 * - storeId / providerId reference the registries in lib/canonical/registry.ts.
 */

// ─── Acquisition mode ──────────────────────────────────────────────────────
// DIRECT and INDIRECT are first-class and stay separate at the acquisition
// layer; both emit a RawOffer and converge here.
export type AcquisitionMode = "direct" | "indirect";

// ─── Validation outcomes ───────────────────────────────────────────────────
export type ValidationStatus = "accepted" | "warned" | "rejected";

export type ValidationRejectionReason =
  | "G1_PROVIDER_UNKNOWN"
  | "G1_EXTERNAL_ID_MISSING"
  | "G2_TITLE_MISSING"
  | "G2_PRICE_INVALID"
  | "G2_CURRENCY_INVALID"
  | "G2_IMAGE_INVALID"
  | "G2_PRODUCT_URL_INVALID"
  | "G2_AFFILIATE_TARGET_BAD" // used when indirect has no usable guide target
  | "G3_PRICE_ABOVE_HARD_CAP"
  | "G3_DISCOUNT_ABOVE_MAX"
  | "G3_AVAILABILITY_INVALID"
  | "G3_FETCHED_AT_INVALID"
  | "G3_IMAGE_PLACEHOLDER"
  | "G4_ORIGINAL_ABOVE_PRICE"
  | "G4_AFFILIATE_HOST_MISMATCH"
  | "G4_SHIPPING_COST_NEGATIVE";

// G2_* are structural rejections; G3_* are semantic rejections that are
// fatal; G4_* are cross-field rejections that are fatal. Warn-level outcomes
// use a separate set derived from profile.gates (see validation.ts).

export interface OfferValidationIssue {
  code: ValidationRejectionReason;
  message: string;
  /** Value observed, when the issue is about a specific field (for telemetry). */
  value?: unknown;
}

export interface OfferValidationResult {
  status: ValidationStatus;
  reasons: OfferValidationIssue[];
  /** Reason codes, for compact telemetry / logs. */
  rejectedCodes: string[];
  warnedCodes: string[];
}

// ─── Identifiers ───────────────────────────────────────────────────────────
/** Supported stable identifier types (mirrors DB product_identifiers CHECK). */
export type IdentifierType =
  | "gtin"
  | "upc"
  | "ean"
  | "mpn"
  | "asin"
  | "sku"
  | "model";

export interface OfferIdentifier {
  type: IdentifierType;
  value: string;
}

// ─── Raw Offer (what an adapter produces before validation) ───────────────
/**
 * The neutral "raw" shape each provider adapter / link adapter emits.
 * Adapters do NOT filter or judge; they map field-by-field and leave gaps null.
 * This is the input to validateOffer → canonicalize.
 */
export interface RawOffer {
  /** Provider registry id (see lib/providers/registry.ts). */
  providerId: string;
  /** Provider's native offer id. REQUIRED for identity. */
  externalOfferId?: string;
  /** How the offer was acquired. */
  acquisition: AcquisitionMode;
  /** Optional source ref for indirect (feed path, batch id, ...). Telemetry only. */
  sourceRef?: string;
  /**
   * Real merchant display name (e.g. an Admitad merchant like "Alibaba").
   * Providers that ARE the store (AliExpress/eBay/...) leave this unset.
   */
  merchantName?: string;

  /** Real product title. If absent → rejected (G2_TITLE_MISSING). */
  title?: string;
  brand?: string;
  model?: string;
  variant?: string;
  sku?: string;

  /** Structured identifiers discovered by the adapter. */
  identifiers?: OfferIdentifier[];

  /** Images. First entry is treated as primary. */
  images?: { url: string; width?: number; height?: number; alt?: string }[];

  // Pricing
  price?: number;
  originalPrice?: number;
  currency?: string;

  // Availability
  availability?: "in_stock" | "out_of_stock" | "limited" | "unknown";
  inStock?: boolean;

  // Shipping (optional)
  shipping?: { freeShipping?: boolean; estimatedDays?: number; cost?: number };

  // Links
  productUrl?: string;
  affiliateUrl?: string;
  affiliateTrackable?: boolean;

  // Categorization / attributes
  category?: string;
  attributes?: Record<string, string>;

  // Trust & provenance
  /** Country code if the offer is geo-scoped, else omitted. */
  countryCode?: string;
  /** ISO timestamp of acquisition; defaulted at canonicalize time. */
  fetchedAt?: string;
  rawEcho?: unknown;
}

// ─── Canonical Offer ───────────────────────────────────────────────────────
/**
 * A single validated, normalized offer from one store.
 * Keyed by {providerId, storeId, externalOfferId}.
 */
export interface CanonicalOffer {
  /** Stable internal id: `po:<providerId>:<externalOfferId>`. */
  canonicalOfferId: string;
  providerId: string;
  storeId: string;
  storeName: string;
  externalOfferId: string;

  /** Link to the CanonicalProduct once matching/grouping has run. */
  canonicalProductId: string;

  acquisition: {
    mode: AcquisitionMode;
    strategy: string;
    sourceRef?: string;
  };

  // Identity / product data (real only; undefined = unknown)
  title: string;
  brand?: string;
  model?: string;
  variant?: string;
  sku?: string;
  identifiers: OfferIdentifier[];

  images: { url: string; width?: number; height?: number; isPrimary?: boolean }[];

  // Pricing
  price: number;
  originalPrice?: number;
  currency: string;
  discount?: { amount: number; percentage: number };

  // Availability & shipping
  availability: "in_stock" | "out_of_stock" | "limited" | "unknown";
  shipping?: { freeShipping?: boolean; estimatedDays?: number; cost?: number };

  // Links
  productUrl: string;
  affiliateUrl?: string;
  affiliateTrackable?: boolean;

  // Categorization / attributes
  category?: string;
  attributes?: Record<string, string>;

  // Trust & provenance
  countryCode?: string;
  qualityScore: number; // 0–1 from validation gates
  validation: {
    status: ValidationStatus;
    warnings: string[];
  };
  source: {
    fetchedAt: string;
    rawProvider: string;
    confidence: number; // 0–1
  };
}

// ─── Canonical Product (identity cluster) ──────────────────────────────────
export type MatchConfidence = "exact" | "strong" | "suggested" | "weak";

/** Stable spec fingerprint used to separate variants within a product. */
export interface VariantSpec {
  /** Normalized, sorted capacity/size/color/spec attribute map. */
  fingerprint: string;
  attributes: Record<string, string>;
}

export interface CanonicalProduct {
  canonicalProductId: string;
  title: string;
  brand?: string;
  model?: string;
  variant?: string;
  identifiers: OfferIdentifier[];
  category?: string;
  attributesHash: string;
  images: string[]; // deduped primary URLs across offers
  offers: CanonicalOffer[];
  lowestPrice: number;
  highestPrice: number;
  offerCount: number;
  currency: string; // derived from the lowest-price offer
  matchConfidence: MatchConfidence;
  updatedAt: string;
  variantSpec?: VariantSpec; // defined when variants must be distinguished
}

// ─── Matching outcomes ─────────────────────────────────────────────────────
export interface IdentityMatch {
  /** How strongly two offers/products are judged the same product. */
  confidence: MatchConfidence;
  /** Which signals produced the match (for telemetry / logs). */
  signals: string[];
  /** True when the two refer to the same exact variant (not just same base product). */
  sameVariant: boolean;
}