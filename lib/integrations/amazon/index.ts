export { AmazonPaApiClient, createAmazonClientFromEnv, mapAmazonPaApiItem } from "@/lib/integrations/amazon/client";
export type { AmazonRawProduct } from "@/lib/integrations/amazon/client";
export {
  AMAZON_CREDENTIAL_KEYS,
  AMAZON_DEFAULT_ASSOCIATE_TAG,
  AMAZON_PROVIDER_ID,
  amazonPaApiHost,
  getAmazonAssociateTag,
  getAmazonCredentialStatus,
  getAmazonCredentials,
  isAmazonConfigured,
} from "@/lib/integrations/amazon/config";
export type { AmazonCredentialStatus } from "@/lib/integrations/amazon/config";
export type { AmazonCredentials, AmazonValidationResult } from "@/lib/integrations/amazon/types";
