-- Phase 1: remove placeholder/seed products from live catalog

UPDATE products
SET is_active = FALSE
WHERE slug IN ('iphone-15-pro-max', 'macbook-air-m3', 'playstation-5', 'nike-air-jordan-1')
   OR (sync_status = 'idle' AND last_synced_at IS NULL AND image_url LIKE '/products/%');

UPDATE deals
SET is_active = FALSE
WHERE product_id IN (SELECT id FROM products WHERE is_active = FALSE);

-- Ensure Phase 1 price sync jobs run hourly
UPDATE sync_jobs
SET interval_minutes = 60, is_enabled = TRUE
WHERE job_type = 'prices'
  AND store_id IN (
    SELECT id FROM stores WHERE integration_type IN ('aliexpress', 'ebay', 'cjdropshipping')
  );

-- Default import keywords for Phase 1 providers
UPDATE sync_jobs
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
  'keywords', CASE stores.integration_type
    WHEN 'aliexpress' THEN '["wireless earbuds","smart watch","phone case","bluetooth speaker"]'::jsonb
    WHEN 'ebay' THEN '["iphone","macbook","playstation","nike shoes"]'::jsonb
    WHEN 'cjdropshipping' THEN '["phone accessories","home decor","pet supplies"]'::jsonb
    ELSE COALESCE(config->'keywords', '["electronics"]'::jsonb)
  END,
  'maxPages', 2,
  'pageSize', 20
)
FROM stores
WHERE sync_jobs.store_id = stores.id
  AND sync_jobs.job_type = 'full'
  AND stores.integration_type IN ('aliexpress', 'ebay', 'cjdropshipping')
  AND (config->'keywords') IS NULL;
