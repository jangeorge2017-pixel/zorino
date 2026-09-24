import { SEARCH_ENGINE_DEFAULTS } from "@/lib/search/types";
import type { ListingCondition } from "@/lib/search/types";

/**
 * Condition-diversity guardrail (anti-monopoly, search aggregation layer).
 *
 * A single source's Refurbished/Used catalog (eBay's deep used-phone pool) can
 * otherwise fill an entire search page in both relevance and price mode: the
 * equal-share balancer caps TOTAL volume, not the refurbished tail, and the
 * price sort lets a wall of cheap refurbished handsets push a store's few new
 * units off the screen. This module reorders/trims the assembled pool so every
 * page window stays condition-diverse:
 *
 *   1. HARD CAP — no single source may contribute more than `share` (40%) of
 *      a page window as Refurbished/Used items.
 *   2. THIN-PEER FALLBACK — when one source holds MORE Refurbished/Used stock
 *      than every other source combined (its peers are thinner), its cap
 *      tightens to `dominantPageSeats` (5) per window — the spec's
 *      "eBay ≤ 5 items per page view" rule.
 *   3. GROUPING — in relevance mode (`newFirst`) New items from every source
 *      lead each window (Amazon/AliExpress global stock surfaces top); the
 *      Refurbished/Used block sits behind it, bounded by the caps above.
 *
 * The guardrail is a pure function: it never invents results, never changes
 * provider identity, and only trims a source's over-budget Refurbished/Used
 * tail from the DISPLAY pool (the catalogue/DB leg and pagination totals are
 * untouched — the beyond-pool page always serves the complete matching
 * universe). Cheap-price order is preserved in price mode (`newFirst: false`).
 */

/**
 * Max share of a page window that any single source may occupy as
 * Refurbished/Used items (requirement: 40% hard cap per source).
 */
export const REFURB_PER_SOURCE_WINDOW_SHARE = 0.4;

/**
 * Fixed per-page-window seat cap for the DOMINANT Refurbished/Used source when
 * its peers are thinner (requirement: strict eBay ≤ 5 per page view).
 */
export const REFURB_DOMINANT_SOURCE_PAGE_SEATS = 5;

export type ConditionDiversityItem = {
  providerId: string;
  condition?: ListingCondition;
  title?: string;
};

export function isNonNewCondition(condition: ListingCondition | undefined): boolean {
  return condition === "refurbished" || condition === "used";
}

/**
 * Classify a listing's condition: an explicit provider condition wins; absent,
 * the title is scanned for the industry marker vocabulary (Amazon "Renewed",
 * eBay "Refurbished", "Pre-Owned", "Open Box", …). Unknown → "new" (the safe
 * default — unclassified stock never gets penalized).
 */
export function classifyListingCondition(
  title: string | undefined,
  explicit?: ListingCondition | string | null,
): ListingCondition {
  const normalized =
    typeof explicit === "string" ? explicit.trim().toLowerCase() : explicit;
  if (normalized === "refurbished" || normalized === "used" || normalized === "new") {
    return normalized;
  }
  if (typeof normalized === "string" && normalized.length > 0) {
    // eBay Browse API vocabulary: "Brand New", "New other (see details)",
    // "Seller refurbished", "Good - Refurbished", "Very Good", "Acceptable",
    // "Open box", "For parts or not working", "Like New", ...
    if (/(^|\s)(brand\s+new|new|new\s+with.*|new\s+other)/.test(normalized)) return "new";
    if (/refurbish/.test(normalized)) return "refurbished";
    if (/(used|open box|good|very good|acceptable|for parts|like new|pre-?owned)/.test(normalized)) {
      return "used";
    }
  }

  if (!title) return "new";
  const t = title.toLowerCase();
  if (/(renewed|\brefurbished|refurb\b|pre-?owned|open box)/.test(t)) {
    return /(\brenewed\b|\brefurbish)/.test(t) ? "refurbished" : "used";
  }
  if (/(^|\b)(new|brand new)(\b|$)/.test(t)) return "new";
  return "new";
}

export type ConditionDiversityOptions<T> = {
  /** Size of the per-page window the caps account against (default: PAGE_SIZE). */
  windowSize?: number;
  /** Hard per-source share of a window for Refurbished/Used items (default 0.4). */
  share?: number;
  /** Seat cap per window for the dominant Refurbished/Used source (default 5). */
  dominantPageSeats?: number;
  /** True → New items lead every window (relevance grouping). */
  newFirst?: boolean;
  /** Extract the display provider id (e.g. storeSlug). */
  providerOf: (item: T) => string;
  /** Extract/classify the item's condition. */
  conditionOf: (item: T) => ListingCondition;
};

type Seated<T> = { item: T; provider: string; nonNew: boolean };

/**
 * Pure condition-diversity guardrail over an assembled search pool.
 *
 * Returns a deterministic reorder/trim of `items` where every result window of
 * `windowSize` has, for every source, at most
 * `min(dominantPageSeats, ceil(share * windowSize))` (dominant source) or
 * `ceil(share * windowSize)` (every other source) Refurbished/Used items.
 * With `newFirst` the New items lead each window. Over-budget Refurbished/Used
 * items are trimmed from the display pool; the trim never drops a pool below
 * one full window so a genuinely lone source never underfills its page.
 */
export function enforceConditionDiversity<T>(
  items: readonly T[],
  options: ConditionDiversityOptions<T>,
): T[] {
  const windowSize = Math.max(
    1,
    Math.floor(options.windowSize ?? SEARCH_ENGINE_DEFAULTS.PAGE_SIZE),
  );
  const share = options.share ?? REFURB_PER_SOURCE_WINDOW_SHARE;
  const dominantPageSeats = Math.max(
    1,
    Math.floor(options.dominantPageSeats ?? REFURB_DOMINANT_SOURCE_PAGE_SEATS),
  );
  const newFirst = options.newFirst ?? false;
  const providerOf = options.providerOf;
  const conditionOf = options.conditionOf;

  if (items.length <= 1) return [...items];

  const seated: Seated<T>[] = items.map((item) => {
    const provider = providerOf(item);
    const nonNew = isNonNewCondition(conditionOf(item));
    return { item, provider, nonNew };
  });

  // Per-source Refurbished/Used totals → dominance detection.
  const nonNewByProvider = new Map<string, number>();
  let totalNonNew = 0;
  for (const row of seated) {
    if (!row.nonNew) continue;
    totalNonNew += 1;
    nonNewByProvider.set(row.provider, (nonNewByProvider.get(row.provider) ?? 0) + 1);
  }

  const windows = Math.max(1, Math.ceil(items.length / windowSize));
  const dominant = new Set<string>();
  for (const [provider, count] of nonNewByProvider) {
    if (count > totalNonNew - count) dominant.add(provider);
  }
  const baseCap = Math.max(1, Math.ceil(share * windowSize));
  const capForWindow = (provider: string): number =>
    dominant.has(provider) ? Math.min(dominantPageSeats, baseCap) : baseCap;
  const capForPool = (provider: string): number => capForWindow(provider) * windows;

  // Pre-order: relevance grouping puts every New item ahead of the
  // Refurbished/Used block; price mode keeps the strict source order.
  const ordered: Seated<T>[] = newFirst
    ? [...seated.filter((row) => !row.nonNew), ...seated.filter((row) => row.nonNew)]
    : [...seated];

  // Build the final pool, trimming a source's over-budget Refurbished/Used
  // tail. Window accounting is over the RESULT (not the input): every window of
  // the returned pool satisfies the per-source cap by construction.
  const placed: Seated<T>[] = [];
  const trimmed: Seated<T>[] = [];
  const perProviderInWindow = new Map<string, number>();
  const perProviderInPool = new Map<string, number>();
  let windowStart = 0;

  for (const row of ordered) {
    if (!row.nonNew) {
      placed.push(row);
      continue;
    }

    if (placed.length - windowStart >= windowSize) {
      windowStart = placed.length;
      perProviderInWindow.clear();
    }

    const windowCount = perProviderInWindow.get(row.provider) ?? 0;
    const poolCount = perProviderInPool.get(row.provider) ?? 0;
    if (windowCount >= capForWindow(row.provider) || poolCount >= capForPool(row.provider)) {
      // Over budget — drop from the DISPLAY pool (catalogue untouched).
      trimmed.push(row);
      continue;
    }
    perProviderInWindow.set(row.provider, windowCount + 1);
    perProviderInPool.set(row.provider, poolCount + 1);
    placed.push(row);
  }

  // Never let the guardrail underfill a page for a genuinely LONE source (no
  // other provider present at all): restore over-budget Refurbished/Used items
  // until the pool holds a full window. With peers present the strict caps stay
  // hard — a short, diverse window is the intended outcome, never a page
  // re-flooded by the dominant source.
  const providerCount = new Set(items.map((item) => providerOf(item))).size;
  if (providerCount === 1) {
    for (const row of trimmed) {
      if (placed.length >= windowSize) break;
      placed.push(row);
    }
  }

  return placed.map((row) => row.item);
}