import { queryWantsAccessory } from "@/lib/search/relevance";
import {
  compareByRelevanceThenQuality,
  isComparablyRelevant,
  rankRawListings,
} from "@/lib/search/ranking";
import { listingToSearchResultItem } from "@/lib/search/price-comparison";
import { balanceMarketplaceQueues } from "@/lib/search/marketplace-balance";
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
  return row.isDevice && row.matchTier !== "accessory" && row.matchTier !== "repair";
}

function splitProviderQueues(
  ranked: NormalizedSearchListing[],
  query: string,
): { primary: NormalizedSearchListing[]; secondary: NormalizedSearchListing[] } {
  const wantsAccessory = queryWantsAccessory(query);

  if (wantsAccessory) {
    const kept = ranked.filter((row) => row.matchTier !== "repair" && row.matchTier !== "none");
    return { primary: kept, secondary: [] };
  }

  const primary = ranked.filter(isPrimaryDeviceListing);
  const secondary = ranked.filter((row) => !isPrimaryDeviceListing(row));
  return { primary, secondary };
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

function balancePhase(
  queuesByProvider: Map<string, NormalizedSearchListing[]>,
  limit: number,
  accepted: NormalizedSearchListing[],
): NormalizedSearchListing[] {
  const cleaned = new Map<string, NormalizedSearchListing[]>();
  for (const [providerId, queue] of queuesByProvider) {
    const next = dedupeQueue(queue, accepted);
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
  const secondaryQueues = new Map<string, NormalizedSearchListing[]>();

  // Dynamic provider set — no hardcoded marketplace list.
  for (const [providerId, raw] of byProvider) {
    if (!raw.length) continue;
    const ranked = rankRawListings(raw, query);
    const { primary, secondary } = splitProviderQueues(ranked, query);
    if (primary.length) primaryQueues.set(providerId, primary);
    if (secondary.length) secondaryQueues.set(providerId, secondary);
  }

  if (primaryQueues.size === 0 && secondaryQueues.size === 0) return [];

  const accepted: NormalizedSearchListing[] = [];
  const primaryPicks = balancePhase(primaryQueues, limit, accepted);
  for (const item of primaryPicks) accepted.push(item);

  if (accepted.length < limit) {
    const secondaryPicks = balancePhase(
      secondaryQueues,
      limit - accepted.length,
      accepted,
    );
    for (const item of secondaryPicks) accepted.push(item);
  }

  return accepted.map(listingToSearchResultItem);
}

export { listingToSearchResultItem };
