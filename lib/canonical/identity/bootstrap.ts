/**
 * Identity bootstrap — Phase 3.
 *
 * Builds deterministic canonical product/offer identities for products that
 * ALREADY exist in the runtime (e.g. `lowest_prices_today` rows) so the
 * canonical spine can reference them without a live provider call. This is
 * READ-ONLY bootstrap: it never modifies lowest_prices_today or any runtime
 * table — it only computes stable ids and, when a store is provided, persists
 * an identity map in the NEW canonical_identity_map table (migration 025,
 * NOT applied to production).
 *
 * Rules:
 *  - Deterministic: same row → same canonicalProductId / canonicalOfferId.
 *  - No data invention: identifiers/brand/model are only used when present;
 *    otherwise the normalized title key is the fallback (confidence drops to
 *    "suggested"). Rows without a usable title/price/external ref are skipped.
 *  - Provider-native ids preserved: canonicalOfferId is scoped by provider.
 */

import { buildCanonicalOfferId, buildCanonicalProductId } from "@/lib/canonical/pipeline";
import { canonicalProductKey } from "@/lib/canonical/matching";
import type { MatchConfidence } from "@/lib/canonical/types";

/** Minimal shape of a lowest_prices_today-style input row (safe, read-only). */
export interface IdentityInputRow {
  /** Stable row/product id from the source table (e.g. lowest_prices_today.product_id). */
  product_id: string;
  product_name: string;
  provider: string;
  store_name?: string;
  lowest_price: number;
  original_price?: number | null;
  currency?: string;
  country_code?: string;
  image_url?: string;
  affiliate_url?: string;
  external_url?: string;
}

/** Deterministic identity computed for one input row. */
export interface BootstrappedIdentity {
  canonicalProductId: string;
  canonicalOfferId: string;
  /** Identity key used to derive the product id (bm:<brand>|<model> | title:...). */
  key: string;
  /** How much the identity is trusted. */
  confidence: MatchConfidence;
  /** Normalized title (telemetry / human-readable clustering). */
  titleKey: string;
}

export interface BootstrapRowError {
  reason: "no-title" | "no-price" | "no-external-id" | "no-provider";
  productId?: string;
}

export const BOOTSTRAP_MIN_PRICE = 0;

/**
 * Compute the canonical identity for one input row deterministically.
 * Returns { identity } on success or { error } when the row is unusable.
 */
export function bootstrapIdentityFromRow(
  row: IdentityInputRow,
):
  | { identity: BootstrappedIdentity }
  | { error: BootstrapRowError } {
  const title = row.product_name?.trim();
  if (!title) return { error: { reason: "no-title", productId: row.product_id } };

  const price = Number(row.lowest_price);
  if (!Number.isFinite(price) || price <= BOOTSTRAP_MIN_PRICE) {
    return { error: { reason: "no-price", productId: row.product_id } };
  }

  const externalRef = row.product_id?.trim();
  if (!externalRef) return { error: { reason: "no-external-id", productId: externalRef } };

  const providerId = row.provider?.trim();
  if (!providerId) return { error: { reason: "no-provider", productId: externalRef } };

  // lowest_prices_today rows carry no identifiers/brand/model columns — but
  // when a richer source supplies them (future), the bootstrap key honors them.
  const key = canonicalProductKey({ title, brand: undefined, model: undefined });

  const canonicalProductId = buildCanonicalProductId(key);
  const canonicalOfferId = buildCanonicalOfferId(providerId, externalRef);

  const confidence: MatchConfidence = "suggested";
  const titleKey = key.startsWith("title|") ? key.slice("title|".length) : key;

  return {
    identity: {
      canonicalProductId,
      canonicalOfferId,
      key,
      confidence,
      titleKey,
    },
  };
}