import { runDueSyncJobs, getDueSyncJobs } from "@/lib/sync/scheduler";
import { runSyncJob } from "@/lib/sync/engine";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import type { ServiceResult } from "@/lib/types/entities";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function executeScheduledSync(): Promise<ServiceResult<SyncRunResult[]>> {
  try {
    const results = await runDueSyncJobs();
    return { data: results, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : "Sync scheduler failed",
    };
  }
}

export async function getPendingJobs() {
  const jobs = await getDueSyncJobs();
  return { data: jobs, error: null };
}

export async function triggerStoreSync(input: {
  storeId: string;
  storeSlug: string;
  integrationType: string;
  countryCode?: string;
  currency?: string;
  jobType?: SyncJobType;
}): Promise<ServiceResult<SyncRunResult>> {
  try {
    const result = await runSyncJob({
      storeId: input.storeId,
      storeSlug: input.storeSlug,
      integrationType: input.integrationType as never,
      countryCode: input.countryCode ?? "US",
      currency: input.currency ?? "USD",
      jobType: input.jobType ?? "full",
    });
    return { data: result, error: null };
  } catch (err) {
    return {
      data: {
        jobType: input.jobType ?? "full",
        status: "failed",
        itemsFetched: 0,
        itemsCreated: 0,
        itemsUpdated: 0,
        itemsFailed: 0,
        errorMessage: err instanceof Error ? err.message : "Sync failed",
      },
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
}

export async function triggerProviderSync(input: {
  storeId: string;
  storeSlug: string;
  integrationType: string;
  countryCode?: string;
  currency?: string;
  jobType?: SyncJobType;
}): Promise<ServiceResult<SyncRunResult>> {
  return triggerStoreSync(input);
}

export async function getImportProviders() {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("import_providers")
    .select("*")
    .eq("is_enabled", true)
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function getRecentSyncRuns(limit = 20) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return { data: [], error: "Supabase not configured" };
  }

  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}
