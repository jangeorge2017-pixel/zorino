-- Zorino sync architecture: product images, external mappings, sync jobs
-- Run after 001_zorino_foundation.sql
-- Note: categories, countries, currencies, users (profiles) are in 001.

-- Ensure categories exist (idempotent if 001 already applied)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (slug, name, name_ar, icon, sort_order) VALUES
  ('phones', 'Phones', 'هواتف', '📱', 1),
  ('laptops', 'Laptops', 'لابتوب', '💻', 2),
  ('gaming', 'Gaming', 'ألعاب', '🎮', 3),
  ('tvs', 'TVs', 'تلفزيونات', '📺', 4),
  ('home', 'Home', 'منزل', '🏠', 5),
  ('wearables', 'Wearables', 'Wearables', '⌚', 6),
  ('fashion', 'Fashion', 'أزياء', '👟', 7)
ON CONFLICT (slug) DO NOTHING;

-- Link products to categories (safe for fresh or upgraded installs)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'idle'
    CHECK (sync_status IN ('idle', 'pending', 'syncing', 'synced', 'failed', 'stale'));

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);

UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category_slug = c.slug AND p.category_id IS NULL;

-- ─── Product images (multi-image from partner APIs) ───
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'manual', 'scrape')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_primary
  ON product_images(product_id) WHERE is_primary = TRUE;

-- ─── External product mappings (per store / country / currency) ───
CREATE TABLE IF NOT EXISTS product_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  external_product_id TEXT NOT NULL,
  external_url TEXT,
  country_code CHAR(2) REFERENCES countries(code),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  affiliate_url TEXT,
  sync_hash TEXT,
  raw_payload JSONB,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, external_product_id, country_code, currency)
);

CREATE INDEX IF NOT EXISTS idx_product_sources_product ON product_sources(product_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_store ON product_sources(store_id);
CREATE INDEX IF NOT EXISTS idx_product_sources_sync ON product_sources(last_synced_at);

-- ─── Store sync settings ───
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes INTEGER NOT NULL DEFAULT 360,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ;

-- ─── Scheduled sync jobs ───
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('products', 'prices', 'deals', 'images', 'full')),
  country_code CHAR(2) REFERENCES countries(code),
  currency CHAR(3) REFERENCES currencies(code),
  schedule_cron TEXT,
  interval_minutes INTEGER NOT NULL DEFAULT 360,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 5,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_enabled ON sync_jobs(is_enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_store ON sync_jobs(store_id);

-- ─── Sync run history ───
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id UUID REFERENCES sync_jobs(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  country_code CHAR(2),
  currency CHAR(3),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  items_fetched INTEGER NOT NULL DEFAULT 0,
  items_created INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_job ON sync_runs(sync_job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status, started_at DESC);

-- Default sync jobs per integration store
INSERT INTO sync_jobs (store_id, job_type, country_code, currency, interval_minutes, priority, config)
SELECT s.id, 'full', 'US', 'USD', 360, 5, '{"connector": "mock"}'::jsonb
FROM stores s
WHERE s.integration_type IN ('amazon', 'aliexpress', 'shopify', 'walmart', 'noon', 'partner')
  AND NOT EXISTS (
    SELECT 1 FROM sync_jobs j WHERE j.store_id = s.id AND j.job_type = 'full' AND j.country_code = 'US'
  );

-- RLS for sync-only tables (categories RLS is in 001)
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_images" ON product_images;
CREATE POLICY "Public read product_images" ON product_images FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read product_sources" ON product_sources;
CREATE POLICY "Public read product_sources" ON product_sources FOR SELECT USING (is_active = TRUE);

DROP TRIGGER IF EXISTS product_sources_updated_at ON product_sources;
CREATE TRIGGER product_sources_updated_at BEFORE UPDATE ON product_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sync_jobs_updated_at ON sync_jobs;
CREATE TRIGGER sync_jobs_updated_at BEFORE UPDATE ON sync_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
