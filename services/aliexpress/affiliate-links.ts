import { affiliateLinkService } from "@/lib/affiliate/affiliate-link-service";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { generateAliExpressOpenApiAffiliateLink } from "@/lib/integrations/aliexpress/open-api-service";
import type { AffiliateLinkResult as PortalAffiliateLinkResult } from "@/lib/affiliate/providers/types";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";

export type AffiliateLinkInput = {
  productUrl: string;
  promotionLink?: string | null;
  /** @deprecated Ignored — tracking ID is read only from ALIEXPRESS_TRACKING_ID. */
  trackingId?: string;
};

export type AffiliateLinkResult = {
  url: string;
  source: "portal" | "portal_base" | "promotion_link" | "original" | "api" | "fallback" | "open_api";
};

function mapPortalResult(result: PortalAffiliateLinkResult): AffiliateLinkResult {
  return {
    url: result.url,
    source:
      result.source === "portal" ||
      result.source === "portal_base" ||
      result.source === "promotion_link" ||
      result.source === "original" ||
      result.source === "open_api"
        ? result.source
        : "fallback",
  };
}

/**
 * Generate a tracked AliExpress affiliate URL.
 * Prefer Open Platform link.generate when APP_KEY/SECRET are configured;
 * otherwise fall back to Affiliate Portal tracking params.
 */
export async function generateAliExpressAffiliateLink(
  input: AffiliateLinkInput,
): Promise<AffiliateLinkResult> {
  const promotion = input.promotionLink?.trim();
  if (promotion) {
    return { url: promotion, source: "promotion_link" };
  }

  await loadAliExpressCredentials();

  if (isAliExpressConfigured()) {
    const openApiUrl = await generateAliExpressOpenApiAffiliateLink(input.productUrl);
    if (openApiUrl) {
      return { url: openApiUrl, source: "open_api" };
    }
  }

  const portal = await affiliateLinkService.generateAliExpressLink({
    productUrl: input.productUrl,
    promotionLink: input.promotionLink,
  });
  return mapPortalResult(portal);
}

export async function generateAliExpressAffiliateLinks(
  inputs: AffiliateLinkInput[],
): Promise<Map<string, AffiliateLinkResult>> {
  const mapped = new Map<string, AffiliateLinkResult>();
  for (const input of inputs) {
    mapped.set(input.productUrl, await generateAliExpressAffiliateLink(input));
  }
  return mapped;
}
