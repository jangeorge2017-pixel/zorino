export { EbayAffiliateClient } from "@/lib/integrations/ebay/client";
export {
  EBAY_BROWSE_API,
  EBAY_CREDENTIAL_KEYS,
  EBAY_PROVIDER_ID,
  EBAY_TOKEN_URL,
  getEbayCredentialStatus,
  getEbayCredentials,
  isEbayConfigured,
} from "@/lib/integrations/ebay/config";
export {
  buildEbayAffiliateContext,
  ebayMarketplaceId,
  getEbayAccessToken,
} from "@/lib/integrations/ebay/auth";
export {
  filterRelevantEbayProducts,
  rankBySearchRelevance,
  scoreSearchRelevance,
  queryTokens,
  isRelevantTitle,
} from "@/lib/integrations/ebay/relevance";
export type {
  EbayCredentials,
  EbayCredentialStatus,
  EbayValidationResult,
  EbayRawProduct,
  EbaySyncJobKind,
  ImportEventLevel,
  ImportEventLog,
} from "@/lib/integrations/ebay/types";

export {
  EBAY_EPN_CREDENTIAL_KEYS,
  EBAY_EPN_CREDENTIAL_SLOTS,
  EBAY_EPN_ADMIN_SAVE_KEYS,
  getEbayEpnPrepStatus,
} from "@/lib/integrations/ebay/epn";
export type { EbayEpnPrepStatus, EbayEpnCredentialSlot } from "@/lib/integrations/ebay/epn";

import { EbayAffiliateClient } from "@/lib/integrations/ebay/client";
import { getEbayCredentials } from "@/lib/integrations/ebay/config";

export function createEbayClientFromEnv(): EbayAffiliateClient | null {
  const creds = getEbayCredentials();
  if (!creds) return null;
  return new EbayAffiliateClient(creds.campaignId);
}
