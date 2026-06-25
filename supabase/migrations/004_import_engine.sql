-- Zorino multi-source import engine (Phase 1)
-- External product/price staging + provider registry

-- Extend store integration types for new providers
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_integration_type_check;
ALTER TABLE stores ADD CONSTRAINT stores_integration_type_check
  CHECK (integration_type IN (
    'amazon', 'aliexpress', 'cjdropshipping', 'ebay',
    'shopify', 'noon', 'walmart', 'custom', 'partner'
  ));

-- ─── Import provider registry ───
CREATE TABLE IF NOT EXISTS import_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  integration_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  requires_credentials BOOLEAN NOT NULL DEFAULT TRUE,
  credential_env_keys TEXT[] NOT NULL DEFAULT '{}',
  default_sync_interval_minutes INTEGER NOT NULL DEFAULT 360,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO import_providers (id, name, description, integration_type, requires_credentials, credential_env_keys, default_sync_interval_minutes, config) VALUES
  ('amazon', 'Amazon', 'Amazon Product Advertising API 5.0', 'amazon', TRUE,
    ARRAY['AMAZON_PAAPI_ACCESS_KEY', 'AMAZON_PAAPI_SECRET_KEY', 'AMAZON_ASSOCIATE_TAG'], 360,
    '{"phase": "placeholder", "apiVersion": "pa-api-5.0"}'::jsonb),
  ('aliexpress', 'AliExpress', 'AliExpress Open Platform affiliate API', 'aliexpress', TRUE,
    ARRAY['ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET'], 360,
    '{"phase": "placeholder", "endpoint": "aliexpress.affiliate.product.query"}'::jsonb),
  ('cjdropshipping', 'CJdropshipping', 'CJdropshipping product & inventory API', 'cjdropshipping', TRUE,
    ARRAY['CJDROPSHIPPING_API_KEY'], 240,
    '{"phase": "placeholder", "endpoint": "https://developers.cjdropshipping.com/api2.0/v1"}'::jsonb),
  ('ebay', 'eBay', 'eBay Browse / Finding API', 'ebay', TRUE,
    ARRAY['EBAY_APP_ID', 'EBAY_CERT_ID'], 360,
    '{"phase": "placeholder", "endpoint": "https://api.ebay.com/buy/browse/v1"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  credential_env_keys = EXCLUDED.credential_env_keys,
  config = EXCLUDED.config;

-- ─── External products (normalized staging) ───
CREATE TABLE IF NOT EXISTS external_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL REFERENCES import_providers(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  canonical_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  slug TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category_slug TEXT,
  image_url TEXT NOT NULL,
  image_urls JSONB NOT NULL DEFAULT '[]',
  emoji TEXT,
  specifications JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  rating NUMERIC(4,2),
  review_count INTEGER NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  country_code CHAR(2) REFERENCES countries(code),
  product_url TEXT,
  affiliate_url TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  sync_hash TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed', 'stale')),
  raw_payload JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, store_id, external_id, country_code, currency)
);

CREATE INDEX IF NOT EXISTS idx_external_products_provider ON external_products(provider);
CREATE INDEX IF NOT EXISTS idx_external_products_store ON external_products(store_id);
CREATE INDEX IF NOT EXISTS idx_external_products_slug ON external_products(slug);
CREATE INDEX IF NOT EXISTS idx_external_products_canonical ON external_products(canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_external_products_sync ON external_products(sync_status, last_synced_at);

-- ─── External prices (provider price snapshots) ───
CREATE TABLE IF NOT EXISTS external_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL REFERENCES import_providers(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_product_id UUID REFERENCES external_products(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  canonical_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(12,2) CHECK (original_price IS NULL OR original_price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  country_code CHAR(2) REFERENCES countries(code),
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  merged_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, store_id, external_id, country_code, currency)
);

CREATE INDEX IF NOT EXISTS idx_external_prices_product ON external_prices(external_product_id);
CREATE INDEX IF NOT EXISTS idx_external_prices_canonical ON external_prices(canonical_product_id);
CREATE INDEX IF NOT EXISTS idx_external_prices_current ON external_prices(is_current) WHERE is_current = TRUE;

-- ─── New import source stores ───
INSERT INTO stores (slug, name, logo_url, logo_initial, website, integration_type, commission_rate, supported_regions, is_active, sync_enabled, sync_interval_minutes)
VALUES
  ('cjdropshipping', 'CJdropshipping', '/stores/cjdropshipping.png', 'CJ', 'https://cjdropshipping.com', 'cjdropshipping', 8.0, ARRAY['US', 'EU', 'GLOBAL'], TRUE, TRUE, 240),
  ('ebay', 'eBay', '/stores/ebay.png', 'EB', 'https://ebay.com', 'ebay', 4.0, ARRAY['US', 'UK', 'DE'], TRUE, TRUE, 360)
ON CONFLICT (slug) DO UPDATE SET
  integration_type = EXCLUDED.integration_type,
  sync_enabled = EXCLUDED.sync_enabled,
  sync_interval_minutes = EXCLUDED.sync_interval_minutes;

-- Provider-specific sync jobs (products + prices intervals)
INSERT INTO sync_jobs (store_id, job_type, country_code, currency, interval_minutes, priority, config)
SELECT s.id, 'full', 'US', 'USD', p.default_sync_interval_minutes, 5,
  jsonb_build_object('connector', s.integration_type, 'provider', p.id)
FROM stores s
JOIN import_providers p ON p.integration_type = s.integration_type
WHERE s.integration_type IN ('aliexpress', 'cjdropshipping', 'ebay', 'amazon')
  AND NOT EXISTS (
    SELECT 1 FROM sync_jobs j
    WHERE j.store_id = s.id AND j.job_type = 'full' AND j.country_code = 'US'
  );

INSERT INTO sync_jobs (store_id, job_type, country_code, currency, interval_minutes, priority, config)
SELECT s.id, 'prices', 'US', 'USD', 60, 8,
  jsonb_build_object('connector', s.integration_type, 'provider', p.id)
FROM stores s
JOIN import_providers p ON p.integration_type = s.integration_type
WHERE s.integration_type IN ('aliexpress', 'cjdropshipping', 'ebay', 'amazon')
  AND NOT EXISTS (
    SELECT 1 FROM sync_jobs j
    WHERE j.store_id = s.id AND j.job_type = 'prices' AND j.country_code = 'US'
  );

-- RLS
ALTER TABLE import_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read import_providers" ON import_providers;
CREATE POLICY "Public read import_providers" ON import_providers FOR SELECT USING (is_enabled = TRUE);

DROP POLICY IF EXISTS "Public read external_products" ON external_products;
CREATE POLICY "Public read external_products" ON external_products FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read external_prices" ON external_prices;
CREATE POLICY "Public read external_prices" ON external_prices FOR SELECT USING (is_current = TRUE);

DROP TRIGGER IF EXISTS import_providers_updated_at ON import_providers;
CREATE TRIGGER import_providers_updated_at BEFORE UPDATE ON import_providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS external_products_updated_at ON external_products;
CREATE TRIGGER external_products_updated_at BEFORE UPDATE ON external_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
