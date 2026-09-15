import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { getActiveProductionProviders } from "@/lib/integration/provider-config";
import { recordProviderRun } from "@/lib/integration/provider-health";
import { getActiveProviderAdapters } from "@/lib/providers/adapter-registry";
import {
  buildSearchCacheKey,
  getCachedSearch,
  setCachedSearch,
} from "@/lib/search/cache";
import { mergeDuplicateListings } from "@/lib/search/deduplication";
import { rankRawListings, sortUnifiedByRelevance } from "@/lib/search/ranking";
import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import { unifiedToSearchResultItem } from "@/lib/search/price-comparison";
import {
  balanceFlatMarketplaceList,
} from "@/lib/search/marketplace-balance";
import type {
  RawProviderListing,
  SearchEngineResult,
  SearchProviderId,
} from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

export type GlobalSearchOptions = {
  limit?: number;
  providers?: SearchProviderId[];
  minFetch?: number;
  targetFetch?: number;
  maxPages?: number;
  skipCache?: boolean;
};

const FAIR_SEARCH_TTL_MS = 2 * 60 * 1000;
const fairSearchCache = new Map<
  string,
  { items: SearchResultItem[]; expiresAt: number }
>();

/**
 * Hard per-provider budget inside the search fan-out. A slow or stalled
 * connector (e.g. the Admitad feed can take up to ~25s on a cold cache) must
 * never hold the search fan-out — and therefore the homepage catalog, which
 * fans out 8 curated queries through this same engine — hostage. When a
 * connector exceeds the budget its partial work is dropped and the fan-out
 * settles with the faster providers' real results.
 */
const PROVIDER_FETCH_TIMEOUT_MS = 8_000;

/**
 * ZORINO Global Search Engine
 *
 * Pipeline: Provider Connectors (parallel) → per-marketplace Ranking →
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
  const cacheKey = buildSearchCacheKey(trimmed, limit, `prod-v1:${providerKey}`);
  if (!options?.skipCache) {
    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;
  }

  const { allRaw, providerStats } = await fetchProvidersInParallel(trimmed, options);

  const ranked: ReturnType<typeof rankRawListings> = [];
  const byProvider = groupByProvider(allRaw);
  for (const listings of byProvider.values()) {
    ranked.push(...rankRawListings(listings, trimmed));
  }

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

function groupByProvider(
  listings: RawProviderListing[],
): Map<SearchProviderId, RawProviderListing[]> {
  const byProvider = new Map<SearchProviderId, RawProviderListing[]>();
  for (const listing of listings) {
    const bucket = byProvider.get(listing.providerId) ?? [];
    bucket.push(listing);
    byProvider.set(listing.providerId, bucket);
  }
  return byProvider;
}

async function fetchProvidersInParallel(
  query: string,
  options?: GlobalSearchOptions,
): Promise<{
  allRaw: RawProviderListing[];
  providerStats: SearchEngineResult["providers"];
}> {
  await hydrateIntegrationCredentials();

  // All provider fan-out flows through the ProviderAdapter layer, which wraps
  // the underlying SearchConnectors. This gives the engine a unified interface
  // while preserving the exact same connectors, normalization, and availability
  // checks as before.
  const adapters = await getActiveProviderAdapters(options?.providers);
  const providerStats: SearchEngineResult["providers"] = [];
  const allRaw: RawProviderListing[] = [];

  await Promise.all(
    adapters.map(async (adapter) => {
      const started = Date.now();
      try {
        const result = await Promise.race([
          adapter.search(query, {
            minFetch: options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT,
            targetFetch: options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT,
            maxPages: options?.maxPages,
          }),
          new Promise<{ providerId: SearchProviderId; listings: RawProviderListing[]; durationMs: number }>(
            (resolve) =>
              setTimeout(
                () =>
                  resolve({
                    providerId: adapter.id,
                    listings: [],
                    // A timed-out provider contributes no fetched/normalized
                    // results and its duration is not credited.
                    durationMs: 0,
                  }),
                PROVIDER_FETCH_TIMEOUT_MS,
              ),
          ),
        ]);
        allRaw.push(...result.listings);
        recordProviderRun(result.providerId, result.listings.length);
        providerStats.push({
          providerId: result.providerId,
          fetched: result.listings.length,
          normalized: result.listings.length,
          durationMs:
            result.durationMs > 0 ? result.durationMs : Date.now() - started,
        });
      } catch (err) {
        recordProviderRun(adapter.id, 0);
        providerStats.push({
          providerId: adapter.id,
          fetched: 0,
          normalized: 0,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        });
      }
    }),
  );

  return { allRaw, providerStats };
}

/**
 * Production search UI entry point.
 * Aggregates all enabled live marketplaces with device-first ranking,
 * cross-marketplace dedupe, fair mixing, and marketplace-correct affiliate URLs.
 * Supplements live results with database-imported products for broader coverage.
 */
export async function searchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT
): Promise<SearchResultItem[]> {
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `prod-v17-marketplace-balance:${trimmed.toLowerCase()}:${capped}`;
  const cached = fairSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, capped);
  }

  const [{ allRaw }, fromDb, activeProviderIds] = await Promise.all([
    fetchProvidersInParallel(trimmed, {
      minFetch: 60,
      targetFetch: 120,
      maxPages: 4,
    }),
    (await import("@/lib/integration/database-catalog"))
      .getSearchResultsFromDatabase(trimmed, capped * 3, {
        timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
      })
      .catch(() => [] as SearchResultItem[]),
    getActiveProductionProviders(),
  ]);

  // Filter DB results: only products whose provider is ACTIVE may enter
  // the unified catalog. Active = credentials + durable DB evidence or recent
  // successful live runs. Closes the DB bypass where inactive/stub providers
  // could leak products through getSearchResultsFromDatabase() without passing
  // isAvailable() or producing any real data.
  const activeProviders = new Set(activeProviderIds);
  const activeDb = fromDb.filter((item) =>
    activeProviders.has(item.storeSlug as never),
  );

  const live = assembleProductionSearchResults(allRaw, trimmed, capped);

  const seen = new Set(live.map((item) => item.id));
  const dedupedDb: typeof activeDb = [];
  for (const dbItem of activeDb) {
    if (seen.has(dbItem.id)) continue;
    const isDup = live.some(
      (l) =>
        l.name.toLowerCase().slice(0, 30) === dbItem.name.toLowerCase().slice(0, 30),
    );
    if (!isDup) {
      dedupedDb.push(dbItem);
      seen.add(dbItem.id);
    }
  }

  // Balance DB results across marketplaces so providers without live connectors
  // (Nike, CJdropshipping, Best Buy, Walmart, etc.) get fair representation
  // instead of being drowned out by the dominant Admitad bulk.
  const balancedDb = balanceFlatMarketplaceList(
    dedupedDb,
    (item) => item.storeSlug || item.store,
    dedupedDb.length,
    (a, b) => b.discount - a.discount || a.price - b.price,
  );

  // Interleave live + balanced DB results: insert one DB card after every
  // live card so underrepresented merchants are spread evenly across the page.
  const mixed: typeof live = [];
  let di = 0;
  for (let i = 0; i < live.length && mixed.length < capped; i++) {
    mixed.push(live[i]);
    if (di < balancedDb.length && mixed.length < capped) {
      mixed.push(balancedDb[di++]);
    }
  }
  while (di < balancedDb.length && mixed.length < capped) {
    mixed.push(balancedDb[di++]);
  }
  fairSearchCache.set(cacheKey, {
    items: mixed,
    expiresAt: Date.now() + FAIR_SEARCH_TTL_MS,
  });

  return mixed;
}

/** One page of search results (offset/limit view over a cached, balanced pool). */
export type SearchPageResult = {
  items: SearchResultItem[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

/**
 * Pure slice of a balanced search pool into a page. Kept standalone so the
 * offset/limit/hasMore contract is unit-testable without live providers.
 */
export function sliceSearchPage(
  pool: SearchResultItem[],
  offset: number,
  limit: number
): SearchPageResult {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;
  const items = pool.slice(safeOffset, safeOffset + safeLimit);
  return {
    items,
    total: pool.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < pool.length,
  };
}

/**
 * Paged view over the unified search pool. The full balanced pool is fetched
 * (and cached, exactly as searchProducts does) and then sliced — so page 1,
 * page 2, … always describe the same stable sequence from one search.
 */
export async function searchProductsPaged(
  query: string,
  offset: number,
  limit: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE
): Promise<SearchPageResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], total: 0, offset: 0, limit, hasMore: false };
  }
  const pool = await searchProducts(trimmed, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  return sliceSearchPage(pool, offset, limit);
}

/** Keep cheapest-offer mapping available for non-search callers. */
export { unifiedToSearchResultItem };
