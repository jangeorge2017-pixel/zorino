import { queryWantsAccessory } from "@/lib/search/relevance";
import {
  compareByRelevanceThenQuality,
  isComparablyRelevant,
  rankRawListings,
} from "@/lib/search/ranking";
import { listingToSearchResultItem } from "@/lib/search/price-comparison";
import { balanceMarketplaceQueues } from "@/lib/search/marketplace-balance";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
  SearchSortMode,
} from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

/**
 * Search-result assembly policy: strict alternation. After a pick, the very
 * next slot belongs to a different source whenever a peer still has stock, so
 * the final layout interleaves providers 1-1-1 (eBay → AliExpress → Source C
 * → loop) instead of letting one source's volume read as a block. Homepage
 * sections (`balanceFlatMarketplaceList`) keep the looser 2-consecutive rule.
 */
export const MAX_CONSECUTIVE_SAME_MARKETPLACE = 1;

/**
 * Best offer among duplicates (used when collapsing leftover ties / price comparison).
 * Priority: availability → price → relevance → rating → popularity.
 */
export function pickBestOffer(
  offers: NormalizedSearchListing[],
): NormalizedSearchListing {
  return [...offers].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (a.price !== b.price) return a.price - b.price;
    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (a.rating !== b.rating) return b.rating - a.rating;
    const popA = (a.salesCount ?? 0) + a.reviewCount * 2 + a.rating * 10;
    const popB = (b.salesCount ?? 0) + b.reviewCount * 2 + b.rating * 10;
    return popB - popA;
  })[0]!;
}

function isPrimaryDeviceListing(row: NormalizedSearchListing): boolean {
  // Only strong device matches (exact/model) lead a page. Weak device matches
  // (series/brand tier, e.g. a wrong-generation iPhone, a sibling AirPods
  // gen, a stylus) must not displace genuine devices from another provider
  // during marketplace balancing; they rank in the secondary phase behind all
  // strong matches.
  return row.isDevice && (row.matchTier === "exact" || row.matchTier === "model");
}

function splitProviderQueues(
  ranked: NormalizedSearchListing[],
  query: string,
): {
  primary: NormalizedSearchListing[];
  secondaryDevices: NormalizedSearchListing[];
  accessories: NormalizedSearchListing[];
} {
  const wantsAccessory = queryWantsAccessory(query);

  if (wantsAccessory) {
    const kept = ranked.filter((row) => row.matchTier !== "repair" && row.matchTier !== "none");
    return { primary: kept, secondaryDevices: [], accessories: [] };
  }

  const primary = ranked.filter(isPrimaryDeviceListing);
  const secondaryDevices = ranked.filter(
    (row) => !isPrimaryDeviceListing(row) && row.isDevice,
  );
  const accessories = ranked.filter(
    (row) => !isPrimaryDeviceListing(row) && !row.isDevice,
  );
  return { primary, secondaryDevices, accessories };
}

/**
 * Search-card dedupe:
 * - Drop exact same listing (provider + external id) only
 * - Keep cross-marketplace offers for price comparison
 */
function isSearchCardDuplicate(
  accepted: NormalizedSearchListing[],
  candidate: NormalizedSearchListing,
): boolean {
  return accepted.some(
    (existing) =>
      existing.providerId === candidate.providerId &&
      existing.externalId === candidate.externalId,
  );
}

function dedupeQueue(
  queue: NormalizedSearchListing[],
  accepted: NormalizedSearchListing[],
): NormalizedSearchListing[] {
  return queue.filter((candidate) => !isSearchCardDuplicate(accepted, candidate));
}

/**
 * Pool-level ceiling: before the genuine inventory of every other provider gets
 * its slots, a SINGLE marketplace's exact/model block may occupy at most this
 * share of the pool (floored to a full page). Market-agnostic — derived from
 * the pool size, never from a provider id. When a marketplace genuinely is the
 * only source of results the ceiling never binds (the refill pass below fills
 * the pool with its real stock), so genuine volume is never discarded.
 */
export const SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE = 0.6;

/** Per-provider slot ceiling for the leading exact/model block of one pool. */
export function exactModelPerProviderCeiling(limit: number): number {
  return Math.max(
    SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
    Math.ceil(limit * SEARCH_POOL_SINGLE_PROVIDER_EXACT_SHARE),
  );
}

/**
 * Strict per-source share of a search pool: `ceil(limit / n)` where n = number
 * of sources that actually returned results. This is the hard, source-agnostic
 * cap behind Requirement 1 — no single marketplace may contribute more than its
 * equal share of a query's final results. It stays dynamic so a genuinely lone
 * provider (n = 1) still fills the whole pool with real stock and is never
 * trimmed.
 */
export function perProviderEqualShareCeiling(limit: number, activeProviders: number): number {
  if (activeProviders <= 0) return limit;
  return Math.max(1, Math.ceil(limit / activeProviders));
}

function balancePhase(
  queuesByProvider: Map<string, NormalizedSearchListing[]>,
  limit: number,
  accepted: NormalizedSearchListing[],
  perProviderSlice?: number,
): NormalizedSearchListing[] {
  const cleaned = new Map<string, NormalizedSearchListing[]>();
  for (const [providerId, queue] of queuesByProvider) {
    let next = dedupeQueue(queue, accepted);
    if (perProviderSlice !== undefined && next.length > perProviderSlice) {
      next = next.slice(0, perProviderSlice);
    }
    if (next.length) cleaned.set(providerId, next);
  }

  return balanceMarketplaceQueues(cleaned, {
    limit,
    compare: compareByRelevanceThenQuality,
    isComparable: isComparablyRelevant,
    maxConsecutive: MAX_CONSECUTIVE_SAME_MARKETPLACE,
  });
}

/** Number of leading positions the price-mode diversity cap covers. */
export const PRICE_SORT_DIVERSITY_WINDOW = 12;

/** Max consecutive slots one provider may hold inside the diversity window. */
export const PRICE_SORT_MAX_CONSECUTIVE_SAME_PROVIDER = 2;

export type DiversityEnforceable = { providerId: string };

/**
 * Pure viewport diversity enforcement for a sorted (price-ordered) list.
 *
 * Keeps the pure global sort order EXCEPT where it would let one marketplace
 * hold more than `maxConsecutive` consecutive slots inside the leading
 * `windowSize` viewport. When the head would violate the cap, the next-cheapest
 * item from a DIFFERENT provider is interleaved instead. A genuinely lone
 * provider (no other provider has any remaining items) is never trimmed — the
 * head is taken as-is rather than dropping real stock into the tail. The result
 * is a pure permutation of `sorted` (same items, minimally reordered), so
 * pagination totals / hasMore semantics computed from the pool are untouched.
 */
export function diversifyTopViewport<T extends DiversityEnforceable>(
  sorted: readonly T[],
  windowSize = PRICE_SORT_DIVERSITY_WINDOW,
  maxConsecutive = PRICE_SORT_MAX_CONSECUTIVE_SAME_PROVIDER,
): T[] {
  if (sorted.length <= 1) return [...sorted];
  const window = Math.max(1, Math.floor(windowSize));
  const cap = Math.max(1, Math.floor(maxConsecutive));
  const queue: T[] = [...sorted];
  const out: T[] = [];
  let streakProvider: string | null = null;
  let streakCount = 0;

  const push = (item: T): void => {
    if (item.providerId === streakProvider) {
      streakCount += 1;
    } else {
      streakProvider = item.providerId;
      streakCount = 1;
    }
    out.push(item);
  };

  while (out.length < window && queue.length > 0) {
    const head = queue[0]!;
    const wouldViolate =
      streakProvider === head.providerId && streakCount >= cap;

    if (wouldViolate) {
      // Interleave the next-cheapest item from a different provider so the
      // current streak is broken before another single-provider slot.
      const otherIdx = queue.findIndex(
        (item, i) => i > 0 && item.providerId !== streakProvider,
      );
      if (otherIdx !== -1) {
        const [picked] = queue.splice(otherIdx, 1);
        push(picked);
        continue;
      }
      // No other provider has any remaining stock → lone provider keeps the
      // spot (genuine volume is never discarded).
    }

    push(queue.shift()!);
  }

  // The rest of the list stays in its pure sorted order.
  for (const item of queue) out.push(item);
  return out;
}

/**
 * Max share of a full page viewport a single source may hold. Complements the
 * equal-share round-robin balancer: even when a provider genuinely holds most
 * matches, no single source may take more than 60% of a page's seats while any
 * peer provider is present.
 */
export const VIEWPORT_SINGLE_SOURCE_MAX_SHARE = 0.6;

/**
 * Pure per-viewport single-source cap (anti-monopoly guardrail).
 *
 * For EVERY full `windowSize`-slot window of the pool (a page's viewport), when
 * at least two distinct providers are present, no single source may hold more
 * than `Math.floor(windowSize * maxShare)` seats inside that window; the
 * surplus rows (their later positions within the window) are relocated to the
 * pool tail. A genuinely lone-provider window — and a partial final window —
 * passes through untouched, so real stock is never discarded.
 *
 * The result is a PURE PERMUTATION of `items` (same membership, no drops,
 * relative order preserved within each kept run), so pool total / hasMore /
 * zero-duplicate semantics computed from the pool are untouched and the
 * surplus stays reachable on later pages. Deterministic and market-agnostic —
 * never a provider id, never a quota.
 */
export function enforceViewportSingleSourceCap<T>(
  items: readonly T[],
  providerOf: (item: T) => string,
  windowSize: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
  maxShare: number = VIEWPORT_SINGLE_SOURCE_MAX_SHARE,
): T[] {
  const win = Math.max(1, Math.floor(windowSize));
  if (win <= 1 || items.length === 0) return [...items];
  const perWindowCap = Math.floor(win * maxShare);

  const out: T[] = [];
  const deferred: T[] = [];

  for (let start = 0; start < items.length; start += win) {
    const window = items.slice(start, start + win);
    // Partial tail window, or a window with a single provider, stays untouched.
    if (window.length < win || new Set(window.map(providerOf)).size < 2) {
      out.push(...window);
      continue;
    }
    const counts = new Map<string, number>();
    for (const item of window) {
      const provider = providerOf(item);
      const taken = counts.get(provider) ?? 0;
      if (taken < perWindowCap) {
        counts.set(provider, taken + 1);
        out.push(item);
      } else {
        deferred.push(item);
      }
    }
  }

  return [...out, ...deferred];
}

/**
 * Universal price sort (Requirement 3): merge EVERY source's ranked inventory
 * into one array, then sort strictly by price (lowest → highest) regardless of
 * which marketplace a product belongs to. Relevance survives only as a
 * tie-breaker for equal-priced items. Round-robin balancing is intentionally
 * skipped here — the user asked for a pure global price order when sort is on.
 * A top-viewport diversity cap (no single provider more than 2 consecutive
 * slots in the leading 12) interleaves the next-cheapest from other platforms
 * so a single marketplace's cheap items can never monopolize the user's first
 * viewport.
 */
function assemblePriceSortedSearchResults(
  allRaw: RawProviderListing[],
  query: string,
  limit: number,
): SearchResultItem[] {
  const ranked: NormalizedSearchListing[] = [];
  const byProvider = groupRawByProvider(allRaw);
  for (const raw of byProvider.values()) {
    if (!raw.length) continue;
    ranked.push(...rankRawListings(raw, query));
  }
  const rankedBySource = new Map<SearchProviderId, number>();
  for (const listing of ranked) {
    rankedBySource.set(
      listing.providerId,
      (rankedBySource.get(listing.providerId) ?? 0) + 1,
    );
  }
  console.log(
    `[search-assembly] query="${query}" price_mode ranked_total=${ranked.length} by_source=[${[
      ...rankedBySource.entries(),
    ]
      .map(([id, count]) => `${id}:${count}`)
      .join(",")}]`,
  );
  const sorted = [...ranked].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    // Equal price → the better-relevance / higher-quality listing first.
    return compareByRelevanceThenQuality(a, b);
  });
  const diversified = diversifyTopViewport(sorted);
  return diversified.slice(0, limit).map(listingToSearchResultItem);
}

function groupRawByProvider(
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

export type ProductionAssemblyOptions = {
  /**
   * "relevance" (default) → phased, strictly-interleaved round-robin assembly.
   * "price" → all sources merged and sorted lowest→highest by price.
   */
  sortBy?: SearchSortMode;
};

/**
 * Production search assembly — marketplace-agnostic:
 * 1) Rank each present marketplace independently
 * 2) Cap each source to its strict equal share of the pool (ceil(limit / n))
 * 3) Balance dynamically across whatever providers returned results via a
 *    strictly alternating 1-1-1 round-robin (no provider may put two results
 *    back-to-back while a peer still has stock)
 * 4) Preserve affiliate URLs; keep cross-marketplace offers for comparison
 *
 * New marketplaces participate automatically when their connector returns data.
 */
export function assembleProductionSearchResults(
  allRaw: RawProviderListing[],
  query: string,
  limit: number,
  options?: ProductionAssemblyOptions,
): SearchResultItem[] {
  if (allRaw.length === 0 || limit <= 0) return [];

  if (options?.sortBy === "price") {
    return assemblePriceSortedSearchResults(allRaw, query, limit);
  }

  // Pass 1 — rank each present marketplace independently and count how many
  // sources genuinely returned results (a source that ranks to nothing is not
  // counted, so it never eats into the equal share of real contributors).
  const rankedByProvider = new Map<SearchProviderId, NormalizedSearchListing[]>();
  for (const [providerId, raw] of groupRawByProvider(allRaw)) {
    if (!raw.length) continue;
    const ranked = rankRawListings(raw, query);
    if (ranked.length > 0) rankedByProvider.set(providerId, ranked);
  }
  if (rankedByProvider.size === 0) return [];

  // Requirement 3 — strict per-source debug logging: after passing through the
  // exact same relevance gates that decide the final pool, report how many
  // listings each provider actually contributed, so a provider that vanished
  // during ranking is visible even when one marketplace holds the whole pool.
  console.log(
    `[search-assembly] query="${query}" ranked_sources=${rankedByProvider.size} counts=[${[...rankedByProvider.entries()]
      .map(([id, list]) => `${id}:${list.length}`)
      .join(",")}]`,
  );

  // Strict per-source cap (Requirement 1): no single source may contribute more
  // than ceil(limit / activeSources) of the final pool, so eBay's 300-listing
  // response can never crowd out AliExpress / Admitad / DB inventory. A lone
  // provider keeps the whole pool.
  const maxPerProvider = perProviderEqualShareCeiling(limit, rankedByProvider.size);

  const primaryQueues = new Map<string, NormalizedSearchListing[]>();
  const secondaryDeviceQueues = new Map<string, NormalizedSearchListing[]>();
  const accessoryQueues = new Map<string, NormalizedSearchListing[]>();

  // Pass 2 — slice each source to its equal share, then split into device tiers.
  // Slicing BEFORE the tier split is what makes the cap HARD across every phase
  // (including the uncapped refill): a source can never reappear from a later
  // tier once its share is spent.
  for (const [providerId, ranked] of rankedByProvider) {
    const capped = ranked.length > maxPerProvider ? ranked.slice(0, maxPerProvider) : ranked;
    const { primary, secondaryDevices, accessories } = splitProviderQueues(capped, query);
    if (primary.length) primaryQueues.set(providerId, primary);
    if (secondaryDevices.length) secondaryDeviceQueues.set(providerId, secondaryDevices);
    if (accessories.length) accessoryQueues.set(providerId, accessories);
  }

  console.log(
    `[search-assembly] query="${query}" tier_split maxPerProvider=${maxPerProvider} primary=[${[
      ...primaryQueues.entries(),
    ]
      .map(([id, l]) => `${id}:${l.length}`)
      .join(",")}] secondary=[${[...secondaryDeviceQueues.entries()]
      .map(([id, l]) => `${id}:${l.length}`)
      .join(",")}] accessories=[${[...accessoryQueues.entries()]
      .map(([id, l]) => `${id}:${l.length}`)
      .join(",")}]`,
  );

  if (
    primaryQueues.size === 0 &&
    secondaryDeviceQueues.size === 0 &&
    accessoryQueues.size === 0
  ) {
    return [];
  }

  const accepted: NormalizedSearchListing[] = [];
  const ceiling = exactModelPerProviderCeiling(limit);
  const fill = (
    queues: Map<string, NormalizedSearchListing[]>,
    budget: number,
    capped: boolean,
  ): void => {
    const picks = balancePhase(queues, budget, accepted, capped ? ceiling : undefined);
    for (const item of picks) accepted.push(item);
  };

  // Phase 1: strong device matches (exact/model) only. The per-provider ceiling
  // stops one marketplace's exact/model block from monopolizing the whole pool:
  // when another provider holds genuine matching inventory (the same family /
  // imported rows the Category surfaces), it keeps a guaranteed share of the
  // leading pool instead of being crowded out by sheer volume.
  fill(primaryQueues, limit, true);

  // Phase 2: other real devices (wrong-generation phones, sibling devices) —
  // when a flaky provider leaves zero strong matches, genuine devices must
  // still lead page 1 ahead of accessories (cases, cables, docks, ...).
  if (accepted.length < limit && secondaryDeviceQueues.size > 0) {
    fill(secondaryDeviceQueues, limit - accepted.length, true);
  }

  // Phase 3: accessories / non-device matches fill only the remaining slots.
  if (accepted.length < limit && accessoryQueues.size > 0) {
    fill(accessoryQueues, limit - accepted.length, true);
  }

  // Refill (ceiling off, same phase order): genuine leftovers beyond the exact-
  // model ceiling fill any remaining pool slots. Still HARD-capped at each
  // source's equal share (queues were pre-sliced above), so a volume leader's
  // real stock is only kept while its fair share is not yet exhausted.
  if (accepted.length < limit && primaryQueues.size > 0) {
    fill(primaryQueues, limit - accepted.length, false);
  }
  if (accepted.length < limit && secondaryDeviceQueues.size > 0) {
    fill(secondaryDeviceQueues, limit - accepted.length, false);
  }
  if (accepted.length < limit && accessoryQueues.size > 0) {
    fill(accessoryQueues, limit - accepted.length, false);
  }

  return accepted.map(listingToSearchResultItem);
}

export { listingToSearchResultItem };
