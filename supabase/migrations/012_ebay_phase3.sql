-- Phase 3: eBay affiliate integration

UPDATE import_providers
SET
  description = 'eBay Browse API with Partner Network affiliate context (Phase 3)',
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{phase}',
    '"live"'::jsonb
  )
WHERE id = 'ebay';

COMMENT ON TABLE import_event_logs IS 'Per-event import/sync logs for marketplace integrations (AliExpress, eBay, etc.)';
