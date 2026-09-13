-- 025_canonical_identity.sql
-- Phase 3: canonical identity bootstrap persistence.
-- Stores the deterministic mapping from an existing runtime product reference
-- (e.g. a lowest_prices_today row) to the canonical product/offer ids computed
-- by the canonical spine (lib/canonical/identity).
--
-- SAFETY: additive, new table only. NOT applied to production yet; apply with
-- `npm run db:push` against a SAFE NON-PRODUCTION target first (user gate).

create table if not exists public.canonical_identity_map (
  id uuid primary key default gen_random_uuid(),
  source text not null,                             -- e.g. 'lowest_prices_today'
  provider_id text not null,                        -- canonical provider id (e.g. 'admitad')
  external_id text not null,                        -- source-table stable ref (e.g. lowest_prices_today.product_id)
  store_name text,                                  -- merchant/store label, when the source carries one
  country_code text,
  currency text,
  canonical_product_id text not null,               -- deterministic, from lib/canonical/pipeline
  canonical_offer_id text not null,                 -- deterministic, provider-scoped
  confidence text not null default 'weak'           -- exact | strong | suggested | weak
    check (confidence in ('exact', 'strong', 'suggested', 'weak')),
  identifiers jsonb not null default '[]'::jsonb,   -- field-level identifiers actually present in the source
  title_key text,                                   -- normalized title used for clustering
  title text,
  created_at timestamptz not null default now(),
  unique (source, provider_id, external_id)
);

create index if not exists canonical_identity_map_product_idx
  on public.canonical_identity_map (canonical_product_id);
create index if not exists canonical_identity_map_offer_idx
  on public.canonical_identity_map (canonical_offer_id);

alter table public.canonical_identity_map enable row level security;

-- Public read (product pages may look up identity), service-role writes only.
create policy "canonical_identity_map_public_read"
  on public.canonical_identity_map
  for select using (true);