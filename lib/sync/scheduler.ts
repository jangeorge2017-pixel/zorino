import type { StoreRow } from "@/lib/database/types";
import { SYNC_DEFAULT_INTERVAL_MINUTES } from "@/lib/sync/config";
import { runSyncJob } from "@/lib/sync/engine";
import { getConnectorForIntegration } from "@/lib/sync/connectors";
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

const SYNC_FAILURE_BACKOFF_THRESHOLD = Number(
  process.env.SYNC_FAILURE_BACKOFF_THRESHOLD ?? 1,
);
const SYNC_FAILURE_BACKOFF_BASE_MINUTES = Number(
  process.env.SYNC_FAILURE_BACKOFF_MINUTES ?? 180,
);
const SYNC_FAILURE_BACKOFF_MAX_MINUTES = 24 * 60;

/**
 * Pure consecutive-failure streak computation.
 *
 * `rows` MUST be ordered most-recent-first. For each store, count the run of
 * consecutive `failed` runs from the top until the first non-failed run closes
 * the streak. A store absent from the result has no known failures.
 */
export function computeFailureStreaks(
  rows: readonly { store_id: string | null; status: string }[],
): Map<string, number> {
  const streaks = new Map<string, number>();
  const closed = new Set<string>();
  for (const row of rows) {
    if (!row.store_id || closed.has(row.store_id)) continue;
    if (row.status === "failed") {
      streaks.set(row.store_id, (streaks.get(row.store_id) ?? 0) + 1);
    } else {
      closed.add(row.store_id);
    }
  }
  return streaks;
}

/** Most-recent consecutive failed run streak per store (from sync_runs). */
export async function getRecentFailureStreaks(
  lookback = 200,
): Promise<Map<string, number>> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("store_id, status")
    .not("store_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(lookback);
  if (error || !data) return new Map();
  return computeFailureStreaks(
    data as { store_id: string | null; status: string }[],
  );
}

export interface RunDueSyncJobsOutcome {
  results: SyncRunResult[];
  /** Due jobs not attempted because the deadline was reached. */
  deferred: number;
  /** Stale 'running' rows swept to 'failed' by the watchdog. */
  sweptStaleRuns: number;
  /** Jobs capped mid-run because they exceeded their time slice. */
  timedOut?: number;
  /** Due jobs skipped because their provider connector is not configured. */
  skipped?: number;
  /** Due jobs deferred with an extended backoff after consecutive failures. */
  backedOff?: number;
}

/** Run due sync jobs (oldest-due first) within an optional deadline. */
export async function runDueSyncJobs(
  options?: RunDueSyncJobsOptions,
): Promise<RunDueSyncJobsOutcome> {
  const sweptStaleRuns = await failStaleRunningRuns();
  const jobs = await getDueSyncJobs();
  const failureStreaks = await getRecentFailureStreaks();
  const results: SyncRunResult[] = [];
  const supabase = createSupabaseServiceClient();
  const deadlineAt = options?.deadlineAt;

  // Failure-aware ordering: a provider whose most recent runs failed (e.g. an
  // API key revoked or a permanently disabled account) must NOT keep winning
  // the oldest-due race and burning the shared budget every invocation. Order
  // healthy jobs first, and defer chronic failures with an extended backoff so
  // the working providers (AliExpress/eBay/Amazon) get the full window.
  const isBackedOff = (job: DueSyncJob) =>
    (failureStreaks.get(job.storeId) ?? 0) >= SYNC_FAILURE_BACKOFF_THRESHOLD;
  const orderedJobs = [
    ...jobs.filter((job) => !isBackedOff(job)),
    ...jobs.filter((job) => isBackedOff(job)),
  ];

  // A single job must never consume the whole remaining window: a "full"
  // import can legitimately run for many minutes, which is exactly how the
  // original cron wedge happened. Cap each job and let the watchdog sweep
  // any sync_runs row left 'running' by a capped job.
  const SYNC_MIN_JOB_ROOM_MS = 8_000;
  const SYNC_JOB_HARD_CAP_MS = 20_000;

  let attempted = 0;
  let deferred = 0;
  let timedOut = 0;
  let skipped = 0;
  let backedOff = 0;

  const advanceNextRun = async (job: DueSyncJob, overrideMinutes?: number) => {
    if (!supabase || !job.id) return;
    const intervalMs =
      (overrideMinutes ?? job.intervalMinutes ?? SYNC_DEFAULT_INTERVAL_MINUTES) * 60_000;
    const nextRun = new Date(Date.now() + intervalMs).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("sync_jobs")
      .update({ last_run_at: new Date().toISOString(), next_run_at: nextRun })
      .eq("id", job.id);
  };

  for (let jobIndex = 0; jobIndex < orderedJobs.length; jobIndex++) {
    const job = orderedJobs[jobIndex];
    // Chronic failures are deferred with an exponential cooldown BEFORE any
    // work is attempted, so a dead provider cannot consume the window.
    if (isBackedOff(job)) {
      const streak = failureStreaks.get(job.storeId) ?? SYNC_FAILURE_BACKOFF_THRESHOLD;
      const cooldownMinutes = Math.min(
        SYNC_FAILURE_BACKOFF_MAX_MINUTES,
        SYNC_FAILURE_BACKOFF_BASE_MINUTES *
          2 ** Math.max(0, streak - SYNC_FAILURE_BACKOFF_THRESHOLD),
      );
      backedOff++;
      console.warn(
        `[sync-scheduler] backing off job ${job.storeSlug}/${job.jobType} for ${Math.round(
          cooldownMinutes,
        )}m after ${streak} consecutive failed run(s)`,
      );
      await advanceNextRun(job, cooldownMinutes);
      continue;
    }

    // Skip providers that are not configured instead of attempting them and
    // failing. Unconfigured connectors (e.g. Amazon/CJdropshipping "placeholder"
    // rows in sync_jobs) throw "Connector not configured", which wastes the cron
    // budget and starves the real providers (eBay/AliExpress) whose successful
    // ingestion is what builds cross-provider Compare Prices data. Matching the
    // existing gate in triggerPhase1Imports keeps the scheduler consistent.
    const connector = getConnectorForIntegration(job.integrationType);
    try {
      if (!connector.isConfigured()) {
        skipped++;
        console.warn(
          `[sync-scheduler] skipping job ${job.storeSlug}/${job.jobType}: connector "${job.integrationType}" not configured`,
        );
        await advanceNextRun(job);
        continue;
      }
    } catch {
      skipped++;
      await advanceNextRun(job);
      continue;
    }

    const roomLeft =
      deadlineAt !== undefined ? deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
    if (roomLeft < SYNC_MIN_JOB_ROOM_MS) {
      deferred = orderedJobs.length - jobIndex;
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

    await advanceNextRun(job);
  }

  return { results, deferred, sweptStaleRuns, timedOut, skipped, backedOff };
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
