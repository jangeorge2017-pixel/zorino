import type { AdmitadFeedConfig } from "./types";

/**
 * Registered Admitad product feeds.
 * To add a new feed: append an entry with a unique slug, display name, and feed URL.
 * Feed URLs are obtained from the Admitad dashboard → Product Feeds section.
 */
export const ADMITAD_FEEDS: AdmitadFeedConfig[] = [
  {
    name: "Alibaba",
    slug: "alibaba-admitad",
    feedUrl:
      "https://export.admitad.com/en/webmaster/websites/2986312/products/export_adv_products/?user=george_wahbaae6f3&code=uytgka46ma&format=xml&currency=&feed_id=23774&last_import=",
  },
];

export const ADMITAD_PROVIDER_ID = "admitad" as const;

/** How long parsed feed products stay in memory (ms). */
export const FEED_CACHE_TTL_MS = 30 * 60 * 1000;
