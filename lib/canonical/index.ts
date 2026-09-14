/**
 * Canonical spine public barrel (Phase 1).
 *
 * Everything the rest of the app (and tests) can import for the canonical
 * architecture lives here. Legend: `.mjs` scripts / tests may import these.
 */

export * from "./types";
export {
  runAcquisition,
  runAllAcquisition,
  summarizeRun,
  type DirectAcquirer,
  type IndirectAcquirer,
  type AnyAcquirer,
  type ProviderAcquirerFailure,
  type AcquisitionRunResult,
  type AcquisitionOptions,
  type RunAllAcquisitionOptions,
} from "./acquisition";
export {
  createDirectAcquirer,
  type DirectListingAcquirerOptions,
} from "./acquisition/direct";
export {
  createIndirectFeedAcquirer,
  type IndirectFeedAcquirerOptions,
  type IndirectFeedSource,
} from "./acquisition/indirect";
export {
  isCanonicalEnabled,
  setCanonicalEnabledForTests,
  resetCanonicalFlagForTests,
  canonicalFlagValue,
} from "./feature";
export {
  validateOffer,
  qualityScoreFromValidation,
  summarizeValidation,
  type ValidationProfile,
  type ValidationGate,
} from "./validation";
export {
  matchOffers,
  variantFingerprint,
  attributesCompatible,
  canonicalProductKey,
} from "./matching";
export {
  resolveCanonicalStore,
  getCanonicalStoreName,
  getProviderLabel,
  providerAcquisitionMode,
  providerSupportedCurrencies,
  isRegisteredProviderId,
  type CanonicalStore,
} from "./registry";
export {
  retargetSearchListing,
  retargetCatalogOffer,
  retargetExternalProduct,
  retargetIndirectFeedOffer,
  type IndirectFeedOffer,
  type IndirectFeedMeta,
} from "./adapters";
export {
  checkListingParity,
  listingParityPasses,
  summarizeParity,
  CANONICAL_REJECTION_BY_CONDITION,
  type ParityResult,
  type ParityDimension,
  type RejectCondition,
} from "./parity";
export {
  checkpointFromRun,
  aggregateValidationRejections,
  writeCanonicalRun,
  summarizeCheckpoint,
  type CanonicalRunMeta,
} from "./health";
export {
  canonicalizeOffer,
  groupOffersIntoProducts,
  mergeProductBatches,
  buildCanonicalOfferId,
  buildCanonicalProductId,
  summarizeCanonicalize,
  type CanonicalizeParams,
  type CanonicalizeOutcome,
} from "./pipeline";
export {
  bootstrapIdentityFromRow,
  BOOTSTRAP_MIN_PRICE,
  backfillLowestPricesRows,
  NoopCanonicalIdentityStore,
  InMemoryCanonicalIdentityStore,
  LocalJsonIdentityStore,
  SupabaseCanonicalIdentityStore,
  createIdentityStore,
  type IdentityInputRow,
  type BootstrappedIdentity,
  type BootstrapRowError,
  type CanonicalIdentityStore,
  type CanonicalIdentityRecord,
  type CreateIdentityRecord,
  type IdentitySource,
  type IdentityStoreTarget,
  type IdentityStoreOptions,
  type BackfillOptions,
  type BackfillStats,
} from "./identity";
export {
  isSurfaceEnabled,
  setSurfaceEnabledForTests,
  resetSurfaceFlagsForTests,
  surfaceEnvValue,
  SURFACE_ENV_VARS,
  canonicalizeSearchListings,
  canonicalizeCatalogItems,
  canonicalizeProductDetail,
  canonicalSearchProducts,
  searchProductsSurface,
  assembleCanonicalSearchPool,
  setCanonicalSearchFetcherForTests,
  applyCanonicalCatalogIfEnabled,
  getCanonicalCatalogDiagnostics,
  canonicalCompareProducts,
  COMPARE_QUERIES,
  resolveMarketplaceProductDetailCanonical,
  getPdpCanonicalDiagnostics,
  runSearchFixtureParity,
  runSearchLiveParity,
  runCatalogFixtureParity,
  runCompareFixtureParity,
  runPdpFixtureParity,
  type CanonicalSurface,
  type SurfaceParityReport,
  type FieldParity,
  type ItemParity,
  type ParityVerdict,
} from "./consumption";