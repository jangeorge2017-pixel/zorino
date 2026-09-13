/**
 * PDP surface — canonical consumption (Phase 4).
 *
 * Default (gate off): a transparent passthrough to resolveMarketplaceProductDetail.
 * Gate on: the resolved detail's comparison offers pass through the canonical
 * spine (validate → group). Valid offers keep their exact bytes; invalid ones
 * are removed and the comparison summary re-computed with the legacy stats
 * (lib/compare/merge semantics). All live provider fetching, DB merges, and
 * enrichment stay on the legacy path — the canonical layer only gates what is
 * published. Any exception falls back to the legacy result.
 */

import type { ProductDetail } from "@/lib/data/product-detail";
import { resolveMarketplaceProductDetail } from "@/lib/data/marketplace-product-detail";
import { canonicalizeProductDetail } from "./core";
import { isSurfaceEnabled } from "./feature";

export interface PdpCanonicalDiagnostics {
  runs: number;
  rejectedOffers: number;
  changed: number;
  lastRunAt: string | null;
}

const diag: PdpCanonicalDiagnostics = {
  runs: 0,
  rejectedOffers: 0,
  changed: 0,
  lastRunAt: null,
};

export function getPdpCanonicalDiagnostics(): PdpCanonicalDiagnostics {
  return { ...diag };
}

export function resetPdpCanonicalDiagnosticsForTests(): void {
  diag.runs = 0;
  diag.rejectedOffers = 0;
  diag.changed = 0;
  diag.lastRunAt = null;
}

export async function resolveMarketplaceProductDetailCanonical(
  id: string,
): Promise<ProductDetail | null> {
  if (!isSurfaceEnabled("pdp")) {
    return resolveMarketplaceProductDetail(id);
  }

  try {
    const detail = await resolveMarketplaceProductDetail(id);
    if (!detail) return null;

    const outcome = canonicalizeProductDetail(detail);
    diag.runs += 1;
    diag.rejectedOffers += outcome.rejectedOfferIds.length;
    diag.changed += outcome.changed ? 1 : 0;
    diag.lastRunAt = new Date().toISOString();

    return outcome.changed ? outcome.detail : detail;
  } catch {
    return resolveMarketplaceProductDetail(id);
  }
}