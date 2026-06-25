import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ImportEventLevel, ImportEventLog } from "@/lib/integrations/ebay/types";
import { EBAY_PROVIDER_ID } from "@/lib/integrations/ebay/config";

export async function logEbayImportEvent(input: {
  jobType: string;
  level?: ImportEventLevel;
  message: string;
  metadata?: Record<string, unknown>;
  syncRunId?: string | null;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("import_event_logs").insert({
    provider: EBAY_PROVIDER_ID,
    job_type: input.jobType,
    level: input.level ?? "info",
    message: input.message,
    metadata: input.metadata ?? {},
    sync_run_id: input.syncRunId ?? null,
  });
}

export async function getEbayImportEventLogs(options?: {
  limit?: number;
}): Promise<ImportEventLog[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("import_event_logs")
    .select("*")
    .eq("provider", EBAY_PROVIDER_ID)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50);

  return ((data ?? []) as {
    id: string;
    provider: string;
    job_type: string;
    level: ImportEventLevel;
    message: string;
    metadata: Record<string, unknown>;
    sync_run_id: string | null;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    provider: row.provider,
    jobType: row.job_type,
    level: row.level,
    message: row.message,
    metadata: row.metadata ?? {},
    syncRunId: row.sync_run_id,
    createdAt: row.created_at,
  }));
}

export async function getEbaySyncSummary(limit = 10) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { runs: [], logs: [] };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("integration_type", "ebay")
    .eq("is_active", true)
    .maybeSingle();

  const storeId = (store as { id: string } | null)?.id;
  if (!storeId) return { runs: [], logs: await getEbayImportEventLogs({ limit }) };

  const { data: runs } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(limit);

  const logs = await getEbayImportEventLogs({ limit });

  return { runs: runs ?? [], logs };
}
