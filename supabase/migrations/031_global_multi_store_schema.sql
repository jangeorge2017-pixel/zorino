-- 031_global_multi_store_schema.sql
-- Global multi-store catalog structure: one canonical product row keyed by a
-- provider-agnostic SKU, plus one offer row per (product, store, country).
--
-- WHY: provider sync previously merged everything through the legacy
-- external_products / product_sources / prices chain. The new structure gives
-- a single global products table keyed by `global_sku` (e.g. the AliExpress
-- product id) and a sibling `product_offers` table where each store contributes
-- exactly one offer per product per country — no duplicate rows on re-sync.
--
-- SHAPE:
--   products.global_sku      — provider-agnostic SKU, unique when present.
--                              Nullable so legacy rows stay valid.
--   product_offers           — one row per (product_id, store_name, country_code)
--                              with store identity (store_name, network_name),
--                              offer economics (price, currency) and the
--                              affiliate deep-link.
--
-- SAFETY: additive. `products.global_sku` is nullable; `product_offers` is a
-- new table. Existing pipelines are unaffected until application code writes
-- to the new columns/table. RLS enabled with no anon policy (service-role
-- sync writes only). `db:push` applies this.

-- 1. Global SKU + category path on the canonical products table.
--    (`title`→`name` and `main_image`→`image_url` already exist under those
--    names; only the new columns are added here.)
alter table public.products
  add column if not exists global_sku text,
  add column if not exists category_path text;

-- Unique (nullable column: multiple NULLs are allowed, so legacy rows are safe).
create unique index if not exists products_global_sku_key
  on public.products (global_sku);

-- 2. Per-store offers.
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_name text not null,
  network_name text not null default 'Direct',
  country_code text not null default 'GLOBAL',
  price numeric(12, 2) not null,
  currency text not null default 'USD',
  affiliate_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Composite unique key: one offer per product per store per country.
-- This is the upsert conflict target used by the sync layer.
create unique index if not exists product_offers_product_store_country_key
  on public.product_offers (product_id, store_name, country_code);

create index if not exists product_offers_store_name_idx
  on public.product_offers (store_name);

create index if not exists product_offers_product_id_idx
  on public.product_offers (product_id);

alter table public.product_offers enable row level security;

-- Service-role only (sync writes via the service client). No anon policy.
