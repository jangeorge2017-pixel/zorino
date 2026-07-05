import { getIntegrationCredential } from "@/lib/integration/credentials";

/** Default Amazon Associates tracking ID for ZORINO production. */
export const AMAZON_DEFAULT_ASSOCIATE_TAG = "zorino-20";

export const AMAZON_CREDENTIAL_KEYS = {
  ACCESS_KEY: "AMAZON_PAAPI_ACCESS_KEY",
  SECRET_KEY: "AMAZON_PAAPI_SECRET_KEY",
  ASSOCIATE_TAG: "AMAZON_ASSOCIATE_TAG",
  MARKETPLACE: "AMAZON_PAAPI_MARKETPLACE",
  REGION: "AMAZON_PAAPI_REGION",
} as const;

export const AMAZON_PROVIDER_ID = "amazon" as const;

export type AmazonCredentialStatus = {
  configured: boolean;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  hasAssociateTag: boolean;
  associateTag: string;
  source: "env" | "database" | "default" | "none";
};

export function getAmazonAssociateTag(): string {
  return (
    getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ASSOCIATE_TAG) ??
    AMAZON_DEFAULT_ASSOCIATE_TAG
  );
}

export function getAmazonCredentialStatus(): AmazonCredentialStatus {
  const accessKey = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ACCESS_KEY);
  const secretKey = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.SECRET_KEY);
  const envTag = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ASSOCIATE_TAG);
  const configured = Boolean(accessKey && secretKey);
  const associateTag = envTag ?? (configured ? AMAZON_DEFAULT_ASSOCIATE_TAG : "");

  let source: AmazonCredentialStatus["source"] = "none";
  if (configured) {
    if (envTag) {
      source = process.env[AMAZON_CREDENTIAL_KEYS.ASSOCIATE_TAG]?.trim() ? "env" : "database";
    } else {
      source = "default";
    }
  }

  return {
    configured,
    hasAccessKey: Boolean(accessKey),
    hasSecretKey: Boolean(secretKey),
    hasAssociateTag: Boolean(associateTag),
    associateTag,
    source,
  };
}

export function getAmazonCredentials(): {
  accessKey: string;
  secretKey: string;
  associateTag: string;
  marketplace: string;
  region: string;
} | null {
  const accessKey = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ACCESS_KEY);
  const secretKey = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.SECRET_KEY);
  if (!accessKey || !secretKey) return null;

  return {
    accessKey,
    secretKey,
    associateTag: getAmazonAssociateTag(),
    marketplace:
      getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.MARKETPLACE) ?? "www.amazon.com",
    region: getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.REGION) ?? "us-east-1",
  };
}

export function isAmazonConfigured(): boolean {
  return getAmazonCredentialStatus().configured;
}

/** Resolve PA-API host from marketplace domain. */
export function amazonPaApiHost(marketplace: string): string {
  const domain = marketplace.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (domain.includes("amazon.co.uk")) return "webservices.amazon.co.uk";
  if (domain.includes("amazon.de")) return "webservices.amazon.de";
  if (domain.includes("amazon.fr")) return "webservices.amazon.fr";
  if (domain.includes("amazon.co.jp")) return "webservices.amazon.co.jp";
  if (domain.includes("amazon.ca")) return "webservices.amazon.ca";
  if (domain.includes("amazon.ae")) return "webservices.amazon.ae";
  if (domain.includes("amazon.sa")) return "webservices.amazon.sa";
  if (domain.includes("amazon.eg")) return "webservices.amazon.eg";
  return "webservices.amazon.com";
}
