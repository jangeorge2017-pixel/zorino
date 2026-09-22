/**
 * Page-1 composition seam for /search.
 *
 * The assembled search pool is device-first and relevance-ordered, but a single
 * provider's genuine exact/model volume can fill the whole first page while
 * every other provider's genuine matching inventory (same-family devices,
 * imported rows, relevant accessories) sits at pool positions 50+. This module
 * recomposes ONLY the head of that pool (membership is untouched — the same
 * items, reordered) so every provider that actually holds matching results
 * gets a truthful presence on page 1, while:
 *
 *   - genuine devices still lead page 1 (accessories never precede a device),
 *   - the provider with the most matching results still dominates the page
 *     (presence is bounded, never a forced-equal round-robin),
 *   - each provider's candidates keep their relevance order,
 *   - the complete universe is invariant: total, hasMore, zero-duplicate and
 *     DB-leg exclusion are all computed from the SAME item set, so pagination
 *     semantics are unchanged.
 *
 * The function is a pure permutation of `pool` (when it needs nothing it
 * returns the input unchanged), so it is safe to run over seeded pools in the
 * paged-seam tests: any pool that already puts every present provider inside
 * the first page is a no-op.
 */
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import { analyzeSearchListing } from "@/lib/search/relevance";
import type { SearchResultItem } from "@/lib/data/homepage";

/**
 * How many items one provider may contribute to page 1 when its genuine
 * matching inventory only appears beyond the first page. Small and bounded by
 * design: presence is truthful, never an equal-share quota.
 */
export const PAGE_ONE_PROVIDER_PRESENCE = 2;

function headSizeFor(poolLength: number, pageSize: number): number {
  return Math.min(poolLength, Math.max(1, Math.floor(pageSize)));
}

function isDeviceItem(item: SearchResultItem, query: string): boolean {
  const analysis = analyzeSearchListing(item.name, query);
  return analysis.isDevice === true;
}

/**
 * Reorder `pool` so every provider represented anywhere in it appears inside
 * the first `pageSize` positions. Returns the input unchanged when nothing is
 * missing (pool ≤ page / already representative / single-provider).
 */
export function composeSearchPageOne(
  pool: ReadonlyArray<SearchResultItem>,
  query: string,
  pageSize: number = SEARCH_ENGINE_DEFAULTS.PAGE_SIZE,
  presence: number = PAGE_ONE_PROVIDER_PRESENCE,
): SearchResultItem[] {
  const headLen = headSizeFor(pool.length, pageSize);
  if (headLen <= 0) return [...pool];
  if (pool.length <= headLen) return [...pool];

  const head = pool.slice(0, headLen);
  const rest = pool.slice(headLen);

  const providersInPool: string[] = [];
  const seenPool = new Set<string>();
  for (const item of pool) {
    if (!item.storeSlug || seenPool.has(item.storeSlug)) continue;
    seenPool.add(item.storeSlug);
    providersInPool.push(item.storeSlug);
  }
  if (providersInPool.length <= 1) return [...pool];

  const providersInHead = new Set<string>();
  for (const item of head) {
    if (item.storeSlug) providersInHead.add(item.storeSlug);
  }

  const missing = providersInPool.filter((p) => !providersInHead.has(p));
  if (missing.length === 0) return [...pool];

  // Group the remaining pool (beyond page 1) per provider in pool order.
  const restByProvider = new Map<string, SearchResultItem[]>();
  for (const item of rest) {
    if (!item.storeSlug) continue;
    const bucket = restByProvider.get(item.storeSlug) ?? [];
    bucket.push(item);
    restByProvider.set(item.storeSlug, bucket);
  }

  const take = Math.max(1, Math.floor(presence));
  const promotedDevices: SearchResultItem[] = [];
  const promotedOthers: SearchResultItem[] = [];
  for (const providerId of missing) {
    const candidates = restByProvider.get(providerId) ?? [];
    if (candidates.length === 0) continue;
    // Device-first, preserve each provider's own relevance order.
    const devices: SearchResultItem[] = [];
    const others: SearchResultItem[] = [];
    for (const candidate of candidates) {
      if (isDeviceItem(candidate, query)) devices.push(candidate);
      else others.push(candidate);
    }
    for (const item of [...devices, ...others].slice(0, take)) {
      if (isDeviceItem(item, query)) promotedDevices.push(item);
      else promotedOthers.push(item);
    }
  }
  if (promotedDevices.length + promotedOthers.length === 0) return [...pool];

  // Devices lead page 1. The candidate slots are split so that every promoted
  // item is admitted first: the device block reserves room for every promoted
  // device (promoted first, then the original leading devices that fit), and
  // genuine, non-device inventory is admitted only into the tail — promoted
  // ones first (they belong to the provider this whole pass is about), then any
  // the head already held. If the leading device block would otherwise crowd a
  // promotion out, the last leading devices roll to page 2 (same items, still
  // reachable, never discarded).
  const origDevices = head.filter((item) => isDeviceItem(item, query));
  const origOthers = head.filter((item) => !isDeviceItem(item, query));

  // Reserve accessory slots so promoted accessories never need to displace a
  // device; everything else in the device block comes from the original head.
  const deviceCapacity = Math.max(0, headLen - promotedOthers.length);
  const keptOrigDevices = origDevices.slice(
    0,
    Math.max(0, deviceCapacity - promotedDevices.length),
  );
  const headDevices = [...keptOrigDevices, ...promotedDevices];
  const accessorySlots = Math.max(0, headLen - headDevices.length);
  const headOthers = [...promotedOthers, ...origOthers].slice(0, accessorySlots);

  const newHead = [...headDevices, ...headOthers];
  const candidates = [...origDevices, ...promotedDevices, ...origOthers, ...promotedOthers];
  const candidateIds = new Set(candidates.map((item) => item.id));

  // Everything the head did not keep rolls to the tail, then the untouched
  // remainder of the pool keeps its original order. A pure permutation.
  const evicted = candidates.filter((item) => !include(item, newHead));
  const tailRest = pool.filter((item) => !candidateIds.has(item.id));

  return [...newHead, ...evicted, ...tailRest];
}

function include(item: SearchResultItem, list: SearchResultItem[]): boolean {
  return list.some((existing) => existing.id === item.id);
}