/**
 * Provider infrastructure — barrel export.
 *
 * Import from here to access the canonical schema, validation,
 * provider registry, and adapter layer.
 */
export type {
  ProductImage,
  ProductLocation,
  ProductDiscount,
  Availability,
  CancellationPolicy,
  SellerInfo,
  ProviderMetadata,
  CanonicalListing,
  PaginationInfo,
  ProviderStat,
  DeduplicationStats,
  SearchResultSet,
  CompareOffer,
  CompareProductResult,
  ProviderConfig,
} from "./schema";

export {
  CanonicalListingSchema,
  SearchResultSetSchema,
  CompareProductResultSchema,
  ProviderConfigSchema,
  validateCanonicalListing,
  validateCanonicalListings,
  computeDiscount,
  deriveCanonicalItemId,
} from "./validation";

export {
  PROVIDER_REGISTRY,
  PROVIDER_IDS,
  getProviderConfig,
  getAllProviderIds,
  getProviderDisplayName,
  resolveProviderId,
  isRegisteredProvider,
  getAllRequiredEnvVars,
} from "./registry";

export type { ProviderId, ProviderStatus } from "./registry";

export type { ProviderAdapter, ProviderSearchResult, AdapterConfig } from "./adapter";
export { defaultNormalizeBatch } from "./adapter";

export {
  getProviderAdapter,
  requireProviderAdapter,
  getAllProviderAdapters,
  getActiveProviderAdapters,
  getActiveProviderIds,
  getRegisteredAdapterCount,
} from "./adapter-registry";
