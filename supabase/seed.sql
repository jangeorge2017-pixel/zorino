-- Zorino seed data: stores and coupons only (products come from Phase 1 API import)
-- Run after: supabase/migrations/001_zorino_foundation.sql

-- ─── Stores ───
INSERT INTO stores (slug, name, logo_url, logo_initial, website, integration_type, supported_regions, supported_currencies)
VALUES
  ('amazon',      'Amazon',      '/stores/amazon.png',      'a',  'https://amazon.com',      'amazon',      ARRAY['US','GB','DE'],   ARRAY['USD','GBP','EUR']),
  ('best-buy',    'Best Buy',    '/stores/best-buy.png',    'BB', 'https://bestbuy.com',     'partner',     ARRAY['US'],            ARRAY['USD']),
  ('walmart',     'Walmart',     '/stores/walmart.png',     'W',  'https://walmart.com',     'walmart',     ARRAY['US'],            ARRAY['USD']),
  ('foot-locker', 'Foot Locker', '/stores/foot-locker.png', 'FL', 'https://footlocker.com',  'partner',     ARRAY['US','GB'],       ARRAY['USD','GBP']),
  ('noon',        'Noon',        '/stores/noon.png',        'N',  'https://noon.com',        'noon',        ARRAY['AE','SA'],       ARRAY['AED','SAR']),
  ('aliexpress',  'AliExpress',  '/stores/aliexpress.png',  'AE', 'https://aliexpress.com',  'aliexpress',  ARRAY['US','GB','AE','SA'], ARRAY['USD','GBP','AED','SAR']),
  ('nike',        'Nike',        '/stores/nike.png',        '✓',  'https://nike.com',        'shopify',     ARRAY['US','GB','DE'],  ARRAY['USD','GBP','EUR'])
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  logo_initial = EXCLUDED.logo_initial,
  website = EXCLUDED.website,
  integration_type = EXCLUDED.integration_type,
  supported_regions = EXCLUDED.supported_regions,
  supported_currencies = EXCLUDED.supported_currencies;

-- ─── Sample coupons (stores must exist) ───
INSERT INTO coupons (store_id, code, title, offer, min_spend, discount, discount_type, used_times, verified, is_active)
SELECT s.id, v.code, v.title, v.offer, v.min_spend, v.discount, v.discount_type, v.used_times, TRUE, TRUE
FROM (VALUES
  ('amazon',      'SAVE10',  '10% Off Electronics', '10% off select electronics', '$50',   10, 'percentage', 1240),
  ('best-buy',    'TECH20',  '$20 Off Tech',        '$20 off orders over $100',     '$100',  20, 'fixed',       890),
  ('walmart',     'FREESHIP','Free Shipping',       'Free shipping on orders $35+', '$35',   0,  'fixed',      2100),
  ('foot-locker', 'KICKS15', '15% Off Sneakers',    '15% off sneakers',             NULL,    15, 'percentage',  560)
) AS v(store_slug, code, title, offer, min_spend, discount, discount_type, used_times)
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT DO NOTHING;
