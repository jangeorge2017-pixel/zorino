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
