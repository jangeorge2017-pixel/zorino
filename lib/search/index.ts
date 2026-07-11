export {
  ACCESSORY_TERMS,
  REPAIR_AND_PARTS_TERMS,
  OFFICIAL_DEVICE_BRANDS,
  DEVICE_CATEGORY_HINTS,
  MARKETPLACE_SEARCH_DEFAULTS,
  queryTokens,
  queryWantsAccessory,
  requiredBrandsForQuery,
  hasOfficialBrand,
  hasSameModel,
  hasSameSeries,
  titleMatchesQuery,
  looksLikeDevice,
  isAccessoryListing,
  analyzeSearchListing,
  scoreSearchRelevance,
  isRelevantTitle,
  rankBySearchRelevance,
} from "@/lib/search/relevance";

export type { ProductMatchTier, SearchListingAnalysis } from "@/lib/search/relevance";

export {
  SEARCH_PROVIDER_IDS,
  SEARCH_ENGINE_DEFAULTS,
  LIVE_SEARCH_PROVIDER_IDS,
} from "@/lib/search/types";

export type {
  SearchProviderId,
  RawProviderListing,
  NormalizedSearchListing,
  UnifiedSearchProduct,
  SearchEngineResult,
} from "@/lib/search/types";

export { executeGlobalSearch, searchProducts } from "@/lib/search/engine";
export type { GlobalSearchOptions } from "@/lib/search/engine";

export { getActiveSearchConnectors, getAllSearchConnectors } from "@/lib/search/connectors/registry";
export { mergeDuplicateListings } from "@/lib/search/deduplication";
export { rankRawListings } from "@/lib/search/ranking";
export {
  unifiedToSearchResultItem,
  unifiedToMarketplaceSearchItems,
  marketplaceDisplayName,
  summarizePriceComparison,
} from "@/lib/search/price-comparison";
