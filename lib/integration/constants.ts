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

/** Catalog fetch defaults (homepage sections and comparison engine). */
export const CATALOG_FETCH_DEFAULTS = {
  maxPages: process.env.NODE_ENV === "development" ? 1 : 2,
  pageSize: process.env.NODE_ENV === "development" ? 12 : 24,
} as const;
