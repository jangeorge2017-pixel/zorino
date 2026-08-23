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
