import { runSyncJob } from "@/lib/sync/engine";
import { isEbayConfigured } from "@/lib/integrations/ebay";
import type { EbaySyncJobKind } from "@/lib/integrations/ebay/types";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logEbayImportEvent } from "@/services/ebay/monitoring";
import { loadEbayCredentials } from "@/services/ebay/credentials";

type EbayStore = {
  id: string;
  slug: string;
};

async function getEbayStore(): Promise<EbayStore | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("integration_type", "ebay")
    .eq("is_active", true)
    .maybeSingle();

  return data as EbayStore | null;
}

function mapJobKind(kind: EbaySyncJobKind): SyncJobType {
  if (kind === "stock") return "prices";
  return kind;
}

export async function runEbaySync(
  kind: EbaySyncJobKind
): Promise<{ ok: boolean; result?: SyncRunResult; error?: string }> {
  await loadEbayCredentials();

  if (!isEbayConfigured()) {
    const message = "eBay credentials not configured. Add API keys in Marketplace Settings.";
    await logEbayImportEvent({ jobType: kind, level: "warn", message });
    return { ok: false, error: message };
  }

  const store = await getEbayStore();
  if (!store) {
    const message = "eBay store record not found.";
    await logEbayImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }

  await logEbayImportEvent({
    jobType: kind,
    level: "info",
    message: `Starting eBay ${kind} sync`,
    metadata: { storeId: store.id },
  });

  try {
    const result = await runSyncJob({
      storeId: store.id,
      storeSlug: store.slug,
      integrationType: "ebay",
      countryCode: "US",
      currency: "USD",
      jobType: mapJobKind(kind),
    });

    await logEbayImportEvent({
      jobType: kind,
      level: result.status === "failed" ? "error" : "info",
      message:
        result.status === "failed"
          ? result.errorMessage ?? "eBay sync failed"
          : `eBay ${kind} sync completed`,
      metadata: {
        itemsFetched: result.itemsFetched,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsFailed: result.itemsFailed,
      },
    });

    return { ok: result.status !== "failed", result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "eBay sync failed";
    await logEbayImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }
}

/**
 * Strict wall-clock deadline for the scheduled eBay sweep. eBay's Browse API
 * can stall; 8s keeps a single stalled request from eating the shared 60s cron
 * window. Any kinds not reached before the deadline are deferred (reported in
 * `deferred`) and picked up by the next run instead of being killed mid-kind.
 */
export const EBAY_SCHEDULED_DEADLINE_MS = 8_000;

export async function runEbayScheduledSync(options?: {
  deadlineMs?: number;
}): Promise<{
  skipped: boolean;
  results: SyncRunResult[];
  error?: string;
  done: boolean;
  deferred: EbaySyncJobKind[];
}> {
  await loadEbayCredentials();

  if (!isEbayConfigured()) {
    await logEbayImportEvent({
      jobType: "scheduled",
      level: "info",
      message: "eBay scheduled sync skipped — credentials not configured",
    });
    return { skipped: true, results: [], done: true, deferred: [] };
  }

  const requested = Number(options?.deadlineMs);
  const deadlineMs =
    Number.isFinite(requested) && requested > 0 ? requested : EBAY_SCHEDULED_DEADLINE_MS;
  const deadlineAt = Date.now() + deadlineMs;

  const kinds: EbaySyncJobKind[] = ["products", "prices", "stock", "images"];
  const results: SyncRunResult[] = [];

  for (let index = 0; index < kinds.length; index++) {
    const kind = kinds[index];
    if (Date.now() >= deadlineAt) {
      return { skipped: false, results, done: false, deferred: kinds.slice(index) };
    }

    const { ok, result, error } = await runEbaySync(kind);
    if (result) results.push(result);
    if (!ok && error) {
      return {
        skipped: false,
        results,
        error,
        done: false,
        deferred: kinds.slice(index + 1),
      };
    }
  }

  return { skipped: false, results, done: true, deferred: [] };
}
