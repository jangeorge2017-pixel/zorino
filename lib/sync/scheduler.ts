import type { StoreRow } from "@/lib/database/types";
import { SYNC_DEFAULT_INTERVAL_MINUTES } from "@/lib/sync/config";
import { runSyncJob } from "@/lib/sync/engine";
import type { SyncJobType, SyncRunResult } from "@/lib/sync/types";
import type { StoreIntegrationType } from "@/lib/types/entities";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type SyncJobWithStore = {
  id: string;
  job_type: string;
  country_code: string | null;
  currency: string | null;
  interval_minutes: number;
  config: Record<string, unknown> | null;
  stores: StoreRow | null;
};

export interface DueSyncJob {
  id: string;
  storeId: string;
  storeSlug: string;
  integrationType: StoreIntegrationType;
  jobType: SyncJobType;
  countryCode: string;
  currency: string;
  intervalMinutes: number;
  provider?: string;
}

/** Returns sync jobs that are due to run (next_run_at <= now or never run). */
export async function getDueSyncJobs(): Promise<DueSyncJob[]> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return getDefaultMockJobs();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, job_type, country_code, currency, interval_minutes, config, stores (id, slug, integration_type)")
    .eq("is_enabled", true)
    .or(`next_run_at.is.null,next_run_at.lte.${now}`);

  if (error || !data?.length) return getDefaultMockJobs();

  return ((data ?? []) as SyncJobWithStore[])
    .filter((row) => row.stores)
    .map((row) => {
      const store = row.stores!;
      return {
        id: row.id,
        storeId: store.id,
        storeSlug: store.slug,
        integrationType: store.integration_type as StoreIntegrationType,
        jobType: row.job_type as SyncJobType,
        countryCode: row.country_code ?? "US",
        currency: row.currency ?? "USD",
        intervalMinutes: row.interval_minutes ?? SYNC_DEFAULT_INTERVAL_MINUTES,
        provider:
          typeof row.config?.provider === "string"
            ? row.config.provider
            : store.integration_type,
      };
    });
}

/** Run all due sync jobs and reschedule them. */
export async function runDueSyncJobs(): Promise<SyncRunResult[]> {
  const jobs = await getDueSyncJobs();
  const results: SyncRunResult[] = [];
  const supabase = createSupabaseServiceClient();

  for (const job of jobs) {
    const result = await runSyncJob({
      storeId: job.storeId,
      storeSlug: job.storeSlug,
      integrationType: job.integrationType,
      countryCode: job.countryCode,
      currency: job.currency,
      jobType: job.jobType,
      syncJobId: job.id,
    });
    results.push(result);

    if (supabase && job.id) {
      const intervalMs = (job.intervalMinutes ?? SYNC_DEFAULT_INTERVAL_MINUTES) * 60_000;
      const nextRun = new Date(Date.now() + intervalMs).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("sync_jobs")
        .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun })
        .eq("id", job.id);
    }
  }

  return results;
}

/** Fallback jobs when Supabase is not configured — runs mock sync in dry-run. */
function getDefaultMockJobs(): DueSyncJob[] {
  return [
    {
      id: "mock-amazon",
      storeId: "mock",
      storeSlug: "amazon",
      integrationType: "amazon",
      jobType: "full",
      countryCode: "US",
      currency: "USD",
      intervalMinutes: SYNC_DEFAULT_INTERVAL_MINUTES,
      provider: "amazon",
    },
    {
      id: "mock-best-buy",
      storeId: "mock",
      storeSlug: "best-buy",
      integrationType: "partner",
      jobType: "full",
      countryCode: "US",
      currency: "USD",
      intervalMinutes: SYNC_DEFAULT_INTERVAL_MINUTES,
    },
  ];
}
