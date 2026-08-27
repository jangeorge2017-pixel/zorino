import {
  createAmazonClientFromEnv,
  isAmazonConfigured,
} from "@/lib/integrations/amazon";
import { normalizeAmazonRaw } from "@/lib/search/normalization";
import { normalizeOxylabsAmazonRaw } from "@/lib/search/normalization";
import {
  fetchOxylabsAmazonProduct,
  isOxylabsConfigured,
} from "@/lib/integrations/oxylabs";
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
    // Always available: the store must never disappear when a single
    // data source (Creators API or Oxylabs) is unavailable.
    return true;
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    // Additive Oxylabs source: when configured and the query is a real Amazon
    // ASIN, fetch real product data for Amazon US (com) and UK (co.uk) and feed
    // it through the same normalization as the existing Amazon connector. This
    // does NOT replace the existing Creators/seed path below.
    if (looksLikeAsin(trimmed) && isOxylabsConfigured()) {
      try {
        const [us, uk] = await Promise.all([
          fetchOxylabsAmazonProduct(trimmed, "amazon-storefront"),
          fetchOxylabsAmazonProduct(trimmed, "amazon-co-uk"),
        ]);

        const listings: RawProviderListing[] = [];
        if (us) {
          const item = normalizeOxylabsAmazonRaw(us, "amazon-storefront");
          if (item) listings.push(item);
        }
        if (uk) {
          const item = normalizeOxylabsAmazonRaw(uk, "amazon-co-uk");
          if (item) listings.push(item);
        }
        if (listings.length > 0) return listings;
      } catch {
        // Fall through to the existing source — an Oxylabs failure must never
        // silence the rest of the provider set.
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
