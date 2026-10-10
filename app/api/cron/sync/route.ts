import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeScheduledSync, triggerPhase1Imports } from "@/services/sync";
import { runAliExpressScheduledSync } from "@/services/aliexpress";
import { runAmazonScheduledSync } from "@/services/amazon/scheduler";
import { runEbayScheduledSync } from "@/services/ebay";
import { refreshUniversalCatalogAggregates } from "@/services/marketplace-engine";
import { createCronBudget, withBudgetCap, CRON_BUDGET_MS, MIN_STEP_BUDGET_MS } from "@/lib/cron/budget";
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

    // ── 2. Heavy provider schedulers (guarded) ────────────────────────────
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.aliexpress = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        // Resumable micro-batch sweep. Deadline is derived from the remaining
        // budget with headroom so the scheduler always finishes (and persists
        // its cursor) before the hard cap can fire — never caps mid-kind.
        const aliexpressDeadlineMs = Math.max(
          8_000,
          Math.min(budget.remainingMs() - 8_000, 20_000),
        );
        const { value: aliexpress, timedOut } = await withBudgetCap(
          budget,
          aliexpressDeadlineMs + 5_000,
          "aliexpress-scheduled-sync",
          runAliExpressScheduledSync({ deadlineMs: aliexpressDeadlineMs }),
        );
        results.aliexpress = timedOut
          ? { timedOut: true }
          : aliexpress?.skipped
            ? { skipped: true }
            : {
                jobsRun: aliexpress?.results.length ?? 0,
                results: aliexpress?.results ?? [],
                error: aliexpress?.error,
                done: aliexpress?.done,
                resumedKind: aliexpress?.resumedKind,
              };
      } catch (err) {
        results.aliexpress = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.ebay = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const { value: ebay, timedOut } = await withBudgetCap(
          budget,
          25_000,
          "ebay-scheduled-sync",
          runEbayScheduledSync(),
        );
        results.ebay = timedOut
          ? { timedOut: true }
          : ebay?.skipped
            ? { skipped: true }
            : { jobsRun: ebay?.results.length ?? 0, results: ebay?.results ?? [], error: ebay?.error };
      } catch (err) {
        results.ebay = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.amazon = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const { value: amazon, timedOut } = await withBudgetCap(
          budget,
          25_000,
          "amazon-scheduled-sync",
          runAmazonScheduledSync(),
        );
        results.amazon = timedOut
          ? { timedOut: true }
          : amazon?.skipped
            ? { skipped: true }
            : { jobsRun: amazon?.results.length ?? 0, results: amazon?.results ?? [], error: amazon?.error };
      } catch (err) {
        results.amazon = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── 3. Phase-1 provider imports (guarded) ─────────────────────────────
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.importPhase1 = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const { value: imported, timedOut } = await withBudgetCap(
          budget,
          25_000,
          "phase1-imports",
          triggerPhase1Imports(),
        );
        results.importPhase1 = timedOut
          ? { timedOut: true }
          : imported?.error
            ? { error: imported.error, results: imported.data }
            : { providersRun: imported?.data.length ?? 0, results: imported?.data ?? [] };
      } catch (err) {
        results.importPhase1 = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── 4. Universal catalog aggregates (guarded) ─────────────────────────
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.universalCatalog = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const catalog = await refreshUniversalCatalogAggregates({ limit: 500 });
        results.universalCatalog = catalog.error
          ? { error: catalog.error }
          : { refreshed: catalog.refreshed };
      } catch (err) {
        results.universalCatalog = { error: err instanceof Error ? err.message : String(err) };
      }
    }
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
