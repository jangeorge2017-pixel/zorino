-- Migration 033: real merchant universe RPC + store ranking index
--
-- Problem (production audit, Oct 2026):
--   The homepage DB leg needs the distinct set of real merchants present in
--   `lowest_prices_today` so it can sample the top products per store. PostgREST
--   cannot express `SELECT DISTINCT`, so the app paginated the whole ~123K-row
--   table (keyset over 16 random UUID partitions) just to collect ~6 store
--   names. On a 0.1-CPU Render instance that scan takes 10–15s, exceeding the
--   homepage DB budget and silently dropping every merchant-backed product.
--
-- Fix (additive, idempotent):
--   1. `real_merchant_names(...)` computes the distinct merchant list in one
--      server-side scan and returns it as text[] (callable with the anon key).
--   2. A covering index makes both that DISTINCT scan and the per-merchant
--      "top products for store X" reads index-only instead of sequential scans.
--
-- No data is seeded or mutated; every returned name is a real `store_name`
-- from a real provider row.

create index if not exists idx_lowest_prices_today_store_rank
  on public.lowest_prices_today (
    store_name,
    discount_percent desc,
    lowest_price desc
  )
  include (provider, country_code, currency)
  where image_url is not null and image_url <> '';

create or replace function public.real_merchant_names(
  p_countries text[],
  p_currencies text[],
  p_providers text[]
)
returns text[]
language sql
stable
parallel safe
as $$
  select coalesce(
    array_agg(distinct store_name order by store_name),
    '{}'::text[]
  )
  from public.lowest_prices_today
  where country_code::text = any (p_countries)
    and currency::text = any (p_currencies)
    and provider = any (p_providers)
    and image_url is not null
    and image_url <> ''
    and store_name is not null
    and btrim(store_name) <> '';
$$;

grant execute on function public.real_merchant_names(text[], text[], text[])
  to anon, authenticated;

comment on function public.real_merchant_names(text[], text[], text[]) is
  'Distinct real merchant names (store_name) for the given market/currency/provider scope. Read-only catalog diagnostic used by the homepage DB leg.';

notify pgrst, 'reload schema';
