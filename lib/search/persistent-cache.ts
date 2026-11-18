import { after } from "next/server";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchProducts } from "@/lib/search/engine";
import {
  PERSISTENT_SEARCH_INCOMPLETE_TTL_MS,
  PERSISTENT_SEARCH_MAX_ITEMS,
  buildPersistentSearchKey,
  getMissingCriticalSearchProviders,
  isPersistentSearchCacheEnabled,
  isPersistentSearchEntryStale,
  readPersistentSearchCache,
  writePersistentSearchCache,
  type PersistentSearchOptions,
} from "@/lib/search/persistent-cache-store";

/** Low-RAM live fetch budget for the background/stale search refresh. */
const LOW_RAM_PROVIDER_TIMEOUT_MS = 3_500;
const LOW_RAM_PROVIDER_CONCURRENCY = 3;
const LOW_RAM_MAX_LISTINGS_PER_PROVIDER = 14;

const inflightBuilds = new Map<string, Promise<SearchResultItem[]>>();
const inflightRefreshes = new Set<string>();

function lowRamSearchOptions(options: PersistentSearchOptions) {
  return {
    optimizeForDeviceIntent: true as const,
    sortBy: options.sortBy,
    ...(options.activeCurrency ? { activeCurrency: options.activeCurrency } : {}),
    ...(options.useFuzzyMatch ? { useFuzzyMatch: true } : {}),
    lowRam: true as const,
    providerTimeoutMs: LOW_RAM_PROVIDER_TIMEOUT_MS,
    providerConcurrency: LOW_RAM_PROVIDER_CONCURRENCY,
    maxListingsPerProvider: LOW_RAM_MAX_LISTINGS_PER_PROVIDER,
  };
}

/**
 * Build the full balanced pool (always the 60-item cache cap) so page 1 and
 * "load more" share ONE persisted universe. Callers slice to their own limit.
 */
async function buildLiveSearchPool(
  query: string,
  options: PersistentSearchOptions,
): Promise<SearchResultItem[]> {
  return searchProducts(
    query,
    PERSISTENT_SEARCH_MAX_ITEMS,
    lowRamSearchOptions(options),
  );
}

/**
 * Cache-first read. Returns the persisted balanced pool immediately; a stale
 * entry is served as-is while a low-RAM refresh runs after the response.
 */
export async function getCachedSearchResult(
  query: string,
  limit: number,
  options: PersistentSearchOptions = {},
): Promise<SearchResultItem[] | null> {
  if (!isPersistentSearchCacheEnabled()) return null;
  const key = buildPersistentSearchKey(query, options);
  const entry = await readPersistentSearchCache(key);
  if (!entry) return null;

  const missing = getMissingCriticalSearchProviders(entry.items);
  if (missing.length > 0) {
    // Never let a pool that dropped Amazon EG / AliExpress / Jumia live for the
    // full 6h TTL. Refresh in the background; after a short grace, bypass the
    // entry entirely so the caller rebuilds it live.
    scheduleSearchCacheRefresh(query, options);
    const fetchedAt = Date.parse(entry.fetchedAt);
    const age = Number.isFinite(fetchedAt)
      ? Date.now() - fetchedAt
      : Number.POSITIVE_INFINITY;
    if (age > PERSISTENT_SEARCH_INCOMPLETE_TTL_MS) {
      console.warn(
        `[search-cache] bypass incomplete pool for "${query}" (missing: ${missing.join(", ")})`,
      );
      return null;
    }
  } else if (isPersistentSearchEntryStale(entry.fetchedAt)) {
    scheduleSearchCacheRefresh(query, options);
  }

  return entry.items.slice(0, Math.min(limit, PERSISTENT_SEARCH_MAX_ITEMS));
}

/**
 * Cache miss: build the pool once (deduping concurrent identical misses),
 * persist it, and return it. Subsequent reads are served by the cache.
 */
export async function buildAndCacheSearchResult(
  query: string,
  limit: number,
  options: PersistentSearchOptions = {},
): Promise<SearchResultItem[]> {
  const key = buildPersistentSearchKey(query, options);
  let build = inflightBuilds.get(key);
  if (!build) {
    build = (async () => {
      const items = await buildLiveSearchPool(query, options);
      if (items.length > 0) {
        void writePersistentSearchCache(key, query, items, options).catch(
          () => {},
        );
      }
      return items;
    })().finally(() => {
      inflightBuilds.delete(key);
    });
    inflightBuilds.set(key, build);
  }

  const items = await build;
  return items.slice(0, Math.min(limit, PERSISTENT_SEARCH_MAX_ITEMS));
}

/** Schedule a stale-while-revalidate refresh after the current response. */
export function scheduleSearchCacheRefresh(
  query: string,
  options: PersistentSearchOptions = {},
): void {
  if (!isPersistentSearchCacheEnabled()) return;
  const key = buildPersistentSearchKey(query, options);
  if (inflightRefreshes.has(key)) return;
  inflightRefreshes.add(key);

  const run = async () => {
    try {
      const items = await buildLiveSearchPool(query, options);
      if (items.length > 0) {
        await writePersistentSearchCache(key, query, items, options);
      }
    } catch {
      // Keep the previously cached pool when a refresh fails.
    } finally {
      inflightRefreshes.delete(key);
    }
  };

  try {
    after(() => {
      void run();
    });
  } catch {
    void run();
  }
}
