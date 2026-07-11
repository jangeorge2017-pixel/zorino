import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getActiveSearchConnectors } from "@/lib/search/connectors/registry";
import {
  buildSearchCacheKey,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/search/cache";
import { mergeDuplicateListings } from "@/lib/search/deduplication";
import { rankRawListings, sortUnifiedByRelevance } from "@/lib/search/ranking";
import {
  unifiedToMarketplaceSearchItems,
  unifiedToSearchResultItem,
} from "@/lib/search/price-comparison";
import type { SearchEngineResult, SearchProviderId } from "@/lib/search/types";
import {
  LIVE_SEARCH_PROVIDER_IDS,
  SEARCH_ENGINE_DEFAULTS,
} from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

export type GlobalSearchOptions = {
  limit?: number;
  providers?: SearchProviderId[];
  minFetch?: number;
  targetFetch?: number;
  maxPages?: number;
  skipCache?: boolean;
};

/**
 * ZORINO Global Search Engine
 *
 * Pipeline: Provider Connectors (parallel) → Normalization → Ranking →
 *           Duplicate Detection → Price Comparison → UI mapping
 */
export async function executeGlobalSearch(
  query: string,
  options?: GlobalSearchOptions
): Promise<SearchEngineResult> {
  const trimmed = query.trim();
  const limit = Math.min(
    options?.limit ?? SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT,
    SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT
  );

  if (!trimmed) {
    return {
      products: [],
      totalFetched: 0,
      totalRanked: 0,
      totalUnified: 0,
      providers: [],
      query: "",
    };
  }

  const providerKey = (options?.providers ?? ["all"]).join(",");
  const cacheKey = buildSearchCacheKey(trimmed, limit, providerKey);
  if (!options?.skipCache) {
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;
  }

  await hydrateIntegrationCredentials();

  const connectors = await getActiveSearchConnectors(options?.providers);
  const providerStats: SearchEngineResult["providers"] = [];
  const allRaw: Awaited<ReturnType<(typeof connectors)[0]["search"]>> = [];

  // Fan out in parallel — a single provider failure never blocks the others.
  await Promise.all(
    connectors.map(async (connector) => {
      const started = Date.now();
      try {
        const batch = await connector.search(trimmed, {
          minFetch: options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT,
          targetFetch: options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT,
          maxPages: options?.maxPages,
        });
        allRaw.push(...batch);
        providerStats.push({
          providerId: connector.id,
          fetched: batch.length,
          normalized: batch.length,
          durationMs: Date.now() - started,
        });
      } catch (err) {
        providerStats.push({
          providerId: connector.id,
          fetched: 0,
          normalized: 0,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        });
      }
    })
  );

  const ranked = rankRawListings(allRaw, trimmed);
  const unified = sortUnifiedByRelevance(mergeDuplicateListings(ranked));

  const result: SearchEngineResult = {
    products: unified,
    totalFetched: allRaw.length,
    totalRanked: ranked.length,
    totalUnified: unified.length,
    providers: providerStats,
    query: trimmed,
  };

  setCachedSearch(cacheKey, result);
  return result;
}

/**
 * Search entry point for UI.
 * Queries live marketplaces in parallel and returns one card per marketplace
 * so eBay + AliExpress (etc.) appear together in the merged list.
 */
export async function searchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT
): Promise<SearchResultItem[]> {
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);

  // Balanced, fast fetch: only live connectors, shallow pagination per marketplace.
  const result = await executeGlobalSearch(query, {
    limit: capped,
    providers: [...LIVE_SEARCH_PROVIDER_IDS],
    minFetch: Math.min(40, capped),
    targetFetch: Math.min(100, Math.max(capped, 60)),
    maxPages: 2,
  });

  const items = result.products.flatMap(unifiedToMarketplaceSearchItems);
  return interleaveMarketplaces(items).slice(0, capped);
}

/** Prefer alternating marketplaces so one provider cannot dominate the first page. */
function interleaveMarketplaces(items: SearchResultItem[]): SearchResultItem[] {
  const buckets = new Map<string, SearchResultItem[]>();
  for (const item of items) {
    const key = item.storeSlug || "other";
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  const queues = [...buckets.values()];
  if (queues.length <= 1) return items;

  const merged: SearchResultItem[] = [];
  let remaining = items.length;
  while (remaining > 0) {
    for (const queue of queues) {
      const next = queue.shift();
      if (!next) continue;
      merged.push(next);
      remaining -= 1;
    }
  }
  return merged;
}

/** Keep cheapest-offer mapping available for non-search callers. */
export { unifiedToSearchResultItem };
