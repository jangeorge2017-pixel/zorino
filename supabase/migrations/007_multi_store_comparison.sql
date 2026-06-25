-- Multi-store price comparison: Temu + multi-offer prices per product

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_integration_type_check;
ALTER TABLE stores ADD CONSTRAINT stores_integration_type_check
  CHECK (integration_type IN (
    'amazon', 'aliexpress', 'cjdropshipping', 'ebay', 'temu',
    'shopify', 'noon', 'walmart', 'custom', 'partner'
  ));

INSERT INTO stores (slug, name, logo_url, logo_initial, website, integration_type, supported_regions, supported_currencies, commission_rate)
VALUES
  ('temu', 'Temu', '/stores/temu.png', 'T', 'https://temu.com', 'temu', ARRAY['US','GB','DE'], ARRAY['USD','GBP','EUR'], 7.0)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  website = EXCLUDED.website,
  integration_type = EXCLUDED.integration_type;

INSERT INTO import_providers (id, name, description, integration_type, requires_credentials, credential_env_keys, default_sync_interval_minutes, config)
VALUES
  ('temu', 'Temu', 'Temu affiliate / product API', 'temu', TRUE, ARRAY['TEMU_API_KEY'], 240,
   '{"phase": "placeholder", "endpoint": "https://api.temu.com"}'::jsonb),
  ('walmart', 'Walmart', 'Walmart Open API', 'walmart', TRUE, ARRAY['WALMART_API_KEY'], 240,
   '{"phase": "placeholder"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  default_sync_interval_minutes = 240;

-- Multi-store offers per product (Amazon, AliExpress, eBay, Walmart, Temu)
INSERT INTO prices (product_id, store_id, price, original_price, currency, country_code, external_url, is_current)
SELECT p.id, s.id, v.price, v.original_price, 'USD', 'US', v.external_url, TRUE
FROM (VALUES
  ('iphone-15-pro-max', 'amazon',      899,  1029, 'https://amazon.com/dp/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'aliexpress',  879,  1049, 'https://aliexpress.com/item/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'ebay',        925,  1099, 'https://ebay.com/itm/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'walmart',     919,  1019, 'https://walmart.com/ip/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'temu',        849,  999,  'https://temu.com/iphone-15-pro-max'),
  ('macbook-air-m3',    'amazon',      1149, 1299, 'https://amazon.com/dp/macbook-air-m3'),
  ('macbook-air-m3',    'aliexpress',  1099, 1249, 'https://aliexpress.com/item/macbook-air-m3'),
  ('macbook-air-m3',    'ebay',        1125, 1280, 'https://ebay.com/itm/macbook-air-m3'),
  ('macbook-air-m3',    'walmart',     1099, 1299, 'https://walmart.com/ip/macbook-air-m3'),
  ('macbook-air-m3',    'temu',        1049, 1199, 'https://temu.com/macbook-air-m3'),
  ('playstation-5',     'amazon',      459,  499,  'https://amazon.com/dp/playstation-5'),
  ('playstation-5',     'aliexpress',  439,  489,  'https://aliexpress.com/item/playstation-5'),
  ('playstation-5',     'ebay',        469,  519,  'https://ebay.com/itm/playstation-5'),
  ('playstation-5',     'walmart',     449,  499,  'https://walmart.com/ip/playstation-5'),
  ('playstation-5',     'temu',        429,  479,  'https://temu.com/playstation-5'),
  ('nike-air-jordan-1', 'amazon',      135,  160,  'https://amazon.com/dp/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'aliexpress',   119,  155,  'https://aliexpress.com/item/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'ebay',        125,  158,  'https://ebay.com/itm/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'walmart',     129,  160,  'https://walmart.com/ip/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'temu',        109,  149,  'https://temu.com/nike-air-jordan-1')
) AS v(product_slug, store_slug, price, original_price, external_url)
JOIN products p ON p.slug = v.product_slug
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT (product_id, store_id, country_code, currency) DO UPDATE SET
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  external_url = EXCLUDED.external_url,
  is_current = TRUE;

INSERT INTO product_sources (product_id, store_id, external_product_id, external_url, affiliate_url, country_code, currency, is_active)
SELECT p.id, s.id, v.external_id, v.external_url, v.external_url, 'US', 'USD', TRUE
FROM (VALUES
  ('iphone-15-pro-max', 'amazon',      'amz-iphone15', 'https://amazon.com/dp/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'aliexpress',  'ae-iphone15',  'https://aliexpress.com/item/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'ebay',        'ebay-iphone15','https://ebay.com/itm/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'walmart',     'wm-iphone15',  'https://walmart.com/ip/iphone-15-pro-max'),
  ('iphone-15-pro-max', 'temu',        'temu-iphone15','https://temu.com/iphone-15-pro-max'),
  ('macbook-air-m3',    'amazon',      'amz-mba',      'https://amazon.com/dp/macbook-air-m3'),
  ('macbook-air-m3',    'aliexpress',  'ae-mba',       'https://aliexpress.com/item/macbook-air-m3'),
  ('macbook-air-m3',    'ebay',        'ebay-mba',     'https://ebay.com/itm/macbook-air-m3'),
  ('macbook-air-m3',    'walmart',     'wm-mba',       'https://walmart.com/ip/macbook-air-m3'),
  ('macbook-air-m3',    'temu',        'temu-mba',     'https://temu.com/macbook-air-m3'),
  ('playstation-5',     'amazon',      'amz-ps5',      'https://amazon.com/dp/playstation-5'),
  ('playstation-5',     'aliexpress',  'ae-ps5',       'https://aliexpress.com/item/playstation-5'),
  ('playstation-5',     'ebay',        'ebay-ps5',     'https://ebay.com/itm/playstation-5'),
  ('playstation-5',     'walmart',     'wm-ps5',       'https://walmart.com/ip/playstation-5'),
  ('playstation-5',     'temu',        'temu-ps5',     'https://temu.com/playstation-5'),
  ('nike-air-jordan-1', 'amazon',      'amz-jordan',   'https://amazon.com/dp/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'aliexpress',  'ae-jordan',    'https://aliexpress.com/item/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'ebay',        'ebay-jordan',  'https://ebay.com/itm/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'walmart',     'wm-jordan',    'https://walmart.com/ip/nike-air-jordan-1'),
  ('nike-air-jordan-1', 'temu',        'temu-jordan',  'https://temu.com/nike-air-jordan-1')
) AS v(product_slug, store_slug, external_id, external_url)
JOIN products p ON p.slug = v.product_slug
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT (store_id, external_product_id, country_code, currency) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  external_url = EXCLUDED.external_url,
  affiliate_url = EXCLUDED.affiliate_url,
  is_active = TRUE;

COMMENT ON TABLE prices IS 'Multi-store current offers per product for price comparison';
