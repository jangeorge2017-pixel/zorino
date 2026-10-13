import { getIntegrationCredential } from "@/lib/integration/credentials";

export const JUMIA_PROVIDER_ID = "jumia" as const;

export const JUMIA_CREDENTIAL_KEYS = {
  API_KEY: "JUMIA_API_KEY",
  AFFILIATE_ID: "JUMIA_AFFILIATE_ID",
  COUNTRY: "JUMIA_MARKETPLACE_COUNTRY",
} as const;

export const JUMIA_DEFAULT_COUNTRY = "EG";

export type JumiaCredentialStatus = {
  configured: boolean;
  hasApiKey: boolean;
  hasAffiliateId: boolean;
  hasCountry: boolean;
  source: "env" | "database" | "none";
};

export function getJumiaCredentialStatus(): JumiaCredentialStatus {
  const apiKey = getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.API_KEY);
  const affiliateId = getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.AFFILIATE_ID);
  const country = getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.COUNTRY);
  const configured = Boolean(apiKey && affiliateId);
  const source = configured
    ? process.env[JUMIA_CREDENTIAL_KEYS.API_KEY]?.trim()
      ? "env"
      : "database"
    : "none";
  return {
    configured,
    hasApiKey: Boolean(apiKey),
    hasAffiliateId: Boolean(affiliateId),
    hasCountry: Boolean(country),
    source,
  };
}

export function isJumiaConfigured(): boolean {
  return getJumiaCredentialStatus().configured;
}

/**
 * Jumia integration search endpoint — deliberately left unset until a REAL
 * Jumia API client contract is confirmed. Setting JUMIA_API_BASE +
 * JUMIA_API_ENDPOINT on the deployment turns the client on; without them
 * ingestion reports `no-api-endpoint` and never touches the network. Never
 * fabricates data.
 */
export const JUMIA_API_BASE = process.env.JUMIA_API_BASE?.trim() ?? "";
export const JUMIA_API_ENDPOINT = process.env.JUMIA_API_ENDPOINT?.trim() ?? "";

export function isJumiaEndpointConfigured(): boolean {
  return Boolean(JUMIA_API_BASE && JUMIA_API_ENDPOINT);
}

export type JumiaConfig = {
  apiKey: string;
  affiliateId: string;
  country: string;
  apiBase: string;
  endpoint: string;
};

export function getJumiaConfig(): JumiaConfig | null {
  const apiKey = getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.API_KEY);
  const affiliateId = getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.AFFILIATE_ID);
  if (!apiKey || !affiliateId) return null;
  return {
    apiKey,
    affiliateId,
    country:
      getIntegrationCredential(JUMIA_CREDENTIAL_KEYS.COUNTRY) ?? JUMIA_DEFAULT_COUNTRY,
    apiBase: JUMIA_API_BASE,
    endpoint: JUMIA_API_ENDPOINT,
  };
}