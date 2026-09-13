/**
 * Persisted provider health — Phase 2.
 *
 * Durable, per-provider health checkpoints (migration 024). This is the
 * storage plane for the "health/observability" air in the re-architecture: it
 * closes the "no persisted per-provider health table" gap from the freeze doc.
 *
 * ADDITIVE and UNWIRED: nothing in the runtime imports this yet. ARCH_CANONICAL
 * is off, so `createHealthCheckpointStore()` returns a Noop store — writing a
 * checkpoint is a safe no-op until a later phase flips the flag and wires the
 * recorder. The Supabase implementation never throws and degrades to no-op
 * without service-role credentials.
 *
 * A checkpoint is a compact per-run row (not per-product): status, counts,
 * latency, error, and per-gate validation-rejection counters.
 */

import { isCanonicalEnabled } from "@/lib/canonical/feature";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database/types";

export type ProviderHealthStatus = "ok" | "degraded" | "error";

export interface ProviderHealthCheckpoint {
  id?: string;
  providerId: string;
  status: ProviderHealthStatus;
  /** Where the run came from: "search" | "homepage" | "sync" | "canonical". */
  source: string;
  /** Acquisition strategy label (e.g. "aliexpress-dpapi", "admitad-feed"). */
  strategy?: string;
  acquiredCount: number;
  acceptedCount: number;
  rejectedCount: number;
  productCount: number;
  durationMs?: number;
  errorCode?: string;
  errorDetail?: string;
  /** Per-gate validation-rejection counters. */
  validationRejections: Record<string, number>;
  collectedAt: string;
}

/** Storage contract for health checkpoints. */
export interface HealthCheckpointStore {
  /** Persist one checkpoint. Resolves true when actually written. */
  write(checkpoint: ProviderHealthCheckpoint): Promise<boolean>;
  /** Persist a batch. Resolves the number of checkpoints actually written. */
  writeMany(checkpoints: ProviderHealthCheckpoint[]): Promise<number>;
}

/** Default store: discards silently. Safe when the flag is off. */
export class NoopHealthCheckpointStore implements HealthCheckpointStore {
  async write(_checkpoint: ProviderHealthCheckpoint): Promise<boolean> {
    void _checkpoint;
    return false;
  }
  async writeMany(_checkpoints: ProviderHealthCheckpoint[]): Promise<number> {
    void _checkpoints;
    return 0;
  }
}

/** In-memory store — used by tests and local diagnostics. */
export class InMemoryHealthCheckpointStore implements HealthCheckpointStore {
  private readonly checkpoints: ProviderHealthCheckpoint[] = [];

  async write(checkpoint: ProviderHealthCheckpoint): Promise<boolean> {
    this.checkpoints.push({ ...checkpoint });
    return true;
  }

  async writeMany(checkpoints: ProviderHealthCheckpoint[]): Promise<number> {
    for (const cp of checkpoints) this.checkpoints.push({ ...cp });
    return checkpoints.length;
  }

  /** Snapshot of every checkpoint written so far (tests/diagnostics). */
  all(): ProviderHealthCheckpoint[] {
    return [...this.checkpoints];
  }

  latest(): ProviderHealthCheckpoint | null {
    return this.checkpoints.at(-1) ?? null;
  }
}

/** Supabase-backed store (migration 024). Never throws; no-op without creds. */
export class SupabaseHealthCheckpointStore implements HealthCheckpointStore {
  async write(checkpoint: ProviderHealthCheckpoint): Promise<boolean> {
    return (await this.writeMany([checkpoint])) === 1;
  }

  async writeMany(checkpoints: ProviderHealthCheckpoint[]): Promise<number> {
    if (checkpoints.length === 0) return 0;
    const client = createSupabaseServiceClient();
    if (!client) return 0;

    const rows = checkpoints.map((cp) => ({
      provider_id: cp.providerId,
      status: cp.status,
      source: cp.source,
      strategy: cp.strategy ?? null,
      acquired_count: cp.acquiredCount,
      accepted_count: cp.acceptedCount,
      rejected_count: cp.rejectedCount,
      product_count: cp.productCount,
      duration_ms: cp.durationMs ?? null,
      error_code: cp.errorCode ?? null,
      error_detail: cp.errorDetail ?? null,
      validation_rejections: cp.validationRejections,
      collected_at: cp.collectedAt,
    }));

    // Migration 024 table; a structural cast keeps the insert type-safe
    // without coupling to the supabase-js generic table lookup.
    const db = client as unknown as {
      from: (table: string) => {
        insert: (values: unknown[]) => Promise<{ error: unknown }>;
      };
    };
    const { error } = await db.from("provider_health_checkpoints").insert(rows);
    if (error) return 0;
    return rows.length;
  }
}

let cachedStore: HealthCheckpointStore | null = null;

/**
 * Create (and memoize) the health checkpoint store.
 * Off by default → Noop; on → Supabase-backed (degrading to no-op cleanly).
 */
export function createHealthCheckpointStore(): HealthCheckpointStore {
  if (cachedStore) return cachedStore;
  cachedStore = isCanonicalEnabled()
    ? new SupabaseHealthCheckpointStore()
    : new NoopHealthCheckpointStore();
  return cachedStore;
}

/** Test helper: force a specific store (no-op/supabase/in-memory). */
export function setHealthCheckpointStoreForTests(
  store: HealthCheckpointStore | null,
): void {
  cachedStore = store;
}

/** Test helper: reset the cached store. */
export function resetHealthCheckpointStoreForTests(): void {
  cachedStore = null;
}

export type ProviderHealthCheckpointRow =
  Database["public"]["Tables"]["provider_health_checkpoints"]["Row"];