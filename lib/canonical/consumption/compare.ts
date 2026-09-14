/**
 * COMPARE surface — canonical consumption (Phase 4).
 *
 * Reproduction of the /compare page's data assembly, but sourced through the
 * flag-aware search surface. With all gates OFF this is byte-for-byte the
 * legacy path (legacy searchProducts → searchItemToCompareResult →
 * enrichCompareResults). With the compare gate ON the seed results come from
 * the canonical pipeline and everything downstream (offer flags, stats,
 * enrichment) is reused unchanged.
 *
 * When the ENTIRE surface is off, canonicalCompareProducts still falls back to
 * legacy search per query — matching today's compare page exactly.
 */

import type { CompareProductResult } from "@/services/compare";
import type { SearchResultItem } from "@/lib/data/homepage";
import { searchItemToCompareResult } from "@/lib/data/marketplace-product-detail";
import { enrichCompareResults } from "@/lib/data/multi-store-comparison";
import { searchProductsSurface } from "./search";
import { getSearchResultsFromDatabase } from "@/lib/integration/database-catalog";
import { isValidProductDestinationUrl } from "@/lib/affiliate/product-url";

export const COMPARE_QUERIES = ["laptop", "monitor", "earbuds", "smartwatch"] as const;

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/**
 * Interleave live-provider and database-catalog seeds so the compare pool is
 * not monopolized by whichever source returned first. Live items are limited
 * to a short consecutive run; the database source is guaranteed to take a turn
 * whenever it has stock, so real DB-backed merchant products (Admitad stores
 * surfaced through getSearchResultsFromDatabase) participate as base cards and
 * get cross-store-enrichment instead of only being matched against.
 */
function interleaveDedupe(
  live: readonly SearchResultItem[],
  db: readonly SearchResultItem[],
  limit: number,
): SearchResultItem[] {
  const seen = new Set<string>();
  const out: SearchResultItem[] = [];
  let li = 0;
  let di = 0;
  let liveStreak = 0;
  const pick = (item: SearchResultItem | undefined): void => {
    if (!item) return;
    const key = String(item.id);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  while (out.length < limit && (li < live.length || di < db.length)) {
    if (liveStreak >= 1 && di < db.length) {
      pick(db[di]);
      di += 1;
      liveStreak = 0;
    } else if (li < live.length) {
      pick(live[li]);
      li += 1;
      liveStreak += 1;
    } else {
      pick(db[di]);
      di += 1;
      liveStreak = 0;
    }
  }
  return out;
}

/**
 * Seed the compare pool for a query from BOTH sources:
 *  - live provider results (searchProductsSurface), and
 *  - the database catalog (getSearchResultsFromDatabase — real lowest-prices
 *    rows from Admitad merchant feeds).
 *
 * Database rows whose stored destination is only a merchant homepage or an
 * opaque link are dropped here: a compare base card must be a genuinely
 * shoppable product on a real store, never a homepage bookmark.
 *
 * Both sources are raced and individually tolerated so a slow or failing
 * source never empties the pool.
 */
async function fetchCompareSeed(
  query: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const budget = Math.max(4, Math.ceil(limit / 2));
  const [live, db] = await Promise.all([
    searchProductsSurface(query, budget).catch(() => []),
    getSearchResultsFromDatabase(query, Math.max(6, limit)).catch(() => []),
  ]);
  const dbShoppable = db.filter((item) =>
    isValidProductDestinationUrl(item.affiliateUrl),
  );
  return interleaveDedupe(live, dbShoppable, limit);
}

/** Builds the /compare page's CompareProductResult[] (flag-aware search). */
export async function canonicalCompareProducts(
  limit = 6,
): Promise<CompareProductResult[]> {
  const perQuery = Math.max(4, Math.ceil(limit / 2));
  const batches = await Promise.all(
    COMPARE_QUERIES.map((query) => fetchCompareSeed(query, perQuery).catch(() => [])),
  );

  const items = dedupeById(batches.flat());
  const baseProducts = items.slice(0, limit).map(searchItemToCompareResult);
  return enrichCompareResults(baseProducts);
}