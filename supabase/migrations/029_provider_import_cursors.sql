-- 029_provider_import_cursors.sql
-- Persisted resume cursors for chunked provider ingestion (AliExpress sweep,
-- price-refresh offsets, image-backfill offsets).
--
-- WHY: Vercel Hobby caps serverless functions at 60s and Cloudflare ends
-- long-running cron requests with HTTP 504/524. Provider imports previously
-- fetched the WHOLE sweep and wrote EVERY row in a single invocation, so heavy
-- stores (AliExpress) blew the window and returned nothing usable.
--
-- FIX: ingestion now processes products in small micro-batches (~20 items per
-- fetch under 15s) and records, at the end of each fast cycle, where in the
-- sweep it stopped (keyword index, page, and/or external-id offset). The next
-- cron invocation reads the cursor and resumes exactly where the last one left
-- off — a full sweep completes across many cron runs instead of one wedged one.
--
-- SAFETY: additive, new table only. When the table is absent (not yet applied)
-- the application falls back to a deterministic start state, so the chunked
-- pipeline still works with zero schema dependency. `db:push` applies this.
--
-- SHAPE: one row per (provider, kind). `state` is a small JSON document:
--   { type: "sweep", keywordIndex: 3, page: 1 }        (keyword×page cursor)
--   { type: "ids", offset: 240 }                       (external-id offset)
-- Rows are upserted by the service client; RLS is enabled with no anon policy
-- (internal ingestion state, never read by the public site).

create table if not exists public.provider_import_cursors (
  provider text not null,
  kind text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, kind)
);

alter table public.provider_import_cursors enable row level security;

-- Service-role only (cron writes via the service client). No anon policy.