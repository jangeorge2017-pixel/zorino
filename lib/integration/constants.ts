/** Production marketplace providers enabled for live catalog + search integration. */
export const PRODUCTION_PROVIDER_IDS = [
  "aliexpress",
  "ebay",
  "amazon",
  "walmart",
  "bestbuy",
  "temu",
  "noon",
  "jumia",
] as const;

export type ProductionProviderId = (typeof PRODUCTION_PROVIDER_IDS)[number];

export const DEFAULT_INTEGRATION_COUNTRY = "US";
export const DEFAULT_INTEGRATION_CURRENCY = "USD";

/** Deep catalog fetch defaults (homepage sections). */
export const CATALOG_FETCH_DEFAULTS = {
  maxPages: 8,
  pageSize: 50,
} as const;
