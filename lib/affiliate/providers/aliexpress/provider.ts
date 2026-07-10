import { buildAliExpressPortalAffiliateLink } from "@/lib/affiliate/providers/aliexpress/portal-links";
import { validateAliExpressPortalEnv } from "@/lib/affiliate/providers/aliexpress/portal-config";
import {
  getAliExpressOpenApiProduct,
  searchAliExpressOpenApi,
  generateAliExpressOpenApiAffiliateLink,
} from "@/lib/integrations/aliexpress/open-api-service";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
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
 * Search / product details / affiliate links use Open Platform when configured.
 * Portal tracking remains the fallback for link generation.
 */
export const aliexpressAffiliateProvider: MarketplaceAffiliateProvider = {
  id: "aliexpress",
  displayName: "AliExpress",

  async search(query: AffiliateSearchQuery): Promise<AffiliateSearchResult> {
    await loadAliExpressCredentials();
    if (!isAliExpressConfigured()) {
      return { items: [], total: 0 };
    }

    const items = await searchAliExpressOpenApi(query.keywords, {
      limit: query.pageSize ?? 24,
      pageNo: query.page ?? 1,
      pageSize: query.pageSize ?? 24,
      currency: query.currency ?? "USD",
    });

    return { items, total: items.length };
  },

  async getProductDetails(
    query: AffiliateProductDetailsQuery,
  ): Promise<AffiliateProductDetails | null> {
    await loadAliExpressCredentials();
    if (!isAliExpressConfigured()) return null;

    const product = await getAliExpressOpenApiProduct(
      query.productId,
      query.currency ?? "USD",
    );
    if (!product) return null;

    return {
      productId: product.productId,
      title: product.title,
      productUrl: product.affiliateUrl || product.productUrl,
      raw: product,
    };
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

    await loadAliExpressCredentials();
    if (isAliExpressConfigured()) {
      const openApiUrl = await generateAliExpressOpenApiAffiliateLink(input.productUrl);
      if (openApiUrl) {
        return {
          url: openApiUrl,
          source: "open_api",
          providerId: "aliexpress",
          trackingApplied: true,
        };
      }
    }

    const config = validateAliExpressPortalEnv();
    return buildAliExpressPortalAffiliateLink(input.productUrl, config);
  },

  async generateAffiliateLinks(
    inputs: GenerateAffiliateLinkInput[],
  ): Promise<Map<string, AffiliateLinkResult>> {
    const results = new Map<string, AffiliateLinkResult>();
    for (const input of inputs) {
      results.set(input.productUrl, await this.generateAffiliateLink(input));
    }
    return results;
  },

  async listCoupons(_query?: AffiliateCouponQuery): Promise<AffiliateCoupon[]> {
    return [];
  },
};
