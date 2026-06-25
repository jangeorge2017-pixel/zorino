import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ImportEventLevel, ImportEventLog } from "@/lib/integrations/aliexpress/types";
import { ALIEXPRESS_PROVIDER_ID } from "@/lib/integrations/aliexpress/config";

export async function logImportEvent(input: {
  provider?: string;
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
    provider: input.provider ?? ALIEXPRESS_PROVIDER_ID,
    job_type: input.jobType,
    level: input.level ?? "info",
    message: input.message,
    metadata: input.metadata ?? {},
    sync_run_id: input.syncRunId ?? null,
  });
}

export async function getImportEventLogs(options?: {
  provider?: string;
  limit?: number;
}): Promise<ImportEventLog[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("import_event_logs")
    .select("*")
    .eq("provider", options?.provider ?? ALIEXPRESS_PROVIDER_ID)
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

export async function getAliExpressSyncSummary(limit = 10) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { runs: [], logs: [] };

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("integration_type", "aliexpress")
    .eq("is_active", true)
    .maybeSingle();

  const storeId = (store as { id: string } | null)?.id;
  if (!storeId) return { runs: [], logs: await getImportEventLogs({ limit }) };

  const { data: runs } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(limit);

  const logs = await getImportEventLogs({ limit });

  return { runs: runs ?? [], logs };
}
