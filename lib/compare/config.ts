import { PROVIDER_IDS, isRegisteredProvider } from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/registry";

/**
 * Marketplaces participating in price comparison.
 *
 * The membership envelope is an ordered allowlist; the exported list is
 * derived from the provider registry so every entry is guaranteed to be a
 * registered provider (single source of truth). Order matches registry order.
 */
const COMPARISON_STORE_SELECTION = new Set<ProviderId>([
  "amazon",
  "aliexpress",
  "ebay",
  "walmart",
  "temu",
]);

export const COMPARISON_STORES: readonly ProviderId[] = PROVIDER_IDS.filter((id) =>
  COMPARISON_STORE_SELECTION.has(id)
).filter(isRegisteredProvider);

export type ComparisonStoreSlug = ProviderId;

export const PRICE_SYNC_INTERVAL_MINUTES = 240;

export const COMPARISON_TAG = "price-comparison";
