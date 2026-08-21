import type { AdmitadFeedConfig } from "./types";

/**
 * Registered Admitad product feeds.
 *
 * Feed URL is read exclusively from the ADMITAD_FEED_URL environment variable.
 * No hardcoded fallback — if the variable is missing, the feed is disabled.
 *
 * Set ADMITAD_FEED_URL in Vercel Production Environment Variables.
 */
const feedUrl = process.env.ADMITAD_FEED_URL?.trim() || "";

export const ADMITAD_FEEDS: AdmitadFeedConfig[] = feedUrl
  ? [
      {
        name: "Alibaba",
        slug: "alibaba-admitad",
        feedUrl,
      },
    ]
  : [];

export const ADMITAD_PROVIDER_ID = "admitad" as const;

/** How long parsed feed products stay in memory (ms). */
export const FEED_CACHE_TTL_MS = 30 * 60 * 1000;
