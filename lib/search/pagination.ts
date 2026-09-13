import type { SearchResultItem } from "@/lib/data/homepage";

/**
 * Merge an incoming paged result onto the items already loaded in the search
 * UI. Order is preserved: the incoming page is appended after the items seen
 * so far. Items whose `id` is already present are dropped — this protects
 * against overlap when the server-side cached search pool is evicted and
 * re-fetched between "Load more" clicks (the pool is cached for
 * FAIR_SEARCH_TTL_MS, but a re-fetch can reorder results slightly).
 *
 * The filter/sort in the UI runs over the merged list, so skipped duplicates
 * are never rendered twice and never counted twice.
 */
export function mergePagedResults(
  existing: SearchResultItem[],
  incoming: SearchResultItem[],
): SearchResultItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id));
  return fresh.length > 0 ? [...existing, ...fresh] : existing;
}