-- Migration: 039_ensure_all_scraper_stores_sync_enabled
-- Guarantees every full-coverage scraper store is active and opted into sync.

INSERT INTO public.stores (
  slug,
  name,
  logo_url,
  logo_initial,
  website,
  integration_type,
  commission_rate,
  supported_regions,
  supported_currencies,
  is_active,
  sync_enabled,
  sync_interval_minutes
)
VALUES
  ('amazon', 'Amazon US', '/stores/amazon.png', 'AZ', 'https://www.amazon.com', 'amazon', 4.0, ARRAY['US'], ARRAY['USD'], TRUE, TRUE, 240),
  ('amazon-eg', 'Amazon Egypt', '/stores/amazon.png', 'AZ', 'https://www.amazon.eg', 'amazon', 4.0, ARRAY['EG'], ARRAY['EGP'], TRUE, TRUE, 240),
  ('noon', 'Noon Egypt', '/stores/noon.png', 'N', 'https://www.noon.com/egypt-en', 'noon', 5.0, ARRAY['EG'], ARRAY['EGP'], TRUE, TRUE, 240),
  ('jumia', 'Jumia Egypt', '/stores/jumia.png', 'J', 'https://www.jumia.com.eg', 'custom', 5.0, ARRAY['EG'], ARRAY['EGP'], TRUE, TRUE, 240),
  ('carrefour', 'Carrefour Egypt', '/stores/carrefour.png', 'C', 'https://www.carrefouregypt.com', 'custom', 4.0, ARRAY['EG'], ARRAY['EGP'], TRUE, TRUE, 240),
  ('btech', 'B-Tech', '/stores/btech.png', 'B', 'https://www.btech.com', 'custom', 4.0, ARRAY['EG'], ARRAY['EGP'], TRUE, TRUE, 240),
  ('temu', 'Temu', '/stores/temu.png', 'T', 'https://www.temu.com', 'temu', 7.0, ARRAY['US', 'EG'], ARRAY['USD', 'EGP'], TRUE, TRUE, 240),
  ('aliexpress', 'AliExpress', '/stores/aliexpress.png', 'AE', 'https://www.aliexpress.com', 'aliexpress', 6.0, ARRAY['US', 'EG'], ARRAY['USD', 'EGP'], TRUE, TRUE, 240),
  ('ebay', 'eBay', '/stores/ebay.png', 'E', 'https://www.ebay.com', 'ebay', 5.0, ARRAY['US', 'EG'], ARRAY['USD', 'EGP'], TRUE, TRUE, 240)
ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE,
  sync_enabled = TRUE,
  updated_at = now();
