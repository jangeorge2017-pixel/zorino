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
} from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

/** @deprecated Use dynamic fairShare in marketplace-balance — kept for tests. */
export const MAX_CONSECUTIVE_SAME_MARKETPLACE = 2;

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
 * Production search assembly — marketplace-agnostic:
 * 1) Rank each present marketplace independently
 * 2) Balance dynamically across whatever providers returned results
 * 3) Preserve affiliate URLs; keep cross-marketplace offers for comparison
 *
 * New marketplaces participate automatically when their connector returns data.
 */
export function assembleProductionSearchResults(
  allRaw: RawProviderListing[],
  query: string,
  limit: number,
): SearchResultItem[] {
  if (allRaw.length === 0 || limit <= 0) return [];

  const byProvider = new Map<SearchProviderId, RawProviderListing[]>();
  for (const listing of allRaw) {
    const bucket = byProvider.get(listing.providerId) ?? [];
    bucket.push(listing);
    byProvider.set(listing.providerId, bucket);
  }

  const primaryQueues = new Map<string, NormalizedSearchListing[]>();
  const secondaryDeviceQueues = new Map<string, NormalizedSearchListing[]>();
  const accessoryQueues = new Map<string, NormalizedSearchListing[]>();

  // Dynamic provider set — no hardcoded marketplace list.
  for (const [providerId, raw] of byProvider) {
    if (!raw.length) continue;
    const ranked = rankRawListings(raw, query);
    const { primary, secondaryDevices, accessories } = splitProviderQueues(ranked, query);
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

  // Refill (UNCAPPED, same phase order): genuine leftovers beyond the ceiling
  // fill any remaining pool slots so a volume leader's real stock is never
  // dropped — it simply sits behind every provider's genuine inventory.
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
