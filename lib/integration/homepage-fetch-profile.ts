/**
 * Homepage live-fetch sizing — keeps marketplace calls shallow enough for fast
 * dev refreshes while still filling every visible carousel/section in production.
 */
const isDev = process.env.NODE_ENV === "development";

/** Skip live marketplace fan-out in dev unless explicitly enabled. */
export const HOMEPAGE_LIVE_FETCH_ENABLED =
  process.env.HOMEPAGE_LIVE_FETCH === "1" || !isDev;

/** Merged catalog depth (per provider) for homepage sections. */
export const HOMEPAGE_CATALOG_FETCH = {
  maxPages: isDev ? 1 : 2,
  pageSize: isDev ? 12 : 24,
  /** Keywords per provider — one in dev to avoid serial API waterfalls. */
  maxKeywords: isDev ? 1 : 2,
} as const;

/** Popular-search chips — single lightweight browse, not global search. */
export const HOMEPAGE_POPULAR_SEARCH_FETCH = {
  keyword: "electronics",
  maxPages: 1,
  pageSize: isDev ? 6 : 12,
  limit: 6,
} as const;
