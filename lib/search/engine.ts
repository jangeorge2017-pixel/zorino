import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getActiveSearchConnectors } from "@/lib/search/connectors/registry";
import {
  buildSearchCacheKey,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/search/cache";
import { mergeDuplicateListings } from "@/lib/search/deduplication";
import { rankRawListings, sortUnifiedByRelevance } from "@/lib/search/ranking";
import { unifiedToSearchResultItem } from "@/lib/search/price-comparison";
import type { SearchEngineResult, SearchProviderId } from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

export type GlobalSearchOptions = {
  limit?: number;
  providers?: SearchProviderId[];
  minFetch?: number;
  targetFetch?: number;
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

  const cacheKey = buildSearchCacheKey(trimmed, limit);
  if (!options?.skipCache) {
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;
  }

  await hydrateIntegrationCredentials();

  const connectors = await getActiveSearchConnectors(options?.providers);
  const providerStats: SearchEngineResult["providers"] = [];
  const allRaw: Awaited<ReturnType<(typeof connectors)[0]["search"]>> = [];

  await Promise.all(
    connectors.map(async (connector) => {
      const started = Date.now();
      try {
        const batch = await connector.search(trimmed, {
          minFetch: options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT,
          targetFetch: options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT,
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

/** Search entry point for UI — returns SearchResultItem[] without UI changes. */
export async function searchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT
): Promise<SearchResultItem[]> {
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  const result = await executeGlobalSearch(query, { limit: capped });
  return result.products.slice(0, capped).map(unifiedToSearchResultItem);
}
