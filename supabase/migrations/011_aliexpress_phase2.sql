-- Phase 2: AliExpress affiliate import monitoring

CREATE TABLE IF NOT EXISTS import_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'aliexpress',
  job_type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_event_logs_provider
  ON import_event_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_event_logs_level
  ON import_event_logs(level, created_at DESC);

ALTER TABLE import_event_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role import_event_logs" ON import_event_logs;
CREATE POLICY "Service role import_event_logs" ON import_event_logs
  FOR ALL USING (auth.role() = 'service_role');

UPDATE import_providers
SET
  description = 'AliExpress Open Platform affiliate API (Phase 2)',
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{phase}',
    '"live"'::jsonb
  )
WHERE id = 'aliexpress';

COMMENT ON TABLE import_event_logs IS 'Per-event import/sync logs for marketplace integrations';
