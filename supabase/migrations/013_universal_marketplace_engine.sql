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
