/**
 * Execution-time budget for cron invocations.
 *
 * The budget was originally pinned to 50s to stay under Vercel's 60s Hobby
 * serverless cap: the bundled cron had declared maxDuration=300 and ran
 * unbounded work, so the platform killed the function mid-run every day and
 * everything after the first slow step silently never executed. Every cron step
 * checks the budget before starting and skips (with an explicit
 * `reason: "budget-exhausted"` marker in the response and heartbeat) instead of
 * overrunning.
 *
 * Background sync now runs on Render, where a web service HTTP response can
 * take up to 100 minutes with no serverless execution block. The total budget
 * is therefore environment driven:
 *
 *   CRON_BUDGET_MS                total wall-clock budget (default 30 min)
 *   CRON_MIN_STEP_BUDGET_MS       min remaining before starting another step
 *
 * Per-step caps read their own optional env override via `stepBudgetMs()`
 * (e.g. CRON_SYNC_STEP_BUDGET_MS, CRON_ALIEXPRESS_STEP_BUDGET_MS). Keep the
 * total budget under Render's 100-minute HTTP response ceiling.
 */

/** Read a positive millisecond value from the environment, else the fallback. */
function envMs(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** Total wall-clock budget for a cron invocation. Override with CRON_BUDGET_MS. */
export const CRON_BUDGET_MS = envMs("CRON_BUDGET_MS", 1_800_000);

/** Minimum remaining time required before starting another guarded step. */
export const MIN_STEP_BUDGET_MS = envMs("CRON_MIN_STEP_BUDGET_MS", 12_000);

/**
 * Per-step wall-clock cap, env-overridable. On Render raise these (or the shared
 * CRON_BUDGET_MS) so long provider/feed parses can use the full window instead
 * of the historical 60s-serverless values.
 */
export function stepBudgetMs(envKey: string, fallbackMs: number): number {
  return envMs(envKey, fallbackMs);
}

export interface CronBudget {
  /** Absolute epoch-ms deadline for this invocation. */
  readonly deadlineAt: number;
  readonly totalMs: number;
  remainingMs(): number;
  outOfTime(): boolean;
  /** True when at least `ms` milliseconds remain before the deadline. */
  hasRoomFor(ms: number): boolean;
}

export function createCronBudget(totalMs: number = CRON_BUDGET_MS): CronBudget {
  const startedAt = Date.now();
  return {
    deadlineAt: startedAt + totalMs,
    totalMs,
    remainingMs() {
      return this.deadlineAt - Date.now();
    },
    outOfTime() {
      return Date.now() >= this.deadlineAt;
    },
    hasRoomFor(ms: number) {
      return this.remainingMs() >= ms;
    },
  };
}

export type BudgetCappedResult<T> = { value?: T; timedOut: boolean };

/**
 * Run a task under a hard wall-clock cap derived from the shared budget.
 *
 * Steps that internally loop over provider APIs (scheduled sync jobs, phase-1
 * imports, aggregate refreshes) do not accept deadlines themselves — without
 * this cap a single slow step could hold the invocation open until the budget
 * runs out. A timed-out task may keep running until the process is replaced;
 * idempotent upserts plus the sync_runs watchdog make that safe to abandon
 * mid-flight.
 */
export async function withBudgetCap<T>(
  budget: CronBudget,
  maxMs: number,
  label: string,
  task: Promise<T>,
): Promise<BudgetCappedResult<T>> {
  const capMs = Math.min(maxMs, Math.max(2_000, budget.remainingMs() - 2_000));
  let timedOut = false;
  const value = await Promise.race([
    task,
    new Promise<undefined>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        console.warn(`[cron-budget] "${label}" exceeded ${Math.round(capMs / 1000)}s — capping`);
        resolve(undefined);
      }, capMs),
    ),
  ]);
  return timedOut ? { timedOut } : { value, timedOut };
}
