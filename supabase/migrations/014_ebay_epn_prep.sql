-- eBay Partner Network (EPN) preparation — metadata only, no runtime activation

UPDATE import_providers
SET
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{epn_status}',
      '"pending"'::jsonb
    ),
    '{epn_docs}',
    '"https://partnernetwork.ebay.com/"'::jsonb
  ),
  description = 'eBay Browse API + EPN affiliate (prepared, awaiting credentials)'
WHERE id = 'ebay';

UPDATE affiliate_settings
SET
  config = jsonb_set(
    jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{epn_status}',
      '"pending"'::jsonb
    ),
    '{custom_param}',
    '"customid"'::jsonb
  ),
  updated_at = NOW()
WHERE marketplace = 'ebay';

COMMENT ON COLUMN affiliate_settings.config IS 'Marketplace affiliate params; ebay.config.epn_status=pending until EPN go-live';
