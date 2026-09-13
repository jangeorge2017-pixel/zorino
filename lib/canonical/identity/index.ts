/**
 * Identity bootstrap + persistence barrel (Phase 3).
 */

export {
  bootstrapIdentityFromRow,
  BOOTSTRAP_MIN_PRICE,
  type IdentityInputRow,
  type BootstrappedIdentity,
  type BootstrapRowError,
} from "./bootstrap";

export {
  NoopCanonicalIdentityStore,
  InMemoryCanonicalIdentityStore,
  LocalJsonIdentityStore,
  SupabaseCanonicalIdentityStore,
  createIdentityStore,
  type CanonicalIdentityStore,
  type CanonicalIdentityRecord,
  type CreateIdentityRecord,
  type IdentitySource,
  type IdentityStoreTarget,
  type IdentityStoreOptions,
  type SupabaseLikeClient,
} from "./persistence";

export {
  backfillLowestPricesRows,
  type BackfillOptions,
  type BackfillStats,
} from "./backfill";