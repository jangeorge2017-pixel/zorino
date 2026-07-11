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

/** Popularity / social-proof signal used as a quality component. */
export function popularityScore(listing: NormalizedSearchListing): number {
  return (listing.salesCount ?? 0) + listing.reviewCount * 2 + listing.rating * 10;
}

/**
 * Composite quality score (after relevance).
 * Missing marketplace stats (common on eBay Browse) use a neutral baseline
 * so API-rich AliExpress listings are not automatically preferred.
 */
export function listingQualityScore(listing: NormalizedSearchListing): number {
  const stockBoost = listing.inStock ? 8 : 0;
  const discountBoost = Math.min(12, Math.max(0, listing.discount) * 0.15);

  const rating = listing.rating > 0 ? listing.rating : 4.0;
  const reviews = listing.reviewCount > 0 ? listing.reviewCount : 30;
  const sales =
    listing.salesCount !== undefined && listing.salesCount > 0
      ? listing.salesCount
      : 30;
  const popularity = Math.log10(1 + sales + reviews);

  return rating * 12 + popularity * 18 + stockBoost + discountBoost;
}

export function matchTierRank(tier: ProductMatchTier): number {
  return TIER_RANK[tier] ?? 0;
}

/**
 * Relevance first, then quality. Price is a soft tie-breaker only.
 * Marketplace identity is intentionally ignored here.
 */
export function compareByRelevanceThenQuality(
  a: NormalizedSearchListing,
  b: NormalizedSearchListing,
): number {
  const tierDiff = matchTierRank(b.matchTier) - matchTierRank(a.matchTier);
  if (tierDiff !== 0) return tierDiff;

  if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;

  if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

  const qualityDiff = listingQualityScore(b) - listingQualityScore(a);
  if (Math.abs(qualityDiff) > 0.01) return qualityDiff;

  if (a.price !== b.price) return a.price - b.price;

  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

  return 0;
}

/**
 * True when `candidate` is close enough in relevance to `best` that
 * marketplace diversity may prefer it without harming result quality.
 */
export function isComparablyRelevant(
  candidate: NormalizedSearchListing,
  best: NormalizedSearchListing,
): boolean {
  if (candidate.isDevice !== best.isDevice) return false;

  const tierGap = Math.abs(matchTierRank(candidate.matchTier) - matchTierRank(best.matchTier));
  if (tierGap > 1) return false;

  const bestScore = Math.max(1, best.relevanceScore);
  if (candidate.relevanceScore >= bestScore * 0.82) return true;

  return tierGap === 0 && candidate.relevanceScore >= bestScore * 0.7;
}

/**
 * Relevance ranking — score every listing, rank devices first.
 * Accessories only appear after matching devices when enough devices exist,
 * unless the query explicitly asks for accessories.
 * Call this per marketplace so one provider's device count cannot wipe another.
 *
 * Sort order: relevance tier/score → quality → price → availability.
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
    .sort((a, b) => compareByRelevanceThenQuality(a, b));

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
    discount?: number;
  },
>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const tierDiff = TIER_RANK[b.matchTier] - TIER_RANK[a.matchTier];
    if (tierDiff !== 0) return tierDiff;

    if (a.isDevice !== b.isDevice) return a.isDevice ? -1 : 1;

    if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;

    const popA = (a.salesCount ?? 0) + a.reviewCount * 2 + a.rating * 10;
    const popB = (b.salesCount ?? 0) + b.reviewCount * 2 + b.rating * 10;
    if (popA !== popB) return popB - popA;

    if (a.price !== b.price) return a.price - b.price;

    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

    return 0;
  });
}
