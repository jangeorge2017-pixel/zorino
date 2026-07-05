import { createEbayClientFromEnv } from "@/lib/integrations/ebay";
import { isEbayConfigured } from "@/lib/integrations/ebay/config";
import { normalizeEbayRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";

export const ebaySearchConnector: SearchConnector = {
  id: "ebay",
  name: "eBay",

  async isAvailable() {
    return isEbayConfigured();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    if (!isEbayConfigured()) return [];

    const client = createEbayClientFromEnv();
    if (!client) return [];

    const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
    const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
    const countryCode = options?.countryCode ?? "US";

    const maxPagesNeeded = Math.ceil(targetFetch / pageSize);
    const pagesToScan = Math.min(maxPages, maxPagesNeeded);

    const batch = await client.searchByKeyword(trimmed, {
      pageSize,
      maxPages: pagesToScan,
      countryCode,
    });

    const listings: RawProviderListing[] = [];
    const seenIds = new Set<string>();

    for (const raw of batch) {
      const id = raw.itemId ?? "";
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const normalized = normalizeEbayRaw(raw);
      if (normalized) listings.push(normalized);
    }

    return listings;
  },
};
