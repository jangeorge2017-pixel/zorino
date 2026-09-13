/**
 * Canonical consumption barrel (Phase 4).
 * All surfaces default OFF (see ./feature). Nothing here runs unless a surface
 * gate AND ARCH_CANONICAL are explicitly enabled.
 */

export {
  isSurfaceEnabled,
  setSurfaceEnabledForTests,
  resetSurfaceFlagsForTests,
  surfaceEnvValue,
  SURFACE_ENV_VARS,
  type CanonicalSurface,
} from "./feature";

export {
  canonicalizeSearchListings,
  canonicalizeCatalogItems,
  canonicalizeProductDetail,
  type CanonicalSearchOutcome,
  type CatalogItemOutcome,
  type ProductDetailOutcome,
} from "./core";

export {
  canonicalSearchProducts,
  searchProductsSurface,
  searchResultsPagedSurface,
  assembleCanonicalSearchPool,
  setCanonicalSearchFetcherForTests,
  type CanonicalSearchFetcher,
} from "./search";

export {
  applyCanonicalCatalogIfEnabled,
  getCanonicalCatalogDiagnostics,
  resetCanonicalCatalogDiagnosticsForTests,
  type CanonicalCatalogDiagnostics,
} from "./homepage";

export {
  canonicalCompareProducts,
  COMPARE_QUERIES,
} from "./compare";

export {
  resolveMarketplaceProductDetailCanonical,
  getPdpCanonicalDiagnostics,
  resetPdpCanonicalDiagnosticsForTests,
  type PdpCanonicalDiagnostics,
} from "./pdp";

export {
  runSearchFixtureParity,
  runSearchLiveParity,
  runCatalogFixtureParity,
  runCompareFixtureParity,
  runPdpFixtureParity,
  compareItems,
  createSearchParityReport,
  SEARCH_PARITY_FIELDS,
  CATALOG_PARITY_FIELDS,
  type SurfaceParityReport,
  type FieldParity,
  type ItemParity,
  type ParityVerdict,
  type PdpDetailFacade,
} from "./parity-harness";