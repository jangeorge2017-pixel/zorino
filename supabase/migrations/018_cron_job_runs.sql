-- Migration 018: Cron execution heartbeats
--
-- Problem (production audit, Aug 2026):
--   Bundled cron /api/cron/refresh was silently dying mid-run (serverless
--   timeout while running unbounded provider sync jobs). Nothing recorded
--   whether a cron invocation started, finished, or how far it got — the only
--   traces were stale sync_jobs.next_run_at columns and orphaned
--   sync_runs rows stuck in 'running' since July.
--
-- Fix: durable, publicly-readable execution evidence. Each cron invocation
-- inserts a row on entry and updates it on exit (status/duration/details).
-- Writes happen exclusively via the service role (RLS denies anon/authed
-- writes); reads are public for transparency.

CREATE TABLE IF NOT EXISTS cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_started
  ON cron_job_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_open
  ON cron_job_runs (job_path, started_at DESC) WHERE status = 'running';

ALTER TABLE cron_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cron_job_runs" ON cron_job_runs;
CREATE POLICY "Public read cron_job_runs"
  ON cron_job_runs FOR SELECT USING (TRUE);
