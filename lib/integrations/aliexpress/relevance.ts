/**
 * AliExpress adapter for shared marketplace search relevance.
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
  analyzeSearchListing,
  scoreSearchRelevance,
  isRelevantTitle,
  rankBySearchRelevance,
} from "@/lib/search/relevance";

import {
  rankBySearchRelevance,
  scoreSearchRelevance,
} from "@/lib/search/relevance";

/** @deprecated Use scoreSearchRelevance */
export function scoreTitleRelevance(
  title: string,
  query: string,
  category?: string
): number {
  return scoreSearchRelevance(title, query, { category });
}

/** Keep relevant AliExpress products, highest device score first. */
export function filterRelevantProducts<
  T extends { product_title?: string; first_level_category_name?: string },
>(products: T[], query: string): T[] {
  return rankBySearchRelevance(
    products,
    query,
    (p) => p.product_title ?? "",
    (p) => p.first_level_category_name
  );
}
