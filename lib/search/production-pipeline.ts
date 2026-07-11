import { queryWantsAccessory } from "@/lib/search/relevance";
import {
  compareByRelevanceThenQuality,
  isComparablyRelevant,
  rankRawListings,
} from "@/lib/search/ranking";
import { listingToSearchResultItem } from "@/lib/search/price-comparison";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
} from "@/lib/search/types";
import { LIVE_SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

/** Max consecutive cards from one marketplace when peers have comparable relevance. */
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
 * - Keep cross-marketplace offers and distinct variants for comparison
 *   (broader fuzzy merge remains available via mergeDuplicateListings / pickBestOffer)
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

function skipDuplicates(
  queue: NormalizedSearchListing[],
  accepted: NormalizedSearchListing[],
): NormalizedSearchListing | null {
  while (queue.length > 0) {
    const candidate = queue[0]!;
    if (!isSearchCardDuplicate(accepted, candidate)) return candidate;
    queue.shift();
  }
  return null;
}

/**
 * Relevance-first selection with marketplace interleaving.
 *
 * 1) Always prefer the highest relevance → quality candidate across providers
 * 2) Never allow > MAX_CONSECUTIVE_SAME_MARKETPLACE cards from one marketplace
 *    when another marketplace still has a comparably relevant product
 * 3) Never force a weaker product just to hit equal counts
 */
function interleaveByRelevance(
  providerQueues: NormalizedSearchListing[][],
  limit: number,
  result: SearchResultItem[],
  accepted: NormalizedSearchListing[],
): void {
  const working = providerQueues
    .map((queue) => [...queue])
    .filter((queue) => queue.length > 0);

  if (working.length === 0) return;

  let streakProvider: SearchProviderId | null = null;
  let streakCount = 0;

  while (result.length < limit) {
    const heads: { queue: NormalizedSearchListing[]; listing: NormalizedSearchListing }[] = [];

    for (const queue of working) {
      const listing = skipDuplicates(queue, accepted);
      if (listing) heads.push({ queue, listing });
    }

    if (heads.length === 0) break;

    heads.sort((a, b) => compareByRelevanceThenQuality(a.listing, b.listing));
    let chosen = heads[0]!;

    // Near-ties: prefer the marketplace that appears less often so far (quality-neutral).
    if (heads.length > 1) {
      const runnerUp = heads.find(
        (row) =>
          row.listing.providerId !== chosen.listing.providerId &&
          isComparablyRelevant(row.listing, chosen.listing) &&
          isComparablyRelevant(chosen.listing, row.listing),
      );
      if (runnerUp) {
        const chosenCount = accepted.filter(
          (row) => row.providerId === chosen.listing.providerId,
        ).length;
        const runnerCount = accepted.filter(
          (row) => row.providerId === runnerUp.listing.providerId,
        ).length;
        if (runnerCount < chosenCount) {
          chosen = runnerUp;
        }
      }
    }

    const wouldExtendStreak =
      streakProvider !== null &&
      streakCount >= MAX_CONSECUTIVE_SAME_MARKETPLACE &&
      chosen.listing.providerId === streakProvider;

    if (wouldExtendStreak) {
      const alternative = heads
        .filter((row) => row.listing.providerId !== streakProvider)
        .find((row) => isComparablyRelevant(row.listing, chosen.listing));

      if (alternative) {
        chosen = alternative;
      }
    }

    const picked = chosen.queue.shift()!;
    if (isSearchCardDuplicate(accepted, picked)) {
      continue;
    }

    accepted.push(picked);
    result.push(listingToSearchResultItem(picked));

    if (picked.providerId === streakProvider) {
      streakCount += 1;
    } else {
      streakProvider = picked.providerId;
      streakCount = 1;
    }
  }
}

/**
 * Production search assembly:
 * 1) Rank each marketplace independently (device-first within each)
 * 2) Relevance → quality selection with marketplace interleave (max 2 consecutive)
 * 3) Same-marketplace dedupe; keep cross-marketplace offers for price comparison
 * 4) Preserve marketplace-correct affiliate URLs on every card
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

  const primaryQueues: NormalizedSearchListing[][] = [];
  const secondaryQueues: NormalizedSearchListing[][] = [];

  const providerOrder: SearchProviderId[] = [
    ...LIVE_SEARCH_PROVIDER_IDS,
    ...[...byProvider.keys()].filter(
      (id) => !(LIVE_SEARCH_PROVIDER_IDS as readonly string[]).includes(id),
    ),
  ];

  for (const providerId of providerOrder) {
    const raw = byProvider.get(providerId);
    if (!raw?.length) continue;
    const ranked = rankRawListings(raw, query);
    const { primary, secondary } = splitProviderQueues(ranked, query);
    if (primary.length) primaryQueues.push(primary);
    if (secondary.length) secondaryQueues.push(secondary);
  }

  if (primaryQueues.length === 0 && secondaryQueues.length === 0) return [];

  const result: SearchResultItem[] = [];
  const accepted: NormalizedSearchListing[] = [];

  interleaveByRelevance(primaryQueues, limit, result, accepted);

  if (result.length < limit) {
    interleaveByRelevance(secondaryQueues, limit, result, accepted);
  }

  return result;
}

export { listingToSearchResultItem };
