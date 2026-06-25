-- Zorino Lowest Prices Today (Phase 2)
-- Complements existing products/prices/import_providers with dedicated lowest-price cache + history.
-- Existing catalog tables are preserved (products, prices, import_providers, trending_rankings).

-- ─── Compatibility views (requested schema names) ───
CREATE OR REPLACE VIEW product_prices AS
SELECT
  pr.id,
  pr.product_id,
  pr.store_id,
  pr.price,
  pr.original_price,
  pr.currency,
  pr.country_code,
  pr.external_url,
  pr.external_product_id,
  pr.in_stock,
  pr.is_current,
  pr.recorded_at,
  pr.created_at,
  s.slug AS store_slug,
  s.name AS store_name,
  s.integration_type AS provider
FROM prices pr
JOIN stores s ON s.id = pr.store_id
WHERE pr.is_current = TRUE;

CREATE OR REPLACE VIEW providers AS
SELECT
  ip.id,
  ip.name,
  ip.integration_type,
  ip.is_enabled,
  ip.requires_credentials,
  ip.default_sync_interval_minutes,
  ip.config,
  ip.created_at,
  ip.updated_at
FROM import_providers ip
UNION ALL
SELECT
  s.slug AS id,
  s.name,
  s.integration_type,
  s.is_active AS is_enabled,
  TRUE AS requires_credentials,
  s.sync_interval_minutes AS default_sync_interval_minutes,
  '{}'::jsonb AS config,
  s.created_at,
  s.updated_at
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM import_providers ip WHERE ip.integration_type = s.integration_type
);

CREATE OR REPLACE VIEW trending_products AS
SELECT
  tr.id,
  tr.ranking_type,
  tr.country_code,
  tr.product_id,
  tr.rank,
  tr.score,
  tr.badge,
  tr.metadata,
  tr.computed_at,
  p.name AS product_name,
  p.slug AS product_slug,
  p.image_url
FROM trending_rankings tr
JOIN products p ON p.id = tr.product_id;

-- ─── Lowest price history (new lows tracking) ───
CREATE TABLE IF NOT EXISTS lowest_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  provider TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  previous_lowest NUMERIC(12, 2) CHECK (previous_lowest IS NULL OR previous_lowest >= 0),
  country_code CHAR(2) REFERENCES countries(code),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lowest_price_history_product
  ON lowest_price_history(product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lowest_price_history_country
  ON lowest_price_history(country_code, recorded_at DESC);

-- ─── Homepage cache: lowest offer per product ───
CREATE TABLE IF NOT EXISTS lowest_prices_today (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL DEFAULT 'US' REFERENCES countries(code),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  product_name TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  image_url TEXT NOT NULL,
  emoji TEXT,
  lowest_price NUMERIC(12, 2) NOT NULL CHECK (lowest_price >= 0),
  original_price NUMERIC(12, 2) CHECK (original_price IS NULL OR original_price >= 0),
  discount_percent NUMERIC(6, 2) NOT NULL DEFAULT 0,
  savings_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  store_name TEXT NOT NULL,
  provider TEXT,
  affiliate_url TEXT,
  external_url TEXT,
  is_new_low BOOLEAN NOT NULL DEFAULT FALSE,
  price_recorded_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, country_code, currency)
);

CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_country
  ON lowest_prices_today(country_code, lowest_price);
CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_discount
  ON lowest_prices_today(country_code, discount_percent DESC);
CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_new_low
  ON lowest_prices_today(country_code, is_new_low, price_recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_computed
  ON lowest_prices_today(computed_at DESC);

-- ─── Refresh schedule (every 4 hours default) ───
CREATE TABLE IF NOT EXISTS lowest_price_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interval_minutes INTEGER NOT NULL DEFAULT 240,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('completed', 'failed', 'running')),
  last_error TEXT,
  items_computed INTEGER NOT NULL DEFAULT 0,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO lowest_price_refresh_jobs (interval_minutes, is_enabled, next_run_at)
SELECT 240, TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM lowest_price_refresh_jobs LIMIT 1);

-- RLS
ALTER TABLE lowest_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lowest_prices_today ENABLE ROW LEVEL SECURITY;
ALTER TABLE lowest_price_refresh_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read lowest_prices_today" ON lowest_prices_today;
CREATE POLICY "Public read lowest_prices_today" ON lowest_prices_today FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read lowest_price_history" ON lowest_price_history;
CREATE POLICY "Public read lowest_price_history" ON lowest_price_history FOR SELECT USING (TRUE);

DROP TRIGGER IF EXISTS lowest_price_refresh_jobs_updated_at ON lowest_price_refresh_jobs;
CREATE TRIGGER lowest_price_refresh_jobs_updated_at BEFORE UPDATE ON lowest_price_refresh_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE products IS 'Canonical product catalog (foundation schema)';
COMMENT ON VIEW product_prices IS 'Current prices across all stores/providers';
COMMENT ON VIEW providers IS 'Import providers + store integrations';
COMMENT ON TABLE lowest_prices_today IS 'Cached lowest offer per product for homepage';
COMMENT ON VIEW trending_products IS 'Trending rankings joined with product details';
