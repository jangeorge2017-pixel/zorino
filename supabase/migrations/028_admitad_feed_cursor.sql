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

-- NOTE: an earlier revision of this migration used an unquoted `offset`
-- identifier, which is a syntax error in Postgres, so it never applied while a
-- table of the same name existed out-of-band WITHOUT an `offset` column. The
-- statements below are therefore written to be fully idempotent against both a
-- fresh install and that pre-existing partial table.
create table if not exists public.admitad_feed_cursor (
  singleton boolean primary key default true,
  -- "offset" is quoted: OFFSET is a reserved word and an unquoted identifier
  -- here is a syntax error.
  "offset" integer not null default 0 check ("offset" >= 0),
  updated_at timestamptz not null default now(),
  constraint admitad_feed_cursor_single_row check (singleton)
);

-- Reconcile a pre-existing table that lacks the columns the app expects.
alter table public.admitad_feed_cursor add column if not exists "offset" integer not null default 0;
alter table public.admitad_feed_cursor add column if not exists updated_at timestamptz not null default now();

-- The application upserts with `onConflict: "singleton"`, which requires a
-- unique index on that column regardless of how the table was created.
create unique index if not exists admitad_feed_cursor_singleton_key
  on public.admitad_feed_cursor (singleton);

-- Seed the singleton row so `maybeSingle()` always has a row to read
-- (no reliance on a pre-existing unique constraint).
insert into public.admitad_feed_cursor (singleton, "offset")
select true, 0
where not exists (select 1 from public.admitad_feed_cursor);

alter table public.admitad_feed_cursor enable row level security;

-- Service-role only (the cron writes via the service client). No anon policy:
-- this is internal ingestion state, never read by the public site.
