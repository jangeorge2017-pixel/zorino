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
