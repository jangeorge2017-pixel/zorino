import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeScheduledSync, triggerPhase1Imports } from "@/services/sync";
import { runAliExpressScheduledSync } from "@/services/aliexpress";
import { runAmazonScheduledSync } from "@/services/amazon/scheduler";
import { runEbayScheduledSync } from "@/services/ebay";
import { refreshUniversalCatalogAggregates } from "@/services/marketplace-engine";
import { createCronBudget, CRON_BUDGET_MS, MIN_STEP_BUDGET_MS } from "@/lib/cron/budget";
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
      const sync = await executeScheduledSync({ deadlineAt: budget.deadlineAt });
      results.sync = sync.error
        ? { error: sync.error, results: sync.data }
        : {
            jobsRun: sync.data.length,
            deferred: sync.deferred ?? 0,
            sweptStaleRuns: sync.sweptStaleRuns ?? 0,
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
        const aliexpress = await runAliExpressScheduledSync();
        results.aliexpress = aliexpress.skipped
          ? { skipped: true }
          : { jobsRun: aliexpress.results.length, results: aliexpress.results, error: aliexpress.error };
      } catch (err) {
        results.aliexpress = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.ebay = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const ebay = await runEbayScheduledSync();
        results.ebay = ebay.skipped
          ? { skipped: true }
          : { jobsRun: ebay.results.length, results: ebay.results, error: ebay.error };
      } catch (err) {
        results.ebay = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.amazon = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const amazon = await runAmazonScheduledSync();
        results.amazon = amazon.skipped
          ? { skipped: true }
          : { jobsRun: amazon.results.length, results: amazon.results, error: amazon.error };
      } catch (err) {
        results.amazon = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── 3. Phase-1 provider imports (guarded) ─────────────────────────────
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.importPhase1 = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const imported = await triggerPhase1Imports();
        results.importPhase1 = imported.error
          ? { error: imported.error, results: imported.data }
          : { providersRun: imported.data.length, results: imported.data };
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
