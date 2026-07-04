/**
 * eBay adapter for shared marketplace search relevance.
 * @see lib/search/relevance.ts
 */
export {
  ACCESSORY_TERMS,
  DEVICE_CATEGORY_HINTS,
  MARKETPLACE_SEARCH_DEFAULTS,
  queryTokens,
  queryWantsAccessory,
  looksLikeDevice,
  isAccessoryListing,
  scoreSearchRelevance,
  isRelevantTitle,
  rankBySearchRelevance,
} from "@/lib/search/relevance";

import { rankBySearchRelevance } from "@/lib/search/relevance";

/** Filter and rank eBay item summaries for a user search query. */
export function filterRelevantEbayProducts<T extends { title?: string }>(
  products: T[],
  query: string
): T[] {
  return rankBySearchRelevance(products, query, (p) => p.title ?? "");
}
