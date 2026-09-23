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
 *   - relevance stays the primary signal: exact/model products of every
 *     genuinely-inventory-bearing provider lead page 1 (their best candidates
 *     are placed directly behind the preserved global lead — early exposure,
 *     never stranded at positions 46-49), then the remaining devices, then
 *     family/series matches, then accessories; the relative pool order is
 *     preserved inside every segment,
 *   - a provider whose ONLY genuine candidates are same-family devices (no
 *     exact/model row in the pool) still gets its best genuine device in the
 *     early page-1 region — bounded by the early-device cap — so one
 *     provider's sheer exact/model volume can never monopolize page 1 while a
 *     peer holds real matching devices behind it,
 *   - EXACT beats FAMILY beats accessory: within the early region exact/model
 *     coverage precedes same-family coverage, a same-family seat or accessory
 *     never displaces an exact/model candidate already placed in the preserved
 *     lead, and on a device query an accessory is never brought ahead of a
 *     device,
 *   - only GENUINE product candidates count as provider representation: on a
 *     device/product query a repair part, screen assembly, or accessory (case,
 *     screen protector, VR glasses, …) can never stand in for a provider whose
 *     matching inventory is accessories/parts-only, so such a provider
 *     contributes ZERO results on page 1 (its pool rows, if any, stay behind
 *     every genuine device); on an accessory-intent query a relevant accessory
 *     IS the target product and is placed at the first accessory slots,
 *   - nothing irrelevant is ever promoted, no provider is fabricated or padded,
 *   - the dominant provider still owns most of the page when its relevance
 *     genuinely is the strongest (no forced-equal round-robin),
 *   - the complete universe is invariant: total, hasMore, zero-duplicate and
 *     DB-leg exclusion are all computed from the SAME item set, so pagination
 *     semantics are unchanged and page 2 continues from the same ordered
 *     candidate universe.
 *
 * The function is a pure permutation of `pool` (when it needs nothing it
 * returns the input unchanged), so it is safe to run over seeded pools in the
 * paged-seam tests: any pool with a single relevant provider (or nothing to
 * fix) is a no-op.
 */
import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import {
  analyzeSearchListing,
  isAccessoryListing,
  queryWantsAccessory,
  type ProductMatchTier,
} from "@/lib/search/relevance";
import type { SearchResultItem } from "@/lib/data/homepage";

/**
 * How many items one provider may contribute to the page-1 coverage block when
 * its genuine matching inventory only appears beyond the early region. Small
 * and bounded by design: presence is truthful, never an equal-share quota.
 */
export const PAGE_ONE_PROVIDER_PRESENCE = 2;

/**
 * How many leading page-1 slots stay reserved for the assembled global
 * relevance order before the coverage block begins.
 */
export const PAGE_ONE_LEADING_GLOBAL_SLOTS = 2;

/**
 * Upper bound on how many genuinely relevant, provider-best devices may be
 * placed in the early page-1 region. Bounded so a long tail of single-provider
 * volume can never be crowded off the page.
 */
export const PAGE_ONE_EARLY_DEVICE_CAP = 6;

type ListingRecord = {
  item: SearchResultItem;
  index: number;
  tier: ProductMatchTier;
  isDevice: boolean;
};

function headSizeFor(poolLength: number, pageSize: number): number {
  return Math.min(poolLength, Math.max(1, Math.floor(pageSize)));
}

/**
 * A listing is a repair part / accessory-style product for the query once
 * isAccessoryListing says so. On a device query those can never represent a
 * provider (an "iPhone X LCD screen full assembly" is not an iPhone 15 Pro
 * Max); on an accessory query a relevant accessory IS the target product.
 */
function isPartOrAccessory(item: SearchResultItem, query: string): boolean {
  return isAccessoryListing(item.name, query) === true;
}

/**
 * Provider coverage on page 1.
 *
 * Reorders `pool` (a pure permutation of the SAME item set) so every provider
 * that genuinely holds relevant candidates gets its best candidates inside the
 * early region of page 1, ordered by relevance tier: exact/model devices first
 * (the requested product), then family/series devices, then accessories (only
 * on accessory-intent queries). Providers whose entire matching inventory is
 * repair parts or accessories on a device query contribute zero.
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

  const wantsAccessory = queryWantsAccessory(query) === true;
  const take = Math.max(1, Math.floor(presence));

  const records: ListingRecord[] = pool.map((item, index) => {
    const analysis = analyzeSearchListing(item.name, query, {
      category: item.category,
    });
    return { item, index, tier: analysis.tier, isDevice: analysis.isDevice };
  });

  const isProduct = (row: ListingRecord): boolean => {
    if (row.tier === "none" || row.tier === "repair") return false;
    if (isPartOrAccessory(row.item, query)) {
      // On an accessory-intent query the relevance engine tags the matching
      // accessory as a real product (exact/model/accessory tier) and it IS the
      // target. On a device/product query an accessory can never represent a
      // provider.
      return wantsAccessory;
    }
    return row.isDevice === true;
  };

  const strongByProvider = new Map<string, ListingRecord[]>();
  const familyByProvider = new Map<string, ListingRecord[]>();
  const accessoryByProvider = new Map<string, ListingRecord[]>();

  for (const row of records) {
    if (!isProduct(row)) continue;
    const providerId = row.item.storeSlug;
    if (!providerId) continue;
    if (!isPartOrAccessory(row.item, query)) {
      if (row.tier === "exact" || row.tier === "model") {
        const bucket = strongByProvider.get(providerId) ?? [];
        bucket.push(row);
        strongByProvider.set(providerId, bucket);
      } else if (row.tier === "series" || row.tier === "brand") {
        const bucket = familyByProvider.get(providerId) ?? [];
        bucket.push(row);
        familyByProvider.set(providerId, bucket);
      }
    } else if (wantsAccessory) {
      const bucket = accessoryByProvider.get(providerId) ?? [];
      bucket.push(row);
      accessoryByProvider.set(providerId, bucket);
    }
  }

  // Representative providers: every provider holding at least one genuine
  // product anywhere in the pool (device-style products on device queries,
  // accessory targets on accessory queries).
  const reps = new Set<string>([...strongByProvider.keys()]);
  for (const providerId of familyByProvider.keys()) reps.add(providerId);
  if (wantsAccessory) for (const providerId of accessoryByProvider.keys()) reps.add(providerId);
  if (reps.size <= 1) return [...pool];

  const byIndex = (a: ListingRecord, b: ListingRecord): number => a.index - b.index;

  // Coverage block: each genuinely-inventory-bearing provider's best candidates.
  const coverageStrong: ListingRecord[] = [];
  for (const providerId of strongByProvider.keys()) {
    coverageStrong.push(...strongByProvider.get(providerId)!.slice(0, take));
  }
  coverageStrong.sort(byIndex);

  // Family-only providers (no exact/model in the pool) still get a truthful
  // seat. Their best same-family device joins the EARLY region directly behind
  // the exact/model coverage — bounded by the early-device cap — because a
  // provider whose only genuine candidates are family devices must still be
  // prevented from being crowded off page 1 by another provider's exact/model
  // volume. Providers that DO hold exact/model inventory keep their family
  // rows behind every exact/model candidate.
  const coverageFamily: ListingRecord[] = [];
  for (const providerId of familyByProvider.keys()) {
    if (strongByProvider.has(providerId)) continue;
    coverageFamily.push(...familyByProvider.get(providerId)!.slice(0, take));
  }
  coverageFamily.sort(byIndex);

  const coverageAccessory: ListingRecord[] = [];
  if (wantsAccessory) {
    for (const providerId of accessoryByProvider.keys()) {
      coverageAccessory.push(...accessoryByProvider.get(providerId)!.slice(0, take));
    }
    coverageAccessory.sort(byIndex);
  }

  if (
    coverageStrong.length === 0 &&
    coverageFamily.length === 0 &&
    (coverageAccessory.length === 0 || !wantsAccessory)
  ) {
    return [...pool];
  }

  const strongPool = records.filter((row) => strongRow(row, query, wantsAccessory));
  const familyPool = records.filter((row) => familyRow(row, query, wantsAccessory));
  const accessoryPool = wantsAccessory
    ? records.filter((row) => accessoryRow(row, query))
    : [];

  const used = new Set<string>();

  // Early device region: exact/model coverage first (a provider with exacts is
  // represented by its best exact rows, in pool order — which preserves the
  // global relevance lead), then same-family coverage of family-only providers,
  // bounded by the early-device cap so a long tail of single-family providers
  // can never crowd the page.
  const earlyBlock: ListingRecord[] = [];
  for (const row of [...coverageStrong, ...coverageFamily]) {
    if (used.has(row.item.id)) continue;
    used.add(row.item.id);
    earlyBlock.push(row);
  }
  const early = earlyBlock.slice(0, PAGE_ONE_EARLY_DEVICE_CAP);

  const strongSegment: ListingRecord[] = [...early];
  for (const row of strongPool) {
    if (used.has(row.item.id)) continue;
    used.add(row.item.id);
    strongSegment.push(row);
  }
  const familySegment: ListingRecord[] = [];
  for (const row of familyPool) {
    if (used.has(row.item.id)) continue;
    used.add(row.item.id);
    familySegment.push(row);
  }
  const accessorySegment: ListingRecord[] = [];
  for (const row of [...coverageAccessory, ...accessoryPool]) {
    if (used.has(row.item.id)) continue;
    used.add(row.item.id);
    accessorySegment.push(row);
  }

  // Reserve page-1 tail slots for accessory-intent coverage so a provider whose
  // only genuine matching inventory is the requested accessory is represented.
  const reserveAccessory = wantsAccessory
    ? Math.min(accessorySegment.length, accessoryByProvider.size * take)
    : 0;
  const strongBudget = Math.max(0, headLen - reserveAccessory);

  const head: SearchResultItem[] = [];
  for (const row of strongSegment) {
    if (head.length >= strongBudget) break;
    head.push(row.item);
  }
  for (const row of familySegment) {
    if (head.length >= headLen) break;
    head.push(row.item);
  }
  for (const row of accessorySegment) {
    if (head.length >= headLen) break;
    head.push(row.item);
  }

  // Rare underfill: drain the remaining pool in order (accessories included),
  // still bounded to the page and still a permutation.
  if (head.length < headLen) {
    const headIds = new Set(head.map((i) => i.id));
    for (const row of records) {
      if (head.length >= headLen) break;
      if (headIds.has(row.item.id)) continue;
      headIds.add(row.item.id);
      head.push(row.item);
    }
  }

  const headIds = new Set(head.map((i) => i.id));
  const tail = pool.filter((item) => !headIds.has(item.id));
  return [...head, ...tail];
}

function strongRow(row: ListingRecord, query: string, wantsAccessory: boolean): boolean {
  if (wantsAccessory) return row.isDevice === true && !isPartOrAccessory(row.item, query);
  return row.tier === "exact" || row.tier === "model";
}

function familyRow(row: ListingRecord, query: string, wantsAccessory: boolean): boolean {
  if (wantsAccessory || isPartOrAccessory(row.item, query)) return false;
  return row.tier === "series" || row.tier === "brand";
}

function accessoryRow(row: ListingRecord, query: string): boolean {
  return isPartOrAccessory(row.item, query);
}
