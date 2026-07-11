/**
 * Marketplace-agnostic result balancer.
 *
 * No hardcoded marketplace shares or percentages.
 * Active marketplaces are whatever providers currently have stock —
 * adding a new marketplace that returns results automatically rebalances.
 */

export type BalanceableItem = {
  providerId: string;
};

export type MarketplaceBalanceOptions<T extends BalanceableItem> = {
  limit: number;
  /** Higher-quality / more-relevant first (orders first-round rotation). */
  compare: (a: T, b: T) => number;
  /**
   * Kept for API compatibility. Equal distribution does not gate on this —
   * every active marketplace gets the same opportunity.
   */
  isComparable: (candidate: T, best: T) => boolean;
  /**
   * Max consecutive picks from one marketplace while peers still have stock.
   * Defaults to 2.
   */
  maxConsecutive?: number;
};

/**
 * Equal-opportunity interleave across all marketplaces that have inventory.
 *
 * - Detects active providers from the queue map (no hardcoded list/%).
 * - Each active marketplace gets the same target: ceil(limit / n).
 * - Round-robin fill; leftovers fill from remaining stock.
 * - New marketplaces participate automatically when they appear in the map.
 */
export function balanceMarketplaceQueues<T extends BalanceableItem>(
  providerQueues: ReadonlyMap<string, readonly T[]>,
  options: MarketplaceBalanceOptions<T>,
): T[] {
  const { limit, compare } = options;
  const maxConsecutive = Math.max(1, options.maxConsecutive ?? 2);

  if (limit <= 0 || providerQueues.size === 0) return [];

  const working = new Map<string, T[]>();
  for (const [providerId, queue] of providerQueues) {
    if (queue.length > 0) working.set(providerId, [...queue]);
  }
  if (working.size === 0) return [];

  // First-round order: best head first (quality), then equal rotation.
  const rotation = [...working.keys()].sort((a, b) =>
    compare(working.get(a)![0]!, working.get(b)![0]!),
  );

  const activeCount = rotation.length;
  const equalTarget = Math.ceil(limit / activeCount);
  const result: T[] = [];
  const taken = new Map<string, number>();
  let streakProvider: string | null = null;
  let streakCount = 0;
  let cursor = 0;

  const takeFrom = (providerId: string): T | null => {
    const queue = working.get(providerId);
    if (!queue?.length) {
      working.delete(providerId);
      return null;
    }
    const item = queue.shift()!;
    if (queue.length === 0) working.delete(providerId);
    taken.set(providerId, (taken.get(providerId) ?? 0) + 1);
    if (providerId === streakProvider) {
      streakCount += 1;
    } else {
      streakProvider = providerId;
      streakCount = 1;
    }
    result.push(item);
    return item;
  };

  // Phase 1 — equal round-robin up to equalTarget per marketplace.
  while (result.length < limit && working.size > 0) {
    let progressed = false;

    for (let step = 0; step < rotation.length; step++) {
      if (result.length >= limit) break;
      const providerId = rotation[(cursor + step) % rotation.length]!;
      if (!working.has(providerId)) continue;

      const count = taken.get(providerId) ?? 0;
      if (count >= equalTarget) continue;

      const wouldDominate =
        streakProvider === providerId &&
        streakCount >= maxConsecutive &&
        working.size > 1;

      if (wouldDominate) continue;

      if (takeFrom(providerId)) {
        progressed = true;
        cursor = (cursor + step + 1) % rotation.length;
        break;
      }
    }

    if (!progressed) {
      // Everyone at equalTarget or streak-blocked — allow fill below.
      break;
    }
  }

  // Phase 2 — fill remaining slots equally from whoever still has stock.
  while (result.length < limit && working.size > 0) {
    let progressed = false;

    for (let step = 0; step < rotation.length; step++) {
      if (result.length >= limit) break;
      const providerId = rotation[(cursor + step) % rotation.length]!;
      if (!working.has(providerId)) continue;

      const wouldDominate =
        streakProvider === providerId &&
        streakCount >= maxConsecutive &&
        working.size > 1;

      if (wouldDominate) continue;

      if (takeFrom(providerId)) {
        progressed = true;
        cursor = (cursor + step + 1) % rotation.length;
        break;
      }
    }

    if (!progressed) {
      // Streak blocked everyone — force-take the best remaining head.
      const heads = [...working.entries()]
        .map(([providerId, queue]) => ({ providerId, item: queue[0]! }))
        .sort((a, b) => compare(a.item, b.item));
      if (heads.length === 0) break;
      takeFrom(heads[0]!.providerId);
    }
  }

  return result;
}

/** Group items by marketplace id (any string — future marketplaces just work). */
export function groupByMarketplace<T>(
  items: readonly T[],
  getProviderId: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const id = getProviderId(item);
    if (!id) continue;
    const bucket = map.get(id) ?? [];
    bucket.push(item);
    map.set(id, bucket);
  }
  return map;
}

/**
 * Re-balance an already-ranked flat list so every present marketplace
 * gets equal opportunity (homepage sections, deals grids, etc.).
 */
export function balanceFlatMarketplaceList<T>(
  items: readonly T[],
  getProviderId: (item: T) => string,
  limit: number,
  compare?: (a: T, b: T) => number,
): T[] {
  if (items.length === 0 || limit <= 0) return [];

  type Wrapped = BalanceableItem & { item: T };
  const wrapped: Wrapped[] = items.map((item) => ({
    providerId: getProviderId(item),
    item,
  }));

  const grouped = groupByMarketplace(wrapped, (row) => row.providerId);
  const queues = new Map<string, Wrapped[]>();
  for (const [id, bucket] of grouped) {
    const sorted = compare
      ? [...bucket].sort((a, b) => compare(a.item, b.item))
      : [...bucket];
    queues.set(id, sorted);
  }

  const balanced = balanceMarketplaceQueues<Wrapped>(queues, {
    limit,
    compare: (a, b) => (compare ? compare(a.item, b.item) : 0),
    isComparable: () => true,
    maxConsecutive: 2,
  });

  return balanced.map((row) => row.item);
}
