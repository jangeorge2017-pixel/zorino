import { affiliateLinkService } from "@/lib/affiliate/affiliate-link-service";
import type { AffiliateLinkResult as PortalAffiliateLinkResult } from "@/lib/affiliate/providers/types";

export type AffiliateLinkInput = {
  productUrl: string;
  promotionLink?: string | null;
  /** @deprecated Ignored — tracking ID is read only from ALIEXPRESS_TRACKING_ID. */
  trackingId?: string;
};

export type AffiliateLinkResult = {
  url: string;
  source: "portal" | "portal_base" | "promotion_link" | "original" | "api" | "fallback";
};

function mapResult(result: PortalAffiliateLinkResult): AffiliateLinkResult {
  return {
    url: result.url,
    source:
      result.source === "portal" ||
      result.source === "portal_base" ||
      result.source === "promotion_link" ||
      result.source === "original"
        ? result.source
        : "fallback",
  };
}

/**
 * Generate a tracked AliExpress affiliate URL via the Affiliate Portal infrastructure.
 * Open API link generation is not used here — reserved for a future adapter.
 * Missing ALIEXPRESS_TRACKING_ID → original product URL (graceful fallback).
 */
export async function generateAliExpressAffiliateLink(
  input: AffiliateLinkInput,
): Promise<AffiliateLinkResult> {
  const result = await affiliateLinkService.generateAliExpressLink({
    productUrl: input.productUrl,
    promotionLink: input.promotionLink,
  });
  return mapResult(result);
}

export async function generateAliExpressAffiliateLinks(
  inputs: AffiliateLinkInput[],
): Promise<Map<string, AffiliateLinkResult>> {
  const mapped = new Map<string, AffiliateLinkResult>();
  const results = await affiliateLinkService.generateAliExpressLinks(
    inputs.map((input) => ({
      productUrl: input.productUrl,
      promotionLink: input.promotionLink,
    })),
  );
  for (const [url, result] of results) {
    mapped.set(url, mapResult(result));
  }
  return mapped;
}
