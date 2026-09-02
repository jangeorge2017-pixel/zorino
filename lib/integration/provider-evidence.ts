/**
 * Durable DB evidence of real provider product data.
 *
 * A provider is only ever reported active if real rows for it exist in the
 * database (or it has recent successful runtime health). Mapping:
 *   - admitad        → `lowest_prices_today` rows (feed-cached, currently US/USD)
 *   - all others     → `external_products` rows keyed by `provider`
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

  const { count: admitadCount, error: admitadError } = await supabase
    .from("lowest_prices_today")
    .select("*", { count: "exact", head: true })
    .eq("provider", "admitad")
    .limit(0);
  if (!admitadError) counts.admitad = admitadCount ?? 0;

  for (const providerId of PRODUCTION_PROVIDER_IDS) {
    if (providerId === "admitad") continue;
    const { count, error } = await supabase
      .from("external_products")
      .select("*", { count: "exact", head: true })
      .eq("provider", providerId)
      .limit(0);
    if (!error) counts[providerId] = count ?? 0;
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

/** Only for tests. */
export function resetProviderEvidenceForTests(): void {
  evidenceCache = null;
}