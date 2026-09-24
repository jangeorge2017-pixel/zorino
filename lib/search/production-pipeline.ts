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

/**
 * Universal price sort (Requirement 3): merge EVERY source's ranked inventory
 * into one array, then sort strictly by price (lowest → highest) regardless of
 * which marketplace a product belongs to. Relevance survives only as a
 * tie-breaker for equal-priced items. Round-robin balancing is intentionally
 * skipped here — the user asked for a pure global price order when sort is on.
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
  const sorted = [...ranked].sort((a, b) => {
    if (a.price !== b.price) return a.price - b.price;
    // Equal price → the better-relevance / higher-quality listing first.
    return compareByRelevanceThenQuality(a, b);
  });
  return sorted.slice(0, limit).map(listingToSearchResultItem);
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
