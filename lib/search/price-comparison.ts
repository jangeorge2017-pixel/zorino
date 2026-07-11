import type { NormalizedSearchListing, UnifiedSearchProduct } from "@/lib/search/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import {
  getProviderStoreMeta,
  searchProviderToProductionId,
} from "@/lib/integration/provider-context";

export type PriceComparisonSummary = {
  lowestPrice: number;
  highestPrice: number;
  savingsAmount: number;
  savingsPercent: number;
  offerCount: number;
  providerCount: number;
  cheapestProviderId: string;
};

/** Marketplace brand label for badges / filters (eBay, AliExpress, …). */
export function marketplaceDisplayName(providerId: string): string {
  const productionId = searchProviderToProductionId(providerId);
  if (productionId) return getProviderStoreMeta(productionId).name;
  return providerId;
}

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

function offerToSearchResultItem(
  product: UnifiedSearchProduct,
  offer: NormalizedSearchListing,
): SearchResultItem {
  const marketplace = marketplaceDisplayName(offer.providerId);
  return {
    id: offer.id,
    name: offer.title || product.title,
    imageSrc: offer.imageUrl || product.imageUrl,
    emoji: product.emoji,
    price: offer.price,
    originalPrice: offer.originalPrice,
    discount: offer.discount,
    store: marketplace,
    storeSlug: offer.storeSlug || offer.providerId,
    rating: offer.rating || product.rating,
    reviewCount: offer.reviewCount || product.reviewCount,
    salesCount: offer.salesCount ?? product.salesCount,
    shipping: offer.shipping,
    inStock: offer.inStock,
    category: offer.category || product.category,
    affiliateUrl: offer.affiliateUrl ?? offer.productUrl,
  };
}

/** Map a single ranked listing → search card (marketplace-labeled). */
export function listingToSearchResultItem(
  listing: NormalizedSearchListing,
): SearchResultItem {
  return {
    id: listing.id,
    name: listing.title,
    imageSrc: listing.imageUrl,
    emoji: "🛍️",
    price: listing.price,
    originalPrice: listing.originalPrice,
    discount: listing.discount,
    store: marketplaceDisplayName(listing.providerId),
    storeSlug: listing.storeSlug || listing.providerId,
    rating: listing.rating,
    reviewCount: listing.reviewCount,
    salesCount: listing.salesCount,
    shipping: listing.shipping,
    inStock: listing.inStock,
    category: listing.category,
    affiliateUrl: listing.affiliateUrl ?? listing.productUrl,
  };
}

/**
 * Fair round-robin mix across marketplace buckets.
 * Each active marketplace gets an equal share of slots when it has results.
 */
export function fairMixSearchResults(
  providerBuckets: SearchResultItem[][],
  limit: number,
): SearchResultItem[] {
  const queues = providerBuckets
    .map((items) => [...items])
    .filter((queue) => queue.length > 0);

  if (queues.length === 0) return [];
  if (queues.length === 1) return queues[0].slice(0, limit);

  const perProviderTarget = Math.ceil(limit / queues.length);
  const result: SearchResultItem[] = [];
  const taken = queues.map(() => 0);

  while (result.length < limit) {
    let progressed = false;
    for (let i = 0; i < queues.length; i++) {
      if (result.length >= limit) break;
      if (taken[i] >= perProviderTarget) continue;
      const next = queues[i].shift();
      if (!next) continue;
      result.push(next);
      taken[i] += 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  while (result.length < limit) {
    let progressed = false;
    for (const queue of queues) {
      if (result.length >= limit) break;
      const next = queue.shift();
      if (!next) continue;
      result.push(next);
      progressed = true;
    }
    if (!progressed) break;
  }

  return result;
}

/**
 * One search card per marketplace offer group.
 * Keeps eBay + AliExpress (and future marketplaces) visible side-by-side
 * instead of collapsing to only the cheapest offer.
 */
export function unifiedToMarketplaceSearchItems(
  product: UnifiedSearchProduct,
): SearchResultItem[] {
  const bestByProvider = new Map<string, NormalizedSearchListing>();
  for (const offer of product.offers) {
    const existing = bestByProvider.get(offer.providerId);
    if (!existing || offer.price < existing.price) {
      bestByProvider.set(offer.providerId, offer);
    }
  }

  return [...bestByProvider.values()]
    .sort((a, b) => a.price - b.price)
    .map((offer) => offerToSearchResultItem(product, offer));
}

/** Map unified search product → UI SearchResultItem (lowest-price offer). */
export function unifiedToSearchResultItem(product: UnifiedSearchProduct): SearchResultItem {
  const cheapest = product.offers.reduce((best, offer) =>
    offer.price < best.price ? offer : best
  );
  return offerToSearchResultItem(product, cheapest);
}
