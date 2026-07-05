import { canonicalProductKey, listingsRepresentSameProduct, pickDisplayTitle } from "@/lib/search/matching";
import type { NormalizedSearchListing, UnifiedSearchProduct } from "@/lib/search/types";

function mergeListingGroup(listings: NormalizedSearchListing[]): UnifiedSearchProduct {
  const sorted = [...listings].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const primary = sorted[0];
  const offers = [...listings].sort((a, b) => a.price - b.price);

  const lowest = offers[0];
  const highestOriginal = Math.max(...offers.map((o) => o.originalPrice));
  const price = lowest.price;
  const originalPrice = Math.max(primary.originalPrice, highestOriginal);
  const discount =
    originalPrice > price
      ? Math.max(primary.discount, Math.round(((originalPrice - price) / originalPrice) * 100))
      : primary.discount;

  const providerIds = new Set(offers.map((o) => o.providerId));

  return {
    canonicalId: `zorino-${canonicalProductKey(primary.title)}`,
    title: sorted.reduce(
      (best, item) => pickDisplayTitle(best, item.title, primary),
      primary.title
    ),
    imageUrl: primary.imageUrl || offers.find((o) => o.imageUrl)?.imageUrl || "",
    emoji: "🛍️",
    category: primary.category,
    rating: Math.max(...offers.map((o) => o.rating)),
    reviewCount: Math.max(...offers.map((o) => o.reviewCount)),
    salesCount: Math.max(...offers.map((o) => o.salesCount ?? 0)),
    inStock: offers.some((o) => o.inStock),
    price,
    originalPrice,
    discount,
    currency: lowest.currency,
    offers,
    providerCount: providerIds.size,
    relevanceScore: primary.relevanceScore,
    matchTier: primary.matchTier,
    isDevice: primary.isDevice,
  };
}

/**
 * Duplicate detection — merge same-product listings from different stores
 * into unified products with multiple offers.
 */
export function mergeDuplicateListings(
  listings: NormalizedSearchListing[]
): UnifiedSearchProduct[] {
  const groups: NormalizedSearchListing[][] = [];

  for (const listing of listings) {
    const existing = groups.find((group) =>
      group.some((item) => listingsRepresentSameProduct(item, listing))
    );
    if (existing) {
      existing.push(listing);
    } else {
      groups.push([listing]);
    }
  }

  return groups.map(mergeListingGroup);
}
