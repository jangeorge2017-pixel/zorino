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
