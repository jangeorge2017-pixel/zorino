export { AmazonPaApiClient, createAmazonClientFromEnv, mapAmazonCreatorsItem } from "@/lib/integrations/amazon/client";
export type { AmazonRawProduct } from "@/lib/integrations/amazon/client";
export {
  AMAZON_CREDENTIAL_KEYS,
  AMAZON_DEFAULT_ASSOCIATE_TAG,
  AMAZON_DIRECT_ENABLE_KEY,
  AMAZON_PROVIDER_ID,
  getAmazonAssociateTag,
  getAmazonCredentialStatus,
  getAmazonCredentials,
  isAmazonConfigured,
  isAmazonDirectEnabled,
} from "@/lib/integrations/amazon/config";
export type { AmazonCredentialStatus } from "@/lib/integrations/amazon/config";
export type { AmazonCredentials, AmazonValidationResult } from "@/lib/integrations/amazon/types";
