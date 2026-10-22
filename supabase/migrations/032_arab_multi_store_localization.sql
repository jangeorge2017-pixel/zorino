-- 032_arab_multi_store_localization.sql
-- Localized, multi-store offer layer for the Arab storefronts.
--
-- Builds on 031 (products.global_sku + product_offers) by making each offer
-- carry the full localized economics a real MENA feed exposes, and by adding a
-- rate table so EGP/SAR/AED rows can be compared/converted without code.
--
-- SHAPE:
--   product_offers.original_price   — merchant strike-through price, real feed value only.
--   product_offers.shipping_cost    — real shipping cost when the feed provides one.
--   product_offers.offer_language   — BCP-47 primary subtag of the offer copy (en/ar/...).
--   product_offers.variant_label    — model/size/color label when the feed is one variant per row.
--   product_offers.attributes       — raw variant attributes (color, size, storage, ...).
--   exchange_rates                  — base/quote FX pairs used for display conversion.
--
-- `country_code` already localizes an offer (one row per product+store+market),
-- so the Arabic storefront variants are real rows, never overwritten by the US
-- row. The extra columns above add within-market variation only.
--
-- SAFETY: additive + idempotent. Columns/table added `if not exists`, indexes
-- `if not exists`, no existing column is altered or dropped, no data is
-- invented or seeded. `in_stock` / `product_store_url` / `last_updated` are
-- re-declared so a database built from migrations matches the live one the
-- sync writer already targets (031 predates those three columns).

-- 1. Localized offer economics / variant metadata.
alter table public.product_offers
  add column if not exists in_stock boolean not null default true,
  add column if not exists product_store_url text,
  add column if not exists last_updated timestamptz not null default now(),
  add column if not exists original_price numeric(12, 2),
  add column if not exists shipping_cost numeric(12, 2),
  add column if not exists offer_language text not null default 'en',
  add column if not exists variant_label text,
  add column if not exists attributes jsonb not null default '{}'::jsonb;

alter table public.product_offers
  drop constraint if exists product_offers_original_price_check;
alter table public.product_offers
  add constraint product_offers_original_price_check
  check (original_price is null or original_price >= 0);

alter table public.product_offers
  drop constraint if exists product_offers_shipping_cost_check;
alter table public.product_offers
  add constraint product_offers_shipping_cost_check
  check (shipping_cost is null or shipping_cost >= 0);

-- Read paths: market-scoped price scans (search/compare legs) and per-network
-- merchant scans (feed diagnostics). The incremental bridge scans last_updated.
create index if not exists product_offers_country_price_idx
  on public.product_offers (country_code, price);

create index if not exists product_offers_network_store_idx
  on public.product_offers (network_name, store_name);

create index if not exists product_offers_last_updated_idx
  on public.product_offers (last_updated);

comment on column public.product_offers.original_price is
  'Merchant strike-through price from the real feed (NULL when the feed omits it).';
comment on column public.product_offers.offer_language is
  'Primary language subtag of the offer copy (en/ar/...), from the feed when known.';
comment on column public.product_offers.variant_label is
  'Model/size/color label when the feed exports one variant per row.';

-- 2. FX pairs for EGP/SAR/AED display conversion.
--    Rows are written by ops/scripts from a real rate source; nothing is seeded
--    here, and `lib/international/exchange-rates.ts` keeps its static fallback
--    when a pair is absent.
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency char(3) not null references public.currencies (code),
  quote_currency char(3) not null references public.currencies (code),
  rate numeric(18, 8) not null check (rate > 0),
  source text not null default 'manual',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchange_rates_pair_key unique (base_currency, quote_currency),
  constraint exchange_rates_distinct_pair check (base_currency <> quote_currency)
);

create index if not exists exchange_rates_fetched_at_idx
  on public.exchange_rates (fetched_at desc);

alter table public.exchange_rates enable row level security;

drop policy if exists "Public read exchange_rates" on public.exchange_rates;
create policy "Public read exchange_rates" on public.exchange_rates
  for select using (true);

drop trigger if exists exchange_rates_updated_at on public.exchange_rates;
create trigger exchange_rates_updated_at
  before update on public.exchange_rates
  for each row execute function public.set_updated_at();

comment on table public.exchange_rates is
  'Base/quote FX pairs for cross-currency display; static code rates are the fallback.';
