/**
 * HOMEPAGE surface — canonical consumption (Phase 4).
 *
 * When the homepage gate is OFF (default) the catalog output is untouched.
 * When ON, every merged catalog item passes its offers through the canonical
 * spine (validate → group into products). Marketplace balancing, order,
 * caching (reactCache + unstable_cache 5-min), pricing, images, and affiliate
 * destinations are preserved: only offers that fail canonical validation are
 * removed (and items that lose every offer are dropped). Diagnostics are held
 * in-process for parity/reporting.
 */

import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import { canonicalizeCatalogItems } from "./core";
import { isSurfaceEnabled } from "./feature";

export interface CanonicalCatalogDiagnostics {
  runs: number;
  itemsIn: number;
  itemsOut: number;
  droppedItems: number;
  rejectedOffers: number;
  productsFormed: number;
  lastRunAt: string | null;
}

const diag: CanonicalCatalogDiagnostics = {
  runs: 0,
  itemsIn: 0,
  itemsOut: 0,
  droppedItems: 0,
  rejectedOffers: 0,
  productsFormed: 0,
  lastRunAt: null,
};

export function getCanonicalCatalogDiagnostics(): CanonicalCatalogDiagnostics {
  return { ...diag };
}

export function resetCanonicalCatalogDiagnosticsForTests(): void {
  diag.runs = 0;
  diag.itemsIn = 0;
  diag.itemsOut = 0;
  diag.droppedItems = 0;
  diag.rejectedOffers = 0;
  diag.productsFormed = 0;
  diag.lastRunAt = null;
}

/**
 * Flag-aware boundary for the homepage catalog. Default (gate off): returns
 * the exact same items array. Gate on: converges offers through the spine.
 */
export function applyCanonicalCatalogIfEnabled(
  items: readonly NormalizedCatalogItem[],
): NormalizedCatalogItem[] {
  if (!isSurfaceEnabled("homepage")) return items as NormalizedCatalogItem[];

  const outcome = canonicalizeCatalogItems(items);
  diag.runs += 1;
  diag.itemsIn += items.length;
  diag.itemsOut += outcome.items.length;
  diag.droppedItems += outcome.droppedItems;
  diag.rejectedOffers += outcome.rejectedOffers;
  diag.productsFormed += outcome.productsFormed;
  diag.lastRunAt = new Date().toISOString();

  return outcome.items;
}