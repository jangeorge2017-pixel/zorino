-- 026_catalog_count.sql
-- Single-row table maintaining the REAL catalog product count shown by the
-- homepage hero "Products" stat (e.g. 69K+).
--
-- WHY: the authoritative source, an exact COUNT over the 120K-row
-- `lowest_prices_today` table, is expensive (up to ~23s) and intermittently
-- errors from PostgREST, so computing it on the render hot path is unreliable.
-- Instead the count is maintained in this one-row table by the bundled cron
-- refresh (off-path) and opportunistically by the render path after any
-- successful live count. The homepage then reads one row in a handful of
-- milliseconds and stays deterministic.
--
-- SAFETY: additive, new table only. `db:push` apply is deferred by the user.

create table if not exists public.catalog_count (
  singleton boolean primary key default true,
  products integer not null default 0 check (products >= 0),
  updated_at timestamptz not null default now(),
  constraint catalog_count_single_row check (singleton)
);

-- Seed the singleton row so `maybeSingle()` always has a row to read.
insert into public.catalog_count (singleton, products)
values (true, 0)
on conflict (singleton) do nothing;

alter table public.catalog_count enable row level security;

-- Public read (the anon homepage reads the stat), service-role writes only
-- (service_role bypasses RLS for the upsert in lib/integration/catalog-count).
create policy "catalog_count_public_read"
  on public.catalog_count
  for select
  using (true);

grant select on public.catalog_count to anon, authenticated;