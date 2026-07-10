export {
  getAffiliateSettings,
  getAffiliateSetting,
  generateProductAffiliateUrl,
  recordAffiliateClick,
  updateAffiliateSettings,
} from "./settings";
export type { AffiliateSetting, AffiliateClickInput } from "./settings";
export { getAffiliateAnalytics } from "./analytics";
export type { AffiliateAnalytics } from "./analytics";
export { getProfitAnalytics } from "./profit";
export type { ProfitAnalytics } from "./profit";

/** Central portal affiliate link service (AliExpress today). */
export {
  affiliateLinkService,
  AffiliateLinkService,
  validateAliExpressPortalEnv,
  getAliExpressPortalConfig,
} from "@/lib/affiliate/providers";
