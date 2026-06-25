export { AliExpressAffiliateClient } from "@/lib/integrations/aliexpress/client";
export {
  ALIEXPRESS_API_URL,
  ALIEXPRESS_CREDENTIAL_KEYS,
  ALIEXPRESS_PROVIDER_ID,
  getAliExpressCredentialStatus,
  getAliExpressCredentials,
  isAliExpressConfigured,
} from "@/lib/integrations/aliexpress/config";
export { signAliExpressParams, buildSignedParams } from "@/lib/integrations/aliexpress/auth";
export type {
  AliExpressCredentials,
  AliExpressCredentialStatus,
  AliExpressValidationResult,
  AliExpressRawProduct,
  AliExpressSyncJobKind,
  ImportEventLevel,
  ImportEventLog,
} from "@/lib/integrations/aliexpress/types";

import { AliExpressAffiliateClient } from "@/lib/integrations/aliexpress/client";
import { getAliExpressCredentials } from "@/lib/integrations/aliexpress/config";

export function createAliExpressClientFromEnv(): AliExpressAffiliateClient | null {
  const creds = getAliExpressCredentials();
  if (!creds) return null;
  return new AliExpressAffiliateClient(creds.appKey, creds.appSecret, creds.trackingId);
}
