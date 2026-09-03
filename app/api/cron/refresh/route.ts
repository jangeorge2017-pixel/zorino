import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { executeScheduledSync } from "@/services/sync";
import { executeTrendingRefresh, isTrendingRefreshDue } from "@/services/trending";
import {
  executeLowestPriceRefresh,
} from "@/services/lowest-prices";
import { triggerPhase1Imports } from "@/services/sync";
import { runAliExpressScheduledSync } from "@/services/aliexpress";
import { runAmazonScheduledSync } from "@/services/amazon/scheduler";
import { runEbayScheduledSync } from "@/services/ebay";
import { refreshUniversalCatalogAggregates } from "@/services/marketplace-engine";
import { runNotificationAlerts } from "@/services/notifications/alerts";
import { invalidateLowestPricesFromRoute, invalidateTrendingFromRoute } from "@/lib/revalidate";
import {
  createCronBudget,
  withBudgetCap,
  CRON_BUDGET_MS,
  MIN_STEP_BUDGET_MS,
} from "@/lib/cron/budget";
import { finishCronRun, startCronRun } from "@/lib/cron/heartbeat";

/**
 * Bundled maintenance cron — keeps Vercel Hobby plan within the 2-cron limit.
 *
 * Reliability contract (F1 remediation):
 *  - maxDuration is 60 (Hobby serverless cap). The previous maxDuration=300
 *    exceeded the cap and the platform killed the function mid-run daily,
 *    which is why nothing after the first slow step executed for weeks.
 *  - Every step runs inside a wall-clock budget (CRON_BUDGET_MS) and is
 *    skipped with an explicit `reason: "budget-exhausted"` marker instead of
 *    overrunning.
 *  - Light maintenance runs first; the historically wedging provider sync
 *    loop runs LAST, deadline-bounded, with stale 'running' rows swept to
 *    'failed' by a watchdog before it starts.
 *  - Admitad ingestion (the intended core ingestion job) always gets a real
 *    deadline derived from the remaining budget.
 *  - The whole invocation is wrapped in a durable cron_job_runs heartbeat so
 *    production executions are verifiable (see supabase/migrations/018).
 */
export const maxDuration = 60;

// Right-sized for the 60s window. Each feed takes ~10-15s at this bound.
// Raise ADMITAD_MAX_FEEDS / ADMITAD_MAX_PRODUCTS_PER_FEED env vars when the
// deployment plan allows longer execution windows.
const ADMITAD_CRON_MAX_FEEDS = Number(process.env.ADMITAD_MAX_FEEDS ?? 3);
const ADMITAD_CRON_MAX_PRODUCTS_PER_FEED = Number(
  process.env.ADMITAD_MAX_PRODUCTS_PER_FEED ?? 300,
);
const ADMITAD_CRON_DEADLINE_CAP_MS = 45_000;

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "true" || request.headers.get("x-vercel-cron") === "1";
  const hourUtc = new Date().getUTCHours();
  const results: Record<string, unknown> = {};

  const budget = createCronBudget();
  const heartbeat = await startCronRun("/api/cron/refresh");
  let thrown: unknown = null;

  try {
    // ── 1. Trending rankings (fast, due-gated) ────────────────────────────
    if (force || (await isTrendingRefreshDue())) {
      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.trending = { skipped: true, reason: "budget-exhausted" };
      } else {
        try {
          const trending = await executeTrendingRefresh();
          results.trending = trending.error
            ? { error: trending.error }
            : { itemsRanked: trending.ranked ?? 0 };
          if (!trending.error) invalidateTrendingFromRoute();
        } catch (err) {
          results.trending = {
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    } else {
      results.trending = { skipped: true };
    }

    // ── 2. Lowest-prices cache refresh (due-gated internally) ─────────────
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.lowestPrices = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const lowest = await executeLowestPriceRefresh({
          force,
          triggeredBy: "cron",
        });
        results.lowestPrices =
          "error" in lowest && lowest.error
            ? { error: lowest.error }
            : { skipped: lowest.skipped, itemsComputed: lowest.itemsComputed };
        if (!lowest.skipped && !("error" in lowest && lowest.error)) {
          invalidateLowestPricesFromRoute();
        }
      } catch (err) {
        results.lowestPrices = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // ── 3. Admitad multi-merchant ingestion (core ingestion job) ──────────
    // Bounded by its own internal per-feed deadlines AND the shared budget so
    // it can never wedge the invocation.
    if (!budget.hasRoomFor(10_000)) {
      results.admitadIngestion = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const deadlineMs = Math.max(
          10_000,
          Math.min(budget.remainingMs() - 5_000, ADMITAD_CRON_DEADLINE_CAP_MS),
        );
        const { runAdmitadIngestion } = await import("@/lib/integrations/admitad");
        const admitad = await runAdmitadIngestion({
          maxFeeds: ADMITAD_CRON_MAX_FEEDS,
          maxProductsPerFeed: ADMITAD_CRON_MAX_PRODUCTS_PER_FEED,
          deadlineMs,
        });
        results.admitadIngestion = {
          authenticated: admitad.authenticated,
          websitesFound: admitad.websitesFound,
          programsDiscovered: admitad.programsDiscovered,
          feedsWithProducts: admitad.feedsWithProducts,
          totalProducts: admitad.totalProducts,
          productsSaved: admitad.productsSaved,
          errors: admitad.errors.slice(0, 10),
          deadlineMs,
        };
      } catch (err) {
        results.admitadIngestion = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // ── 4. Admitad image backfill (core canonical-DB fix) ──────────────────
    // The persisted catalog rows written before the image-parser fix carry an
    // empty image_url for most real merchants. Re-read the real merchant feeds
    // (fixed parser) and patch those rows with their genuine images so the
    // canonical DB — not just the live feed — shows every real merchant.
    if (!budget.hasRoomFor(10_000)) {
      results.admitadImageBackfill = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const deadlineMs = Math.max(
          10_000,
          Math.min(budget.remainingMs() - 5_000, 40_000),
        );
        const { backfillAdmitadImages } = await import(
          "@/services/admitad-image-backfill"
        );
        const backfill = await backfillAdmitadImages({
          maxFeeds: 20,
          maxProductsPerFeed: 800,
          timeoutPerFeedMs: 12_000,
          deadlineMs,
        });
        results.admitadImageBackfill = {
          feedsChecked: backfill.feedsChecked,
          offersWithImage: backfill.offersWithImage,
          rowsScanned: backfill.rowsScanned,
          rowsPatched: backfill.rowsPatched,
          errors: backfill.errors.slice(0, 10),
          deadlineMs,
        };
      } catch (err) {
        results.admitadImageBackfill = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // ── 5. Heavy provider schedulers / imports / aggregates ───────────────
    // Each guarded individually: one slow provider must not starve the rest.
    // These schedulers loop provider APIs internally without deadline support,
    // so each also runs under a hard wall-clock cap (withBudgetCap) — without
    // it the AliExpress scheduler alone overran the 60s serverless limit.
    if (force || hourUtc % 6 === 0) {
      const budgetSkipped = () => ({ skipped: true, reason: "budget-exhausted" });
      const capped = <T>(
        key: string,
        maxMs: number,
        task: Promise<T>,
      ): Promise<{ value?: T; timedOut: boolean }> =>
        withBudgetCap(budget, maxMs, key, task);

      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.aliexpress = budgetSkipped();
      } else {
        try {
          const { value: aliexpress, timedOut } = await capped(
            "aliexpress-scheduled-sync",
            20_000,
            runAliExpressScheduledSync(),
          );
          results.aliexpress = timedOut
            ? { timedOut: true }
            : aliexpress!.skipped
              ? { skipped: true }
              : { jobsRun: aliexpress!.results.length, results: aliexpress!.results, error: aliexpress!.error };
        } catch (err) {
          results.aliexpress = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.ebay = budgetSkipped();
      } else {
        try {
          const { value: ebay, timedOut } = await capped(
            "ebay-scheduled-sync",
            20_000,
            runEbayScheduledSync(),
          );
          results.ebay = timedOut
            ? { timedOut: true }
            : ebay!.skipped
              ? { skipped: true }
              : { jobsRun: ebay!.results.length, results: ebay!.results, error: ebay!.error };
        } catch (err) {
          results.ebay = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.amazon = budgetSkipped();
      } else {
        try {
          const { value: amazon, timedOut } = await capped(
            "amazon-scheduled-sync",
            20_000,
            runAmazonScheduledSync(),
          );
          results.amazon = timedOut
            ? { timedOut: true }
            : amazon!.skipped
              ? { skipped: true }
              : { jobsRun: amazon!.results.length, results: amazon!.results, error: amazon!.error };
        } catch (err) {
          results.amazon = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.importPhase1 = budgetSkipped();
      } else {
        try {
          const { value: imported, timedOut } = await capped(
            "phase1-imports",
            25_000,
            triggerPhase1Imports(),
          );
          results.importPhase1 = timedOut
            ? { timedOut: true }
            : imported!.error
              ? { error: imported!.error, results: imported!.data }
              : { providersRun: imported!.data.length, results: imported!.data };
        } catch (err) {
          results.importPhase1 = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.universalCatalog = budgetSkipped();
      } else {
        try {
          const { value: catalog, timedOut } = await capped(
            "universal-catalog",
            15_000,
            refreshUniversalCatalogAggregates({ limit: 500 }),
          );
          results.universalCatalog = timedOut
            ? { timedOut: true }
            : catalog!.error
              ? { error: catalog!.error }
              : { refreshed: catalog!.refreshed };
        } catch (err) {
          results.universalCatalog = { error: err instanceof Error ? err.message : String(err) };
        }
      }
    } else {
      results.aliexpress = { skipped: true };
      results.ebay = { skipped: true };
      results.amazon = { skipped: true };
      results.importPhase1 = { skipped: true };
      results.universalCatalog = { skipped: true };
    }

    // ── 6. Due store-sync jobs LAST, deadline-bounded ─────────────────────
    // This was the historical wedge: unbounded sequential provider imports
    // ran FIRST and got the function killed before anything else could run.
    // The watchdog inside also sweeps runs orphaned by earlier kills.
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      results.sync = { skipped: true, reason: "budget-exhausted" };
    } else {
      try {
        const sync = await executeScheduledSync({ deadlineAt: budget.deadlineAt });
        results.sync = sync.error
          ? { error: sync.error, results: sync.data }
          : {
              jobsRun: sync.data.length,
              deferred: sync.deferred ?? 0,
              sweptStaleRuns: sync.sweptStaleRuns ?? 0,
              timedOut: sync.timedOut ?? 0,
              skipped: sync.skipped ?? 0,
              results: sync.data,
            };
      } catch (err) {
        results.sync = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // ── 7. Notification alerts ─────────────────────────────────────────────
    if (force || hourUtc === 8) {
      if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
        results.notifications = { skipped: true, reason: "budget-exhausted" };
      } else {
        try {
          const { value: alerts, timedOut } = await withBudgetCap(
            budget,
            20_000,
            "notification-alerts",
            runNotificationAlerts(),
          );
          if (timedOut) {
            results.notifications = { timedOut: true };
          } else {
            results.notifications = alerts;
          }
        } catch (err) {
          results.notifications = {
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }
    } else {
      results.notifications = { skipped: true };
    }
  } catch (err) {
    thrown = err;
  }

  const durationMs = Date.now() - heartbeat.startedAt;
  const status = thrown ? "failed" : "succeeded";
  await finishCronRun(heartbeat, status, {
    scheduled: request.headers.get("x-vercel-cron") === "1",
    hourUtc,
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
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
