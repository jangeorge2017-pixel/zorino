import { getActiveSearchConnectors } from "@/lib/search/connectors/registry";
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
};

/**
 * ZORINO Global Search Engine
 *
 * Pipeline: Provider Connectors → Normalization → Ranking →
 *           Duplicate Detection → Price Comparison → UI mapping
 */
export async function executeGlobalSearch(
  query: string,
  options?: GlobalSearchOptions
): Promise<SearchEngineResult> {
  const trimmed = query.trim();
  const limit = options?.limit ?? SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT;
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

  return {
    products: unified,
    totalFetched: allRaw.length,
    totalRanked: ranked.length,
    totalUnified: unified.length,
    providers: providerStats,
    query: trimmed,
  };
}

/** Search entry point for UI — returns SearchResultItem[] without UI changes. */
export async function searchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT
): Promise<SearchResultItem[]> {
  const result = await executeGlobalSearch(query, { limit });
  return result.products.slice(0, limit).map(unifiedToSearchResultItem);
}
