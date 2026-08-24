/**
 * Execution-time budget for cron invocations.
 *
 * Vercel Hobby caps serverless functions at 60s. The bundled cron previously
 * declared maxDuration=300 and ran unbounded work, so the platform killed the
 * function mid-run every day — everything after the first slow step silently
 * never executed. Every cron step now checks the budget before starting and
 * skips (with an explicit `reason: "budget-exhausted"` marker in the response
 * and heartbeat) instead of overrunning.
 */

/** Total wall-clock budget for a cron invocation. Leaves headroom under 60s. */
export const CRON_BUDGET_MS = 50_000;

/** Minimum remaining time required before starting another guarded step. */
export const MIN_STEP_BUDGET_MS = 12_000;

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
 * this cap a single slow step overruns the serverless execution limit and the
 * platform kills the whole invocation (the original cron wedge). A timed-out
 * task may keep running until the sandbox freezes; idempotent upserts plus the
 * sync_runs watchdog make that safe to abandon mid-flight.
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
