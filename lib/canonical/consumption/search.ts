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
import type { NormalizedSearchListing, RawProviderListing, SearchSortMode } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import { toEgpDisplayCurrency } from "@/lib/search/display-currency";
import { searchProducts } from "@/lib/search/engine";
import { analyzeSearchQueryIntent } from "@/lib/search/query-intent";
import { enforceStrictDevicePool, passesStrictDeviceGuard } from "@/lib/search/accessory-exclusion";
import { rankRawListings } from "@/lib/search/ranking";
import {
  classifyListingCondition,
  enforceConditionDiversity,
} from "@/lib/search/condition-diversity";
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
  sortBy?: SearchSortMode;
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

  // Strict genuine-device pool guard (mirrors engine.ts): on a DEVICE-intent
  // query drop accessory rows absolutely and price-floor the rest unless the
  // row is itself a recognised genuine device. Applies to BOTH live listings
  // and the DB-supplement leg (the legacy engine seam covers the db-as-raw
  // pool; here the same rule hits `dbItems` so a device query can never be
  // repopulated with imported cases/glass/junk). Cache key is per
  // (query,capped,sort) where raw pool content is stable; accessory-intent
  // queries are untouched here.
  const deviceIntent = analyzeSearchQueryIntent(trimmed).kind === "device";
  const rawLive = deviceIntent
    ? enforceStrictDevicePool(input.liveListings, trimmed)
    : input.liveListings;
  const strictDbItems = deviceIntent
    ? input.dbItems.filter((item) =>
        passesStrictDeviceGuard(item.name, item.price, trimmed),
      )
    : input.dbItems;
  const ranked = rankRawListings(rawLive as NormalizedSearchListing[], trimmed);
  const canonical = canonicalizeSearchListings(ranked);

  const activeProviderSet = new Set(input.activeProviders);
  const seen = new Set<string>();
  const rejectedByCode: Record<string, number> = {};
  for (const rejection of canonical.rejected) {
    for (const code of rejection.codes) rejectedByCode[code] = (rejectedByCode[code] ?? 0) + 1;
  }

  const live = assembleProductionSearchResults(canonical.accepted, trimmed, capped, {
    ...(input.sortBy ? { sortBy: input.sortBy } : {}),
  });

  const activeDb = strictDbItems.filter((item) => activeProviderSet.has(item.storeSlug));
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

  // Universal price mode: the balanced-DB + live interleave below would destroy
  // a pure lowest-price order, so in price mode the DB leg is merged and
  // price-sorted together with the live pool instead.
  if (input.sortBy === "price") {
    const priceSorted = [...live, ...dedupedDb].sort(
      (a, b) => a.price - b.price || a.reviewCount - b.reviewCount || a.rating - b.rating,
    );
    const guarded = enforceConditionDiversity<SearchResultItem>(
      priceSorted.slice(0, capped),
      {
        windowSize: SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
        newFirst: false,
        providerOf: (item) => item.storeSlug || item.store,
        conditionOf: (item) => classifyListingCondition(item.name, item.condition),
      },
    );
    return {
      items: guarded,
      rejectedCount: canonical.rejected.length,
      rejectedByCode,
      acceptedCount: canonical.accepted.length,
      productsFormed: canonical.products.length,
    };
  }

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

  // Stable-trim diversity guardrail (mirrors the legacy engine seam): caps a
  // single source's Refurbished/Used share per 50-slot window (40%, a dominant
  // source drops to ≤5/page) without regrouping. Preserves the relevance
  // interleave and DB-leg placement exactly; only over-budget non-new rows are
  // trimmed. Aligned with searchProducts (engine.ts) which deliberately does
  // NOT New-first regroup — doing so would move imported "New" rows above a
  // live "Refurbished" exact-match device and could displace an accessory over
  // a genuine device.
  const guarded = enforceConditionDiversity<SearchResultItem>(mixed, {
    windowSize: SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
    newFirst: false,
    providerOf: (item) => item.storeSlug || item.store,
    conditionOf: (item) => classifyListingCondition(item.name, item.condition),
  });

  return {
    items: guarded,
    rejectedCount: canonical.rejected.length,
    rejectedByCode,
    acceptedCount: canonical.accepted.length,
    productsFormed: canonical.products.length,
  };
}

export async function canonicalSearchProducts(
  query: string,
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT,
  sortBy?: SearchSortMode,
): Promise<SearchResultItem[]> {
  if (!isSurfaceEnabled(SURFACE)) {
    return searchProducts(query, limit, { optimizeForDeviceIntent: true, sortBy });
  }

  const trimmed = query.trim();
  if (!trimmed) return [];
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);

  const sort = sortBy ?? "relevance";
  const cacheKey = `canonical-search:${trimmed.toLowerCase()}:${capped}:sort:${sort}`;
  const cached = canSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items.slice(0, capped);

  try {
    const inputs = await fetchCanonicalInputs(trimmed, capped);
    const pooled = assembleCanonicalSearchPool({
      ...inputs,
      query: trimmed,
      limit: capped,
      sortBy: sort,
    });
    canSearchCache.set(cacheKey, { items: pooled.items, expiresAt: Date.now() + CACHE_TTL_MS });
    return pooled.items;
  } catch {
    return searchProducts(trimmed, capped, { optimizeForDeviceIntent: true, sortBy: sort });
  }
}

/** Landing seam used by the app — flag-aware, legacy-delegating by default. */
export async function searchProductsSurface(
  query: string,
  limit?: number,
  sortBy?: SearchSortMode,
): Promise<SearchResultItem[]> {
  const items = await canonicalSearchProducts(query, limit, sortBy);
  // Display seam: convert source currency to EGP so formatPrice() (which is
  // called WITHOUT fromCurrency) renders the real EGP number, not raw USD
  // digits with an EGP label. Engine/pool math keeps the raw source currency.
  return toEgpDisplayCurrency(items);
}

import {
  sliceSearchPage,
  resolvePooledPageSelection,
  type SearchPageResult,
} from "@/lib/search/engine";

/**
 * Paged seam (search page "load more"). Gate off → legacy paged search verbatim
 * (it inherits the truthful-total / beyond-window fix from engine.ts).
 *
 * Gate on → the canonical pool is sliced for the in-window page, but `total`
 * and `hasMore` come from the exact Supabase match count when the DB leg is
 * live (fallback: canonical pool length). Pages past the 200-item pool window
 * continue off the pool-excluded DB-index-level paged leg
 * (`resolvePooledPageSelection` + `excludeProductIds`), so every page is a
 * successive, duplicate/gap-free portion of the SAME complete matching universe
 * (pool positions first, then the DB leg minus the db rows the pool already
 * emitted).
 */
export async function searchResultsPagedSurface(
  query: string,
  offset: number,
  limit: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
  sortBy?: SearchSortMode,
): Promise<SearchPageResult> {
  if (!isSurfaceEnabled(SURFACE)) {
    const { searchProductsPaged } = await import("@/lib/search/engine");
    const page = await searchProductsPaged(query, offset, limit, {
      optimizeForDeviceIntent: true,
      sortBy,
    });
    return { ...page, items: toEgpDisplayCurrency(page.items) };
  }
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], total: 0, offset: 0, limit, hasMore: false };
  }
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;

  // Canonical pool + exact DB count race together; a slow/failed count
  // resolves 0 so the pool length keeps the historical in-window behaviour.
  const dbModule = import("@/lib/integration/database-catalog");
  const [pool, dbCountP] = await Promise.all([
    canonicalSearchProducts(
      trimmed,
      SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT,
      sortBy,
    ),
    dbModule.then((m) =>
      m.countSearchResultsFromDatabase(trimmed, {
        timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
      }),
    ),
  ]);
  const dbCount = await dbCountP;
  const total = dbCount > 0 ? dbCount : pool.length;

  // Fully inside the canonical pool window: the pure pool slice decides the
  // items; only the reported total/hasMore become truthful.
  if (safeOffset + safeLimit <= pool.length) {
    const page = sliceSearchPage(pool, safeOffset, safeLimit);
    return {
      ...page,
      items: toEgpDisplayCurrency(page.items),
      total,
      hasMore: safeOffset + safeLimit < total,
    };
  }

  // Beyond the capped pool: serve the complete catalog from the pool-excluded
  // DB paged leg. `resolvePooledPageSelection` maps the offset onto the ONE
  // deterministic universe (pool positions first, then the discount-ordered DB
  // leg minus the db rows the pool already emitted — excluded by SET, not
  // skipped by count, so a window can never re-serve a row an earlier page
  // already showed nor skip a discount-head row the pool never placed).
  const selection = resolvePooledPageSelection(pool, safeOffset, safeLimit);

  const dbPage = await dbModule.then((m) =>
    m.getSearchResultsFromDatabasePaged(
      trimmed,
      selection.tailStart,
      selection.tailCount,
      {
        timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
        excludeProductIds: selection.excludeProductIds,
      },
    ),
  );

  // Strict device guard on the DB tail: the canonical pool already filters its
  // `dbItems` leg, but the beyond-pool DB leg is fetched fresh here and would
  // otherwise re-import accessory/junk rows on a device query.
  const deviceIntent = analyzeSearchQueryIntent(trimmed).kind === "device";
  const tailItems = deviceIntent
    ? dbPage.items.filter((item) => passesStrictDeviceGuard(item.name, item.price, trimmed))
    : dbPage.items;

  // Prefer the truthful DB count; if only the paged leg succeeded, trust its
  // exact count; otherwise the pool length keeps the historical behaviour.
  const finalTotal =
    total > 0 ? total : dbPage.total > 0 ? dbPage.total : pool.length;

  const items = [...selection.poolHead, ...tailItems];

  return {
    items: toEgpDisplayCurrency(items),
    total: finalTotal,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < finalTotal,
  };
}