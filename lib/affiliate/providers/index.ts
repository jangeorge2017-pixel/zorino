export type {
  AffiliateCoupon,
  AffiliateCouponProvider,
  AffiliateCouponQuery,
  AffiliateLinkProvider,
  AffiliateLinkResult,
  AffiliateLinkSource,
  AffiliateProductDetails,
  AffiliateProductDetailsQuery,
  AffiliateProductProvider,
  AffiliateProviderId,
  AffiliateSearchProvider,
  AffiliateSearchQuery,
  AffiliateSearchResult,
  GenerateAffiliateLinkInput,
  MarketplaceAffiliateProvider,
} from "@/lib/affiliate/providers/types";

export {
  ALIEXPRESS_PORTAL_ENV,
  getAliExpressPortalConfig,
  validateAliExpressPortalEnv,
} from "@/lib/affiliate/providers/aliexpress/portal-config";
export type { AliExpressPortalConfig } from "@/lib/affiliate/providers/aliexpress/portal-config";

export { buildAliExpressPortalAffiliateLink } from "@/lib/affiliate/providers/aliexpress/portal-links";
export { aliexpressAffiliateProvider } from "@/lib/affiliate/providers/aliexpress/provider";
export {
  AffiliateLinkService,
  affiliateLinkService,
} from "@/lib/affiliate/affiliate-link-service";
