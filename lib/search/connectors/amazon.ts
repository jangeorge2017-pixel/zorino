import {
  createAmazonClientFromEnv,
  isAmazonConfigured,
} from "@/lib/integrations/amazon";
import { normalizeAmazonRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";
import { loadAmazonCredentials } from "@/services/amazon/credentials";

/** PA-API max: 10 pages × 10 items = 100 listings per query. */
const AMAZON_MAX_PAGES = 10;
const AMAZON_PAGE_SIZE = 10;

export const amazonSearchConnector: SearchConnector = {
  id: "amazon",
  name: "Amazon",

  async isAvailable() {
    await loadAmazonCredentials();
    return isAmazonConfigured();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

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

    try {
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
