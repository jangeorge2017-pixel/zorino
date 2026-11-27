CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $migration$
DECLARE
  zorino_column text;
BEGIN
  FOREACH zorino_column IN ARRAY ARRAY['name', 'name_ar', 'title', 'title_ar', 'slug', 'category_slug'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND information_schema.columns.column_name = zorino_column
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.products USING gin (%I gin_trgm_ops)',
        'idx_products_' || zorino_column || '_trgm',
        zorino_column
      );
    END IF;
  END LOOP;

  FOREACH zorino_column IN ARRAY ARRAY['product_name', 'product_name_normalized', 'store_name', 'provider', 'product_slug', 'title', 'store', 'category'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lowest_prices_today'
        AND information_schema.columns.column_name = zorino_column
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.lowest_prices_today USING gin (%I gin_trgm_ops)',
        'idx_lowest_prices_today_' || zorino_column || '_trgm',
        zorino_column
      );
    END IF;
  END LOOP;
END
$migration$;
