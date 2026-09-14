/**
 * CJdropshipping — non-affiliate pass-through classification.
 *
 * Root cause (evidence-based):
 *
 *   1. CJdropshipping's public API (v2.0, developers.cjdropshipping.com) returns
 *      product data via /product/list, /product/listV2, and /product/query — but
 *      contains ZERO affiliate link, promotion link, or tracking-ID fields in any
 *      product response schema.
 *
 *   2. CJdropshipping's "Affiliate Program" (affiliate.cjdropshipping.com) is a
 *      REFERRAL program that pays 2% of revenue from referred MERCHANTS for 365
 *      days. The "Affiliate Link" is a merchant-account registration URL — NOT a
 *      product-level affiliate link. Per the Affiliate Marketing Program Terms,
 *      §6.2: affiliates "shall only use Referral Links obtained from the
 *      Affiliate Platform" and "shall not manipulate, alter or otherwise modify
 *      any Referral Links." These links track new-account sign-ups, not product
 *      purchases.
 *
 *   3. CJ's API lists a `getAffiliateAccessToken` endpoint under Authentication,
 *      but this token is for the merchant-referral program, not for product-level
 *      affiliate link generation — the product endpoints return no affiliate
 *      fields even when the token is present.
 *
 * Conclusion: CJdropshipping provides NO legitimate product-level affiliate
 * tracking through the available integration. The real product URL is the ONLY
 * correct destination. Never fabricate tracking IDs, referral codes, or fake
 * affiliate parameters for CJdropshipping URLs.
 *
 * Guards implemented:
 *   1. `isNonAffiliatePassThroughMarketplace()` — identifies CJ as a pass-through
 *      marketplace where affiliate link-building must return the exact destination
 *      untouched (no tracking params, no `zorino_ref`, no wrapper URLs).
 *   2. `classifyCjAffiliateCapability()` — returns an explicit classification
 *      declaring `supportsProductLevelAffiliate: false`.
 *   3. `buildCjPassThroughUrl()` — validates the destination is a real CJ product
 *      URL (never homepage, search, category, or unrelated page) and returns it
 *      byte-identical. For non-product or malformed URLs returns `null` — the
 *      caller must never emit it as an affiliate link.
 */

import {
  isCjdropshippingHostUrl,
  isCjdropshippingProductUrl,
} from "@/lib/affiliate/product-url";

// ---------------------------------------------------------------------------
// Pass-through classification
// ---------------------------------------------------------------------------

/** Only CJdropshipping is currently classified as non-affiliate pass-through. */
const NON_AFFILIATE_PASS_THROUGH_SLUGS = ["cjdropshipping"] as const;

/**
 * True when `slugOrMarketplace` is a marketplace whose available integration
 * provides NO product-level affiliate tracking capability. For these providers
 * the real product URL is the ONLY valid destination.
 */
export function isNonAffiliatePassThroughMarketplace(
  slugOrMarketplace: string,
): boolean {
  const key = slugOrMarketplace.toLowerCase().trim();
  return (NON_AFFILIATE_PASS_THROUGH_SLUGS as readonly string[]).includes(key);
}

const CJ_NON_AFFILIATE_REASON =
  "CJdropshipping's affiliate program (affiliate.cjdropshipping.com) is a " +
  "merchant-referral program that pays commissions on referred merchant sign-ups, " +
  "not product purchases. Its v2.0 product API (/product/list, /product/listV2, " +
  "/product/query) returns no affiliate or promotion-link field. There is no " +
  "legitimate per-product affiliate tracking mechanism available.";

export type CjAffiliateCapability = {
  readonly marketplace: "cjdropshipping";
  readonly supportsProductLevelAffiliate: false;
  readonly mode: "pass-through";
  readonly reason: string;
};

/**
 * Explicit evidence-based classification of CJdropshipping's affiliate
 * capability. Returns the same value regardless of environment configuration
 * because the limitation is inherent to CJ's integration, not a missing env var.
 */
export function classifyCjAffiliateCapability(): CjAffiliateCapability {
  return {
    marketplace: "cjdropshipping",
    supportsProductLevelAffiliate: false,
    mode: "pass-through",
    reason: CJ_NON_AFFILIATE_REASON,
  };
}

// ---------------------------------------------------------------------------
// URL classification + pass-through builder
// ---------------------------------------------------------------------------

export type CjPassThroughResult =
  | { ok: true; url: string; trackingApplied: false }
  | { ok: false; url: null; reason: CjPassThroughFailure };

export type CjPassThroughFailure =
  | "malformed-url"
  | "non-cj-host"
  | "non-product-destination"
  | "not-https";

/**
 * Validate a destination URL and, if it is a real CJ product URL, return it
 * byte-identical (never modified, never tracked). If it is not a valid CJ
 * product URL (homepage, search, category, malformed, wrong host) returns
 * `{ ok: false }` — the caller must never emit it as an affiliate link.
 */
export function buildCjPassThroughUrl(destinationUrl: string): CjPassThroughResult {
  if (!destinationUrl) {
    return { ok: false, url: null, reason: "malformed-url" };
  }

  const trimmed = destinationUrl.trim();
  if (!trimmed) {
    return { ok: false, url: null, reason: "malformed-url" };
  }

  // Must be a parseable HTTPS URL.
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, url: null, reason: "malformed-url" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, url: null, reason: "not-https" };
  }

  // Must be a CJdropshipping host.
  const host = url.hostname.toLowerCase();
  if (!isCjdropshippingHostUrl(host)) {
    return { ok: false, url: null, reason: "non-cj-host" };
  }

  // Must be a product-level destination — never homepage, search, category.
  if (!isCjdropshippingProductUrl(trimmed)) {
    return { ok: false, url: null, reason: "non-product-destination" };
  }

  // Exact product URL preserved — pass-through with zero tracking.
  return { ok: true, url: trimmed, trackingApplied: false };
}
