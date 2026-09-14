import type { AffiliateLinkResult } from "@/lib/affiliate/providers/types";
import {
  getAliExpressPortalConfig,
  type AliExpressPortalConfig,
  validateAliExpressPortalEnv,
} from "@/lib/affiliate/providers/aliexpress/portal-config";
import {
  isAlreadyTrackedAliExpressUrl,
  isCredibleAliExpressTrackingId,
} from "@/lib/affiliate/aliexpress-tracking";
import { isValidAliExpressDestinationUrl } from "@/lib/affiliate/product-url";

/**
 * Build an AliExpress Affiliate Portal tracking URL.
 * Uses ALIEXPRESS_TRACKING_ID (+ optional ALIEXPRESS_AFFILIATE_BASE_URL).
 * Never invents tracking IDs — falls back to the original product URL.
 */
export function buildAliExpressPortalAffiliateLink(
  productUrl: string,
  config?: AliExpressPortalConfig,
): AffiliateLinkResult {
  const resolved = config ?? validateAliExpressPortalEnv();
  const original = productUrl.trim();

  if (!original) {
    return {
      url: productUrl,
      source: "original",
      providerId: "aliexpress",
      trackingApplied: false,
    };
  }

  // Only a REAL AliExpress product page may be tagged — a homepage, search or
  // category URL is never turned into a tracked link.
  if (!isValidAliExpressDestinationUrl(original)) {
    return {
      url: original,
      source: "original",
      providerId: "aliexpress",
      trackingApplied: false,
    };
  }

  // Never re-tag a URL that already carries AliExpress tracking (Open API /
  // portal promotion links, s.click deep-links).
  if (isAlreadyTrackedAliExpressUrl(original)) {
    return {
      url: original,
      source: "original",
      providerId: "aliexpress",
      trackingApplied: false,
    };
  }

  // Placeholder / default / test values are treated as UNCONFIGURED — fail
  // safe back to the real product URL instead of emitting aff_trace_key=default.
  if (!resolved.trackingId || !isCredibleAliExpressTrackingId(resolved.trackingId)) {
    return {
      url: original,
      source: "original",
      providerId: "aliexpress",
      trackingApplied: false,
    };
  }

  // Optional click / deep-link base from the Affiliate Portal.
  if (resolved.affiliateBaseUrl) {
    try {
      const wrapped = new URL(resolved.affiliateBaseUrl);
      wrapped.searchParams.set("dl_target_url", original);
      wrapped.searchParams.set("aff_short_key", resolved.trackingId);
      wrapped.searchParams.set("tracking_id", resolved.trackingId);
      return {
        url: wrapped.toString(),
        source: "portal_base",
        providerId: "aliexpress",
        trackingApplied: true,
      };
    } catch {
      // Fall through to product-URL param injection.
    }
  }

  try {
    const url = new URL(original);
    url.searchParams.set("aff_platform", "portals-promotion");
    url.searchParams.set("aff_trace_key", resolved.trackingId);
    return {
      url: url.toString(),
      source: "portal",
      providerId: "aliexpress",
      trackingApplied: true,
    };
  } catch {
    return {
      url: original,
      source: "original",
      providerId: "aliexpress",
      trackingApplied: false,
    };
  }
}

/** Convenience: always re-read env (for one-off calls). */
export function buildAliExpressPortalAffiliateLinkFromEnv(
  productUrl: string,
): AffiliateLinkResult {
  return buildAliExpressPortalAffiliateLink(productUrl, getAliExpressPortalConfig());
}
