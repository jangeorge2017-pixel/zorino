import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { normalizeAliExpressRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";

async function getClient() {
  await loadAliExpressCredentials();
  if (!isAliExpressConfigured()) return null;
  return createAliExpressClientFromEnv();
}

export const aliExpressSearchConnector: SearchConnector = {
  id: "aliexpress",
  name: "AliExpress",

  async isAvailable() {
    await loadAliExpressCredentials();
    return isAliExpressConfigured();
  },

  async search(query: string, options?: ConnectorSearchOptions): Promise<RawProviderListing[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const client = await getClient();
    if (!client) return [];

    const pageSize = options?.pageSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
    const maxPages = options?.maxPages ?? SEARCH_ENGINE_DEFAULTS.MAX_PAGES_PER_PROVIDER;
    const targetFetch = options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT;
    const minFetch = options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT;
    const currency = options?.currency ?? "USD";

    const listings: RawProviderListing[] = [];
    const seenIds = new Set<string>();

    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      const batch = await client.searchByKeyword(trimmed, {
        pageSize,
        pageNo,
        currency,
      });
      if (batch.length === 0) break;

      for (const raw of batch) {
        const id = raw.product_id != null ? String(raw.product_id) : "";
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const normalized = normalizeAliExpressRaw(raw);
        if (normalized) listings.push(normalized);
      }

      if (listings.length >= targetFetch) break;
      if (listings.length >= minFetch && batch.length < pageSize) break;
      if (batch.length < pageSize) break;
    }

    return listings;
  },
};
