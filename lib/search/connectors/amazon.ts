import { createAmazonClientFromEnv, isAmazonConfigured, isAmazonDirectEnabled } from "@/lib/integrations/amazon";
import { normalizeAmazonRaw } from "@/lib/search/normalization";
import { normalizeAmazonScraperRaw } from "@/lib/search/normalization";
import { normalizeAmazonScraperSearchResults } from "@/lib/search/normalization";
import {
  fetchAmazonProductScraper,
  fetchAmazonSearchScraper,
  isAmazonScraperAvailable,
} from "@/lib/integrations/amazon-scraper";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import { loadAmazonCredentials } from "@/services/amazon/credentials";

/** PA-API max: 10 pages × 10 items = 100 listings per query. */
const AMAZON_MAX_PAGES = 10;
const AMAZON_PAGE_SIZE = 10;

/** Rough Amazon ASIN shape (10-char alphanumeric, at least one letter). */
function looksLikeAsin(query: string): boolean {
  const t = query.trim();
  return /^[A-Z0-9]{6,12}$/.test(t) && /[A-Z]/.test(t);
}

export const amazonSearchConnector: SearchConnector = {
  id: "amazon",
  name: "Amazon",

  async isAvailable() {
    // A REAL Amazon data source (Creators API credentials OR the local
    // open-source storefront scraper, which needs no keys) makes the store
    // available. Without either there is no genuine Amazon product data, so
    // the connector must not report as operational — it would run on every
    // fan-out, burn the provider timeout budget, and get recorded as
    // "available, fetched 0".
    //
    // Phase 5 decision (AMAZON IS INDIRECT): the LATENT DIRECT path
    // (query → Creators API / scraper) must NOT activate merely because
    // credentials are later added. It is additionally gated behind the
    // explicit AMAZON_DIRECT_ENABLE=1 architecture opt-in. The approved
    // indirect path (affiliate URL → ASIN → ingestion) does not go through
    // this connector.
    //
    // Phase 6 (current): Oxylabs subscription retired (401). The local
    // storefront scraper (fetchAmazonSearchScraper) is the production source —
    // additive, no credentials required.
    return isAmazonDirectEnabled() && (isAmazonConfigured() || isAmazonScraperAvailable());
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Additive local scraper source: real Amazon storefront keyword search
    // across the US (com) and UK (co.uk) storefronts. No API keys needed.
    try {
      const [us, uk] = await Promise.all([
        fetchAmazonSearchScraper(trimmed, "amazon-storefront"),
        fetchAmazonSearchScraper(trimmed, "amazon-co-uk"),
      ]);

      const sListing: RawProviderListing[] = [
        ...normalizeAmazonScraperSearchResults(us, "amazon-storefront"),
        ...normalizeAmazonScraperSearchResults(uk, "amazon-co-uk"),
      ];
      if (sListing.length > 0) return sListing;
    } catch {
      // Fall through to the existing source — a scraper failure must never
      // silence the rest of the provider set.
    }

    // ASIN lookup fallback via the local scraper product page fetch.
    if (looksLikeAsin(trimmed)) {
      try {
        const [us, uk] = await Promise.all([
          fetchAmazonProductScraper(trimmed, "amazon-storefront"),
          fetchAmazonProductScraper(trimmed, "amazon-co-uk"),
        ]);
        const pListing: RawProviderListing[] = [];
        if (us) {
          const item = normalizeAmazonScraperRaw(us, "amazon-storefront");
          if (item) pListing.push(item);
        }
        if (uk) {
          const item = normalizeAmazonScraperRaw(uk, "amazon-co-uk");
          if (item) pListing.push(item);
        }
        if (pListing.length > 0) return pListing;
      } catch {
        // Fall through below.
      }
    }

    // Existing source: Amazon Creators API keyword search.
    try {
      await loadAmazonCredentials();
      if (!isAmazonConfigured()) return [];

      const client = createAmazonClientFromEnv();
      if (!client) return [];

      const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
      const maxPages = Math.min(
        options?.maxPages ?? AMAZON_MAX_PAGES,
        AMAZON_MAX_PAGES,
        Math.ceil(targetFetch / AMAZON_PAGE_SIZE)
      );

      const batch = await client.searchByKeyword(trimmed, {
        itemCount: AMAZON_PAGE_SIZE,
        maxPages,
      });

      return batch
        .map((raw) => normalizeAmazonRaw(raw))
        .filter((item): item is RawProviderListing => item !== null);
    } catch {
      return [];
    }
  },
};