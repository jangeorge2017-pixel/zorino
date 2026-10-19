-- ============================================================
-- ZORINO DATABASE BACKUP (schema + seed)
-- Generated: 2026-10-06 15:28:23 +03:00
-- Source: Supabase (hosted PostgreSQL), project ref: trgzpvpzzfldtouikitc
-- Host: aws-1-eu-central-1.pooler.supabase.com:5432 (db: postgres)
-- Region: eu-central-1
-- NOTE: schema rebuilt from supabase/migrations (DDL source of truth).
--       Row-level DATA is NOT included: no direct Postgres credential
--       (database password) is stored on this machine. See RESTORE block at end.
-- ============================================================

BEGIN;
SET client_encoding = 'UTF8';
SET check_function_bodies = false;

-- ----------------------------------------------------------------
-- MIGRATION: 001_zorino_foundation.sql
-- ----------------------------------------------------------------
-- Zorino foundation schema for Supabase (PostgreSQL)
-- Run via Supabase SQL editor or: supabase db push

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Global: currencies & countries ───
CREATE TABLE IF NOT EXISTS currencies (
  code CHAR(3) PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS countries (
  code CHAR(2) PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  default_currency CHAR(3) NOT NULL REFERENCES currencies(code),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed currencies first (countries reference them)
INSERT INTO currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('AED', 'UAE Dirham', 'د.إ'),
  ('SAR', 'Saudi Riyal', '﷼')
ON CONFLICT (code) DO NOTHING;

INSERT INTO countries (code, name, name_ar, default_currency) VALUES
  ('US', 'United States', 'الولايات المتحدة', 'USD'),
  ('GB', 'United Kingdom', 'المملكة المتحدة', 'GBP'),
  ('AE', 'United Arab Emirates', 'الإمارات', 'AED'),
  ('SA', 'Saudi Arabia', 'السعودية', 'SAR'),
  ('DE', 'Germany', 'ألمانيا', 'EUR')
ON CONFLICT (code) DO NOTHING;

-- ─── Users (profiles linked to Supabase Auth) ───
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  country_code CHAR(2) REFERENCES countries(code),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Public "users" view — profiles is the auth-linked users table (Supabase standard)
CREATE OR REPLACE VIEW public.users AS
SELECT
  id,
  email,
  name,
  avatar_url,
  locale,
  country_code,
  currency,
  is_verified,
  is_admin,
  created_at,
  updated_at,
  last_login_at
FROM public.profiles;

COMMENT ON TABLE profiles IS 'Application users (linked to auth.users). Query via profiles or the users view.';

-- ─── Categories ───
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

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

INSERT INTO categories (slug, name, name_ar, icon, sort_order) VALUES
  ('phones',     'Phones',     'هواتف',     '📱', 1),
  ('laptops',    'Laptops',    'لابتوب',    '💻', 2),
  ('gaming',     'Gaming',     'ألعاب',     '🎮', 3),
  ('tvs',        'TVs',        'تلفزيونات', '📺', 4),
  ('home',       'Home',       'منزل',      '🏠', 5),
  ('wearables',  'Wearables',  'Wearables', '⌚', 6),
  ('fashion',    'Fashion',    'أزياء',     '👟', 7)
ON CONFLICT (slug) DO NOTHING;

-- ─── Stores (multi-marketplace / partner integrations) ───
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  logo_initial TEXT,
  website TEXT NOT NULL,
  integration_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (integration_type IN ('amazon', 'aliexpress', 'shopify', 'noon', 'walmart', 'custom', 'partner')),
  affiliate_program TEXT,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  supported_regions TEXT[] NOT NULL DEFAULT '{}',
  supported_currencies TEXT[] NOT NULL DEFAULT '{USD}',
  external_store_id TEXT,
  api_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_integration ON stores(integration_type);

-- ─── Products (canonical product catalog) ───
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ar TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  description_ar TEXT,
  image_url TEXT NOT NULL,
  emoji TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_slug TEXT,
  brand TEXT,
  rating NUMERIC(3, 2),
  review_count INTEGER NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  country_code CHAR(2) REFERENCES countries(code),
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  specifications JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- ─── Prices (multi-store current + historical compare) ───
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL,
  original_price NUMERIC(12, 2),
  currency CHAR(3) NOT NULL DEFAULT 'USD' REFERENCES currencies(code),
  country_code CHAR(2) REFERENCES countries(code),
  external_url TEXT,
  external_product_id TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, store_id, country_code, currency)
);

CREATE INDEX IF NOT EXISTS idx_prices_product ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_store ON prices(store_id);
CREATE INDEX IF NOT EXISTS idx_prices_current ON prices(is_current) WHERE is_current = TRUE;

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  price NUMERIC(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id, recorded_at DESC);

-- ─── Deals ───
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  discount NUMERIC(5, 2) NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  price NUMERIC(12, 2) NOT NULL,
  original_price NUMERIC(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  country_code CHAR(2) REFERENCES countries(code),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_featured ON deals(is_featured, sort_order) WHERE is_active = TRUE;

-- ─── Coupons ───
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_ar TEXT,
  offer TEXT NOT NULL,
  min_spend TEXT,
  discount NUMERIC(10, 2) NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  country_code CHAR(2) REFERENCES countries(code),
  used_times INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);

-- ─── Favorites ───
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_alert NUMERIC(12, 2),
  currency CHAR(3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- ─── Notifications ───
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('price_drop', 'coupon', 'deal', 'system', 'review', 'alert')),
  title TEXT NOT NULL,
  title_ar TEXT,
  message TEXT NOT NULL,
  message_ar TEXT,
  link TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ─── Row Level Security (public read for catalog) ───
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read countries" ON countries FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read currencies" ON currencies FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read stores" ON stores FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read products" ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read prices" ON prices FOR SELECT USING (TRUE);
CREATE POLICY "Public read price_history" ON price_history FOR SELECT USING (TRUE);
CREATE POLICY "Public read deals" ON deals FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read coupons" ON coupons FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------
-- MIGRATION: 002_sync_architecture.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 003_admin_rls_storage.sql
-- ----------------------------------------------------------------
-- Admin RLS policies + catalog image storage for Zorino dashboard

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_admin = TRUE
  );
$$;

-- ─── Admin write access on catalog tables ───
CREATE POLICY "Admins manage categories" ON categories
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage stores" ON stores
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage products" ON products
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage prices" ON prices
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage price_history" ON price_history
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage deals" ON deals
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage coupons" ON coupons
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins manage product_images" ON product_images
  FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- ─── Supabase Storage: catalog images ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public read catalog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-images');

CREATE POLICY "Admins upload catalog images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog-images'
    AND public.is_admin_user()
  );

CREATE POLICY "Admins update catalog images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-images' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'catalog-images' AND public.is_admin_user());

CREATE POLICY "Admins delete catalog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-images' AND public.is_admin_user());


-- ----------------------------------------------------------------
-- MIGRATION: 004_import_engine.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 005_trending_products.sql
-- ----------------------------------------------------------------
-- Zorino Trending Products system
-- Engagement tracking + precomputed rankings

-- ─── Raw engagement events ───
CREATE TABLE IF NOT EXISTS product_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'favorite', 'purchase')),
  country_code CHAR(2) REFERENCES countries(code),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_product_time
  ON product_engagement_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_type_time
  ON product_engagement_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_country_time
  ON product_engagement_events(country_code, created_at DESC);

-- ─── Daily aggregated stats (fast ranking input) ───
CREATE TABLE IF NOT EXISTS product_engagement_daily (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  country_code CHAR(2) NOT NULL DEFAULT 'US' REFERENCES countries(code),
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  favorites INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, stat_date, country_code)
);

CREATE INDEX IF NOT EXISTS idx_engagement_daily_date
  ON product_engagement_daily(stat_date DESC, country_code);

-- ─── Precomputed trending rankings ───
CREATE TABLE IF NOT EXISTS trending_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ranking_type TEXT NOT NULL CHECK (ranking_type IN (
    'trending_today', 'best_sellers', 'hot_deals', 'biggest_drops', 'popular_country'
  )),
  country_code CHAR(2) NOT NULL DEFAULT 'US' REFERENCES countries(code),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank > 0),
  score NUMERIC(14, 4) NOT NULL DEFAULT 0,
  badge TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ranking_type, country_code, product_id)
);

CREATE INDEX IF NOT EXISTS idx_trending_lookup
  ON trending_rankings(ranking_type, country_code, rank);
CREATE INDEX IF NOT EXISTS idx_trending_product
  ON trending_rankings(product_id);

-- ─── Ranking refresh schedule ───
CREATE TABLE IF NOT EXISTS trending_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interval_minutes INTEGER NOT NULL DEFAULT 240,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('completed', 'failed', 'running')),
  last_error TEXT,
  items_ranked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO trending_refresh_jobs (interval_minutes, is_enabled, next_run_at)
SELECT 240, TRUE, NOW()
WHERE NOT EXISTS (SELECT 1 FROM trending_refresh_jobs LIMIT 1);

-- RLS
ALTER TABLE product_engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_engagement_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_refresh_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read trending_rankings" ON trending_rankings;
CREATE POLICY "Public read trending_rankings" ON trending_rankings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read engagement_daily" ON product_engagement_daily;
CREATE POLICY "Public read engagement_daily" ON product_engagement_daily FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone insert engagement events" ON product_engagement_events;
CREATE POLICY "Anyone insert engagement events" ON product_engagement_events FOR INSERT WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS trending_refresh_jobs_updated_at ON trending_refresh_jobs;
CREATE TRIGGER trending_refresh_jobs_updated_at BEFORE UPDATE ON trending_refresh_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------
-- MIGRATION: 006_lowest_prices_today.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 007_multi_store_comparison.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 008_affiliate_system.sql
-- ----------------------------------------------------------------
-- Zorino Affiliate System (Phase 1)
-- Partner tags, click tracking, and analytics

CREATE TABLE IF NOT EXISTS affiliate_settings (
  marketplace TEXT PRIMARY KEY CHECK (marketplace IN (
    'amazon', 'aliexpress', 'ebay', 'walmart', 'temu'
  )),
  display_name TEXT NOT NULL,
  partner_tag TEXT,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO affiliate_settings (marketplace, display_name, commission_rate, is_enabled, config) VALUES
  ('amazon',     'Amazon',     4.00, TRUE, '{"param": "tag"}'::jsonb),
  ('aliexpress', 'AliExpress', 5.00, TRUE, '{"param": "aff_trace_key"}'::jsonb),
  ('ebay',       'eBay',       4.00, TRUE, '{"param": "campid"}'::jsonb),
  ('walmart',    'Walmart',    3.00, TRUE, '{"param": "wmlspartner"}'::jsonb),
  ('temu',       'Temu',       7.00, TRUE, '{"param": "ref"}'::jsonb)
ON CONFLICT (marketplace) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  commission_rate = EXCLUDED.commission_rate;

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  marketplace TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  session_id TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  country_code CHAR(2) REFERENCES countries(code),
  source TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_marketplace
  ON affiliate_clicks(marketplace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_product
  ON affiliate_clicks(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created
  ON affiliate_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_source
  ON affiliate_clicks(source, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_daily_stats (
  stat_date DATE NOT NULL,
  marketplace TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, marketplace)
);

ALTER TABLE affiliate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read affiliate_settings" ON affiliate_settings;
CREATE POLICY "Public read affiliate_settings" ON affiliate_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone insert affiliate clicks" ON affiliate_clicks;
CREATE POLICY "Anyone insert affiliate clicks" ON affiliate_clicks FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public read affiliate daily stats" ON affiliate_daily_stats;
CREATE POLICY "Public read affiliate_daily_stats" ON affiliate_daily_stats FOR SELECT USING (TRUE);

DROP TRIGGER IF EXISTS affiliate_settings_updated_at ON affiliate_settings;
CREATE TRIGGER affiliate_settings_updated_at BEFORE UPDATE ON affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE affiliate_settings IS 'Per-marketplace affiliate partner tags and commission rates';
COMMENT ON TABLE affiliate_clicks IS 'Tracked outbound affiliate link clicks';


-- ----------------------------------------------------------------
-- MIGRATION: 009_phase1_import_cleanup.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 010_integration_settings_notifications.sql
-- ----------------------------------------------------------------
-- Integration API keys (admin-managed) + notification preferences

CREATE TABLE IF NOT EXISTS integration_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL,
  label TEXT,
  is_secret BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_provider ON integration_settings(provider);

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role integration_settings" ON integration_settings;
CREATE POLICY "Service role integration_settings" ON integration_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_price_drops BOOLEAN NOT NULL DEFAULT TRUE,
  email_trending BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notification prefs" ON notification_preferences;
CREATE POLICY "Users read own notification prefs" ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own notification prefs" ON notification_preferences;
CREATE POLICY "Users insert own notification prefs" ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users upsert own notification prefs" ON notification_preferences;
CREATE POLICY "Users upsert own notification prefs" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Extend notifications type check for price/trending alerts
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('price_drop', 'deal', 'coupon', 'system', 'trending', 'affiliate', 'review', 'alert'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read, created_at DESC);


-- ----------------------------------------------------------------
-- MIGRATION: 011_aliexpress_phase2.sql
-- ----------------------------------------------------------------
-- Phase 2: AliExpress affiliate import monitoring

CREATE TABLE IF NOT EXISTS import_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'aliexpress',
  job_type TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_event_logs_provider
  ON import_event_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_event_logs_level
  ON import_event_logs(level, created_at DESC);

ALTER TABLE import_event_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role import_event_logs" ON import_event_logs;
CREATE POLICY "Service role import_event_logs" ON import_event_logs
  FOR ALL USING (auth.role() = 'service_role');

UPDATE import_providers
SET
  description = 'AliExpress Open Platform affiliate API (Phase 2)',
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{phase}',
    '"live"'::jsonb
  )
WHERE id = 'aliexpress';

COMMENT ON TABLE import_event_logs IS 'Per-event import/sync logs for marketplace integrations';


-- ----------------------------------------------------------------
-- MIGRATION: 012_ebay_phase3.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 013_universal_marketplace_engine.sql
-- ----------------------------------------------------------------
-- Phase 4: Universal Marketplace Engine

-- Cached cross-marketplace aggregates on canonical products
ALTER TABLE products ADD COLUMN IF NOT EXISTS lowest_price NUMERIC(12, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS highest_price NUMERIC(12, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS savings_percent NUMERIC(6, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS offer_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Richer price history for tracking changes over time
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2);
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS country_code CHAR(3);
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS change_percent NUMERIC(6, 2);
ALTER TABLE price_history ADD COLUMN IF NOT EXISTS change_direction TEXT;

CREATE INDEX IF NOT EXISTS idx_price_history_product_store
  ON price_history(product_id, store_id, recorded_at DESC);

-- Cross-marketplace identity keys (GTIN, MPN, ASIN, etc.)
CREATE TABLE IF NOT EXISTS product_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL CHECK (
    identifier_type IN ('gtin', 'upc', 'ean', 'mpn', 'asin', 'sku', 'model')
  ),
  identifier_value TEXT NOT NULL,
  source_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_product_identifiers_product
  ON product_identifiers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_identifiers_lookup
  ON product_identifiers(identifier_type, identifier_value);

-- Product variants (size, color, SKU-level offers)
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  external_id TEXT,
  sku TEXT,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  price NUMERIC(12, 2),
  original_price NUMERIC(12, 2),
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, store_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON product_variants(product_id);

-- Duplicate detection audit log
CREATE TABLE IF NOT EXISTS product_match_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  external_product_id UUID,
  provider TEXT,
  match_type TEXT NOT NULL,
  confidence NUMERIC(4, 3),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_match_log_product
  ON product_match_log(canonical_product_id, created_at DESC);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_products_search_vector
  ON products USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_products_lowest_price
  ON products(lowest_price)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_prices_product_active
  ON prices(product_id, price)
  WHERE is_current = TRUE;

-- Maintain search_vector on product changes
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.specifications::text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, brand, tags, description, specifications
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- Backfill search vectors for existing products
UPDATE products
SET search_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(brand, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(specifications::text, '')), 'D');

-- Unified cross-marketplace offers view
CREATE OR REPLACE VIEW marketplace_offers AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.slug AS product_slug,
  pr.id AS price_id,
  pr.store_id,
  s.name AS store_name,
  s.slug AS store_slug,
  s.integration_type AS provider,
  pr.price,
  pr.original_price,
  pr.currency,
  pr.country_code,
  pr.in_stock,
  pr.external_url,
  pr.external_product_id,
  pr.recorded_at,
  pr.is_current
FROM prices pr
JOIN products p ON p.id = pr.product_id
JOIN stores s ON s.id = pr.store_id
WHERE pr.is_current = TRUE AND p.is_active = TRUE;

-- Indexed search RPC (used by marketplace engine)
CREATE OR REPLACE FUNCTION search_products_indexed(
  search_query TEXT,
  result_limit INT DEFAULT 20
) RETURNS SETOF products AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM products p
  WHERE p.is_active = TRUE
    AND p.sync_status = 'synced'
    AND p.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(p.search_vector, plainto_tsquery('english', search_query)) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

ALTER TABLE product_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_match_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_identifiers" ON product_identifiers;
CREATE POLICY "Public read product_identifiers" ON product_identifiers FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read product_variants" ON product_variants;
CREATE POLICY "Public read product_variants" ON product_variants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Service role product_match_log" ON product_match_log;
CREATE POLICY "Service role product_match_log" ON product_match_log
  FOR ALL USING (auth.role() = 'service_role');

UPDATE import_providers
SET
  description = 'Universal marketplace engine (Phase 4)',
  config = jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{engine}',
    '"universal"'::jsonb
  )
WHERE id IN ('aliexpress', 'ebay', 'cjdropshipping');

COMMENT ON VIEW marketplace_offers IS 'Unified cross-marketplace price offers for comparison engine';
COMMENT ON TABLE product_identifiers IS 'Cross-provider identity keys for duplicate detection';
COMMENT ON TABLE product_variants IS 'SKU/variant-level offers per marketplace';


-- ----------------------------------------------------------------
-- MIGRATION: 014_ebay_epn_prep.sql
-- ----------------------------------------------------------------
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


-- ----------------------------------------------------------------
-- MIGRATION: 015_prevent_admin_escalation.sql
-- ----------------------------------------------------------------
-- Prevent authenticated users from self-elevating to admin via profiles.is_admin

CREATE OR REPLACE FUNCTION public.prevent_profile_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF COALESCE(current_setting('role', true), '') <> 'service_role' THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_admin_escalation ON public.profiles;

CREATE TRIGGER profiles_prevent_admin_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_admin_escalation();


-- ----------------------------------------------------------------
-- MIGRATION: 016_storage_remove_svg.sql
-- ----------------------------------------------------------------
-- Remove SVG from public catalog image bucket (XSS risk when served from app origin)

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'catalog-images';


-- ----------------------------------------------------------------
-- MIGRATION: 017_lowest_prices_today_search_indexes.sql
-- ----------------------------------------------------------------
-- Migration 017: Performance indexes for lowest_prices_today catalog queries
--
-- Problem (production audit, Aug 2026):
--   * getCatalogItemsFromDatabase() runs
--       WHERE country_code='US' AND currency='USD'
--       ORDER BY discount_percent DESC, lowest_price DESC LIMIT 500
--     over ~120K rows. Existing indexes cover (country_code, lowest_price) and
--     (country_code, discount_percent DESC) separately, so Postgres cannot
--     satisfy both filter + full ORDER BY from one index → intermittent
--     "canceling statement due to statement timeout" → silent empty homepage
--     sections.
--   * getSearchResultsFromDatabase() runs multi-word ILIKE ORs over
--     product_name with no trigram index → sequential scan, 8–24s search
--     latency in production.
--
-- Fix: additive, idempotent indexes only (no data changes).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_catalog
  ON lowest_prices_today (country_code, currency, discount_percent DESC, lowest_price DESC);

CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_product_name_trgm
  ON lowest_prices_today USING gin (product_name gin_trgm_ops);


-- ----------------------------------------------------------------
-- MIGRATION: 018_cron_job_runs.sql
-- ----------------------------------------------------------------
-- Migration 018: Cron execution heartbeats
--
-- Problem (production audit, Aug 2026):
--   Bundled cron /api/cron/refresh was silently dying mid-run (serverless
--   timeout while running unbounded provider sync jobs). Nothing recorded
--   whether a cron invocation started, finished, or how far it got — the only
--   traces were stale sync_jobs.next_run_at columns and orphaned
--   sync_runs rows stuck in 'running' since July.
--
-- Fix: durable, publicly-readable execution evidence. Each cron invocation
-- inserts a row on entry and updates it on exit (status/duration/details).
-- Writes happen exclusively via the service role (RLS denies anon/authed
-- writes); reads are public for transparency.

CREATE TABLE IF NOT EXISTS cron_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_started
  ON cron_job_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_job_runs_open
  ON cron_job_runs (job_path, started_at DESC) WHERE status = 'running';

ALTER TABLE cron_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read cron_job_runs" ON cron_job_runs;
CREATE POLICY "Public read cron_job_runs"
  ON cron_job_runs FOR SELECT USING (TRUE);


-- ----------------------------------------------------------------
-- MIGRATION: 019_security_hardening.sql
-- ----------------------------------------------------------------
-- Fix affiliate_clicks RLS: restrict to service role only
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Allow inserts from any authenticated or anon user (for click tracking)
CREATE POLICY "Allow affiliate click inserts"
  ON affiliate_clicks FOR INSERT
  WITH CHECK (true);

-- Restrict reads to service role only (no user should read raw click data)
CREATE POLICY "Service role only for affiliate click reads"
  ON affiliate_clicks FOR SELECT
  USING (auth.role() = 'service_role');


-- ----------------------------------------------------------------
-- MIGRATION: 020_coupon_trust_fix.sql
-- ----------------------------------------------------------------
-- Fix coupon trust defaults: new coupons should be unverified until manually confirmed
ALTER TABLE coupons ALTER COLUMN verified SET DEFAULT FALSE;

-- Remove fabricated used_times from seed data
UPDATE coupons SET used_times = 0 WHERE used_times > 0;


-- ----------------------------------------------------------------
-- MIGRATION: 021_add_amazon_store.sql
-- ----------------------------------------------------------------
-- Migration: 021_add_amazon_store
-- Seed Amazon store row so /stores/amazon renders and the search connector
-- has a store_id to reference.  Sync is disabled until Creators API
-- credentials are configured in Vercel environment variables.

INSERT INTO stores (
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
) VALUES (
  'amazon',
  'Amazon',
  '/stores/amazon.png',
  'AZ',
  'https://www.amazon.eg',
  'amazon',
  4.0,
  ARRAY['EG', 'US', 'GLOBAL'],
  ARRAY['EGP', 'USD'],
  TRUE,
  FALSE,
  360
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website,
  logo_initial = EXCLUDED.logo_initial,
  commission_rate = EXCLUDED.commission_rate,
  supported_regions = EXCLUDED.supported_regions,
  supported_currencies = EXCLUDED.supported_currencies,
  is_active = EXCLUDED.is_active;


-- ----------------------------------------------------------------
-- MIGRATION: 022_add_amazon_eg_store.sql
-- ----------------------------------------------------------------
-- Migration: 022_add_amazon_eg_store
-- Seed Amazon Egypt store row so /stores/amazon-eg renders.
-- Uses zorinoeg-21 affiliate tag on amazon.eg marketplace.

INSERT INTO stores (
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
) VALUES (
  'amazon-eg',
  'Amazon Egypt',
  '/stores/amazon.png',
  'AZ',
  'https://www.amazon.eg',
  'amazon',
  4.0,
  ARRAY['EG'],
  ARRAY['EGP'],
  TRUE,
  FALSE,
  360
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website,
  logo_initial = EXCLUDED.logo_initial,
  commission_rate = EXCLUDED.commission_rate,
  supported_regions = EXCLUDED.supported_regions,
  supported_currencies = EXCLUDED.supported_currencies,
  is_active = EXCLUDED.is_active;


-- ----------------------------------------------------------------
-- MIGRATION: 023_coupon_seed_removal.sql
-- ----------------------------------------------------------------
-- Migration 023: deactivate fabricated seed coupons.
--
-- Zorino has NO real coupon/offer source yet (Admitad/eBay/AliExpress/CJ
-- deliver products, not coupons). The only `coupons` rows are seed/demo data:
-- generic offers, marked `verified = true`, with invented `used_times`
-- statistics. Presenting them as real would label seed data as real, which is
-- forbidden. This migration:
--   1. Deactivates every existing seed coupon (so none can surface).
--   2. Zeroes the fabricated usage counts.
--   3. Defaults new coupons to unverified (they must be confirmed against a
--      real offer source before display).
--
-- Combined with the code-level coupon gate (services/coupons.ts), no seed
-- coupon reaches the UI. Re-seeding coupons will not re-activate them because
-- the seed sets `verified = FALSE` and this migration keeps `is_active = FALSE`.

ALTER TABLE coupons ALTER COLUMN verified SET DEFAULT FALSE;

UPDATE coupons
SET
  is_active = FALSE,
  verified = FALSE,
  used_times = 0
WHERE is_active = TRUE OR used_times > 0 OR verified = TRUE;


-- ----------------------------------------------------------------
-- MIGRATION: 024_provider_health.sql
-- ----------------------------------------------------------------
-- Migration 024: Persisted per-provider health checkpoints
--
-- Problem (architecture freeze §10): provider runtime health is kept only
-- in an in-memory registry (lib/integration/provider-health.ts, 30 min TTL).
-- There is NO durable per-provider health history, no validation-rejection
-- counters, and no error telemetry — nothing to audit or alert on after the
-- process dies.
--
-- Fix: a durable, publicly-readable per-provider health checkpoint table.
-- Each canonical acquisition run writes a compact checkpoint (status, counts,
-- latency, error code, per-gate validation-rejection counters). Writes happen
-- exclusively via the service role (RLS denies anon/authed writes, matching
-- cron_job_runs); reads are public for transparency.
--
-- ADDITIVE: no row is written by the runtime today (ARCH_CANONICAL=off and no
-- caller wired). Applied to production only when Phase 2 is explicitly applied.

CREATE TABLE IF NOT EXISTS provider_health_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ok', 'degraded', 'error')),
  source TEXT NOT NULL DEFAULT 'canonical',
  strategy TEXT,
  acquired_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_code TEXT,
  error_detail TEXT,
  validation_rejections JSONB NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_health_provider_collected
  ON provider_health_checkpoints (provider_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_health_collected
  ON provider_health_checkpoints (collected_at DESC);

ALTER TABLE provider_health_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read provider_health_checkpoints"
  ON provider_health_checkpoints;
CREATE POLICY "Public read provider_health_checkpoints"
  ON provider_health_checkpoints FOR SELECT USING (TRUE);

-- ----------------------------------------------------------------
-- MIGRATION: 025_canonical_identity.sql
-- ----------------------------------------------------------------
-- 025_canonical_identity.sql
-- Phase 3: canonical identity bootstrap persistence.
-- Stores the deterministic mapping from an existing runtime product reference
-- (e.g. a lowest_prices_today row) to the canonical product/offer ids computed
-- by the canonical spine (lib/canonical/identity).
--
-- SAFETY: additive, new table only. NOT applied to production yet; apply with
-- `npm run db:push` against a SAFE NON-PRODUCTION target first (user gate).

create table if not exists public.canonical_identity_map (
  id uuid primary key default gen_random_uuid(),
  source text not null,                             -- e.g. 'lowest_prices_today'
  provider_id text not null,                        -- canonical provider id (e.g. 'admitad')
  external_id text not null,                        -- source-table stable ref (e.g. lowest_prices_today.product_id)
  store_name text,                                  -- merchant/store label, when the source carries one
  country_code text,
  currency text,
  canonical_product_id text not null,               -- deterministic, from lib/canonical/pipeline
  canonical_offer_id text not null,                 -- deterministic, provider-scoped
  confidence text not null default 'weak'           -- exact | strong | suggested | weak
    check (confidence in ('exact', 'strong', 'suggested', 'weak')),
  identifiers jsonb not null default '[]'::jsonb,   -- field-level identifiers actually present in the source
  title_key text,                                   -- normalized title used for clustering
  title text,
  created_at timestamptz not null default now(),
  unique (source, provider_id, external_id)
);

create index if not exists canonical_identity_map_product_idx
  on public.canonical_identity_map (canonical_product_id);
create index if not exists canonical_identity_map_offer_idx
  on public.canonical_identity_map (canonical_offer_id);

alter table public.canonical_identity_map enable row level security;

-- Public read (product pages may look up identity), service-role writes only.
create policy "canonical_identity_map_public_read"
  on public.canonical_identity_map
  for select using (true);

-- ----------------------------------------------------------------
-- MIGRATION: 026_catalog_count.sql
-- ----------------------------------------------------------------
-- 026_catalog_count.sql
-- Single-row table maintaining the REAL catalog product count shown by the
-- homepage hero "Products" stat (e.g. 69K+).
--
-- WHY: the authoritative source, an exact COUNT over the 120K-row
-- `lowest_prices_today` table, is expensive (up to ~23s) and intermittently
-- errors from PostgREST, so computing it on the render hot path is unreliable.
-- Instead the count is maintained in this one-row table by the bundled cron
-- refresh (off-path) and opportunistically by the render path after any
-- successful live count. The homepage then reads one row in a handful of
-- milliseconds and stays deterministic.
--
-- SAFETY: additive, new table only. `db:push` apply is deferred by the user.

create table if not exists public.catalog_count (
  singleton boolean primary key default true,
  products integer not null default 0 check (products >= 0),
  updated_at timestamptz not null default now(),
  constraint catalog_count_single_row check (singleton)
);

-- Seed the singleton row so `maybeSingle()` always has a row to read.
insert into public.catalog_count (singleton, products)
values (true, 0)
on conflict (singleton) do nothing;

alter table public.catalog_count enable row level security;

-- Public read (the anon homepage reads the stat), service-role writes only
-- (service_role bypasses RLS for the upsert in lib/integration/catalog-count).
create policy "catalog_count_public_read"
  on public.catalog_count
  for select
  using (true);

grant select on public.catalog_count to anon, authenticated;

-- ----------------------------------------------------------------
-- SEED: supabase/seed.sql
-- ----------------------------------------------------------------
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
INSERT INTO coupons (store_id, code, title, offer, min_spend, discount, discount_type, verified, is_active)
SELECT s.id, v.code, v.title, v.offer, v.min_spend, v.discount, v.discount_type, FALSE, TRUE
FROM (VALUES
  ('amazon',      'SAVE10',  '10% Off Electronics', '10% off select electronics', '$50',   10, 'percentage'),
  ('best-buy',    'TECH20',  '$20 Off Tech',        '$20 off orders over $100',     '$100',  20, 'fixed'),
  ('walmart',     'FREESHIP','Free Shipping',       'Free shipping on orders $35+', '$35',   0,  'fixed'),
  ('foot-locker', 'KICKS15', '15% Off Sneakers',    '15% off sneakers',             NULL,    15, 'percentage')
) AS v(store_slug, code, title, offer, min_spend, discount, discount_type)
JOIN stores s ON s.slug = v.store_slug
ON CONFLICT DO NOTHING;


COMMIT;

-- ============================================================
-- RESTORE:
--   psql "<DIRECT_CONN_STRING>" -f zorino_db_backup.sql
-- FULL DATA DUMP (run from a host with the Supabase DB password):
--   pg_dump "<DIRECT_CONN_STRING>" --no-owner --no-privileges -Fc -f zorino_data.dump
--   (password: Supabase Dashboard > Project Settings > Database > Connection string)
-- Alternative: Supabase Dashboard > Database > Backups > Download dump
-- ============================================================

