import type { AdmitadFeedConfig } from "./types";

/**
 * Registered Admitad product feeds.
 *
 * Feed URL priority:
 *   1. ADMITAD_FEED_URL env var (when overriding via .env)
 *   2. Hardcoded default below
 *
 * Additional feeds are discovered dynamically via the Admitad Publisher API
 * (see ingestion.ts).
 */
const DEFAULT_FEED_URL =
  "https://export.admitad.com/en/webmaster/websites/2986312/products/export_adv_products/?user=george_wahbaae6f3&code=uytgka46ma&format=xml&currency=&feed_id=17675&last_import=";

export const ADMITAD_FEEDS: AdmitadFeedConfig[] = [
  {
    name: "Alibaba",
    slug: "alibaba-admitad",
    feedUrl: process.env.ADMITAD_FEED_URL || DEFAULT_FEED_URL,
  },
];

export const ADMITAD_PROVIDER_ID = "admitad" as const;

/** How long parsed feed products stay in memory (ms). */
export const FEED_CACHE_TTL_MS = 30 * 60 * 1000;
