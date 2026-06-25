/** Trending rankings refresh interval (4 hours). */
export const TRENDING_REFRESH_INTERVAL_MINUTES = 240;

/** Days of engagement data used when computing rankings. */
export const TRENDING_LOOKBACK_DAYS = 7;

export const DEFAULT_TRENDING_COUNTRY = "US";

export const DEFAULT_TRENDING_LIMIT = 8;

export const TRENDING_TAG = "trending-products";

/** Cache homepage trending data for 4 hours (refreshed by cron). */
export const TRENDING_REVALIDATE_SECONDS = TRENDING_REFRESH_INTERVAL_MINUTES * 60;

/** Weights for ranking by real user engagement. */
export const TRENDING_ENGAGEMENT_WEIGHTS = {
  views: 1,
  clicks: 3,
  purchases: 10,
} as const;
