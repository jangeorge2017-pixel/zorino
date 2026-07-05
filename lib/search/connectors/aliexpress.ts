import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress/config";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";
import { normalizeAliExpressRaw } from "@/lib/search/normalization";
import type { RawProviderListing } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ConnectorSearchOptions, SearchConnector } from "@/lib/search/connectors/types";

const PARALLEL_PAGE_BATCH = 4;

async function getClient() {
  await loadAliExpressCredentials();
  if (!isAliExpressConfigured()) return null;
  return createAliExpressClientFromEnv();
}

function ingestBatch(
  batch: Parameters<typeof normalizeAliExpressRaw>[0][],
  listings: RawProviderListing[],
  seenIds: Set<string>
) {
  for (const raw of batch) {
    const id = raw.product_id != null ? String(raw.product_id) : "";
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);
    const normalized = normalizeAliExpressRaw(raw);
    if (normalized) listings.push(normalized);
  }
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
    let exhausted = false;

    for (let startPage = 1; startPage <= maxPages && !exhausted; startPage += PARALLEL_PAGE_BATCH) {
      const pageNumbers = Array.from(
        { length: PARALLEL_PAGE_BATCH },
        (_, index) => startPage + index
      ).filter((pageNo) => pageNo <= maxPages);

      const batches = await Promise.all(
        pageNumbers.map((pageNo) =>
          client.searchByKeyword(trimmed, { pageSize, pageNo, currency })
        )
      );

      let shortestBatch = pageSize;
      for (const batch of batches) {
        if (batch.length === 0) {
          exhausted = true;
          continue;
        }
        shortestBatch = Math.min(shortestBatch, batch.length);
        ingestBatch(batch, listings, seenIds);
      }

      if (listings.length >= targetFetch) break;
      if (shortestBatch < pageSize) break;
      if (listings.length >= minFetch && exhausted) break;
    }

    return listings;
  },
};
