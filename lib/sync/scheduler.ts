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
  jobConfig?: Record<string, unknown> | null;
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
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    // Oldest-due first: deterministic fairness so one provider's backlog
    // cannot permanently starve the others across invocations.
    .order("next_run_at", { ascending: true, nullsFirst: true });

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
        jobConfig: row.config,
      };
    });
}

/**
 * Watchdog: mark runs stuck in 'running' as failed.
 *
 * A previous cron invocation can be killed by the platform mid-job (serverless
 * timeout), leaving sync_runs rows in 'running' forever and hiding the wedge.
 * Runs older than `staleMinutes` are unfinishable — their invocation is gone.
 */
export async function failStaleRunningRuns(staleMinutes = 15): Promise<number> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return 0;

  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sync_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: `watchdog: run exceeded ${staleMinutes}m — invoking function died before completion`,
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    console.warn("[sync-watchdog] could not sweep stale runs:", error.message);
    return 0;
  }
  const swept = data?.length ?? 0;
  if (swept > 0) {
    console.log(`[sync-watchdog] marked ${swept} stale running run(s) as failed`);
  }
  return swept;
}

export interface RunDueSyncJobsOptions {
  /**
   * Absolute epoch-ms deadline. When reached, remaining due jobs are skipped
   * (deferred to the next invocation) instead of overrun — the previous
   * unbounded loop got the whole cron killed by the platform, which is why
   * nothing after the first slow job ran for weeks.
   */
  deadlineAt?: number;
}

export interface RunDueSyncJobsOutcome {
  results: SyncRunResult[];
  /** Due jobs not attempted because the deadline was reached. */
  deferred: number;
  /** Stale 'running' rows swept to 'failed' by the watchdog. */
  sweptStaleRuns: number;
  /** Jobs capped mid-run because they exceeded their time slice. */
  timedOut?: number;
}

/** Run due sync jobs (oldest-due first) within an optional deadline. */
export async function runDueSyncJobs(
  options?: RunDueSyncJobsOptions,
): Promise<RunDueSyncJobsOutcome> {
  const sweptStaleRuns = await failStaleRunningRuns();
  const jobs = await getDueSyncJobs();
  const results: SyncRunResult[] = [];
  const supabase = createSupabaseServiceClient();
  const deadlineAt = options?.deadlineAt;

  // A single job must never consume the whole remaining window: a "full"
  // import can legitimately run for many minutes, which is exactly how the
  // original cron wedge happened. Cap each job and let the watchdog sweep
  // any sync_runs row left 'running' by a capped job.
  const SYNC_MIN_JOB_ROOM_MS = 8_000;
  const SYNC_JOB_HARD_CAP_MS = 20_000;

  let attempted = 0;
  let deferred = 0;
  let timedOut = 0;

  for (const job of jobs) {
    const roomLeft =
      deadlineAt !== undefined ? deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
    if (roomLeft < SYNC_MIN_JOB_ROOM_MS) {
      deferred = jobs.length - attempted;
      if (deferred > 0) {
        console.warn(
          `[sync-scheduler] deadline reached — deferring ${deferred} due job(s) to next invocation`,
        );
      }
      break;
    }

    const jobTimeoutMs = Math.min(SYNC_JOB_HARD_CAP_MS, Math.max(3_000, roomLeft - 2_000));
    let timedOutJob = false;
    const result = await Promise.race([
      runSyncJob({
        storeId: job.storeId,
        storeSlug: job.storeSlug,
        integrationType: job.integrationType,
        countryCode: job.countryCode,
        currency: job.currency,
        jobType: job.jobType,
        syncJobId: job.id,
        jobConfig: job.jobConfig,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => {
          timedOutJob = true;
          resolve(null);
        }, jobTimeoutMs),
      ),
    ]);
    if (timedOutJob) {
      timedOut++;
      console.warn(
        `[sync-scheduler] job ${job.storeSlug}/${job.jobType} exceeded ${Math.round(
          jobTimeoutMs / 1000,
        )}s — capping; run row will be swept by watchdog`,
      );
    } else if (result) {
      results.push(result);
    }
    attempted++;

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

  return { results, deferred, sweptStaleRuns, timedOut };
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
