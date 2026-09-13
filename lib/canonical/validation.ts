/**
 * Central offer validation (Phase 1) — G1..G4 reason-coded gates.
 *
 * Every RawOffer is validated through this single entry point regardless of
 * whether it came from a DIRECT (API) or INDIRECT (link/feed) adapter. The
 * output is always reason-coded so telemetry and the provider onboarding
 * gates can see exactly what was rejected and why.
 *
 * Gate model:
 *  - Hard/structural gates (G1/G2) and semantic/cross-field (G3/G4) are
 *    REJECTIONS: the offer is dropped.
 *  - profile.warnGates may downgrade specific gates to warnings (offer kept,
 *    reason recorded, qualityScore reduced). By default nothing is downgraded.
 *
 * "Do NOT invent missing data": a gate can only reject on what was actually
 * provided. Absent optional fields (brand, model, rating, review count, ...)
 * are allowed and simply left undefined on the canonical offer.
 */

import type {
  OfferValidationIssue,
  OfferValidationResult,
  RawOffer,
  ValidationRejectionReason,
} from "@/lib/canonical/types";
import { isRegisteredProvider } from "@/lib/providers/registry";
import { normalizeProductImageUrl } from "@/lib/images/product-image";
import { PRODUCT_IMAGE_PLACEHOLDER } from "@/lib/images/product-image";

// ─── Profiles ──────────────────────────────────────────────────────────────

export type ValidationGate =
  | "G1_PROVIDER_UNKNOWN"
  | "G1_EXTERNAL_ID_MISSING"
  | "G2_TITLE_MISSING"
  | "G2_PRICE_INVALID"
  | "G2_CURRENCY_INVALID"
  | "G2_IMAGE_INVALID"
  | "G2_PRODUCT_URL_INVALID"
  | "G2_AFFILIATE_TARGET_BAD"
  | "G3_PRICE_ABOVE_HARD_CAP"
  | "G3_DISCOUNT_ABOVE_MAX"
  | "G3_AVAILABILITY_INVALID"
  | "G3_FETCHED_AT_INVALID"
  | "G3_IMAGE_PLACEHOLDER"
  | "G4_ORIGINAL_ABOVE_PRICE"
  | "G4_AFFILIATE_HOST_MISMATCH"
  | "G4_SHIPPING_COST_NEGATIVE";

export interface ValidationProfile {
  /** Country the offer is scoped to (for URL/host checks); optional. */
  countryCode?: string;
  /** Hard cap on price (currency-independent sanity). Optional. */
  maxPrice?: number;
  /** Allowed affiliate host suffix(es) for indirect providers. */
  affiliateAllowlist?: string[];
  /** Disable the affiliate-host gate entirely (for direct providers). */
  requireAffiliateHost?: boolean;
  /** Gates downgraded to warnings (offer kept, quality reduced). */
  warnGates?: ValidationGate[];
}

const fallbackGateTitles: Record<ValidationGate, string> = {
  G1_PROVIDER_UNKNOWN: "provider is not registered",
  G1_EXTERNAL_ID_MISSING: "external offer id is missing",
  G2_TITLE_MISSING: "title is missing",
  G2_PRICE_INVALID: "price is not a positive finite number",
  G2_CURRENCY_INVALID: "currency code is empty or too long",
  G2_IMAGE_INVALID: "primary image url is empty or invalid",
  G2_PRODUCT_URL_INVALID: "product url is empty or invalid",
  G2_AFFILIATE_TARGET_BAD: "affiliate link target is unusable",
  G3_PRICE_ABOVE_HARD_CAP: "price exceeds configured hard cap",
  G3_DISCOUNT_ABOVE_MAX: "discount exceeds 100%",
  G3_AVAILABILITY_INVALID: "availability value is invalid",
  G3_FETCHED_AT_INVALID: "fetchedAt is not a valid ISO date",
  G3_IMAGE_PLACEHOLDER: "image resolves to the placeholder",
  G4_ORIGINAL_ABOVE_PRICE: "original price must be >= price when present",
  G4_AFFILIATE_HOST_MISMATCH: "affiliate host is not on the allowlist",
  G4_SHIPPING_COST_NEGATIVE: "shipping cost cannot be negative",
};

const isValidHttpUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const isFinitePositive = (n: number | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

const currencyRegex = /^[A-Z]{3}$/;

/**
 * Validate a RawOffer against a profile, producing a reason-coded result.
 * Pure function — safe to use in CI / tests / telemetry.
 */
export function validateOffer(
  raw: RawOffer,
  profile: ValidationProfile = {},
): OfferValidationResult {
  const issues: OfferValidationIssue[] = [];
  const rejectedPartials: ValidationGate[] = [];

  /** Record a gate outcome unless it was downgraded to a warning. */
  const record = (gate: ValidationGate, message: string, value?: unknown) => {
    if (profile.warnGates?.includes(gate)) {
      issues.push({ code: gate as ValidationRejectionReason, message, value });
    } else {
      rejectedPartials.push(gate);
      issues.push({ code: gate as ValidationRejectionReason, message, value });
    }
  };

  const detail = (gate: ValidationGate) =>
    `[${gate}] ${fallbackGateTitles[gate]}`;

  // ── G1: Identity (structural) ───────────────────────────────────────────
  if (!isRegisteredProvider(raw.providerId)) {
    record("G1_PROVIDER_UNKNOWN", detail("G1_PROVIDER_UNKNOWN"), raw.providerId);
  }
  if (!raw.externalOfferId || !String(raw.externalOfferId).trim()) {
    record("G1_EXTERNAL_ID_MISSING", detail("G1_EXTERNAL_ID_MISSING"));
  }

  // ── G2: Required (structural) ───────────────────────────────────────────
  if (!raw.title || !String(raw.title).trim()) {
    record("G2_TITLE_MISSING", detail("G2_TITLE_MISSING"));
  }
  if (!isFinitePositive(raw.price)) {
    record("G2_PRICE_INVALID", detail("G2_PRICE_INVALID"), raw.price);
  }
  if (!raw.currency || !currencyRegex.test(raw.currency)) {
    record("G2_CURRENCY_INVALID", detail("G2_CURRENCY_INVALID"), raw.currency);
  }

  const rawImage = raw.images?.[0]?.url;
  if (!rawImage) {
    record("G2_IMAGE_INVALID", detail("G2_IMAGE_INVALID"), undefined);
  } else {
    const normalized = normalizeProductImageUrl(rawImage);
    if (rawImage === PRODUCT_IMAGE_PLACEHOLDER || normalized === PRODUCT_IMAGE_PLACEHOLDER) {
      // A placeholder or invalid/relative image collapses to the local
      // placeholder — distinct reason code so telemetry can see it.
      record("G3_IMAGE_PLACEHOLDER", detail("G3_IMAGE_PLACEHOLDER"), rawImage);
    } else if (!isValidHttpUrl(normalized)) {
      record("G2_IMAGE_INVALID", detail("G2_IMAGE_INVALID"), rawImage);
    }
  }

  if (!isValidHttpUrl(raw.productUrl)) {
    record("G2_PRODUCT_URL_INVALID", detail("G2_PRODUCT_URL_INVALID"), raw.productUrl);
  }

  // Affiliate target requirement differs by acquisition mode:
  //  - indirect MUST carry a usable affiliateUrl + trackable true
  //  - direct may omit it (warned only if a broken one is supplied)
  if (raw.acquisition === "indirect") {
    if (!isValidHttpUrl(raw.affiliateUrl) || raw.affiliateTrackable !== true) {
      record("G2_AFFILIATE_TARGET_BAD", detail("G2_AFFILIATE_TARGET_BAD"), raw.affiliateUrl);
    }
  } else if (raw.affiliateUrl && !isValidHttpUrl(raw.affiliateUrl)) {
    record("G2_AFFILIATE_TARGET_BAD", detail("G2_AFFILIATE_TARGET_BAD"), raw.affiliateUrl);
  }

  // ── G3: Semantic (fatal unless warned) ──────────────────────────────────
  if (profile.maxPrice != null && isFinitePositive(raw.price) && raw.price > profile.maxPrice) {
    record("G3_PRICE_ABOVE_HARD_CAP", detail("G3_PRICE_ABOVE_HARD_CAP"), raw.price);
  }

  if (
    raw.originalPrice != null &&
    isFinitePositive(raw.price) &&
    isFinitePositive(raw.originalPrice) &&
    raw.originalPrice > raw.price &&
    ((raw.originalPrice - raw.price) / raw.originalPrice) * 100 > 100
  ) {
    record("G3_DISCOUNT_ABOVE_MAX", detail("G3_DISCOUNT_ABOVE_MAX"), raw.originalPrice);
  }

  if (
    raw.availability != null &&
    !["in_stock", "out_of_stock", "limited", "unknown"].includes(raw.availability)
  ) {
    record("G3_AVAILABILITY_INVALID", detail("G3_AVAILABILITY_INVALID"), raw.availability);
  }

  if (raw.fetchedAt != null && Number.isNaN(Date.parse(raw.fetchedAt))) {
    record("G3_FETCHED_AT_INVALID", detail("G3_FETCHED_AT_INVALID"), raw.fetchedAt);
  }

  // ── G4: Cross-field (fatal unless warned) ───────────────────────────────
  if (raw.originalPrice != null && isFinitePositive(raw.price) && raw.originalPrice < raw.price - 1e-9) {
    record("G4_ORIGINAL_ABOVE_PRICE", detail("G4_ORIGINAL_ABOVE_PRICE"), {
      price: raw.price,
      originalPrice: raw.originalPrice,
    });
  }

  if (
    raw.affiliateUrl &&
    isValidHttpUrl(raw.affiliateUrl) &&
    profile.affiliateAllowlist?.length &&
    profile.requireAffiliateHost !== false
  ) {
    const host = new URL(raw.affiliateUrl).host.toLowerCase();
    const allowed = profile.affiliateAllowlist.some((item) =>
      host === item || host.endsWith(`.${item}`)
    );
    if (!allowed) {
      record("G4_AFFILIATE_HOST_MISMATCH", detail("G4_AFFILIATE_HOST_MISMATCH"), host);
    }
  }

  if (raw.shipping?.cost != null && raw.shipping.cost < 0) {
    record("G4_SHIPPING_COST_NEGATIVE", detail("G4_SHIPPING_COST_NEGATIVE"), raw.shipping.cost);
  }

  const rejectedCodes = rejectedPartials;
  const warnedCodes = issues
    .filter((i) => !rejectedPartials.includes(i.code as ValidationGate))
    .map((i) => i.code);

  const status: "rejected" | "accepted" | "warned" =
    rejectedPartials.length > 0
      ? "rejected"
      : warnedCodes.length > 0
        ? "warned"
        : "accepted";

  if (status === "rejected") {
    return { status, reasons: issues, rejectedCodes, warnedCodes };
  }

  return { status, reasons: issues, rejectedCodes, warnedCodes };
}

/**
 * Compute a 0–1 quality score from a validation result.
 * Starts at 1.0 and subtracts for each warning; rejected offers score 0.
 * Used for ranking/telemetry, NOT to fabricate rating data.
 */
export function qualityScoreFromValidation(result: OfferValidationResult): number {
  if (result.status === "rejected") return 0;
  const warnings = result.warnedCodes.length;
  return Math.max(0, 1 - warnings * 0.1);
}

/** Summary string for logs / onboarding reports. */
export function summarizeValidation(result: OfferValidationResult): string {
  return result.status === "rejected"
    ? `rejected: ${result.rejectedCodes.join(", ")}`
    : result.status === "warned"
      ? `warned: ${result.warnedCodes.join(", ")}`
      : "accepted";
}