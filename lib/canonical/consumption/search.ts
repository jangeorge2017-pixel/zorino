/**
 * SEARCH surface — canonical consumption (Phase 4).
 *
 * When the search gate is OFF (default) this module is a transparent passthrough:
 * it calls the legacy searchProducts() and returns its result untouched.
 *
 * When the gate is ON every fetched listing passes through the canonical spine
 * (validation G1–G4 + product identity) BEFORE the legacy balancing/emission
 * pipeline publishes it — marketplace balancing, freshness (same 2-min TTL),
 * pricing, images, affiliate destinations, filters, and the SearchResultItem
 * contract are preserved by REUSING the legacy assembly + emitter on the same
 * underlying connector data. Offers the canonical gate rejects are arrayed and
 * reported; on any exception the surface falls back to the legacy path.
 */

import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { NormalizedSearchListing, RawProviderListing } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchProducts } from "@/lib/search/engine";
import { analyzeSearchQueryIntent } from "@/lib/search/query-intent";
import { rankRawListings } from "@/lib/search/ranking";
import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import { getActiveProductionProviders } from "@/lib/integration/provider-config";
import { getActiveProviderAdapters } from "@/lib/providers/adapter-registry";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { recordProviderRun } from "@/lib/integration/provider-health";
import { canonicalizeSearchListings } from "./core";
import { isSurfaceEnabled } from "./feature";

const SURFACE = "search" as const;

const CACHE_TTL_MS = 2 * 60 * 1000;
const PROVIDER_FETCH_TIMEOUT_MS = 8_000;
const canSearchCache = new Map<string, { items: SearchResultItem[]; expiresAt: number }>();

/** Test hook — replaces the live fetcher. */
export type CanonicalSearchFetcher = (query: string) => Promise<{
  liveListings: RawProviderListing[];
  dbItems: SearchResultItem[];
  activeProviders: string[];
}>;

let fetcherOverride: CanonicalSearchFetcher | null = null;

export function setCanonicalSearchFetcherForTests(fetcher: CanonicalSearchFetcher | null): void {
  fetcherOverride = fetcher;
}

async function fetchCanonicalInputs(query: string, capped: number): Promise<{
  liveListings: RawProviderListing[];
  dbItems: SearchResultItem[];
  activeProviders: string[];
}> {
  if (fetcherOverride) return fetcherOverride(query.trim());

  await hydrateIntegrationCredentials();
  const adapters = await getActiveProviderAdapters();
  const allRaw: RawProviderListing[] = [];
  const intent = analyzeSearchQueryIntent(query.trim());

  await Promise.all(
    adapters.map(async (adapter) => {
      try {
        const result = await Promise.race([
          adapter.search(query.trim(), {
            minFetch: 60,
            targetFetch: 120,
            maxPages: 4,
            // Search surface only: let connectors adapt to the query's device
            // intent (eBay category narrowing, AliExpress family expansion).
            optimizeForDeviceIntent: true,
            intent,
          }),
          new Promise<{ providerId: string; listings: RawProviderListing[]; durationMs: number }>(
            (resolve) =>
              setTimeout(
                () => resolve({ providerId: adapter.id, listings: [], durationMs: 0 }),
                PROVIDER_FETCH_TIMEOUT_MS,
              ),
          ),
        ]);
        allRaw.push(...result.listings);
        recordProviderRun(result.providerId, result.listings.length);
      } catch {
        recordProviderRun(adapter.id, 0);
      }
    }),
  );

  const [dbItems, activeProviders] = await Promise.all([
    (await import("@/lib/integration/database-catalog"))
      .getSearchResultsFromDatabase(query.trim(), capped * 3)
      .catch(() => [] as SearchResultItem[]),
    getActiveProductionProviders().catch(() => []),
  ]);

  return { liveListings: allRaw, dbItems, activeProviders: activeProviders as string[] };
}

/**
 * Pure assembler (no network): canonicalize live listings, then emit exactly
 * like the legacy pipeline so balancing/freshness contract is preserved.
 */
export function assembleCanonicalSearchPool(input: {
  liveListings: readonly RawProviderListing[];
  dbItems: readonly SearchResultItem[];
  activeProviders: readonly string[];
  query: string;
  limit: number;
}): {
  items: SearchResultItem[];
  rejectedCount: number;
  rejectedByCode: Record<string, number>;
  acceptedCount: number;
  productsFormed: number;
} {
  const trimmed = input.query.trim();
  const capped = Math.min(input.limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  if (!trimmed || capped <= 0) {
    return { items: [], rejectedCount: 0, rejectedByCode: {}, acceptedCount: 0, productsFormed: 0 };
  }

  const ranked = rankRawListings(input.liveListings as NormalizedSearchListing[], trimmed);
  const canonical = canonicalizeSearchListings(ranked);

  const activeProviderSet = new Set(input.activeProviders);
  const seen = new Set<string>();
  const rejectedByCode: Record<string, number> = {};
  for (const rejection of canonical.rejected) {
    for (const code of rejection.codes) rejectedByCode[code] = (rejectedByCode[code] ?? 0) + 1;
  }

  const live = assembleProductionSearchResults(canonical.accepted, trimmed, capped);

  const activeDb = input.dbItems.filter((item) => activeProviderSet.has(item.storeSlug));
  const dedupedDb: SearchResultItem[] = [];
  for (const dbItem of activeDb) {
    if (seen.has(dbItem.id)) continue;
    const isDup = live.some(
      (l) => l.name.toLowerCase().slice(0, 30) === dbItem.name.toLowerCase().slice(0, 30),
    );
    if (!isDup) {
      dedupedDb.push(dbItem);
      seen.add(dbItem.id);
    }
  }
  for (const item of live) seen.add(item.id);

  const balancedDb = balanceFlatMarketplaceList(
    dedupedDb,
    (item) => item.storeSlug || item.store,
    dedupedDb.length,
    (a, b) => b.discount - a.discount || a.price - b.price,
  );

  const mixed: SearchResultItem[] = [];
  let di = 0;
  for (let i = 0; i < live.length && mixed.length < capped; i++) {
    mixed.push(live[i]);
    if (di < balancedDb.length && mixed.length < capped) mixed.push(balancedDb[di++]);
  }
  while (di < balancedDb.length && mixed.length < capped) mixed.push(balancedDb[di++]);

  return {
    items: mixed,
    rejectedCount: canonical.rejected.length,
    rejectedByCode,
    acceptedCount: canonical.accepted.length,
    productsFormed: canonical.products.length,
  };
}

export async function canonicalSearchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT,
): Promise<SearchResultItem[]> {
  if (!isSurfaceEnabled(SURFACE)) {
    return searchProducts(query, limit, { optimizeForDeviceIntent: true });
  }

  const trimmed = query.trim();
  if (!trimmed) return [];
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);

  const cacheKey = `canonical-search:${trimmed.toLowerCase()}:${capped}`;
  const cached = canSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items.slice(0, capped);

  try {
    const inputs = await fetchCanonicalInputs(trimmed, capped);
    const pooled = assembleCanonicalSearchPool({ ...inputs, query: trimmed, limit: capped });
    canSearchCache.set(cacheKey, { items: pooled.items, expiresAt: Date.now() + CACHE_TTL_MS });
    return pooled.items;
  } catch {
    return searchProducts(trimmed, capped, { optimizeForDeviceIntent: true });
  }
}

/** Landing seam used by the app — flag-aware, legacy-delegating by default. */
export async function searchProductsSurface(
  query: string,
  limit?: number,
): Promise<SearchResultItem[]> {
  return canonicalSearchProducts(query, limit);
}

import { sliceSearchPage, type SearchPageResult } from "@/lib/search/engine";

/** Paged seam (search page "load more"). Gate off → legacy paged search verbatim. */
export async function searchResultsPagedSurface(
  query: string,
  offset: number,
  limit: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
): Promise<SearchPageResult> {
  if (!isSurfaceEnabled(SURFACE)) {
    const { searchProductsPaged } = await import("@/lib/search/engine");
    return searchProductsPaged(query, offset, limit, { optimizeForDeviceIntent: true });
  }
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], total: 0, offset: 0, limit, hasMore: false };
  }
  const pool = await canonicalSearchProducts(trimmed, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  return sliceSearchPage(pool, offset, limit);
}