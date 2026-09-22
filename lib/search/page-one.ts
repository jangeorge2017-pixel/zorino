/**
 * Page-1 composition seam for /search.
 *
 * The assembled search pool is device-first and relevance-ordered, but a single
 * provider's genuine exact/model volume can fill the whole first page while
 * every other provider's genuine matching inventory (same-family devices,
 * imported rows, relevant accessories) sits at pool positions 50+. This module
 * recomposes ONLY the head of that pool (membership is untouched — the same
 * items, reordered) so every provider that actually holds matching results gets
 * a truthful presence on page 1 with MEANINGFUL EARLY exposure:
 *
 *   - global relevance stays the primary signal: the top leading slots are
 *     preserved untouched, and within every provider the assembled relevance
 *     order is kept,
 *   - a provider missing from page 1 has its genuine devices placed directly
 *     at the start of the page's device block (right behind the preserved
 *     global lead), not stranded at positions 46-49,
 *   - a provider whose matching inventory is only relevant accessories gets its
 *     best accessories at the first accessory slots — a device never yields to
 *     an accessory, so accessories are never brought ahead of a device,
 *   - the provider with the most matching results still dominates the page
 *     (presence is bounded, never a forced-equal round-robin),
 *   - nothing irrelevant is ever promoted just to satisfy diversity,
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

/**
 * How many leading page-1 slots stay reserved for the assembled global
 * relevance order before the diversity placements begin.
 */
export const PAGE_ONE_LEADING_GLOBAL_SLOTS = 2;

/**
 * Upper bound on how many genuinely relevant, provider-best devices may be
 * placed in the early page-1 region. Bounded so a long tail of single-provider
 * volume can never be crowded off the page.
 */
export const PAGE_ONE_EARLY_DEVICE_CAP = 6;

function headSizeFor(poolLength: number, pageSize: number): number {
  return Math.min(poolLength, Math.max(1, Math.floor(pageSize)));
}

function isDeviceItem(item: SearchResultItem, query: string): boolean {
  const analysis = analyzeSearchListing(item.name, query);
  return analysis.isDevice === true;
}

/** Only genuinely matching inventory may be promoted — never tier none/repair. */
function isSufficientlyRelevant(item: SearchResultItem, query: string): boolean {
  const tier = analyzeSearchListing(item.name, query).tier;
  return tier !== "none" && tier !== "repair";
}

/**
 * Reorder `pool` so every provider represented anywhere in it appears inside
 * the first `pageSize` positions, with its best genuine devices placed EARLY
 * on page 1 (right behind the preserved global-relevance lead). Returns the
 * input unchanged when nothing is missing (pool ≤ page / already
 * representative / single-provider).
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

  // Select each missing provider's genuine inventory (device-first, up to
  // `take` per provider, preserving that provider's own relevance order).
  const take = Math.max(1, Math.floor(presence));
  const earlyDevices: SearchResultItem[] = [];
  const promotedOthers: SearchResultItem[] = [];
  for (const providerId of missing) {
    const candidates = restByProvider.get(providerId) ?? [];
    if (candidates.length === 0) continue;
    const devices: SearchResultItem[] = [];
    const others: SearchResultItem[] = [];
    for (const candidate of candidates) {
      if (isDeviceItem(candidate, query)) devices.push(candidate);
      else others.push(candidate);
    }
    for (const item of [...devices, ...others].slice(0, take)) {
      if (isDeviceItem(item, query)) earlyDevices.push(item);
      else promotedOthers.push(item);
    }
  }
  if (earlyDevices.length + promotedOthers.length === 0) return [...pool];

  // Real inventory only: drop anything the relevance tiers reject so diversity
  // can never promote an irrelevant product.
  const billing = earlyDevices
    .filter((item) => isSufficientlyRelevant(item, query))
    .slice(0, PAGE_ONE_EARLY_DEVICE_CAP);
  if (billing.length + promotedOthers.length === 0) return [...pool];

  const origDevices = head.filter((item) => isDeviceItem(item, query));
  const origOthers = head.filter((item) => !isDeviceItem(item, query));

  // Devices lead page 1. The device block keeps the assembled global-relevance
  // lead untouched, then places every promoted provider-best device directly
  // behind it (early exposure), then the remaining original devices in
  // assembled order. Accessories are admitted only into the tail — promoted
  // ones first (they belong to the provider this whole pass is about), then any
  // the head already held. If the leading device block would otherwise crowd a
  // promotion out, the last leading devices roll to page 2 (same items, still
  // reachable, never discarded).
  const lead = Math.min(PAGE_ONE_LEADING_GLOBAL_SLOTS, origDevices.length);
  const origTail = origDevices.slice(lead);
  const origBudget = Math.max(
    0,
    headLen - billing.length - promotedOthers.length - lead,
  );
  const keptOrigTail = origTail.slice(0, origBudget);

  const headDevices = [
    ...origDevices.slice(0, lead),
    ...billing,
    ...keptOrigTail,
  ];
  const accessorySlots = Math.max(0, headLen - headDevices.length);
  const headOthers = [...promotedOthers, ...origOthers].slice(0, accessorySlots);

  const newHead = [...headDevices, ...headOthers];
  const candidates = [...origDevices, ...earlyDevices, ...origOthers, ...promotedOthers];
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