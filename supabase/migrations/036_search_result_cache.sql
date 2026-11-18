-- 036_search_result_cache.sql
-- Persistent, cache-first storage for unified search results.
--
-- WHY: the /search surface cold path fans out to nine Egyptian storefront
-- scrapers plus every API marketplace, which is slow and memory-heavy. Search
-- now serves the last known-good balanced pool from this table immediately and
-- refreshes it in the background (stale-while-revalidate) on a 6-hour TTL.
--
-- SAFETY: additive, new table only. Read/write exclusively through the
-- service-role client on the server; no anon/public policies are granted.

create table if not exists public.search_result_cache (
  cache_key text primary key,
  query text not null,
  locale text,
  currency text,
  sort_mode text,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0 check (item_count >= 0),
  provider_counts jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists search_result_cache_fetched_at_idx
  on public.search_result_cache (fetched_at);

alter table public.search_result_cache enable row level security;

-- Intentionally no policies: service_role bypasses RLS. The cache is an
-- internal server-side artifact and must never be readable by anon clients.
revoke all on public.search_result_cache from anon, authenticated;
grant select, insert, update, delete on public.search_result_cache to service_role;
