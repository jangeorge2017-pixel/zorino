import { runSyncJob } from "@/lib/sync/engine";
import { isAliExpressConfigured } from "@/lib/integrations/aliexpress";
import type { AliExpressSyncJobKind } from "@/lib/integrations/aliexpress/types";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { logImportEvent } from "@/services/aliexpress/monitoring";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";

type AliExpressStore = {
  id: string;
  slug: string;
};

async function getAliExpressStore(): Promise<AliExpressStore | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("integration_type", "aliexpress")
    .eq("is_active", true)
    .maybeSingle();

  return data as AliExpressStore | null;
}

function mapJobKind(kind: AliExpressSyncJobKind): SyncJobType {
  if (kind === "stock") return "prices";
  return kind;
}

export async function runAliExpressSync(
  kind: AliExpressSyncJobKind
): Promise<{ ok: boolean; result?: SyncRunResult; error?: string }> {
  await loadAliExpressCredentials();

  if (!isAliExpressConfigured()) {
    const message = "AliExpress credentials not configured. Add API keys in Marketplace Settings.";
    await logImportEvent({ jobType: kind, level: "warn", message });
    return { ok: false, error: message };
  }

  const store = await getAliExpressStore();
  if (!store) {
    const message = "AliExpress store record not found.";
    await logImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }

  await logImportEvent({
    jobType: kind,
    level: "info",
    message: `Starting AliExpress ${kind} sync`,
    metadata: { storeId: store.id },
  });

  try {
    const result = await runSyncJob({
      storeId: store.id,
      storeSlug: store.slug,
      integrationType: "aliexpress",
      countryCode: "US",
      currency: "USD",
      jobType: mapJobKind(kind),
    });

    await logImportEvent({
      jobType: kind,
      level: result.status === "failed" ? "error" : "info",
      message:
        result.status === "failed"
          ? result.errorMessage ?? "AliExpress sync failed"
          : `AliExpress ${kind} sync completed`,
      metadata: {
        itemsFetched: result.itemsFetched,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsFailed: result.itemsFailed,
      },
    });

    return { ok: result.status !== "failed", result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AliExpress sync failed";
    await logImportEvent({ jobType: kind, level: "error", message });
    return { ok: false, error: message };
  }
}

export async function runAliExpressScheduledSync(): Promise<{
  skipped: boolean;
  results: SyncRunResult[];
  error?: string;
}> {
  await loadAliExpressCredentials();

  if (!isAliExpressConfigured()) {
    await logImportEvent({
      jobType: "scheduled",
      level: "info",
      message: "AliExpress scheduled sync skipped — credentials not configured",
    });
    return { skipped: true, results: [] };
  }

  const kinds: AliExpressSyncJobKind[] = ["products", "prices", "stock", "images"];
  const results: SyncRunResult[] = [];

  for (const kind of kinds) {
    const { ok, result, error } = await runAliExpressSync(kind);
    if (result) results.push(result);
    if (!ok && error) {
      return { skipped: false, results, error };
    }
  }

  return { skipped: false, results };
}
