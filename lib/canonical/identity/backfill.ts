/**
 * Identity backfill — Phase 3.
 *
 * Bootstraps canonical identity for existing runtime rows (lowest_prices_today
 * shaped) and persists the resulting identity map through a CanonicalIdentityStore.
 * Purely additive: reads source rows passed by the caller, writes only to the
 * (new) canonical identity store. It never touches lowest_prices_today and
 * never rewrites runtime id fields.
 */

import { bootstrapIdentityFromRow, type IdentityInputRow, type BootstrapRowError } from "./bootstrap";
import type { CanonicalIdentityStore, CreateIdentityRecord } from "./persistence";

export interface BackfillOptions {
  store: CanonicalIdentityStore;
  /** Skip rows whose external ref already exists in the store. Default true. */
  skipExisting?: boolean;
}

export interface BackfillStats {
  totalRows: number;
  mapped: number;
  skipped: number;
  existingSkipped: number;
  skipReasons: Partial<Record<BootstrapRowError["reason"], number>>;
  duplicateExternalKeys: number;
  uniqueProducts: number;
  byProvider: Record<string, { rows: number; mapped: number }>;
}

function reasonKey(reason: BootstrapRowError["reason"]): BootstrapRowError["reason"] {
  return reason;
}

export async function backfillLowestPricesRows(
  rows: readonly IdentityInputRow[],
  options: BackfillOptions,
): Promise<BackfillStats> {
  const store = options.store;
  const skipExisting = options.skipExisting ?? true;

  const stats: BackfillStats = {
    totalRows: rows.length,
    mapped: 0,
    skipped: 0,
    existingSkipped: 0,
    skipReasons: {},
    duplicateExternalKeys: 0,
    uniqueProducts: 0,
    byProvider: {},
  };

  const seenExternal = new Set<string>();
  const batch: CreateIdentityRecord[] = [];
  const writtenProducts = new Set<string>();

  for (const row of rows) {
    const provider = row.provider?.trim();
    if (provider) {
      const p = (stats.byProvider[provider] ??= { rows: 0, mapped: 0 });
      p.rows += 1;
    }

    const result = bootstrapIdentityFromRow(row);
    if ("error" in result) {
      stats.skipped += 1;
      stats.skipReasons[reasonKey(result.error.reason)] =
        (stats.skipReasons[reasonKey(result.error.reason)] ?? 0) + 1;
      continue;
    }

    const identity = result.identity;
    const externalId = row.product_id.trim();
    const extKey = `${provider ?? ""}\u0000${externalId}`;

    if (seenExternal.has(extKey)) {
      stats.duplicateExternalKeys += 1;
      continue;
    }
    seenExternal.add(extKey);

    if (skipExisting) {
      const existing = await store.getByExternalId("lowest_prices_today", provider!, externalId);
      if (existing) {
        stats.existingSkipped += 1;
        continue;
      }
    }

    batch.push({
      source: "lowest_prices_today",
      providerId: provider!,
      externalId,
      storeName: row.store_name?.trim() || undefined,
      countryCode: row.country_code?.trim() || undefined,
      currency: row.currency?.trim() || undefined,
      canonicalProductId: identity.canonicalProductId,
      canonicalOfferId: identity.canonicalOfferId,
      confidence: identity.confidence,
      identifiers: [],
      titleKey: identity.titleKey,
      title: row.product_name?.trim(),
    });

    stats.mapped += 1;
    writtenProducts.add(identity.canonicalProductId);
    if (provider) stats.byProvider[provider].mapped += 1;
  }

  if (batch.length > 0) {
    await store.writeMany(batch);
  }

  stats.uniqueProducts = writtenProducts.size;
  return stats;
}