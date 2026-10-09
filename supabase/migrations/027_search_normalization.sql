-- Migration 027: Multilingual search normalization (TSVector/FTS + trigram over a
-- normalized product-title surface).
--
-- Problem (search-accuracy audit, Oct 2026):
--   * The DB legs filter `product_name` with raw word-boundary `imatch` regexes
--     built from the RAW query. Arabic orthographic variants split a family
--     ("آيفون/إيفون" vs "ايفون"), Arabic-Indic/Persian digits split "128GB"
--     from "١٢٨GB", dash variants split "MacBook-Pro", and e-commerce noise
--     ("new", "original", "free shipping", "للبيع") pollutes the token set on
--     both sides.
--   * There is no indexed way to answer a fuzzy/normalized containment query.
--     The existing trigram index (017) covers the RAW `product_name`, so an
--     orthographic variant of a brand never matches.
--   * The `products` table already carries `search_vector` (013) but
--     `lowest_prices_today` — the catalog search reads — has no tsvector/GIN.
--
-- Fix: additive + idempotent. One immutable SQL normalizer, a STORED generated
-- column `product_name_normalized` (same folding the app's
-- `lib/search/text-normalization.ts` applies: hamza→ا, ى/ی→ي, ة→ه, tashkeel +
-- tatweel stripped, Arabic-Indic/Persian digits → ASCII, dash variants erased,
-- Latin accents folded via `unaccent`), and two GIN indexes:
--   * pg_trgm over the normalized surface → real fuzzy/substring recall
--   * 'simple' tsvector over the normalized surface → FTS word matching
--
-- The app keeps building its own `imatch` filters (unchanged) and can switch
-- to the normalized surface / FTS without code that fails on older schemas:
-- every object here is additive. No data is rewritten in place.

-- Required extensions (both idempotent). unaccent folds Latin diacritics (é→e)
-- so query and title surfaces agree; pg_trgm backs the trigram index below.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Canonical SQL mirror of lib/search/text-normalization.ts `normalizeText`.
-- IMMUTABLE + PARALLEL SAFE so it can feed STORED generated columns.
-- search_path includes `extensions` so unaccent() resolves whether the extension
-- was installed in `public` or in Supabase's `extensions` schema.
CREATE OR REPLACE FUNCTION zorino_normalize_title(p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $function$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(unaccent(coalesce(p_title, ''))),
            -- أإآٱٲٳ ى ی ێ ە ة → ا ا ا ا ا ا ي ي ي ه ه ; Arabic-Indic ٠-٩ and
            -- Persian ۰-۹ digits → ASCII 0-9 (translate pairs positionally).
            U&'\0622\0623\0625\0671\0672\0673\0649\06CC\06CE\06D5\0629\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9',
            U&'\0627\0627\0627\0627\0627\0627\064A\064A\064A\0647\0647\0030\0031\0032\0033\0034\0035\0036\0037\0038\0039\0030\0031\0032\0033\0034\0035\0036\0037\0038\0039'
          ),
          -- Diacritics/tashkeel/tatweel/superscript alef + Arabic signs/comma.
          U&'[\064B-\0652\0670\0640\060C\0600-\060B\06D0-\06ED]', '', 'g'
        ),
        -- Dash/hyphen variants erased to a space so tokens split cleanly.
        U&'[\2010-\2015\2212\00AD\FF0D\FE58\FE63]', ' ', 'g'
      ),
      '[[:space:]]+', ' ', 'g'
    )
  );
$function$;

-- Normalized product title surface (STORED, computed once at migration).
ALTER TABLE lowest_prices_today
  ADD COLUMN IF NOT EXISTS product_name_normalized text
  GENERATED ALWAYS AS (zorino_normalize_title(product_name)) STORED;

-- Trigram GIN over the NORMALIZED surface → typo/orthographic-variant recall.
CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_product_name_norm_trgm
  ON lowest_prices_today USING gin (product_name_normalized gin_trgm_ops);

-- 'simple' tsvector over the normalized surface → indexed FTS word matching.
ALTER TABLE lowest_prices_today
  ADD COLUMN IF NOT EXISTS product_name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', product_name_normalized)) STORED;

CREATE INDEX IF NOT EXISTS idx_lowest_prices_today_product_name_tsv
  ON lowest_prices_today USING gin (product_name_tsv);