/**
 * Sync configuration — mock mode until partner APIs are connected.
 */

export const SYNC_DEFAULT_INTERVAL_MINUTES = 360;
export const SYNC_PRICE_INTERVAL_MINUTES = 60;
export const SYNC_DEALS_INTERVAL_MINUTES = 120;

/** Default job schedules (used by scheduler + cron). */
export const DEFAULT_SYNC_SCHEDULES = [
  { jobType: "full" as const, intervalMinutes: SYNC_DEFAULT_INTERVAL_MINUTES },
  { jobType: "prices" as const, intervalMinutes: SYNC_PRICE_INTERVAL_MINUTES },
  { jobType: "deals" as const, intervalMinutes: SYNC_DEALS_INTERVAL_MINUTES },
] as const;

/** Provider credential env keys for import engine. */
export const PROVIDER_CREDENTIAL_KEYS = {
  amazon: ["AMAZON_PAAPI_ACCESS_KEY", "AMAZON_PAAPI_SECRET_KEY", "AMAZON_ASSOCIATE_TAG"],
  aliexpress: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
  cjdropshipping: ["CJDROPSHIPPING_API_KEY"],
  ebay: ["EBAY_APP_ID", "EBAY_CERT_ID"],
} as const;

/**
 * Use static mock catalog only when Supabase is not configured or SYNC_USE_MOCK=true.
 * Partner API keys control sync connectors, not homepage DB reads.
 */
export function shouldUseMockCatalog(): boolean {
  if (!isSupabaseEnvConfigured()) return true;
  if (process.env.SYNC_USE_MOCK === "true") return true;
  return false;
}

function isSupabaseEnvConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("your-project-ref") || key === "your-anon-key") return false;
  return true;
}

export function hasPartnerApiCredentials(): boolean {
  return Object.values(PROVIDER_CREDENTIAL_KEYS).some((keys) =>
    keys.every((key) => Boolean(process.env[key]?.trim()))
  );
}

export function isProviderConfigured(provider: keyof typeof PROVIDER_CREDENTIAL_KEYS): boolean {
  return PROVIDER_CREDENTIAL_KEYS[provider].every((key) => Boolean(process.env[key]?.trim()));
}

export function getConnectorForStore(integrationType: string): "mock" | string {
  if (shouldUseMockCatalog()) return "mock";

  if (integrationType in PROVIDER_CREDENTIAL_KEYS) {
    return isProviderConfigured(integrationType as keyof typeof PROVIDER_CREDENTIAL_KEYS)
      ? integrationType
      : "mock";
  }

  if (!hasPartnerApiCredentials()) return "mock";
  return integrationType;
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}
