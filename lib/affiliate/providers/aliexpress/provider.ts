import { buildAliExpressPortalAffiliateLink } from "@/lib/affiliate/providers/aliexpress/portal-links";
import { validateAliExpressPortalEnv } from "@/lib/affiliate/providers/aliexpress/portal-config";
import type {
  AffiliateCoupon,
  AffiliateCouponQuery,
  AffiliateLinkResult,
  AffiliateProductDetails,
  AffiliateProductDetailsQuery,
  AffiliateSearchQuery,
  AffiliateSearchResult,
  GenerateAffiliateLinkInput,
  MarketplaceAffiliateProvider,
} from "@/lib/affiliate/providers/types";

/**
 * AliExpress marketplace provider.
 * Link generation uses Affiliate Portal env today.
 * Search / product details / coupons are stubs for future Open API adapters.
 */
export const aliexpressAffiliateProvider: MarketplaceAffiliateProvider = {
  id: "aliexpress",
  displayName: "AliExpress",

  async search(_query: AffiliateSearchQuery): Promise<AffiliateSearchResult> {
    // Future: Open API product.query adapter
    return { items: [], total: 0 };
  },

  async getProductDetails(
    _query: AffiliateProductDetailsQuery,
  ): Promise<AffiliateProductDetails | null> {
    // Future: Open API productdetail.get adapter
    return null;
  },

  async generateAffiliateLink(
    input: GenerateAffiliateLinkInput,
  ): Promise<AffiliateLinkResult> {
    const promotion = input.promotionLink?.trim();
    if (promotion) {
      return {
        url: promotion,
        source: "promotion_link",
        providerId: "aliexpress",
        trackingApplied: true,
      };
    }

    const config = validateAliExpressPortalEnv();
    return buildAliExpressPortalAffiliateLink(input.productUrl, config);
  },

  async generateAffiliateLinks(
    inputs: GenerateAffiliateLinkInput[],
  ): Promise<Map<string, AffiliateLinkResult>> {
    const config = validateAliExpressPortalEnv();
    const results = new Map<string, AffiliateLinkResult>();
    for (const input of inputs) {
      const promotion = input.promotionLink?.trim();
      if (promotion) {
        results.set(input.productUrl, {
          url: promotion,
          source: "promotion_link",
          providerId: "aliexpress",
          trackingApplied: true,
        });
        continue;
      }
      results.set(
        input.productUrl,
        buildAliExpressPortalAffiliateLink(input.productUrl, config),
      );
    }
    return results;
  },

  async listCoupons(_query?: AffiliateCouponQuery): Promise<AffiliateCoupon[]> {
    // Future: Coupon API adapter
    return [];
  },
};
