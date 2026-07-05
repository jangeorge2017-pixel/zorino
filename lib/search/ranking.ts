import { analyzeSearchListing, type ProductMatchTier } from "@/lib/search/relevance";
import { normalizeRawListing } from "@/lib/search/normalization";
import type { NormalizedSearchListing, RawProviderListing } from "@/lib/search/types";
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
 * Accessories only appear after all matching devices when enough devices exist.
 */
export function rankRawListings(
  listings: RawProviderListing[],
  query: string
): NormalizedSearchListing[] {
  const { MIN_DEVICES_BEFORE_ACCESSORIES } = SEARCH_ENGINE_DEFAULTS;

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

  const popDiff = popularityScore(b) - popularityScore(a);
  if (popDiff !== 0) return popDiff;

  if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

  return a.price - b.price;
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
  },
>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const tierDiff = TIER_RANK[b.matchTier] - TIER_RANK[a.matchTier];
    if (tierDiff !== 0) return tierDiff;

    if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;

    const popA = (a.salesCount ?? 0) + a.reviewCount * 2 + a.rating * 10;
    const popB = (b.salesCount ?? 0) + b.reviewCount * 2 + b.rating * 10;
    if (popA !== popB) return popB - popA;

    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

    return a.price - b.price;
  });
}
