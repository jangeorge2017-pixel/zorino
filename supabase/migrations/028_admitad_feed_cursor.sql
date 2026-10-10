-- 028_admitad_feed_cursor.sql
-- Persisted rotation cursor for the Admitad multi-merchant feed ingestion.
--
-- WHY: the daily /api/cron/refresh ingestion always fetched the SAME first N
-- discovered merchant feeds (candidateFeeds.slice(0, maxFeeds) — Alibaba first,
-- then a fixed pair). Every run upserted the same merchants, so merchants 4..N
-- were NEVER ingested and the canonical catalog stopped growing organically.
--
-- FIX: a single-row cursor that the ingestion reads to ROTATE the starting
-- offset through the discovered feed list, then advances by the number of feeds
-- it attempted. Across daily runs the whole discovered catalog is swept.
--
-- SAFETY: additive, new table only. When the table is absent (not yet applied)
-- the application degrades to a deterministic day-of-year offset, so rotation
-- still happens. `db:push` applies this migration.

create table if not exists public.admitad_feed_cursor (
  singleton boolean primary key default true,
  offset integer not null default 0 check (offset >= 0),
  updated_at timestamptz not null default now(),
  constraint admitad_feed_cursor_single_row check (singleton)
);

-- Seed the singleton row so `maybeSingle()` always has a row to read.
insert into public.admitad_feed_cursor (singleton, offset)
values (true, 0)
on conflict (singleton) do nothing;

alter table public.admitad_feed_cursor enable row level security;

-- Service-role only (the cron writes via the service client). No anon policy:
-- this is internal ingestion state, never read by the public site.
