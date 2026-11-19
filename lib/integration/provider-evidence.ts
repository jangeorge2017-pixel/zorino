/**
 * Durable DB evidence of real provider product data.
 *
 * A provider is only ever reported active if real rows for it exist in the
 * database (or it has recent successful runtime health). Evidence is counted
 * from `lowest_prices_today` (provider-tagged catalog rows, written by the
 * catalog saver / GA ingestion) and, for non-Admitad providers, from
 * `external_products` as a fallback source.
 *
 * Evidence is cached for 10 minutes (product counts change only via imports).
 */

import { PRODUCTION_PROVIDER_IDS } from "@/lib/integration/constants";

const EVIDENCE_TTL_MS = 10 * 60 * 1000;

let evidenceCache: { at: number; counts: Record<string, number> } | null = null;

async function loadEvidenceCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const { createSupabaseAnonClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseAnonClient();
  if (!supabase) return counts;

  for (const providerId of PRODUCTION_PROVIDER_IDS) {
    let total = 0;

    const { count: lowestCount, error: lowestError } = await supabase
      .from("lowest_prices_today")
      .select("*", { count: "exact", head: true })
      .eq("provider", providerId)
      .limit(0);
    if (!lowestError && typeof lowestCount === "number") {
      total += lowestCount;
    }

    if (providerId !== "admitad") {
      const { count: externalCount, error: externalError } = await supabase
        .from("external_products")
        .select("*", { count: "exact", head: true })
        .eq("provider", providerId)
        .limit(0);
      if (!externalError && typeof externalCount === "number") {
        total += externalCount;
      }
    }

    counts[providerId] = total;
  }

  return counts;
}

/** Cached evidence counts per provider (keys = provider ids). */
export async function getProviderEvidenceCounts(): Promise<Record<string, number>> {
  if (evidenceCache && Date.now() - evidenceCache.at < EVIDENCE_TTL_MS) {
    return evidenceCache.counts;
  }
  const counts = await loadEvidenceCounts();
  evidenceCache = { at: Date.now(), counts };
  return counts;
}

/** True when the DB holds evidence of real product data for the provider. */
export async function hasProviderEvidence(providerId: string): Promise<boolean> {
  const counts = await getProviderEvidenceCounts();
  return (counts[providerId] ?? 0) > 0;
}

/**
 * True when the cached evidence snapshot is still within its 10-minute TTL.
 * Used to skip the redundant recompute in refreshProviderEvidence() when the
 * cached snapshot already answers for every provider.
 */
export function isProviderEvidenceFresh(): boolean {
  return evidenceCache !== null && Date.now() - evidenceCache.at < EVIDENCE_TTL_MS;
}

/** Only for tests. */
export function resetProviderEvidenceForTests(): void {
  evidenceCache = null;
}