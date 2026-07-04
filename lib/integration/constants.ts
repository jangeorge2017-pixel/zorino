/** Production marketplace providers enabled for live catalog integration. */
export const PRODUCTION_PROVIDER_IDS = ["aliexpress"] as const;

export type ProductionProviderId = (typeof PRODUCTION_PROVIDER_IDS)[number];

export const DEFAULT_INTEGRATION_COUNTRY = "US";
export const DEFAULT_INTEGRATION_CURRENCY = "USD";
