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
import {
  analyzeSearchQueryIntent,
  FAMILY_RETRIEVAL_KEYWORDS,
} from "@/lib/search/query-intent";
import { assembleProductionSearchResults } from "@/lib/search/production-pipeline";
import { composeSearchPageOne } from "@/lib/search/page-one";
import { unifiedToSearchResultItem } from "@/lib/search/price-comparison";
import type {
  RawProviderListing,
  SearchEngineResult,
  SearchProviderId,
  SearchSortMode,
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
  /**
   * Opt-in device-intent optimization for connectors that can adapt their
   * query (eBay category narrowing, AliExpress family keyword expansion). Only
   * the /search surface sets this; homepage catalog, Compare Prices, and every
   * other engine caller leave it unset and keep the legacy behaviour.
   */
  optimizeForDeviceIntent?: boolean;
};

const FAIR_SEARCH_TTL_MS = 2 * 60 * 1000;
const fairSearchCache = new Map<
  string,
  { items: SearchResultItem[]; expiresAt: number }
>();

/**
 * Merge the live pool with relevant DB supplements. The first `liveLead` slots
 * stay live-only so genuine devices lead; after that one DB item is inserted
 * every `dbEvery` slots, and any leftover DB items drain at the tail. This
 * guarantees DB/imported products remain reachable within `capped` even when
 * the live pool alone already fills the display cap. Pure + exported so the
 * reachability contract is unit-testable.
 */
/**
 * Structurally-balanced merge of the live provider pool with the canonical
 * catalog supplement. The DB rows are reserved at a fixed cadence in the
 * pattern from slot 0 (`dbEvery`-spaced) — NOT appended after a live "lead"
 * that a single provider's volume could fill to the cap. This is the
 * retrieval-layer guarantee the root requirement names: no provider may
 * independently consume the whole window and hide another surface's matching
 * catalog inventory, and the canonical supplement is always reachable (both
 * in-window and through the pager over the same pool).
 *
 * Pattern construction order: `dbEvery`-spaced DB slots first (so canonical
 * rows are structurally present the moment the window opens), then live rows
 * fill every remaining slot. A busy provider can never unbudget the canonical
 * seam because the cadence is decided before any live rows are considered.
 */
export function interleaveLiveAndDbResults(
  live: readonly SearchResultItem[],
  db: readonly SearchResultItem[],
  capped: number,
  _liveLead: number,
  dbEvery: number | bigint,
): SearchResultItem[] {
  const mixed: SearchResultItem[] = [];
  if (capped <= 0) return mixed;

  // Normalize the cadence to a Number exactly once; every arithmetic site below
  // (the `/` divisor and the `+= dbEveryNum` cadence stepper) uses the Number so
  // a BigInt-arriving `dbEvery` (older bigint-typed callers) can never mix with
  // Number on this window's byte-stable cadence math — and the cadence decision
  // itself stays a pure structural cadence, fully independent of how many live
  // rows each provider returned.
  const dbEveryNum = Number(dbEvery);

  // Reserve canonical slots first: every dbEvery-th position (0-based) belongs
  // to the supplement. This is a pure cadence decision and is completely
  // independent of how many live rows each provider returned.
  const dbSlotCount = Math.min(Math.ceil(capped / dbEveryNum), db.length);
  const takenByDb = new Array<boolean>(capped).fill(false);
  let di = 0;
  for (let pos = 0; pos < capped && di < dbSlotCount;     pos += dbEveryNum) {
    takenByDb[pos] = true;
    mixed[pos] = db[di];
    di += 1;
  }

  // Now live fills every position the cadence left open, in ranked order. When
  // live runs out the canonical pool keeps draining into the remainder, so the
  // window is never artificially under-filled and canonical inventory is what
  // a live-only absence exposes (dev live ideal, both in-window and through the
  // pager over the same pool).
  let li = 0;
  let drainDi = di;
  for (let pos = 0; pos < capped; pos++) {
    if (takenByDb[pos] || mixed[pos] !== undefined) continue;
    if (li < live.length) {
      mixed[pos] = live[li];
      li += 1;
    } else if (drainDi < db.length) {
      mixed[pos] = db[drainDi];
      drainDi += 1;
    } else {
      // Both pools exhausted — the remaining positions are structurally empty
      // and fall away.
      break;
    }
  }

  return mixed.filter(Boolean);
}

/**
 * Default live cadence for beyond-window pages: one live result every N slots,
 * mirroring how in-window pages reserve DB rows. Named and exported so the
 * legacy engine seam and the canonical consumption seam cannot drift.
 */
export const DB_PAGE_LIVE_INTERLEAVE_CADENCE = 3;

/**
 * DB-first interleave for pages that reach past the assembled pool window.
 * The DB leg (the complete catalog, discount-ordered and multi-provider) fills
 * every open slot; LIVE rows that are still unconsumed are inserted at the same
 * `Number(dbEvery)` structural cadence that `interleaveLiveAndDbResults`
 * reserves canonical rows at in-window — so live results keep appearing deep
 * into the catalog, and once the live head is exhausted the remaining slots run
 * pure DB. Pure + exported so the cadence seam stays unit-testable.
 */
export function interleaveLiveIntoDbPage(
  live: readonly SearchResultItem[],
  db: readonly SearchResultItem[],
  pageSize: number,
  dbEvery: number | bigint,
): SearchResultItem[] {
  if (pageSize <= 0) return [];
  // Normalize the cadence to a Number exactly once — same seam as
  // interleaveLiveAndDbResults so a BigInt-arriving caller can never mix with
  // Number on this window's cadence math.
  const cadence = Number(dbEvery) > 0 ? Number(dbEvery) : pageSize + 1;

  const page: Array<SearchResultItem | undefined> = [];
  let li = 0;
  let di = 0;
  for (let pos = 0; pos < pageSize; pos++) {
    if (li < live.length && pos % cadence === 0) {
      page[pos] = live[li];
      li += 1;
    } else if (di < db.length) {
      page[pos] = db[di];
      di += 1;
    }
  }
  // Drain any remaining live rows into slots the DB leg could not cover (so the
  // short-tail page is never artificially under-filled).
  for (let pos = 0; pos < pageSize && li < live.length; pos++) {
    if (page[pos] === undefined) {
      page[pos] = live[li];
      li += 1;
    }
  }
  return page.filter((item): item is SearchResultItem => item !== undefined);
}

/**
 * Exact-first merge of the search-pool DB supplement. The exact-query rows
 * (highest relevance) come first, then the matching rows for the canonical
 * family retrieval keyword ("phone", "laptop", "earbuds", …) — the SAME bare
 * family vocabulary the Category surfaces use — deduplicated by item id so a
 * row reachable through both vocabularies appears once. Pure + exported so the
 * exact-first/dedupe contract is unit-testable.
 */
export function mergeDbSupplementExactFirst(
  exactRows: readonly SearchResultItem[],
  familyRows: readonly SearchResultItem[],
): SearchResultItem[] {
  const seen = new Set<string>();
  const merged: SearchResultItem[] = [];
  for (const row of [...exactRows, ...familyRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

/**
 * Search-pool DB supplement: query the canonical/imported ZORINO inventory the
 * Categories already use. Runs the exact query AND the family retrieval
 * keyword in parallel behind the same hard deadline the live providers race,
 * so a slow DB read can never hold the whole search hostage.
 */
async function fetchDbSupplementForSearch(
  query: string,
  cachedLimit: number,
  familyKeyword: string | undefined,
): Promise<SearchResultItem[]> {
  const limit = cachedLimit * 3;
  const loadDbCatalog = () => import("@/lib/integration/database-catalog");
  const exactSub = loadDbCatalog().then((mod) =>
    mod
      .getSearchResultsFromDatabase(query, limit, {
        timeoutMs: providerFetchTimeoutMs,
      })
      .catch(() => [] as SearchResultItem[]),
  );
  const familySub = familyKeyword
    ? loadDbCatalog().then((mod) =>
        mod
          .getSearchResultsFromDatabase(familyKeyword, limit, {
            timeoutMs: providerFetchTimeoutMs,
          })
          .catch(() => [] as SearchResultItem[]),
      )
    : Promise.resolve([] as SearchResultItem[]);
  const [exactRows, familyRows] = await Promise.all([exactSub, familySub]);
  return mergeDbSupplementExactFirst(exactRows, familyRows);
}

/**
 * Hard per-provider budget inside the search fan-out. A slow or stalled
 * connector (e.g. the Admitad feed can take up to ~25s on a cold cache) must
 * never hold the search fan-out — and therefore the homepage catalog, which
 * fans out 8 curated queries through this same engine — hostage. When a
 * connector exceeds the budget its partial work is dropped and the fan-out
 * settles with the faster providers' real results.
 */
const DEFAULT_PROVIDER_FETCH_TIMEOUT_MS = 8_000;
let providerFetchTimeoutMs = DEFAULT_PROVIDER_FETCH_TIMEOUT_MS;

/** Test-only: shrink the per-provider budget so timeout degradation is provable fast. */
export function setProviderFetchTimeoutForTests(ms?: number): void {
  providerFetchTimeoutMs =
    ms === undefined ? DEFAULT_PROVIDER_FETCH_TIMEOUT_MS : Math.max(1, Math.floor(ms));
}

/**
 * Test-only: seed the balanced search pool for a query so the paged seam
 * (`searchProductsPaged`) can be exercised offline with a fully controlled,
 * stable pool — no provider fan-out, no DB supplement fetch. The key mirrors
 * exactly what `searchProducts` builds for a device-intent /search request.
 */
export function setSearchPoolForTests(
  query: string,
  items: ReadonlyArray<SearchResultItem>,
): void {
  const cacheKey = `prod-v20-device-pool:${query.trim().toLowerCase()}:${SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT}:device-opt:sort:relevance`;
  fairSearchCache.set(cacheKey, {
    items: items as SearchResultItem[],
    expiresAt: Date.now() + 60_000,
  });
}

/** Test-only: clear the seeded pool cache back to an empty state. */
export function clearSearchPoolForTests(): void {
  fairSearchCache.clear();
}

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
  // One card per provider+externalId: a device-intent search now fetches the
  // exact query AND the family-keyword fallback, so the same genuine product
  // can legitimately arrive through both legs (same product_id on AliExpress,
  // same offer id on Admitad, …). Collapsing identical provider+externalId
  // here keeps duplicates out of the assembly pipeline entirely.
  const seenListingKeys = new Set<string>();

  const optimizeForDeviceIntent = options?.optimizeForDeviceIntent === true;
  const intent = optimizeForDeviceIntent
    ? analyzeSearchQueryIntent(query)
    : undefined;

  // Provider-neutral family-keyword fallback: a device-intent search fans the
  // exact query AND that family's generic retrieval keyword ("phone", "laptop",
  // "earbuds", …) out to EVERY adapter in parallel, inside the same per-provider
  // budget. The family keyword is the same vocabulary the category surfaces rely
  // on to reach genuine devices beyond a device query's accessory-saturated
  // first pages (see lib/data/category-keywords.ts); it uses the legacy shallow
  // budget so AliExpress searches "phone" exactly as /categories/phones does.
  // The relevance tiers still rank exact/model matches first and drop unrelated
  // family results, and duplicate providerId+externalId pairs collapse in
  // deduplication — so the fallback only ever ADDS genuine inventory to the
  // pool, never floods it.
  const familyKeyword =
    intent?.kind === "device"
      ? FAMILY_RETRIEVAL_KEYWORDS[intent.family]
      : undefined;

  const legacyBudget = {
    minFetch: 60,
    targetFetch: 120,
    maxPages: 4,
  } as const;

  await Promise.all(
    adapters.map(async (adapter) => {
      const started = Date.now();
      try {
        const searches = [
          adapter.search(query, {
            minFetch: options?.minFetch ?? SEARCH_ENGINE_DEFAULTS.MIN_FETCH_COUNT,
            targetFetch: options?.targetFetch ?? SEARCH_ENGINE_DEFAULTS.TARGET_FETCH_COUNT,
            maxPages: options?.maxPages,
            // Only present when optimizing, so the default (homepage/compare)
            // adapter options stay byte-identical to before.
            ...(intent ? { optimizeForDeviceIntent: true as const, intent } : {}),
          }),
        ];
        if (familyKeyword) {
          searches.push(adapter.search(familyKeyword, legacyBudget));
        }
        // Every leg races the per-provider timeout INDEPENDENTLY: a slow
        // family-keyword leg must never keep the fast exact-query leg from
        // contributing its real results (a broad "phone" keyword hit can run
        // long on a flaky provider and was silently collapsing the whole
        // provider to zero under a single shared race). Legs that fail or
        // time out contribute nothing without discarding their peers.
        const timeoutOnly = async (leg: ReturnType<typeof adapter.search>) => {
          try {
            return await Promise.race([
              leg,
              new Promise<{
                providerId: SearchProviderId;
                listings: RawProviderListing[];
                durationMs: number;
              }>((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      providerId: adapter.id,
                      listings: [],
                      // A timed-out leg contributes no fetched/normalized
                      // results and its duration is not credited.
                      durationMs: 0,
                    }),
                  providerFetchTimeoutMs,
                ),
              ),
            ]);
          } catch {
            // One failing leg (e.g. a rate-limited family keyword) must not
            // discard the other leg's real results.
            return {
              providerId: adapter.id,
              listings: [] as RawProviderListing[],
              durationMs: 0,
            };
          }
        };
        const settled = await Promise.all(searches.map(timeoutOnly));
        const result = {
          providerId: adapter.id,
          listings: settled.flatMap((s) => s.listings),
          durationMs: Math.max(...settled.map((s) => s.durationMs), 0),
        };
        const merged = result.listings.filter((listing) => {
          const key = `${listing.providerId}:${listing.externalId}`;
          if (seenListingKeys.has(key)) return false;
          seenListingKeys.add(key);
          return true;
        });
        // Requirement 1 — fetching limit per source: a single source may never
        // push more than MAX_LISTINGS_PER_SOURCE raw listings into the pool per
        // search query, so slow/lean peers (AliExpress, Admitad) are never
        // drowned out by a high-volume source's paginated tail.
        const cappedMerged = merged.slice(
          0,
          SEARCH_ENGINE_DEFAULTS.MAX_LISTINGS_PER_SOURCE,
        );
        allRaw.push(...cappedMerged);
        recordProviderRun(result.providerId, cappedMerged.length);
        providerStats.push({
          providerId: result.providerId,
          fetched: cappedMerged.length,
          normalized: cappedMerged.length,
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
  limit: number = SEARCH_ENGINE_DEFAULTS.DEFAULT_LIMIT,
  options?: { optimizeForDeviceIntent?: boolean; sortBy?: SearchSortMode },
): Promise<SearchResultItem[]> {
  const capped = Math.min(limit, SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const optimizeForDeviceIntent = options?.optimizeForDeviceIntent === true;
  const sortBy: SearchSortMode = options?.sortBy ?? "relevance";
  // Separate cache namespaces per mode + sort so a price-sorted pool can never
  // be served to (or evict) the relevance pool for the same query.
  const cacheKey = `prod-v20-device-pool:${trimmed.toLowerCase()}:${capped}${
    optimizeForDeviceIntent ? ":device-opt" : ""
  }:sort:${sortBy}`;
  const cached = fairSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items.slice(0, capped);
  }

  // Explicit device-intent query (e.g. "iphone 15 pro max", "airpods pro") on
  // the /search surface. For these, a shallow keyword page can be dominated by
  // accessories (cases, chargers, screen protectors) even when genuine devices
  // exist — so retrieval pages deeper to reach each provider's genuine
  // inventory instead of mistaking the first accessory-saturated page for
  // "no genuine match". The pool itself is never gated: assembly stays
  // device-first across all providers.
  // Intent + the canonical family retrieval keyword — the SAME bare family
  // vocabulary the Category surfaces search ("phone", "laptop", "earbuds", …).
  // The search pool must reach the same canonical/imported ZORINO inventory the
  // Categories surface, enriched by the exact query — never a different,
  // narrower universe of products.
  const intentForSearch = optimizeForDeviceIntent
    ? analyzeSearchQueryIntent(trimmed)
    : undefined;
  const deviceIntent = intentForSearch?.kind === "device";
  const familyRetrievalForSearch =
    deviceIntent && intentForSearch.family !== "unknown"
      ? FAMILY_RETRIEVAL_KEYWORDS[intentForSearch.family]
      : undefined;
  const canonicalFamilyKeyword =
    familyRetrievalForSearch &&
    familyRetrievalForSearch.toLowerCase() !== trimmed.toLowerCase()
      ? familyRetrievalForSearch
      : undefined;

  const [{ allRaw }, fromDb, activeProviderIds] = await Promise.all([
    fetchProvidersInParallel(trimmed, {
      // Device-intent searches page deeper so an accessory-saturated catalog is
      // not mistaken for "no genuine inventory" after one shallow page. Still
      // bounded by the same per-provider fetch budget as before.
      minFetch: optimizeForDeviceIntent ? 100 : 60,
      targetFetch: optimizeForDeviceIntent ? 300 : 120,
      maxPages: optimizeForDeviceIntent ? 8 : 4,
      ...(optimizeForDeviceIntent ? { optimizeForDeviceIntent: true } : {}),
    }),
    // DB supplement: exact query first, then the canonical family keyword, so
    // Search reaches the same imported/canonical inventory the Categories show.
    fetchDbSupplementForSearch(trimmed, capped, canonicalFamilyKeyword),
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

  // One pool that flows from EVERY provider (live + imported) through the same
  // device-first production pipeline. No device-intent gate: a provider whose
  // retrieval holds genuine devices contributes them (leading every page), and
  // a provider with only relevant accessories contributes those behind all
  // genuine matches — so Search stays multi-provider and can never read as
  // "eBay-only", while accessories can never displace a genuine match.
  // Imported rows are mapped to the RawProviderListing vocabulary and pass
  // through exactly the same relevance tiers as live listings (drop none &
  // repair inside the pipeline) before being restored to their `db-*` identity.
  const liveTitlePrefixes = new Set(
    allRaw.map((listing) => listing.title.toLowerCase().slice(0, 30)),
  );
  const dbAsRaw: RawProviderListing[] = [];
  for (const dbItem of activeDb) {
    if (liveTitlePrefixes.has(dbItem.name.toLowerCase().slice(0, 30))) continue;
    dbAsRaw.push({
      providerId: dbItem.storeSlug as SearchProviderId,
      externalId: `__db__${dbItem.id}`,
      title: dbItem.name,
      imageUrl: dbItem.imageSrc,
      price: dbItem.price,
      originalPrice:
        dbItem.originalPrice > 0 ? dbItem.originalPrice : dbItem.price,
      discount: dbItem.discount ?? 0,
      currency: dbItem.currency ?? "USD",
      storeName: dbItem.store,
      category: dbItem.category ?? "General",
      rating: dbItem.rating ?? 0,
      reviewCount: dbItem.reviewCount ?? 0,
      salesCount: dbItem.salesCount,
      inStock: dbItem.inStock,
      productUrl: dbItem.affiliateUrl ?? "#",
      affiliateUrl: dbItem.affiliateUrl,
      countryCode: dbItem.countryCode,
    });
  }

  const assembled = assembleProductionSearchResults(
    [...allRaw, ...dbAsRaw],
    trimmed,
    capped,
    { sortBy },
  );

  // Restore original imported-row identity so Compare Prices / PDP / affiliate
  // routing keep resolving the same `db-<product_id>` ids the UI already knows.
  const dbById = new Map(activeDb.map((item) => [item.id, item]));
  const mixed = assembled.map((item) => {
    const dbKey = `${item.storeSlug}-__db__`;
    if (item.id.startsWith(dbKey)) {
      const original = dbById.get(item.id.slice(dbKey.length));
      if (original) return original;
    }
    return item;
  });

  // /search page-1 composition seam: recompose ONLY the head of the balanced
  // pool so every provider that genuinely holds matching results appears
  // EARLY inside the first page (providers missing from page 1 get their best
  // genuine devices placed right behind the preserved global-relevance lead —
  // a truthful presence, bounded, never a forced equal share). A pure
  // permutation of the SAME item set — total, hasMore, zero-duplicate and
  // DB-leg exclusion are all computed from the unchanged pool, so pagination
  // semantics are untouched. Homepage / Compare Prices never pass the flag,
  // so their pools stay byte-identical.
  const composed =
    optimizeForDeviceIntent && sortBy !== "price"
      ? composeSearchPageOne(mixed, trimmed)
      : mixed;
  fairSearchCache.set(cacheKey, {
    items: composed,
    expiresAt: Date.now() + FAIR_SEARCH_TTL_MS,
  });

  return composed;
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
 * Resolve which universe positions a paged request past the balanced pool is
 * asking for. The complete matching universe is ONE deterministic sequence:
 *
 *   positions [0, pool.length)           → the balanced pool (live + db rows in
 *                                         device-first assemble order)
 *   positions [pool.length, total)       → the discount-ordered DB leg MINUS
 *                                         the db rows the pool already emitted
 *
 * Returns exactly the pool rows the page still needs (`poolHead`), the tail
 * rank to start the DB leg at (`tailStart`, 0-based within the excluded
 * universe), how many tail rows the page has room for (`tailCount`), and the
 * set of `product_id`s to exclude from the DB leg so a window can never
 * re-serve a row an earlier page already showed. Pure + exported so the
 * universe-seam contract is unit-testable without live providers.
 */
export function resolvePooledPageSelection(
  pool: readonly SearchResultItem[],
  offset: number,
  limit: number,
): {
  poolHead: SearchResultItem[];
  tailStart: number;
  tailCount: number;
  excludeProductIds: string[];
} {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;

  // The pool occupies [0, pool.length); any position at or past it is a tail
  // rank into the excluded DB universe.
  const tailStart = Math.max(0, safeOffset - pool.length);
  const tailCount = Math.min(
    safeLimit,
    Math.max(0, safeOffset + safeLimit - pool.length),
  );
  const poolHead = pool.slice(
    safeOffset,
    Math.min(safeOffset + safeLimit, pool.length),
  );

  // Every db row the pool emitted belongs to universe positions
  // [0, pool.length) — exclude ALL of them (by set, wherever they sit in
  // discount order) so the tail cannot re-serve them.
  const excludeProductIds: string[] = [];
  for (const item of pool) {
    if (!item.id.startsWith("db-")) continue;
    const productId = item.id.slice("db-".length);
    if (productId) excludeProductIds.push(productId);
  }

  return { poolHead, tailStart, tailCount, excludeProductIds };
}

/**
 * Paged view over the unified search pool. The full balanced pool is fetched
 * (and cached, exactly as searchProducts does) and then sliced — so page 1,
 * page 2, … always describe the same stable sequence from one search.
 *
 * Truthful total: `total` and `hasMore` come from the exact Supabase match
 * count when the DB leg is live (a slow/failed count resolves 0), falling back
 * to the balanced pool length so the legacy pure-pool behaviour is preserved
 * when the database is unavailable.
 *
 * Beyond the 200-item pool window the pages keep running off the DB-index-level
 * paged leg (`getSearchResultsFromDatabasePaged`), so the complete catalog
 * (10,000+) is reachable page-by-page without loading it into memory and no
 * single provider monopolizes later pages. The tail index is a rank into the
 * pool-excluded DB universe (`resolvePooledPageSelection`), so every page is a
 * successive, duplicate/gap-free portion of the SAME complete matching
 * universe — the pool's db rows are excluded by SET (not skipped by count),
 * because the pool is not a discount-prefix and a count-skip re-serves rows
 * already shown.
 */
export async function searchProductsPaged(
  query: string,
  offset: number,
  limit: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
  options?: { optimizeForDeviceIntent?: boolean; sortBy?: SearchSortMode }
): Promise<SearchPageResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], total: 0, offset: 0, limit, hasMore: false };
  }
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : SEARCH_ENGINE_DEFAULTS.PAGE_SIZE;

  // The balanced pool and the exact DB count race together so the truthful
  // total never adds latency to the pool fetch. Count resolves 0 on timeout /
  // failure / empty DB → pool.length keeps the historical in-window behaviour.
  const dbModule = import("@/lib/integration/database-catalog");
  const [pool, dbCountP] = await Promise.all([
    searchProducts(
      trimmed,
      SEARCH_ENGINE_DEFAULTS.MAX_DISPLAY_LIMIT,
      options
    ),
    dbModule.then((m) =>
      m.countSearchResultsFromDatabase(trimmed, {
        timeoutMs: providerFetchTimeoutMs,
      }),
    ),
  ]);
  const dbCount = await dbCountP;
  const total = dbCount > 0 ? dbCount : pool.length;

  // The complete matching universe this pager serves is ONE deterministic
  // sequence, and page offset N is exactly universe position N:
  //
  //   positions [0, pool.length)            → the balanced pool (live + db rows
  //                                            in device-first assemble order)
  //   positions [pool.length, total)        → the discount-ordered DB leg,
  //                                            EXCLUDING the db rows the pool
  //                                            already emitted (by set, not by
  //                                            count — the pool is not a
  //                                            discount-prefix of the leg)
  //
  // A page fully inside the pool window is therefore a straight pool slice —
  // the pool head is the universe, not a separate capped universe. Only pages
  // reaching past the pool fetch the DB leg, at an EXCLUSION-filtered rank that
  // advances with the offset past the pool, so every page is a successive,
  // duplicate/gap-free portion of the SAME complete matching universe with a
  // truthful total. This keeps the architectural fix (no 200-row cap on
  // reachability, complete catalog paged by normal pagination, eBay untamed,
  // no provider quotas) while removing the count-skip hedge
  // (`dbConsumedInPool`) that repeated rows already shown by the pool.
  if (safeOffset + safeLimit <= pool.length) {
    const page = sliceSearchPage(pool, safeOffset, safeLimit);
    return {
      ...page,
      total,
      hasMore: safeOffset + safeLimit < total,
    };
  }

  // Page reaches past the balanced pool head: take the remaining pool positions
  // [safeOffset, pool.length) as-is (they belong first), then continue the
  // complete universe from the pool-excluded DB leg at rank
  // (safeOffset - pool.length). The DB leg already excludes the pool's db rows
  // by set (WHERE product_id NOT IN poolDbIds), so rank 0 is the true row after
  // the pool in discount order — a window can never re-serve a row an earlier
  // page already showed, nor skip a discount-head row the pool never placed.
  const selection = resolvePooledPageSelection(pool, safeOffset, safeLimit);

  const dbPage = await dbModule.then((m) =>
    m.getSearchResultsFromDatabasePaged(
      trimmed,
      selection.tailStart,
      selection.tailCount,
      { timeoutMs: providerFetchTimeoutMs, excludeProductIds: selection.excludeProductIds },
    ),
  );

  // Prefer the truthful DB count; if only the paged leg succeeded, trust its
  // exact count; otherwise the pool length keeps the historical behaviour.
  const finalTotal =
    total > 0 ? total : dbPage.total > 0 ? dbPage.total : pool.length;

  const items = [...selection.poolHead, ...dbPage.items];

  return {
    items,
    total: finalTotal,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < finalTotal,
  };
}

/** Keep cheapest-offer mapping available for non-search callers. */
export { unifiedToSearchResultItem };
