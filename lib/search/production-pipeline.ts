import { queryWantsAccessory } from "@/lib/search/relevance";
import { mergeDuplicateListings } from "@/lib/search/deduplication";
import { rankRawListings } from "@/lib/search/ranking";
import {
  fairMixSearchResults,
  listingToSearchResultItem,
  marketplaceDisplayName,
} from "@/lib/search/price-comparison";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
  UnifiedSearchProduct,
} from "@/lib/search/types";
import { LIVE_SEARCH_PROVIDER_IDS } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

const TIER_RANK: Record<string, number> = {
  exact: 6,
  model: 5,
  series: 4,
  brand: 3,
  accessory: 2,
  repair: 0,
  none: 0,
};

function popularity(listing: {
  salesCount?: number;
  reviewCount: number;
  rating: number;
}): number {
  return (listing.salesCount ?? 0) + listing.reviewCount * 2 + listing.rating * 10;
}

/**
 * Best offer for a deduped product:
 * availability → relevance → price → rating → popularity.
 */
export function pickBestOffer(
  offers: NormalizedSearchListing[],
): NormalizedSearchListing {
  return [...offers].sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (a.price !== b.price) return a.price - b.price;
    if (a.rating !== b.rating) return b.rating - a.rating;
    return popularity(b) - popularity(a);
  })[0]!;
}

function compareProductionItems(a: SearchResultItem, b: SearchResultItem): number {
  // Relevance proxies: rating+sales already on item; prefer higher rating then lower price
  // Primary ordering is done by tier buckets before this sort.
  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
  if (a.rating !== b.rating) return b.rating - a.rating;
  const popA = (a.salesCount ?? 0) + a.reviewCount * 2 + a.rating * 10;
  const popB = (b.salesCount ?? 0) + b.reviewCount * 2 + b.rating * 10;
  if (popA !== popB) return popB - popA;
  return a.price - b.price;
}

function compareNormalized(a: NormalizedSearchListing, b: NormalizedSearchListing): number {
  const tierDiff = (TIER_RANK[b.matchTier] ?? 0) - (TIER_RANK[a.matchTier] ?? 0);
  if (tierDiff !== 0) return tierDiff;
  if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
  if (a.price !== b.price) return a.price - b.price;
  if (a.rating !== b.rating) return b.rating - a.rating;
  return popularity(b) - popularity(a);
}

function unifiedToDedupedSearchItem(product: UnifiedSearchProduct): SearchResultItem {
  const offer = pickBestOffer(product.offers);
  const marketplace = marketplaceDisplayName(offer.providerId);
  return {
    id: product.canonicalId,
    name: product.title,
    imageSrc: offer.imageUrl || product.imageUrl,
    emoji: product.emoji,
    price: offer.price,
    originalPrice: Math.max(offer.originalPrice, product.originalPrice),
    discount:
      Math.max(offer.originalPrice, product.originalPrice) > offer.price
        ? Math.max(
            offer.discount,
            Math.round(
              ((Math.max(offer.originalPrice, product.originalPrice) - offer.price) /
                Math.max(offer.originalPrice, product.originalPrice)) *
                100,
            ),
          )
        : offer.discount,
    store: marketplace,
    storeSlug: offer.storeSlug || offer.providerId,
    rating: Math.max(offer.rating, product.rating),
    reviewCount: Math.max(offer.reviewCount, product.reviewCount),
    salesCount: Math.max(offer.salesCount ?? 0, product.salesCount ?? 0),
    shipping: offer.shipping,
    inStock: product.inStock || offer.inStock,
    category: offer.category || product.category,
    affiliateUrl: offer.affiliateUrl ?? offer.productUrl,
  };
}

function groupItemsByProvider(items: SearchResultItem[]): SearchResultItem[][] {
  const buckets = new Map<string, SearchResultItem[]>();
  for (const item of items) {
    const key = item.storeSlug || "other";
    const list = buckets.get(key);
    if (list) list.push(item);
    else buckets.set(key, [item]);
  }

  // Stable marketplace order for round-robin.
  const ordered: SearchResultItem[][] = [];
  for (const id of LIVE_SEARCH_PROVIDER_IDS) {
    const bucket = buckets.get(id);
    if (bucket?.length) ordered.push(bucket);
  }
  for (const [id, bucket] of buckets) {
    if ((LIVE_SEARCH_PROVIDER_IDS as readonly string[]).includes(id)) continue;
    if (bucket.length) ordered.push(bucket);
  }
  return ordered;
}

function prepareTier(
  ranked: NormalizedSearchListing[],
  query: string,
): { primary: NormalizedSearchListing[]; secondary: NormalizedSearchListing[] } {
  const wantsAccessory = queryWantsAccessory(query);

  if (wantsAccessory) {
    // Accessory-intent queries: accessories/products matching the query are primary.
    const primary = ranked
      .filter((row) => row.matchTier !== "repair" && row.matchTier !== "none")
      .sort(compareNormalized);
    return { primary, secondary: [] };
  }

  const primary = ranked
    .filter((row) => row.isDevice && row.matchTier !== "accessory")
    .sort(compareNormalized);
  const secondary = ranked
    .filter((row) => row.matchTier === "accessory" || !row.isDevice)
    .sort(compareNormalized);

  return { primary, secondary };
}

/**
 * Production search assembly:
 * 1) Rank per marketplace (no cross-provider wipe)
 * 2) Merge into one pool, split devices vs accessories
 * 3) Deduplicate across marketplaces
 * 4) Fair-mix within each tier
 * 5) Devices first (unless query asks for accessories)
 */
export function assembleProductionSearchResults(
  allRaw: RawProviderListing[],
  query: string,
  limit: number,
): SearchResultItem[] {
  if (allRaw.length === 0 || limit <= 0) return [];

  // Rank each marketplace independently, then combine.
  const byProvider = new Map<SearchProviderId, RawProviderListing[]>();
  for (const listing of allRaw) {
    const bucket = byProvider.get(listing.providerId) ?? [];
    bucket.push(listing);
    byProvider.set(listing.providerId, bucket);
  }

  const ranked: NormalizedSearchListing[] = [];
  for (const listings of byProvider.values()) {
    ranked.push(...rankRawListings(listings, query));
  }

  const { primary, secondary } = prepareTier(ranked, query);

  const primaryDeduped = mergeDuplicateListings(primary)
    .map(unifiedToDedupedSearchItem)
    .sort(compareProductionItems);

  const secondaryDeduped = mergeDuplicateListings(secondary)
    .map(unifiedToDedupedSearchItem)
    .sort(compareProductionItems);

  const primaryMixed = fairMixSearchResults(
    groupItemsByProvider(primaryDeduped),
    limit,
  );

  const remaining = Math.max(0, limit - primaryMixed.length);
  const secondaryMixed =
    remaining > 0
      ? fairMixSearchResults(groupItemsByProvider(secondaryDeduped), remaining)
      : [];

  // Fallback: if device tier is empty but we have ranked listings, show them fairly.
  if (primaryMixed.length === 0 && secondaryMixed.length === 0 && ranked.length > 0) {
    const fallback = mergeDuplicateListings(ranked)
      .map(unifiedToDedupedSearchItem)
      .sort(compareProductionItems);
    return fairMixSearchResults(groupItemsByProvider(fallback), limit);
  }

  return [...primaryMixed, ...secondaryMixed].slice(0, limit);
}

/** Expose listing mapper for tests / diagnostics. */
export { listingToSearchResultItem };
