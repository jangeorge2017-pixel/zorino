/**
 * Canonical run → persisted health checkpoint (Phase 2).
 *
 * Converts an AcquisitionRunResult into a compact provider-health checkpoint
 * and hands it to the persisted HealthCheckpointStore. This is the bridge
 * between the canonical pipeline (validation-rejection counters, acceptance
 * counts) and the durability plane.
 *
 * ADDITIVE / UNWIRED: nothing imported by the runtime. `writeCanonicalRun`
 * falls back to the Noop store while ARCH_CANONICAL is off.
 */

import type { AcquisitionRunResult } from "@/lib/canonical/acquisition";
import { createHealthCheckpointStore } from "@/lib/integration/provider-health-persisted";
import type { ProviderHealthCheckpoint } from "@/lib/integration/provider-health-persisted";

export interface CanonicalRunMeta {
  source: string;
  strategy?: string;
  durationMs?: number;
  errorDetail?: string;
}

/** Aggregate per-gate validation-rejection counters from a run's rejects. */
export function aggregateValidationRejections(
  result: AcquisitionRunResult,
): Record<string, number> {
  const counters: Record<string, number> = {};
  for (const rejected of result.rejected) {
    for (const code of rejected.rejectedCodes) {
      counters[code] = (counters[code] ?? 0) + 1;
    }
  }
  return counters;
}

/** Build a single checkpoint for one acquisition run. Never throws. */
export function checkpointFromRun(
  result: AcquisitionRunResult,
  meta: CanonicalRunMeta,
): ProviderHealthCheckpoint {
  const { counts } = result;
  const providerId =
    result.offers[0]?.providerId ??
    result.failures[0]?.providerId ??
    "unknown";
  const hasAccepted = counts.accepted > 0;
  const hasFailures = result.failures.length > 0;
  const validationRejections = aggregateValidationRejections(result);

  const status: ProviderHealthCheckpoint["status"] = !hasAccepted && hasFailures
    ? "error"
    : !hasAccepted
      ? "error"
      : counts.rejected > 0
        ? "degraded"
        : "ok";

  const firstRejection =
    result.rejected[0]?.rejectedCodes[0] ?? undefined;

  const errorCode = status === "error"
    ? (result.failures[0]?.code ?? firstRejection)
    : undefined;
  const errorDetail =
    meta.errorDetail ?? result.failures[0]?.error ?? undefined;

  return {
    providerId,
    status,
    source: meta.source,
    strategy: meta.strategy,
    acquiredCount: counts.acquired,
    acceptedCount: counts.accepted,
    rejectedCount: counts.rejected,
    productCount: counts.products,
    durationMs: meta.durationMs,
    errorCode,
    errorDetail,
    validationRejections,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Record an acquisition run into the persisted health store.
 * Returns true when a checkpoint was actually persisted (false = no-op,
 * e.g. flag off, or store unavailable).
 */
export async function writeCanonicalRun(
  result: AcquisitionRunResult,
  meta: CanonicalRunMeta,
): Promise<boolean> {
  const checkpoint = checkpointFromRun(result, meta);
  const store = createHealthCheckpointStore();
  return store.write(checkpoint);
}

/** Build a compact diagnostic line for a health checkpoint. */
export function summarizeCheckpoint(checkpoint: ProviderHealthCheckpoint): string {
  const rejections = Object.keys(checkpoint.validationRejections).join(",") || "none";
  return (
    `${checkpoint.providerId} → ${checkpoint.status} ` +
    `(acquired ${checkpoint.acquiredCount}, accepted ${checkpoint.acceptedCount}, ` +
    `rejected ${checkpoint.rejectedCount}, products ${checkpoint.productCount}); ` +
    `rejections: ${rejections}`
  );
}