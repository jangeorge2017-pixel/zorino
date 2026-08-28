import {
  createAmazonClientFromEnv,
  isAmazonConfigured,
} from "@/lib/integrations/amazon";
import { normalizeAmazonRaw } from "@/lib/search/normalization";
import { normalizeOxylabsAmazonRaw } from "@/lib/search/normalization";
import { normalizeOxylabsAmazonSearchResults } from "@/lib/search/normalization";
import {
  fetchOxylabsAmazonProduct,
  fetchOxylabsAmazonSearch,
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

    // Additive Oxylabs source: when configured, fetch real Amazon product data
    // for BOTH product (ASIN) lookups and normal keyword searches, across the
    // US (com) and UK (co.uk) storefronts. Results feed the same normalization
    // as the existing Amazon connector. This does NOT replace the existing
    // Creators/seed path below — it only augments it when Oxylabs is configured.
    if (isOxylabsConfigured()) {
      try {
        if (looksLikeAsin(trimmed)) {
          const [us, uk] = await Promise.all([
            fetchOxylabsAmazonProduct(trimmed, "amazon-storefront"),
            fetchOxylabsAmazonProduct(trimmed, "amazon-co-uk"),
          ]);

          const oListing: RawProviderListing[] = [];
          if (us) {
            const item = normalizeOxylabsAmazonRaw(us, "amazon-storefront");
            if (item) oListing.push(item);
          }
          if (uk) {
            const item = normalizeOxylabsAmazonRaw(uk, "amazon-co-uk");
            if (item) oListing.push(item);
          }
          if (oListing.length > 0) return oListing;
        } else {
          const [us, uk] = await Promise.all([
            fetchOxylabsAmazonSearch(trimmed, "amazon-storefront"),
            fetchOxylabsAmazonSearch(trimmed, "amazon-co-uk"),
          ]);

          const oListing: RawProviderListing[] = [
            ...normalizeOxylabsAmazonSearchResults(us, "amazon-storefront"),
            ...normalizeOxylabsAmazonSearchResults(uk, "amazon-co-uk"),
          ];
          if (oListing.length > 0) return oListing;
        }
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
