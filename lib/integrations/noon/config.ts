import { getIntegrationCredential } from "@/lib/integration/credentials";

export const NOON_PROVIDER_ID = "noon" as const;

export const NOON_CREDENTIAL_KEYS = {
  API_KEY: "NOON_API_KEY",
  SELLER_ID: "NOON_SELLER_ID",
  COUNTRY: "NOON_COUNTRY",
} as const;

export const NOON_DEFAULT_COUNTRY = "AE";

export type NoonCredentialStatus = {
  configured: boolean;
  hasApiKey: boolean;
  hasSellerId: boolean;
  hasCountry: boolean;
  source: "env" | "database" | "none";
};

export function getNoonCredentialStatus(): NoonCredentialStatus {
  const apiKey = getIntegrationCredential(NOON_CREDENTIAL_KEYS.API_KEY);
  const sellerId = getIntegrationCredential(NOON_CREDENTIAL_KEYS.SELLER_ID);
  const country = getIntegrationCredential(NOON_CREDENTIAL_KEYS.COUNTRY);
  const configured = Boolean(apiKey);
  const source = configured
    ? process.env[NOON_CREDENTIAL_KEYS.API_KEY]?.trim()
      ? "env"
      : "database"
    : "none";
  return {
    configured,
    hasApiKey: Boolean(apiKey),
    hasSellerId: Boolean(sellerId),
    hasCountry: Boolean(country),
    source,
  };
}

export function isNoonConfigured(): boolean {
  return getNoonCredentialStatus().configured;
}

/**
 * Noon integration search endpoint — deliberately left unset until a REAL Noon
 * API client contract is confirmed. Setting NOON_API_BASE + NOON_API_ENDPOINT
 * on the deployment turns the client on; without them ingestion reports
 * `no-api-endpoint` and never touches the network. Never fabricates data.
 */
export const NOON_API_BASE = process.env.NOON_API_BASE?.trim() ?? "";
export const NOON_API_ENDPOINT = process.env.NOON_API_ENDPOINT?.trim() ?? "";

export function isNoonEndpointConfigured(): boolean {
  return Boolean(NOON_API_BASE && NOON_API_ENDPOINT);
}

export type NoonConfig = {
  apiKey: string;
  sellerId?: string;
  country: string;
  apiBase: string;
  endpoint: string;
};

export function getNoonConfig(): NoonConfig | null {
  const apiKey = getIntegrationCredential(NOON_CREDENTIAL_KEYS.API_KEY);
  if (!apiKey) return null;
  return {
    apiKey,
    sellerId: getIntegrationCredential(NOON_CREDENTIAL_KEYS.SELLER_ID),
    country:
      getIntegrationCredential(NOON_CREDENTIAL_KEYS.COUNTRY) ?? NOON_DEFAULT_COUNTRY,
    apiBase: NOON_API_BASE,
    endpoint: NOON_API_ENDPOINT,
  };
}