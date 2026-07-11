/**
 * Marketplace-agnostic result balancer.
 *
 * No hardcoded marketplace shares or percentages.
 * Fair opportunity is derived dynamically from whatever providers
 * currently have remaining, comparable inventory.
 */

export type BalanceableItem = {
  providerId: string;
};

export type MarketplaceBalanceOptions<T extends BalanceableItem> = {
  limit: number;
  /** Higher-quality / more-relevant first. */
  compare: (a: T, b: T) => number;
  /**
   * True when `candidate` is close enough in quality/relevance to `best`
   * that diversity may prefer it without harming results.
   */
  isComparable: (candidate: T, best: T) => boolean;
  /**
   * Max consecutive picks from one marketplace while peers still have
   * comparable items. Defaults to 2 (quality-preserving diversity).
   */
  maxConsecutive?: number;
};

/**
 * Build balanced results from per-marketplace queues.
 * Queues must already be sorted best-first within each marketplace.
 * Adding a new marketplace = add another queue; no algorithm changes.
 */
export function balanceMarketplaceQueues<T extends BalanceableItem>(
  providerQueues: ReadonlyMap<string, readonly T[]>,
  options: MarketplaceBalanceOptions<T>,
): T[] {
  const { limit, compare, isComparable } = options;
  const maxConsecutive = Math.max(1, options.maxConsecutive ?? 2);

  if (limit <= 0 || providerQueues.size === 0) return [];

  const working = new Map<string, T[]>();
  for (const [providerId, queue] of providerQueues) {
    if (queue.length > 0) working.set(providerId, [...queue]);
  }
  if (working.size === 0) return [];

  const result: T[] = [];
  const taken = new Map<string, number>();
  let streakProvider: string | null = null;
  let streakCount = 0;

  while (result.length < limit && working.size > 0) {
    const heads: { providerId: string; item: T }[] = [];
    for (const [providerId, queue] of working) {
      if (queue.length === 0) {
        working.delete(providerId);
        continue;
      }
      heads.push({ providerId, item: queue[0]! });
    }
    if (heads.length === 0) break;

    heads.sort((a, b) => compare(a.item, b.item));
    let chosen = heads[0]!;

    const activeWithStock = heads.length;
    const fairShare = Math.ceil((result.length + 1) / activeWithStock);
    const chosenTaken = taken.get(chosen.providerId) ?? 0;

    // Soft fairness: when peers are comparable, prefer under-represented marketplaces.
    // fairShare adapts automatically as providers are added/removed.
    const underrepresented = heads
      .filter(
        (row) =>
          row.providerId !== chosen.providerId &&
          isComparable(row.item, chosen.item) &&
          isComparable(chosen.item, row.item) &&
          (taken.get(row.providerId) ?? 0) < chosenTaken,
      )
      .sort(
        (a, b) =>
          (taken.get(a.providerId) ?? 0) - (taken.get(b.providerId) ?? 0) ||
          compare(a.item, b.item),
      )[0];

    if (underrepresented && chosenTaken >= fairShare) {
      chosen = underrepresented;
    } else if (underrepresented && chosenTaken > (taken.get(underrepresented.providerId) ?? 0)) {
      // Near-tie: keep counts roughly even without fixed percentages.
      if (isComparable(underrepresented.item, chosen.item)) {
        chosen = underrepresented;
      }
    }

    const wouldDominateStreak =
      streakProvider !== null &&
      streakCount >= maxConsecutive &&
      chosen.providerId === streakProvider;

    if (wouldDominateStreak) {
      const alternative = heads
        .filter((row) => row.providerId !== streakProvider)
        .find((row) => isComparable(row.item, chosen.item));
      if (alternative) chosen = alternative;
    }

    // Hard dominance guard: never let one marketplace run far ahead while peers
    // still have comparable stock (share ceiling = fairShare + 1).
    const chosenAfter = (taken.get(chosen.providerId) ?? 0) + 1;
    if (chosenAfter > fairShare + 1 && heads.length > 1) {
      const peer = heads
        .filter((row) => row.providerId !== chosen.providerId)
        .find((row) => isComparable(row.item, chosen.item));
      if (peer) chosen = peer;
    }

    const queue = working.get(chosen.providerId);
    if (!queue?.length) {
      working.delete(chosen.providerId);
      continue;
    }
    queue.shift();
    if (queue.length === 0) working.delete(chosen.providerId);

    result.push(chosen.item);
    taken.set(chosen.providerId, (taken.get(chosen.providerId) ?? 0) + 1);

    if (chosen.providerId === streakProvider) {
      streakCount += 1;
    } else {
      streakProvider = chosen.providerId;
      streakCount = 1;
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

  const grouped = groupByMarketplace(items, getProviderId);
  const queues = new Map<string, T[]>();
  for (const [id, bucket] of grouped) {
    const sorted = compare ? [...bucket].sort(compare) : [...bucket];
    queues.set(id, sorted);
  }

  const identityCompare = compare ?? (() => 0);

  return balanceMarketplaceQueues(queues, {
    limit,
    compare: identityCompare,
    isComparable: () => true,
    maxConsecutive: 2,
  });
}
