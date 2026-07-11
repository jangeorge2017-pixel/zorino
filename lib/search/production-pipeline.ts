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

function prepareProviderQueue(
  ranked: NormalizedSearchListing[],
  query: string,
): NormalizedSearchListing[] {
  const wantsAccessory = queryWantsAccessory(query);

  if (wantsAccessory) {
    return ranked.filter((row) => row.matchTier !== "repair" && row.matchTier !== "none");
  }

  const primary = ranked.filter(
    (row) => row.isDevice && row.matchTier !== "accessory",
  );
  const secondary = ranked.filter(
    (row) => row.matchTier === "accessory" || !row.isDevice,
  );
  return [...primary, ...secondary];
}

/**
 * Production search assembly:
 * 1) Query/rank each marketplace independently (device-first within each)
 * 2) Fair round-robin across marketplaces (no provider bias)
 * 3) Skip cross-marketplace duplicates as the list is built
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

  const queues: NormalizedSearchListing[][] = [];

  for (const providerId of LIVE_SEARCH_PROVIDER_IDS) {
    const raw = byProvider.get(providerId);
    if (!raw?.length) continue;
    const ranked = rankRawListings(raw, query);
    const queue = prepareProviderQueue(ranked, query);
    if (queue.length) queues.push(queue);
  }

  for (const [providerId, raw] of byProvider) {
    if ((LIVE_SEARCH_PROVIDER_IDS as readonly string[]).includes(providerId)) continue;
    if (!raw.length) continue;
    const ranked = rankRawListings(raw, query);
    const queue = prepareProviderQueue(ranked, query);
    if (queue.length) queues.push(queue);
  }

  if (queues.length === 0) return [];

  const result: SearchResultItem[] = [];
  const accepted: NormalizedSearchListing[] = [];
  const working = queues.map((queue) => [...queue]);

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

  return result;
}

export { listingToSearchResultItem };
