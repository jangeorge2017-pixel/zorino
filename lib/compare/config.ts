/** Supported marketplace integrations for price comparison. */
export const COMPARISON_STORES = [
  "amazon",
  "aliexpress",
  "ebay",
  "walmart",
  "temu",
] as const;

export type ComparisonStoreSlug = (typeof COMPARISON_STORES)[number];

export const PRICE_SYNC_INTERVAL_MINUTES = 240;

export const COMPARISON_TAG = "price-comparison";
