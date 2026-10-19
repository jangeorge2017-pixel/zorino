import {
  withBudgetCap,
  stepBudgetMs,
  MIN_STEP_BUDGET_MS,
  type CronBudget,
} from "@/lib/cron/budget";
import { ALIEXPRESS_CALL_TIMEOUT_MS } from "@/lib/integrations/aliexpress/client";
import { runAliExpressScheduledSync } from "@/services/aliexpress";
import { runAmazonScheduledSync } from "@/services/amazon/scheduler";
import { EBAY_SCHEDULED_DEADLINE_MS, runEbayScheduledSync } from "@/services/ebay";
import { refreshUniversalCatalogAggregates } from "@/services/marketplace-engine";
import { triggerPhase1Imports } from "@/services/sync";
import { runNoonIngestion } from "@/lib/integrations/noon";
import { runJumiaIngestion } from "@/lib/integrations/jumia";
import { runArabClicksIngestion } from "@/lib/integration/arabclicks";

export const PROVIDER_STEP_KEYS = [
  "aliexpress",
  "ebay",
  "amazon",
  "importPhase1",
  "universalCatalog",
  "noon",
  "jumia",
  "arabclicks",
] as const;

export type ProviderStepKey = (typeof PROVIDER_STEP_KEYS)[number];

export type ProviderStepResult = Record<string, unknown>;

export type ProviderStepResults = Record<ProviderStepKey, ProviderStepResult>;

/**
 * Hard wall-clock cap for the eBay step. eBay's Browse API can stall for tens
 * of seconds; `EBAY_SCHEDULED_DEADLINE_MS` (8s) bounds the scheduler's own loop
 * and this cap (deadline + 4s) lets that bounded value return instead of being
 * discarded by the race. eBay also has full/price sync coverage via the legacy
 * sync_jobs, so a short cap here never loses ingestion coverage.
 */
export const EBAY_STEP_CAP_MS = EBAY_SCHEDULED_DEADLINE_MS + 4_000;

// Per-step wall-clock caps. Defaults preserve the historical 60s-serverless
// values; on Render set the CRON_*_STEP_BUDGET_MS env vars (see render.yaml) so
// long provider/feed parses can use the full invocation window.
const ALIEXPRESS_STEP_BUDGET_MS = stepBudgetMs("CRON_ALIEXPRESS_STEP_BUDGET_MS", 20_000);
const AMAZON_STEP_BUDGET_MS = stepBudgetMs("CRON_AMAZON_STEP_BUDGET_MS", 25_000);
const PHASE1_STEP_BUDGET_MS = stepBudgetMs("CRON_PHASE1_STEP_BUDGET_MS", 25_000);
const CATALOG_STEP_BUDGET_MS = stepBudgetMs("CRON_CATALOG_STEP_BUDGET_MS", 15_000);
const NOON_STEP_BUDGET_MS = stepBudgetMs("CRON_NOON_STEP_BUDGET_MS", 20_000);
const JUMIA_STEP_BUDGET_MS = stepBudgetMs("CRON_JUMIA_STEP_BUDGET_MS", 20_000);
const ARABCLICKS_STEP_BUDGET_MS = stepBudgetMs("CRON_ARABCLICKS_STEP_BUDGET_MS", 20_000);

/** Scheduler deadline for a step, leaving headroom before its hard cap. */
function stepDeadlineMs(capMs: number): number {
  return Math.max(5_000, capMs - 5_000);
}

/**
 * Run every heavy provider step CONCURRENTLY under the shared cron budget.
 *
 * Previously these ran sequentially, so the first slow provider (e.g. eBay
 * burning its full cap) starved every later provider within the 60s serverless
 * window — amazon/phase1/catalog reported `budget-exhausted`. Fanning them out
 * with `Promise.all` means one slow provider can no longer block the others;
 * each step is still individually guarded (skip-with-reason when out of budget)
 * and individually capped so no single step can overrun the invocation.
 *
 * Each task catches its own errors and returns a JSON-serializable record, so
 * one provider failing never rejects the batch or suppresses the rest.
 */
export async function runProviderStepsParallel(budget: CronBudget): Promise<ProviderStepResults> {
  const aliExpress = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(ALIEXPRESS_CALL_TIMEOUT_MS + 8_000)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    // Resumable micro-batch sweep. One chunk is one bounded API call
    // (ALIEXPRESS_CALL_TIMEOUT_MS); derive the deadline to leave room for a
    // final chunk plus headroom so the scheduler always finishes and persists
    // its cursor before the hard cap — never capped mid-kind.
    const deadlineMs = Math.max(
      6_000,
      Math.min(budget.remainingMs() - (ALIEXPRESS_CALL_TIMEOUT_MS + 6_000), ALIEXPRESS_STEP_BUDGET_MS),
    );
    const budgetBeforeMs = budget.remainingMs();
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        deadlineMs + ALIEXPRESS_CALL_TIMEOUT_MS + 4_000,
        "aliexpress-scheduled-sync",
        runAliExpressScheduledSync({ deadlineMs }),
      );
      if (timedOut) return { timedOut: true, budgetBeforeMs, deadlineMs };
      if (value?.skipped) return { skipped: true };
      return {
        jobsRun: value?.results.length ?? 0,
        results: value?.results ?? [],
        error: value?.error,
        done: value?.done,
        resumedKind: value?.resumedKind,
        budgetBeforeMs,
        deadlineMs,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const ebay = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        EBAY_STEP_CAP_MS,
        "ebay-scheduled-sync",
        runEbayScheduledSync({ deadlineMs: EBAY_SCHEDULED_DEADLINE_MS }),
      );
      if (timedOut) return { timedOut: true, deadlineMs: EBAY_SCHEDULED_DEADLINE_MS };
      if (value?.skipped) return { skipped: true };
      return {
        jobsRun: value?.results.length ?? 0,
        results: value?.results ?? [],
        error: value?.error,
        done: value?.done,
        deferred: value?.deferred,
        deadlineMs: EBAY_SCHEDULED_DEADLINE_MS,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const amazon = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        AMAZON_STEP_BUDGET_MS,
        "amazon-scheduled-sync",
        runAmazonScheduledSync(),
      );
      if (timedOut) return { timedOut: true };
      if (value?.skipped) return { skipped: true };
      return {
        jobsRun: value?.results.length ?? 0,
        results: value?.results ?? [],
        error: value?.error,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const importPhase1 = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        PHASE1_STEP_BUDGET_MS,
        "phase1-imports",
        triggerPhase1Imports(),
      );
      if (timedOut) return { timedOut: true };
      if (value?.error) return { error: value.error, results: value.data };
      return { providersRun: value?.data.length ?? 0, results: value?.data ?? [] };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const universalCatalog = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        CATALOG_STEP_BUDGET_MS,
        "universal-catalog",
        refreshUniversalCatalogAggregates({ limit: 500 }),
      );
      if (timedOut) return { timedOut: true };
      return value?.error ? { error: value.error } : { refreshed: value?.refreshed };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  // Noon / Jumia: credential-gated ingestion runners. When unconfigured (or
  // configured without a real API endpoint) they return immediately with an
  // explicit skip reason and never touch the network — so wiring them here is
  // free until a real Noon/Jumia API contract lands, at which point products
  // flow into products/prices/lowest_prices_today with no further changes.
  const noon = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        NOON_STEP_BUDGET_MS,
        "noon-ingestion",
        runNoonIngestion({ maxProducts: 200, deadlineMs: stepDeadlineMs(NOON_STEP_BUDGET_MS) }),
      );
      if (timedOut) return { timedOut: true };
      return {
        skipped: value?.skipped,
        reason: value?.reason,
        configured: value?.configured,
        endpointConfigured: value?.endpointConfigured,
        totalProducts: value?.totalProducts,
        productsSaved: value?.productsSaved,
        errors: value?.errors?.slice(0, 5),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const jumia = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        JUMIA_STEP_BUDGET_MS,
        "jumia-ingestion",
        runJumiaIngestion({ maxProducts: 200, deadlineMs: stepDeadlineMs(JUMIA_STEP_BUDGET_MS) }),
      );
      if (timedOut) return { timedOut: true };
      return {
        skipped: value?.skipped,
        reason: value?.reason,
        configured: value?.configured,
        endpointConfigured: value?.endpointConfigured,
        totalProducts: value?.totalProducts,
        productsSaved: value?.productsSaved,
        errors: value?.errors?.slice(0, 5),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  // ArabClicks: network transport that routes Noon EG + Jumia EG offers into
  // the same catalog spine. Credential-gated AND endpoint-gated — until a real
  // ArabClicks feed endpoint is configured it returns an explicit skip reason
  // and never touches the network, so the pipeline stays unblocked.
  const arabclicks = (async (): Promise<ProviderStepResult> => {
    if (!budget.hasRoomFor(MIN_STEP_BUDGET_MS)) {
      return { skipped: true, reason: "budget-exhausted" };
    }
    try {
      const { value, timedOut } = await withBudgetCap(
        budget,
        ARABCLICKS_STEP_BUDGET_MS,
        "arabclicks-ingestion",
        runArabClicksIngestion({
          maxProductsPerTarget: 100,
          deadlineMs: stepDeadlineMs(ARABCLICKS_STEP_BUDGET_MS),
        }),
      );
      if (timedOut) return { timedOut: true };
      return {
        skipped: value?.skipped,
        reason: value?.reason,
        configured: value?.configured,
        endpointConfigured: value?.endpointConfigured,
        targetsRun: value?.targetsRun,
        totalProducts: value?.totalProducts,
        productsSaved: value?.productsSaved,
        byTarget: value?.byTarget,
        errors: value?.errors?.slice(0, 5),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

  const [
    aliexpressResult,
    ebayResult,
    amazonResult,
    importPhase1Result,
    universalCatalogResult,
    noonResult,
    jumiaResult,
    arabclicksResult,
  ] = await Promise.all([
    aliExpress,
    ebay,
    amazon,
    importPhase1,
    universalCatalog,
    noon,
    jumia,
    arabclicks,
  ]);

  return {
    aliexpress: aliexpressResult,
    ebay: ebayResult,
    amazon: amazonResult,
    importPhase1: importPhase1Result,
    universalCatalog: universalCatalogResult,
    noon: noonResult,
    jumia: jumiaResult,
    arabclicks: arabclicksResult,
  };
}
