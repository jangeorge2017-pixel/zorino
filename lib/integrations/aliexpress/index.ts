export { AliExpressAffiliateClient } from "@/lib/integrations/aliexpress/client";
export {
  ALIEXPRESS_API_URL,
  ALIEXPRESS_CREDENTIAL_KEYS,
  ALIEXPRESS_PROVIDER_ID,
  getAliExpressCredentialStatus,
  getAliExpressCredentials,
  isAliExpressConfigured,
} from "@/lib/integrations/aliexpress/config";
export {
  signAliExpressParams,
  buildSignedParams,
  formatAliExpressTimestamp,
} from "@/lib/integrations/aliexpress/auth";
export { logAliExpress, maskSecret } from "@/lib/integrations/aliexpress/logger";
export {
  queryTokens,
  scoreSearchRelevance,
  scoreTitleRelevance,
  isRelevantTitle,
  filterRelevantProducts,
  rankBySearchRelevance,
  MARKETPLACE_SEARCH_DEFAULTS,
} from "@/lib/integrations/aliexpress/relevance";
export {
  searchAliExpressOpenApi,
  getAliExpressOpenApiProduct,
  generateAliExpressOpenApiAffiliateLink,
  attachOpenApiAffiliateLinks,
} from "@/lib/integrations/aliexpress/open-api-service";
export {
  mapAliExpressRawToOpenApiProduct,
  formatAliExpressShipping,
  formatAliExpressStoreName,
} from "@/lib/integrations/aliexpress/map-product";
export type { AliExpressOpenApiProduct } from "@/lib/integrations/aliexpress/open-api-types";
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
