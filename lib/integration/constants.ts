/** Production marketplace providers enabled for live catalog + search integration. */
import { PROVIDER_IDS } from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/registry";

export const PRODUCTION_PROVIDER_IDS: readonly ProviderId[] = PROVIDER_IDS;

export type ProductionProviderId = ProviderId;

export const DEFAULT_INTEGRATION_COUNTRY = "US";
export const DEFAULT_INTEGRATION_CURRENCY = "USD";

/** Catalog fetch defaults (homepage sections and comparison engine). */
export const CATALOG_FETCH_DEFAULTS = {
  maxPages: process.env.NODE_ENV === "development" ? 1 : 2,
  pageSize: process.env.NODE_ENV === "development" ? 12 : 24,
} as const;
