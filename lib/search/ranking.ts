import { analyzeSearchListing, queryWantsAccessory, type ProductMatchTier } from "@/lib/search/relevance";
import { normalizeRawListing } from "@/lib/search/normalization";
import type {
  NormalizedSearchListing,
  RawProviderListing,
} from "@/lib/search/types";
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";

const TIER_RANK: Record<ProductMatchTier, number> = {
  exact: 6,
  model: 5,
  series: 4,
  brand: 3,
  accessory: 2,
  repair: 0,
  none: 0,
};

function popularityScore(listing: NormalizedSearchListing): number {
  return (listing.salesCount ?? 0) + listing.reviewCount * 2 + listing.rating * 10;
}

/**
 * Relevance ranking — score every listing, rank devices first.
 * Accessories only appear after matching devices when enough devices exist,
 * unless the query explicitly asks for accessories.
 * Call this per marketplace so one provider's device count cannot wipe another.
 *
 * Sort order: relevance tier/score → price → rating → popularity → availability.
 */
export function rankRawListings(
  listings: RawProviderListing[],
  query: string
): NormalizedSearchListing[] {
  const { MIN_DEVICES_BEFORE_ACCESSORIES } = SEARCH_ENGINE_DEFAULTS;
  const wantsAccessory = queryWantsAccessory(query);

  const analyzed = listings
    .map((raw) => {
      const result = analyzeSearchListing(raw.title, query, { category: raw.category });
      if (result.tier === "none" || result.tier === "repair") return null;
      return normalizeRawListing(raw, {
        score: result.score,
        tier: result.tier,
        isDevice: result.isDevice,
      });
    })
    .filter((item): item is NormalizedSearchListing => item !== null)
    .sort((a, b) => compareListings(a, b));

  // Accessory-intent queries must keep accessory matches (earbuds, cases, cables, …).
  if (wantsAccessory) {
    return analyzed;
  }

  const devices = analyzed.filter((row) => row.isDevice && row.matchTier !== "accessory");

  if (devices.length >= MIN_DEVICES_BEFORE_ACCESSORIES) {
    return devices;
  }

  const accessories = analyzed.filter(
    (row) => row.matchTier === "accessory" || (!row.isDevice && row.matchTier !== "repair")
  );

  return [...devices, ...accessories];
}

function compareListings(a: NormalizedSearchListing, b: NormalizedSearchListing): number {
  const tierDiff = TIER_RANK[b.matchTier] - TIER_RANK[a.matchTier];
  if (tierDiff !== 0) return tierDiff;

  if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;

  if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

  if (a.price !== b.price) return a.price - b.price;

  if (a.rating !== b.rating) return b.rating - a.rating;

  const popDiff = popularityScore(b) - popularityScore(a);
  if (popDiff !== 0) return popDiff;

  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

  return 0;
}

export function sortUnifiedByRelevance<
  T extends {
    relevanceScore: number;
    isDevice: boolean;
    matchTier: ProductMatchTier;
    price: number;
    reviewCount: number;
    salesCount?: number;
    rating: number;
    inStock?: boolean;
  },
>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const tierDiff = TIER_RANK[b.matchTier] - TIER_RANK[a.matchTier];
    if (tierDiff !== 0) return tierDiff;

    if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;

    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

    if (a.price !== b.price) return a.price - b.price;

    if (a.rating !== b.rating) return b.rating - a.rating;

    const popA = (a.salesCount ?? 0) + a.reviewCount * 2 + a.rating * 10;
    const popB = (b.salesCount ?? 0) + b.reviewCount * 2 + b.rating * 10;
    if (popA !== popB) return popB - popA;

    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

    return 0;
  });
}
