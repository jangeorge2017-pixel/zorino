import type { AliExpressCredentials, AliExpressCredentialStatus } from "@/lib/integrations/aliexpress/types";
import { getIntegrationCredential } from "@/lib/integration/credentials";

export const ALIEXPRESS_CREDENTIAL_KEYS = {
  APP_KEY: "ALIEXPRESS_APP_KEY",
  APP_SECRET: "ALIEXPRESS_APP_SECRET",
  TRACKING_ID: "ALIEXPRESS_TRACKING_ID",
} as const;

export const ALIEXPRESS_PROVIDER_ID = "aliexpress" as const;

export const ALIEXPRESS_API_URL = "https://api-sg.aliexpress.com/sync";

export function getAliExpressCredentialStatus(): AliExpressCredentialStatus {
  const appKey = getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.APP_KEY);
  const appSecret = getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.APP_SECRET);
  const trackingId = getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.TRACKING_ID);

  const hasAppKey = Boolean(appKey);
  const hasAppSecret = Boolean(appSecret);
  const configured = hasAppKey && hasAppSecret;

  let source: AliExpressCredentialStatus["source"] = "none";
  if (configured) {
    source = process.env[ALIEXPRESS_CREDENTIAL_KEYS.APP_KEY]?.trim() ? "env" : "database";
  }

  return {
    configured,
    hasAppKey,
    hasAppSecret,
    hasTrackingId: Boolean(trackingId),
    source,
  };
}

export function getAliExpressCredentials(): AliExpressCredentials | null {
  const appKey = getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.APP_KEY);
  const appSecret = getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.APP_SECRET);
  if (!appKey || !appSecret) return null;

  return {
    appKey,
    appSecret,
    trackingId: getIntegrationCredential(ALIEXPRESS_CREDENTIAL_KEYS.TRACKING_ID),
  };
}

export function isAliExpressConfigured(): boolean {
  return getAliExpressCredentialStatus().configured;
}
