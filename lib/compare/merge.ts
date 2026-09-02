/**
 * Pure helpers for the Compare Prices pipeline.
 *
 * Compare Prices merges offers from TWO real sources:
 *   - internal `prices` rows (per-store current price rows)
 *   - `external_prices` staging rows (provider price snapshots, keyed to a
 *     canonical product via canonical_product_id)
 *
 * These helpers are import-free (no aliases, no I/O) so they are directly
 * unit-testable and the merge/stat logic is verifiable without a database.
 */

export type ComparShareable = {
  price: number;
  discountPercent: number;
};

/**
 * Merge primary + secondary offers, keeping at most one offer per identity
 * key (store id). Primary takes precedence over secondary (dedupe keeps the
 * first occurrence of a key), so an internal price row for a store always
 * wins over an external staging row for the same store.
 */
export function mergeOffersDedupe<T>(
  primary: T[],
  secondary: T[],
  key: (offer: T) => string,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const offer of [...primary, ...secondary]) {
    const k = key(offer);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    merged.push(offer);
  }
  return merged;
}

/**
 * Return product ids that have offers at two or more distinct stores across
 * both persisted price sources.  `external_prices` is not merely a cache of
 * `prices`: a product can be comparable before an internal price row exists.
 */
export function collectComparableProductIds(
  internalRows: Array<{ productId: string; storeId: string }>,
  externalRows: Array<{ productId: string | null; storeId: string }>,
  limit: number,
): string[] {
  const storesByProduct = new Map<string, Set<string>>();
  const add = (productId: string | null, storeId: string) => {
    if (!productId || !storeId) return;
    const stores = storesByProduct.get(productId) ?? new Set<string>();
    stores.add(storeId);
    storesByProduct.set(productId, stores);
  };

  for (const row of internalRows) add(row.productId, row.storeId);
  for (const row of externalRows) add(row.productId, row.storeId);

  return [...storesByProduct]
    .filter(([, stores]) => stores.size >= 2)
    .map(([productId]) => productId)
    .slice(0, limit);
}

export type CompareStats = {
  lowestPrice: number;
  highestPrice: number;
  highestDiscount: number;
  savingsVsHighest: number;
  savingsPercent: number;
  /** Index (in the sorted-by-price array) of the cheapest offer, or -1. */
  cheapestIndex: number;
  /** Indexes (in the sorted-by-price array) of offers at the max discount. */
  highestDiscountIndexes: number[];
};

/** Sort by ascending price and compute the comparison stats over ALL offers. */
export function computeCompareStats<T extends ComparShareable>(offers: T[]): CompareStats {
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  if (sorted.length === 0) {
    return {
      lowestPrice: 0,
      highestPrice: 0,
      highestDiscount: 0,
      savingsVsHighest: 0,
      savingsPercent: 0,
      cheapestIndex: -1,
      highestDiscountIndexes: [],
    };
  }

  const lowestPrice = sorted[0].price;
  const highestPrice = sorted[sorted.length - 1].price;

  let highestDiscount = 0;
  for (const offer of sorted) {
    if (offer.discountPercent > highestDiscount) highestDiscount = offer.discountPercent;
  }

  const highestDiscountIndexes: number[] = [];
  if (highestDiscount > 0) {
    sorted.forEach((offer, index) => {
      if (offer.discountPercent === highestDiscount) highestDiscountIndexes.push(index);
    });
  }

  return {
    lowestPrice,
    highestPrice,
    highestDiscount,
    savingsVsHighest: Math.max(0, highestPrice - lowestPrice),
    savingsPercent:
      highestPrice > lowestPrice && lowestPrice > 0
        ? Math.round(((highestPrice - lowestPrice) / highestPrice) * 10000) / 100
        : 0,
    cheapestIndex: 0,
    highestDiscountIndexes,
  };
}

/** Mark the cheapest offer and every max-discount offer on the sorted array. */
export function tagCompareFlags<T extends ComparShareable>(
  sorted: T[],
  stats: CompareStats,
): void {
  if (stats.cheapestIndex >= 0 && sorted[stats.cheapestIndex]) {
    (sorted[stats.cheapestIndex] as unknown as Record<string, unknown>).isLowest = true;
  }
  for (const index of stats.highestDiscountIndexes) {
    if (sorted[index]) {
      (sorted[index] as unknown as Record<string, unknown>).isHighestDiscount = true;
    }
  }
}
