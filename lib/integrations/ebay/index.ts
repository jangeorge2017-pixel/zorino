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
export type {
  EbayCredentials,
  EbayCredentialStatus,
  EbayValidationResult,
  EbayRawProduct,
  EbaySyncJobKind,
  ImportEventLevel,
  ImportEventLog,
} from "@/lib/integrations/ebay/types";

import { EbayAffiliateClient } from "@/lib/integrations/ebay/client";
import { getEbayCredentials } from "@/lib/integrations/ebay/config";

export function createEbayClientFromEnv(): EbayAffiliateClient | null {
  const creds = getEbayCredentials();
  if (!creds) return null;
  return new EbayAffiliateClient(creds.campaignId);
}
