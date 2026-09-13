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
import { searchItemToCompareResult } from "@/lib/data/marketplace-product-detail";
import { enrichCompareResults } from "@/lib/data/multi-store-comparison";
import { searchProductsSurface } from "./search";

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

/** Builds the /compare page's CompareProductResult[] (flag-aware search). */
export async function canonicalCompareProducts(
  limit = 6,
): Promise<CompareProductResult[]> {
  const batches = await Promise.all(
    COMPARE_QUERIES.map((query) =>
      searchProductsSurface(query, 4).catch(() => []),
    ),
  );

  const items = dedupeById(batches.flat());
  const baseProducts = items.slice(0, limit).map(searchItemToCompareResult);
  return enrichCompareResults(baseProducts);
}