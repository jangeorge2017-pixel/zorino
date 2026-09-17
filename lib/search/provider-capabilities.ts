/**
 * Per-provider search capabilities.
 *
 * Every marketplace speaks its own "query language". This map is the single
 * place that records, generically, how each provider can be searched better for
 * device-intent queries — WITHOUT any model/product hardcoding and without
 * privileging one marketplace. Providers absent from the map fall back to plain
 * keyword search, so new providers participate automatically and nothing is
 * ever removed or disabled here.
 */

import type { ProductFamily } from "@/lib/search/query-intent";

export type ProviderSearchCapabilities = {
  /** How this provider's catalog understands a raw device query. */
  queryMode: "keyword" | "keyword-expand";
  /** Provider supports a category filter alongside the keyword query (eBay). */
  supportsCategoryFilter: boolean;
  /**
   * Provider supports a condition (NEW/USED/…) filter. Deliberately false
   * everywhere: ZORINO must never force `condition=NEW`, because Used and
   * Refurbished devices are legitimate results and must not be hidden.
   */
  supportsConditionFilter: boolean;
  /** Generic family terms appended to the query for `keyword-expand` providers. */
  deviceAppendTerms?: Partial<Record<ProductFamily, readonly string[]>>;
};

const KEYWORD_ONLY: ProviderSearchCapabilities = {
  queryMode: "keyword",
  supportsCategoryFilter: false,
  supportsConditionFilter: false,
};

const CAPABILITIES: Readonly<Record<string, ProviderSearchCapabilities>> = {
  ebay: {
    queryMode: "keyword",
    supportsCategoryFilter: true,
    supportsConditionFilter: false,
  },
  aliexpress: {
    queryMode: "keyword-expand",
    supportsCategoryFilter: false,
    supportsConditionFilter: false,
    deviceAppendTerms: {
      phone: ["smartphone", "unlocked", "mobile phone"],
      tablet: ["tablet"],
      laptop: ["computer", "notebook"],
      console: ["console"],
      audio: ["earbuds"],
    },
  },
};

/**
 * Capabilities for a provider id. Unknown providers get safe keyword-only
 * defaults rather than being dropped.
 */
export function getProviderSearchCapabilities(providerId: string): ProviderSearchCapabilities {
  return CAPABILITIES[providerId] ?? KEYWORD_ONLY;
}
