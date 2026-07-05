import type { UnifiedSearchProduct } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";

export type PriceComparisonSummary = {
  lowestPrice: number;
  highestPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  offerCount: number;
  providerCount: number;
  cheapestProviderId: string;
};

/** Compute cross-store price comparison stats for a unified product. */
export function summarizePriceComparison(product: UnifiedSearchProduct): PriceComparisonSummary {
  const prices = product.offers.map((o) => o.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const cheapest = product.offers.find((o) => o.price === lowestPrice)!;

  return {
    lowestPrice,
    highestPrice,
    savingsAmount: Math.max(0, highestPrice - lowestPrice),
    savingsPercent:
      highestPrice > 0
        ? Math.round(((highestPrice - lowestPrice) / highestPrice) * 10000) / 100
        : 0,
    offerCount: product.offers.length,
    providerCount: product.providerCount,
    cheapestProviderId: cheapest.providerId,
  };
}

/** Map unified search product → UI SearchResultItem (lowest-price offer). */
export function unifiedToSearchResultItem(product: UnifiedSearchProduct): SearchResultItem {
  const cheapest = product.offers.reduce((best, offer) =>
    offer.price < best.price ? offer : best
  );

  return {
    id: product.canonicalId,
    name: product.title,
    imageSrc: product.imageUrl,
    emoji: product.emoji,
    price: product.price,
    originalPrice: product.originalPrice,
    discount: product.discount,
    store: cheapest.storeName,
    storeSlug: cheapest.storeSlug,
    rating: product.rating,
    reviewCount: product.reviewCount,
    salesCount: product.salesCount,
    inStock: product.inStock,
    category: product.category,
    affiliateUrl: cheapest.affiliateUrl ?? cheapest.productUrl,
  };
}
