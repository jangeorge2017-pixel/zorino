export {
  ACTIVE_MARKETPLACE_PROVIDERS,
  FUTURE_MARKETPLACE_PROVIDERS,
  ALL_MARKETPLACE_PROVIDERS,
  DUPLICATE_MATCH_CONFIDENCE,
  FUZZY_TITLE_THRESHOLD,
  IDENTIFIER_SPEC_KEYS,
} from "@/lib/marketplace-engine/config";

export type {
  MarketplaceProviderId,
  ProductIdentifierType,
  ProductIdentifier,
  DuplicateMatchType,
  DuplicateMatchResult,
  MarketplaceOffer,
  ProductPricingSummary,
  ProductVariant,
  PriceChangeDirection,
  PriceChangeRecord,
} from "@/lib/marketplace-engine/types";

export {
  normalizeTitleKey,
  tokenizeTitle,
  titleSimilarity,
  extractProductIdentifiers,
  computeSavingsPercent,
  computeDiscountPercent,
  computePriceChange,
} from "@/lib/marketplace-engine/utils";

export {
  findUniversalDuplicateProduct,
  logProductMatch,
} from "@/lib/marketplace-engine/deduplication";

export {
  syncProductIdentifiers,
  syncProductVariants,
  computeProductPricingSummary,
  refreshProductPricingAggregates,
  afterProductMerge,
} from "@/lib/marketplace-engine/catalog";

export { searchCatalogProducts } from "@/lib/marketplace-engine/search";
