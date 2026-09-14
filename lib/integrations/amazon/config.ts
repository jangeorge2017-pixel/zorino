import { getIntegrationCredential } from "@/lib/integration/credentials";

/** Default Amazon Associates tracking ID for ZORINO production. */
export const AMAZON_DEFAULT_ASSOCIATE_TAG = "zorino-20";

/**
 * ≡≡≡ PHASE 5 ARCHITECTURAL DECISION (enforced) ≡≡≡
 *
 * AMAZON AND AMAZON-EG ARE INDIRECT for the current production architecture.
 *
 * The ONLY approved Amazon acquisition path is:
 *   affiliate/network URL → host-guarded ASIN extraction → indirect ingestion
 *   → RawOffer → validate → canonicalize.
 *
 * The LATENT DIRECT Amazon path (query → Amazon Creators API / Oxylabs) is
 * deliberately isolated and deferred. It must NEVER become active merely
 * because credentials are later added to Vercel. Activating it requires an
 * EXPLICIT opt-in: set AMAZON_DIRECT_ENABLE=1 in production env (first
 * revisiting this decision) — a future credential addition alone cannot
 * switch the normal Phase 5 indirect pipeline to the direct path.
 */
export const AMAZON_DIRECT_ENABLE_KEY = "AMAZON_DIRECT_ENABLE" as const;

/** Explicit architecture opt-in gate for the latent DIRECT Amazon acquisition path. */
export function isAmazonDirectEnabled(): boolean {
  const value = getIntegrationCredential(AMAZON_DIRECT_ENABLE_KEY)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export const AMAZON_CREDENTIAL_KEYS = {
  CLIENT_ID: "AMAZON_CREATORS_CLIENT_ID",
  CLIENT_SECRET: "AMAZON_CREATORS_CLIENT_SECRET",
  ASSOCIATE_TAG: "AMAZON_ASSOCIATE_TAG",
  MARKETPLACE: "AMAZON_CREATORS_MARKETPLACE",
  VERSION: "AMAZON_CREATORS_VERSION",
} as const;

export const AMAZON_PROVIDER_ID = "amazon" as const;

export type AmazonCredentialStatus = {
  configured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasAssociateTag: boolean;
  associateTag: string;
  source: "env" | "database" | "default" | "none";
};

export function getAmazonAssociateTag(): string {
  const tag = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ASSOCIATE_TAG);
  if (tag && tag.toLowerCase() !== "placeholder") return tag;
  return AMAZON_DEFAULT_ASSOCIATE_TAG;
}

export function getAmazonCredentialStatus(): AmazonCredentialStatus {
  const clientId = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.CLIENT_ID);
  const clientSecret = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.CLIENT_SECRET);
  const envTag = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.ASSOCIATE_TAG);
  const configured = Boolean(clientId && clientSecret);
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
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasAssociateTag: Boolean(associateTag),
    associateTag,
    source,
  };
}

export function getAmazonCredentials(): {
  clientId: string;
  clientSecret: string;
  associateTag: string;
  marketplace: string;
  version: string;
} | null {
  const clientId = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.CLIENT_ID);
  const clientSecret = getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    associateTag: getAmazonAssociateTag(),
    marketplace:
      getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.MARKETPLACE) ?? "www.amazon.eg",
    version: getIntegrationCredential(AMAZON_CREDENTIAL_KEYS.VERSION) ?? "3.2",
  };
}

export function isAmazonConfigured(): boolean {
  const creds = getAmazonCredentials();
  return Boolean(creds);
}
