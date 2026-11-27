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

import {
  SEARCH_ENGINE_DEFAULTS,
  storeRoundRobinKey,
} from "@/lib/search/types";
import type { NormalizedSearchListing, RawProviderListing, SearchSortMode } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import type { CurrencyCode } from "@/lib/international/config";
import {
  toDisplayCurrency,
  DISPLAY_CURRENCY,
} from "@/lib/search/display-currency";
import { searchProducts } from "@/lib/search/engine";
import {
  buildAndCacheSearchResult,
  getCachedSearchResult,
} from "@/lib/search/persistent-cache";
import {
  PERSISTENT_SEARCH_MAX_ITEMS,
  isPersistentSearchCacheEnabled,
} from "@/lib/search/persistent-cache-store";
import { getSearchCacheVersion } from "@/lib/search/cache-version";
import { analyzeSearchQueryIntent } from "@/lib/search/query-intent";
import { filterStrictRelevantTitles } from "@/lib/search/relevance";
import { enforceStrictDevicePool, passesStrictDeviceGuard } from "@/lib/search/accessory-exclusion";
import { rankRawListings } from "@/lib/search/ranking";
import { setBoundedCacheEntry } from "@/lib/utils/bounded-map-cache";
import {
  classifyListingCondition,
  enforceConditionDiversity,
} from "@/lib/search/condition-diversity";
import { assembleProductionSearchResults, enforceViewportSingleSourceCap } from "@/lib/search/production-pipeline";
import { balanceFlatMarketplaceList } from "@/lib/search/marketplace-balance";
import { getActiveProductionProviders } from "@/lib/integration/provider-config";
import { getActiveProviderAdapters } from "@/lib/providers/adapter-registry";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { recordProviderRun } from "@/lib/integration/provider-health";
import { canonicalizeSearchListings } from "./core";
import { isSurfaceEnabled } from "./feature";
import { isWebSupabaseOnly } from "@/lib/sync/config";

const SURFACE = "search" as const;

const CACHE_TTL_MS = 2 * 60 * 1000;
const PROVIDER_FETCH_TIMEOUT_MS = 8_000;
const CANONICAL_SEARCH_CACHE_MAX_ENTRIES = 50;
const canSearchCache = new Map<string, { items: SearchResultItem[]; expiresAt: number }>();

function setCanonicalSearchCache(
  key: string,
  value: { items: SearchResultItem[]; expiresAt: number },
): void {
  setBoundedCacheEntry(canSearchCache, key, value, CANONICAL_SEARCH_CACHE_MAX_ENTRIES);
}

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

async function fetchCanonicalInputs(
  query: string,
  capped: number,
  useFuzzyMatch = false,
  originalQuery?: string,
): Promise<{
  liveListings: RawProviderListing[];
  dbItems: SearchResultItem[];
  activeProviders: string[];
}> {
  if (fetcherOverride) return fetcherOverride(query.trim());

  const supabaseOnly = isWebSupabaseOnly();
  if (!supabaseOnly) await hydrateIntegrationCredentials();
  const adapters = supabaseOnly ? [] : await getActiveProviderAdapters();
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
      .getSearchResultsFromDatabase(query.trim(), capped * 3, {
        useFuzzyMatch,
        originalQuery,
      })
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
  activeCurrency?: CurrencyCode;
}): {
  items: SearchResultItem[];
  rejectedCount: number;
  rejectedByCode: Record<string, number>;
  acceptedCount: number;
  productsFormed: number;
} {
  const trimmed = input.query.trim();
  const capped = Math.min(input.limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  const activeCurrency: CurrencyCode = input.activeCurrency ?? "USD";
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
  const relevantLive = filterStrictRelevantTitles(
    input.liveListings,
    [trimmed],
    (item) => item.title,
  );
  const relevantDbItems = filterStrictRelevantTitles(
    input.dbItems,
    [trimmed],
    (item) => item.name,
  );
  const rawLive = deviceIntent
    ? enforceStrictDevicePool(relevantLive, trimmed, activeCurrency)
    : relevantLive;
  const strictDbItems = deviceIntent
    ? relevantDbItems.filter((item) =>
        passesStrictDeviceGuard(item.name, item.price, trimmed, item.currency, activeCurrency),
      )
    : relevantDbItems;
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
    const priceGuarded = enforceConditionDiversity<SearchResultItem>(
      priceSorted.slice(0, capped),
      {
        windowSize: SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
        newFirst: false,
        providerOf: (item) => item.storeSlug || item.store,
        conditionOf: (item) => classifyListingCondition(item.name, item.condition),
      },
    );
    // The hard 60% single-source viewport cap applies in price mode too: a
    // marketplace with the cheapest inventory cannot monopolize a full page
    // window while any peer provider is present (pure permutation — totals
    // and hasMore untouched, price order preserved within the kept run).
    const priceCapped = enforceViewportSingleSourceCap<SearchResultItem>(
      priceGuarded,
      (item) => item.storeSlug || item.store,
    );
    return {
      items: priceCapped,
      rejectedCount: canonical.rejected.length,
      rejectedByCode,
      acceptedCount: canonical.accepted.length,
      productsFormed: canonical.products.length,
    };
  }

  const balancedDb = balanceFlatMarketplaceList(
    dedupedDb,
    storeRoundRobinKey,
    dedupedDb.length,
    (a, b) => b.discount - a.discount || a.price - b.price,
    1,
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

  // Per-viewport single-source cap (mirrors engine.ts): no single source may
  // hold more than 60% of a full page's seats while any peer provider is
  // present; surplus rows relocate to the pool tail (pure permutation). This
  // path is the non-price relevance branch (the price branch already returned
  // above), so the cap always applies — price mode keeps its strict order.
  const items = enforceViewportSingleSourceCap<SearchResultItem>(
    guarded,
    (item) => item.storeSlug || item.store,
  );

  return {
    items,
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
  activeCurrency?: CurrencyCode,
  useFuzzyMatch = false,
  originalQuery?: string,
): Promise<SearchResultItem[]> {
  const guardCurrency: CurrencyCode = activeCurrency ?? "USD";
  if (!isSurfaceEnabled(SURFACE)) {
    // Cache-first landing path: serve the persisted balanced pool immediately
    // (the common case), and only build when the query has never been cached.
    // Without Supabase service credentials this falls through to the legacy
    // engine call byte-identically, so tests/local dev keep the old behavior.
    if (isPersistentSearchCacheEnabled()) {
      const cacheOptions = {
        sortBy,
        activeCurrency: guardCurrency,
        useFuzzyMatch,
        originalQuery,
      };
      const cached = await getCachedSearchResult(query, limit, cacheOptions);
      if (cached) return cached;
      return buildAndCacheSearchResult(query, limit, cacheOptions);
    }
    // Gate-off delegation stays byte-identical to the legacy call shape: only
    // inject the currency when the caller actually provides one (undefined
    // keeps the engine's classic USD default and the exact legacy option set).
    return searchProducts(query, limit, {
      optimizeForDeviceIntent: true,
      sortBy,
      ...(activeCurrency ? { activeCurrency: guardCurrency } : {}),
      ...(useFuzzyMatch ? { useFuzzyMatch } : {}),
      ...(originalQuery ? { originalQuery } : {}),
    });
  }

  const trimmed = query.trim();
  if (!trimmed) return [];
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);

  const sort = sortBy ?? "relevance";
  const cacheKey = `canonical-search:${getSearchCacheVersion()}:${trimmed.toLowerCase()}:${capped}:sort:${sort}:cur:${guardCurrency}:fuzzy:${useFuzzyMatch}${originalQuery ? `:orig:${originalQuery.trim().toLowerCase()}` : ""}`;
  const cached = canSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items.slice(0, capped);

  try {
    const inputs = await fetchCanonicalInputs(trimmed, capped, useFuzzyMatch, originalQuery);
    const pooled = assembleCanonicalSearchPool({
      ...inputs,
      query: trimmed,
      limit: capped,
      sortBy: sort,
      activeCurrency: guardCurrency,
    });

    // Safety net: an empty canonical pool must never black-hole a query that
    // the legacy engine can still answer with real provider data. This is the
    // same fallback contract as the exception path below - the canonical spine
    // is additive, not a replacement for the working search pipeline.
    if (pooled.items.length === 0) {
      const legacy = await searchProducts(trimmed, capped, {
        optimizeForDeviceIntent: true,
        sortBy: sort,
        ...(activeCurrency ? { activeCurrency: guardCurrency } : {}),
        ...(useFuzzyMatch ? { useFuzzyMatch } : {}),
        ...(originalQuery ? { originalQuery } : {}),
      });
      if (legacy.length > 0) {
        setCanonicalSearchCache(cacheKey, {
          items: legacy,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return legacy;
      }
      return pooled.items;
    }

    setCanonicalSearchCache(cacheKey, {
      items: pooled.items,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return pooled.items;
  } catch {
    return searchProducts(trimmed, capped, {
      optimizeForDeviceIntent: true,
      sortBy: sort,
      ...(activeCurrency ? { activeCurrency: guardCurrency } : {}),
      ...(useFuzzyMatch ? { useFuzzyMatch } : {}),
      ...(originalQuery ? { originalQuery } : {}),
    });
  }
}

/** Landing seam used by the app — flag-aware, legacy-delegating by default. */
export async function searchProductsSurface(
  query: string,
  limit?: number,
  sortBy?: SearchSortMode,
  activeCurrency?: CurrencyCode,
  useFuzzyMatch = false,
  originalQuery?: string,
): Promise<SearchResultItem[]> {
  // Guard math defaults to USD (classic engine behavior); DISPLAY honors the
  // visitor's active currency, falling back to the EGP legacy when no currency
  // context is supplied (homepage/compare/category callers pass none today).
  const guardCurrency: CurrencyCode = activeCurrency ?? "USD";
  const displayCurrency: CurrencyCode = activeCurrency ?? DISPLAY_CURRENCY;
  const items = await canonicalSearchProducts(
    query,
    limit,
    sortBy,
    guardCurrency,
    useFuzzyMatch,
    originalQuery,
  );
  // Display seam: convert source currency to the visitor's ACTIVE currency so
  // formatPrice() (which is called WITHOUT fromCurrency) renders the real
  // number, not raw digits wearing a mismatched label. Engine/pool math keeps
  // the raw source currency.
  return toDisplayCurrency(items, displayCurrency);
}

import {
  sliceSearchPage,
  resolvePooledPageSelection,
  type SearchPageResult,
} from "@/lib/search/engine";

type DatabaseCatalogModule = typeof import("@/lib/integration/database-catalog");

type PooledPageInput = {
  query: string;
  pool: SearchResultItem[];
  dbCountPromise: Promise<number>;
  dbModule: Promise<DatabaseCatalogModule>;
  offset: number;
  limit: number;
  deviceIntent: boolean;
  deviceLeg?: { query: string; activeCurrency: CurrencyCode; originalQuery?: string };
  displayCurrency: CurrencyCode;
  guardCurrency: CurrencyCode;
  originalQuery?: string;
};

/**
 * Slice the SAME pooled universe for every page: pool positions first, then the
 * pool-excluded DB tail. Both the canonical gate-on path and the cache-first
 * gate-off path share this, so page 1 (persistent cache) and "load more" can
 * never duplicate or skip a product.
 */
async function resolvePooledPagedResult(
  input: PooledPageInput,
): Promise<SearchPageResult> {
  const dbCount = await input.dbCountPromise;
  const total = dbCount > 0 ? dbCount : input.pool.length;

  if (input.offset + input.limit <= input.pool.length) {
    const page = sliceSearchPage(input.pool, input.offset, input.limit);
    return {
      ...page,
      items: toDisplayCurrency(page.items, input.displayCurrency),
      total,
      hasMore: input.offset + input.limit < total,
    };
  }

  const selection = resolvePooledPageSelection(
    input.pool,
    input.offset,
    input.limit,
  );
  const dbPage = await input.dbModule.then((m) =>
    m.getSearchResultsFromDatabasePaged(
      input.query,
      selection.tailStart,
      selection.tailCount,
      {
        timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
        excludeProductIds: selection.excludeProductIds,
        originalQuery: input.originalQuery,
        ...(input.deviceLeg ? { device: input.deviceLeg } : {}),
      },
    ),
  );

  const tailItems = input.deviceIntent
    ? dbPage.items.filter((item) =>
        passesStrictDeviceGuard(
          item.name,
          item.price,
          input.query,
          item.currency,
          input.guardCurrency,
        ),
      )
    : dbPage.items;

  const finalTotal =
    total > 0 ? total : dbPage.total > 0 ? dbPage.total : input.pool.length;

  return {
    items: toDisplayCurrency(
      [...selection.poolHead, ...tailItems],
      input.displayCurrency,
    ),
    total: finalTotal,
    offset: input.offset,
    limit: input.limit,
    hasMore: input.offset + input.limit < finalTotal,
  };
}

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
  activeCurrency?: CurrencyCode,
  useFuzzyMatch = false,
  originalQuery?: string,
): Promise<SearchPageResult> {
  const guardCurrency: CurrencyCode = activeCurrency ?? "USD";
  const displayCurrency: CurrencyCode = activeCurrency ?? DISPLAY_CURRENCY;
  if (!isSurfaceEnabled(SURFACE)) {
    const trimmed = query.trim();
    if (!trimmed) {
      return { items: [], total: 0, offset: 0, limit, hasMore: false };
    }
    const safeOffset = Number.isFinite(offset)
      ? Math.max(0, Math.floor(offset))
      : 0;
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.floor(limit))
      : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;

    // Cache-first "load more": paginate the SAME persisted pool page 1 served
    // (pool positions first, then the pool-excluded DB tail) so the cached
    // first page and later pages stay duplicate/gap-free.
    if (isPersistentSearchCacheEnabled()) {
      const deviceIntent = analyzeSearchQueryIntent(trimmed).kind === "device";
      const deviceLeg = deviceIntent
        ? { query: trimmed, activeCurrency: guardCurrency, originalQuery }
        : undefined;
      const cacheOptions = {
        sortBy,
        activeCurrency: guardCurrency,
        useFuzzyMatch,
        originalQuery,
      };
      const dbModule = import("@/lib/integration/database-catalog");
      const dbCountPromise = dbModule
        .then((m) =>
          m.countSearchResultsFromDatabase(trimmed, {
            timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
            originalQuery,
            ...(deviceLeg ? { device: deviceLeg } : {}),
          }),
        )
        .catch(() => 0);
      const cached = await getCachedSearchResult(
        trimmed,
        PERSISTENT_SEARCH_MAX_ITEMS,
        cacheOptions,
      );
      const pool =
        cached ??
        (await buildAndCacheSearchResult(
          trimmed,
          PERSISTENT_SEARCH_MAX_ITEMS,
          cacheOptions,
        ));
      return resolvePooledPagedResult({
        query: trimmed,
        pool,
        dbCountPromise,
        dbModule,
        offset: safeOffset,
        limit: safeLimit,
        deviceIntent,
        deviceLeg,
        displayCurrency,
        guardCurrency,
        originalQuery,
      });
    }

    const { searchProductsPaged } = await import("@/lib/search/engine");
    const page = await searchProductsPaged(query, offset, limit, {
      optimizeForDeviceIntent: true,
      sortBy,
      ...(activeCurrency ? { activeCurrency: guardCurrency } : {}),
      ...(useFuzzyMatch ? { useFuzzyMatch } : {}),
      ...(originalQuery ? { originalQuery } : {}),
    });
    return { ...page, items: toDisplayCurrency(page.items, displayCurrency) };
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
  // On a DEVICE query the count resolves the guard-passing universe instead of
  // the raw 120K accessory-inclusive match count (database-catalog device legs),
  // so `total`/`hasMore` describe the reachable genuine-device sequence.
  const deviceIntent = analyzeSearchQueryIntent(trimmed).kind === "device";
  const deviceLeg = deviceIntent
    ? { query: trimmed, activeCurrency: guardCurrency, originalQuery }
    : undefined;

  const dbModule = import("@/lib/integration/database-catalog");
  const dbCountPromise = dbModule
    .then((m) =>
      m.countSearchResultsFromDatabase(trimmed, {
        timeoutMs: PROVIDER_FETCH_TIMEOUT_MS,
        originalQuery,
        ...(deviceLeg ? { device: deviceLeg } : {}),
      }),
    )
    .catch(() => 0);
  const pool = await canonicalSearchProducts(
    trimmed,
    SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT,
    sortBy,
    guardCurrency,
    useFuzzyMatch,
    originalQuery,
  );

  return resolvePooledPagedResult({
    query: trimmed,
    pool,
    dbCountPromise,
    dbModule,
    offset: safeOffset,
    limit: safeLimit,
    deviceIntent,
    deviceLeg,
    displayCurrency,
    guardCurrency,
    originalQuery,
  });
}