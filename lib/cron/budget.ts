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
