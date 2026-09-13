-- Migration 024: Persisted per-provider health checkpoints
--
-- Problem (architecture freeze §10): provider runtime health is kept only
-- in an in-memory registry (lib/integration/provider-health.ts, 30 min TTL).
-- There is NO durable per-provider health history, no validation-rejection
-- counters, and no error telemetry — nothing to audit or alert on after the
-- process dies.
--
-- Fix: a durable, publicly-readable per-provider health checkpoint table.
-- Each canonical acquisition run writes a compact checkpoint (status, counts,
-- latency, error code, per-gate validation-rejection counters). Writes happen
-- exclusively via the service role (RLS denies anon/authed writes, matching
-- cron_job_runs); reads are public for transparency.
--
-- ADDITIVE: no row is written by the runtime today (ARCH_CANONICAL=off and no
-- caller wired). Applied to production only when Phase 2 is explicitly applied.

CREATE TABLE IF NOT EXISTS provider_health_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ok', 'degraded', 'error')),
  source TEXT NOT NULL DEFAULT 'canonical',
  strategy TEXT,
  acquired_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_code TEXT,
  error_detail TEXT,
  validation_rejections JSONB NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider_collected
  ON provider_health_checkpoints (provider_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_health_collected
  ON provider_health_checkpoints (collected_at DESC);

ALTER TABLE provider_health_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read provider_health_checkpoints"
  ON provider_health_checkpoints;
CREATE POLICY "Public read provider_health_checkpoints"
  ON provider_health_checkpoints FOR SELECT USING (TRUE);