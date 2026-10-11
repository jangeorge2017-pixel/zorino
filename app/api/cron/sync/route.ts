import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeScheduledSync } from "@/services/sync";
import { createCronBudget, CRON_BUDGET_MS } from "@/lib/cron/budget";
import { runProviderStepsParallel } from "@/lib/cron/provider-steps";
import { finishCronRun, startCronRun } from "@/lib/cron/heartbeat";

/**
 * Dedicated heavy-sync cron window (second Vercel Hobby cron slot).
 *
 * Provider import jobs (AliExpress/eBay/Amazon/CJ full + price imports) were
 * the historical wedge inside /api/cron/refresh: they ran first, exceeded the
 * serverless execution cap, and got the whole invocation killed — so nothing
 * ever completed. They now get their own invocation with:
 *  - a watchdog that sweeps runs orphaned by previous kills,
 *  - a wall-clock budget with per-step guards (skip-with-reason, never overrun),
 *  - deadline-bounded due-job processing (oldest-due first, rest deferred),
 *  - a durable cron_job_runs heartbeat for verifiability.
 */
export const maxDuration = 60;

// The sync_jobs step runs capped multi-minute import jobs. Without a bound it
// eats the whole 60s window (two 20s-capped jobs already starved every other
// step in live runs). Cap its deadline so the dedicated provider schedulers
// and phase-1 imports below always get a share of the budget.
const SYNC_STEP_BUDGET_MS = 20_000;

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "true" || request.headers.get("x-vercel-cron") === "1";

  const budget = createCronBudget();
  const heartbeat = await startCronRun("/api/cron/sync");
  const results: Record<string, unknown> = {};
  let thrown: unknown = null;

  try {
    // ── 1. Due store-sync jobs, deadline-bounded ──────────────────────────
    try {
      const sync = await executeScheduledSync({
        deadlineAt: Math.min(budget.deadlineAt, Date.now() + SYNC_STEP_BUDGET_MS),
      });
      results.sync = sync.error
        ? { error: sync.error, results: sync.data }
        : {
            jobsRun: sync.data.length,
            deferred: sync.deferred ?? 0,
            backedOff: sync.backedOff ?? 0,
            sweptStaleRuns: sync.sweptStaleRuns ?? 0,
            timedOut: sync.timedOut ?? 0,
            results: sync.data,
          };
    } catch (err) {
      results.sync = { error: err instanceof Error ? err.message : String(err) };
    }

    // ── 2. Heavy provider steps — run CONCURRENTLY ────────────────────────
    // AliExpress / eBay / Amazon / phase-1 imports / catalog aggregates each
    // run under their own budget guard + wall-clock cap via the shared runner.
    // Sequential execution let the first slow provider starve the rest; fanning
    // them out means a stalled provider (notably eBay, now strictly bounded)
    // can never block the others within the 60s serverless window.
    Object.assign(results, await runProviderStepsParallel(budget));
  } catch (err) {
    thrown = err;
  }

  const durationMs = Date.now() - heartbeat.startedAt;
  const status = thrown ? "failed" : "succeeded";
  await finishCronRun(heartbeat, status, {
    scheduled: request.headers.get("x-vercel-cron") === "1",
    force,
    budgetMs: CRON_BUDGET_MS,
    budgetRemainingMs: budget.remainingMs(),
    durationMs,
    error: thrown instanceof Error ? thrown.message : undefined,
    results,
  });

  if (thrown) {
    return NextResponse.json(
      {
        success: false,
        error: thrown instanceof Error ? thrown.message : String(thrown),
        cronRunId: heartbeat.id,
        results,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    cronRunId: heartbeat.id,
    durationMs,
    budgetRemainingMs: budget.remainingMs(),
    force,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
