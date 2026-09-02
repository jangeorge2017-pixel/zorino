/**
 * In-memory provider runtime health registry.
 *
 * Every search / homepage fan-out through the search engine records each
 * connector's outcome here. A provider is considered "live" only after it has
 * actually returned real products and has not been in a fatal-error state
 * recently. This is the runtime (per-process) half of provider activation;
 * durable DB evidence lives in `lib/integration/provider-evidence.ts`.
 */

import type { ProductionProviderId } from "@/lib/integration/constants";

type ProviderHealth = {
  /** Last time the provider ran (search fan-out). */
  lastRunAt: number;
  /** Last run returned at least one product. */
  lastOk: boolean;
  /** Consecutive fatal-error runs (current streak). */
  consecutiveFailures: number;
  /** Total successful (products>0) runs observed. */
  successRuns: number;
};

const HEALTH_TTL_MS = 30 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;

const registry = new Map<ProductionProviderId, ProviderHealth>();

/** Record a connector run outcome. `productCount` = real products returned. */
export function recordProviderRun(
  providerId: string,
  productCount: number,
): void {
  const id = providerId as ProductionProviderId;
  const existing = registry.get(id);
  const now = Date.now();

  const ok = Number.isFinite(productCount) && productCount > 0;
  const successRuns = (existing?.successRuns ?? 0) + (ok ? 1 : 0);
  const consecutiveFailures = ok ? 0 : (existing?.consecutiveFailures ?? 0) + 1;

  registry.set(id, {
    lastRunAt: now,
    lastOk: ok,
    consecutiveFailures,
    successRuns,
  });
}

/** Whether the provider is currently trusted live based on runtime health. */
export function isProviderLive(providerId: string): boolean {
  const id = providerId as ProductionProviderId;
  const health = registry.get(id);
  if (!health) return false;
  if (Date.now() - health.lastRunAt > HEALTH_TTL_MS) return false;
  if (health.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return false;
  return health.lastOk && health.successRuns >= 1;
}

/** Snapshot of provider ids that passed (or failed) runtime health. */
export function getProviderHealthSnapshot(): Record<string, boolean> {
  const snapshot: Record<string, boolean> = {};
  for (const [id] of registry) {
    snapshot[id] = isProviderLive(id);
  }
  return snapshot;
}

/** Only for tests. */
export function resetProviderHealthForTests(): void {
  registry.clear();
}