import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Durable cron execution heartbeats (cron_job_runs table, migration 018).
 *
 * Each cron invocation records a `running` row on entry and finalizes it with
 * status/duration/details on exit — including on failure paths. This is the
 * verifiable production evidence that a cron run actually executed.
 *
 * Heartbeat failures NEVER break the cron itself: before migration 018 is
 * applied (or if Supabase is unavailable) writes degrade to console warnings.
 */

export type CronRunStatus = "succeeded" | "failed";

export interface CronRunHandle {
  id: string | null;
  jobPath: string;
  startedAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: unknown): any {
  return client;
}

export async function startCronRun(jobPath: string): Promise<CronRunHandle> {
  const handle: CronRunHandle = { id: null, jobPath, startedAt: Date.now() };
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return handle;
    const { data, error } = await db(supabase)
      .from("cron_job_runs")
      .insert({ job_path: jobPath, status: "running" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    handle.id = (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn(
      "[cron-heartbeat] could not record cron start:",
      err instanceof Error ? err.message : err,
    );
  }
  return handle;
}

export async function finishCronRun(
  handle: CronRunHandle,
  status: CronRunStatus,
  details?: Record<string, unknown>,
): Promise<void> {
  if (!handle.id) return;
  try {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return;
    const { error } = await db(supabase)
      .from("cron_job_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - handle.startedAt,
        details: details ?? null,
      })
      .eq("id", handle.id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn(
      "[cron-heartbeat] could not record cron finish:",
      err instanceof Error ? err.message : err,
    );
  }
}
