import { queryWantsAccessory } from "@/lib/search/relevance";
import { listingsRepresentSameProduct } from "@/lib/search/matching";
import { rankRawListings } from "@/lib/search/ranking";
import { listingToSearchResultItem } from "@/lib/search/price-comparison";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
} from "@/lib/search/types";
import { LIVE_SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

/**
 * Best offer among duplicates (used when collapsing leftover ties).
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

function roundRobinTake(
  working: NormalizedSearchListing[][],
  limit: number,
  result: SearchResultItem[],
  accepted: NormalizedSearchListing[],
): void {
  while (result.length < limit) {
    let progressed = false;

    for (const queue of working) {
      if (result.length >= limit) break;

      while (queue.length > 0) {
        const candidate = queue.shift()!;
        const isDuplicate = accepted.some((existing) =>
          listingsRepresentSameProduct(existing, candidate),
        );
        if (isDuplicate) continue;

        accepted.push(candidate);
        result.push(listingToSearchResultItem(candidate));
        progressed = true;
        break;
      }
    }

    if (!progressed) break;
  }
}

/**
 * Production search assembly:
 * 1) Query/rank each marketplace independently
 * 2) Globally device-first: fair-mix devices from all marketplaces before any accessories
 * 3) Then fair-mix accessories / non-devices (unless the query asks for accessories)
 * 4) Skip cross-marketplace duplicates as the list is built
 * 5) Preserve marketplace-correct affiliate URLs on every card
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

  roundRobinTake(
    primaryQueues.map((queue) => [...queue]),
    limit,
    result,
    accepted,
  );

  if (result.length < limit) {
    roundRobinTake(
      secondaryQueues.map((queue) => [...queue]),
      limit,
      result,
      accepted,
    );
  }

  return result;
}

export { listingToSearchResultItem };
