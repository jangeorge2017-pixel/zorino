-- Zorino seed data: stores, products, prices, deals, coupons, price history
-- Run after: supabase/migrations/001_zorino_foundation.sql
-- Or via CLI: supabase db reset  (applies migrations + this seed)

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

-- ─── Products ───
INSERT INTO products (slug, name, image_url, emoji, category_slug, brand, rating, review_count, currency, country_code)
VALUES
  ('iphone-15-pro-max',  'iPhone 15 Pro Max',  '/products/deal-iphone.png',  '📱', 'phones',  'Apple', 4.8, 2847, 'USD', 'US'),
  ('macbook-air-m3',     'MacBook Air M3',     '/products/deal-macbook.png', '💻', 'laptops', 'Apple', 4.9, 1523, 'USD', 'US'),
  ('playstation-5',      'PlayStation 5',      '/products/deal-ps5.png',     '🎮', 'gaming',  'Sony',  4.9, 8901, 'USD', 'US'),
  ('nike-air-jordan-1',  'Nike Air Jordan 1',  '/products/deal-nike.png',    '👟', 'fashion', 'Nike',  4.6, 4210, 'USD', 'US')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  emoji = EXCLUDED.emoji,
  category_slug = EXCLUDED.category_slug,
  brand = EXCLUDED.brand,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count;

-- ─── Prices (current, per product + store) ───
INSERT INTO prices (product_id, store_id, price, original_price, currency, country_code, is_current)
SELECT p.id, s.id, v.price, v.original_price, 'USD', 'US', TRUE
FROM (VALUES
  ('iphone-15-pro-max',  'amazon',      899,  1029),
  ('macbook-air-m3',     'best-buy',    1099, 1299),
  ('playstation-5',      'walmart',     449,  499),
  ('nike-air-jordan-1',  'foot-locker', 129,  160)
) AS v(product_slug, store_slug, price, original_price)
JOIN products p ON p.slug = v.product_slug
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT (product_id, store_id, country_code, currency) DO UPDATE SET
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  is_current = TRUE;

-- ─── Featured deals (homepage Trending Deals) ───
DELETE FROM deals WHERE product_id IN (
  SELECT id FROM products WHERE slug IN ('iphone-15-pro-max','macbook-air-m3','playstation-5','nike-air-jordan-1')
);

INSERT INTO deals (product_id, store_id, title, discount, price, original_price, currency, country_code, is_featured, is_active, sort_order)
SELECT p.id, s.id, p.name, v.discount, v.price, v.original_price, 'USD', 'US', TRUE, TRUE, v.sort_order
FROM (VALUES
  ('iphone-15-pro-max',  'amazon',      12, 899,  1029, 1),
  ('macbook-air-m3',     'best-buy',    15, 1099, 1299, 2),
  ('playstation-5',      'walmart',     10, 449,  499,  3),
  ('nike-air-jordan-1',  'foot-locker', 20, 129,  160,  4)
) AS v(product_slug, store_slug, discount, price, original_price, sort_order)
JOIN products p ON p.slug = v.product_slug
JOIN stores s ON s.slug = v.store_slug;

-- ─── Price history (sparkline charts) ───
DELETE FROM price_history WHERE product_id IN (
  SELECT id FROM products WHERE slug IN ('iphone-15-pro-max','macbook-air-m3','playstation-5','nike-air-jordan-1')
);

INSERT INTO price_history (product_id, store_id, price, currency)
SELECT p.id, s.id, v.price, 'USD'
FROM (VALUES
  ('iphone-15-pro-max',  'amazon',      980),
  ('iphone-15-pro-max',  'amazon',      960),
  ('iphone-15-pro-max',  'amazon',      940),
  ('iphone-15-pro-max',  'amazon',      920),
  ('iphone-15-pro-max',  'amazon',      899),
  ('macbook-air-m3',     'best-buy',    1250),
  ('macbook-air-m3',     'best-buy',    1200),
  ('macbook-air-m3',     'best-buy',    1150),
  ('macbook-air-m3',     'best-buy',    1120),
  ('macbook-air-m3',     'best-buy',    1099),
  ('playstation-5',      'walmart',     490),
  ('playstation-5',      'walmart',     480),
  ('playstation-5',      'walmart',     470),
  ('playstation-5',      'walmart',     460),
  ('playstation-5',      'walmart',     449),
  ('nike-air-jordan-1',  'foot-locker', 155),
  ('nike-air-jordan-1',  'foot-locker', 148),
  ('nike-air-jordan-1',  'foot-locker', 140),
  ('nike-air-jordan-1',  'foot-locker', 135),
  ('nike-air-jordan-1',  'foot-locker', 129)
) AS v(product_slug, store_slug, price)
JOIN products p ON p.slug = v.product_slug
JOIN stores s ON s.slug = v.store_slug;

-- ─── Coupons (homepage Top Coupons) ───
INSERT INTO coupons (store_id, code, title, offer, min_spend, discount, discount_type, currency, used_times, verified, is_active)
SELECT s.id, v.code, v.title, v.offer, v.min_spend, v.discount, v.discount_type, 'USD', v.used_times, TRUE, TRUE
FROM (VALUES
  ('amazon',     'SAVE10',   'Amazon Sitewide',    '10% OFF Sitewide',           'Min spend $50',  10, 'percentage', 24532),
  ('noon',       'NOON15',   'Noon Electronics',   '15% OFF Electronics',        'Min spend $100', 15, 'percentage', 8721),
  ('aliexpress', 'AE50OFF',  'AliExpress Orders',  '$50 OFF Orders $200+',       'Min spend $200', 50, 'fixed',      5623),
  ('nike',       'NIKE20',   'Nike Full Price',    '20% OFF Full Price Items',   'No minimum',     20, 'percentage', 9834)
) AS v(store_slug, code, title, offer, min_spend, discount, discount_type, used_times)
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT (code) DO UPDATE SET
  offer = EXCLUDED.offer,
  min_spend = EXCLUDED.min_spend,
  discount = EXCLUDED.discount,
  used_times = EXCLUDED.used_times;
