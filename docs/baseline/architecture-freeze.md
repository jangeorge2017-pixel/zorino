# ZORINO — Architecture Freeze (Phase 0 baseline)

Snapshot of the running architecture as of `dbf1920` (2026-09-07). This is a snapshot for reference — **not** the target design. The approved re-architecture (Phase 1+) will replace/evolve this.

## 1. System layers (current)

```
CONSUMPTION (UI)      app/[locale]/ page · search · product/[id] · compare · stores
                      components/zorino-home/* , SearchPageClient, PriceComparisonTable,
                      ComparePageClient, ListingProductCard, StoresPageClient, ...
DATA LAYER            THREE parallel product models (never converge):
                        A. lib/search  : RawProviderListing → NormalizedSearchListing
                                         → UnifiedSearchProduct → SearchResultItem
                        B. lib/integration: NormalizedCatalogItem (with ProviderOffer[])
                        C. lib/providers/schema : CanonicalListing (Zod) — defined, NOT
                                         used by the live path
ACQUISITION           lib/search/connectors/* (aliexpress, ebay, amazon, amazon-eg,
                      cjdropshipping, admitad, stubs x5) + sync-bridge stubs
SYNC / DB             services/sync · lib/sync/{scheduler,engine,import,normalizer,dedupe}
                      cron routes write external_products → products/prices/last.
OSS Supabase          products · prices · stores · product_identifiers · product_sources ·
                      product_variants · external_products · integration_settings ·
                      lowest_prices_today · engagement · trending · affiliate_*
LEGACY (parallel)     lib/data-layer/providers/* incl. jarir/extra/btech/raya/
                      live/stub · lib/database/schema.ts · lib/types/entities.ts
```

## 2. Provider registry (single source: `lib/providers/registry.ts`)

| id | name | status | integrationType |
|---|---|---|---|
| aliexpress | AliExpress | active | (sync-compatible) |
| ebay | eBay | active | |
| cjdropshipping | CJdropshipping | active | |
| admitad | Admitad | active | |
| amazon | Amazon | configured | |
| amazon-eg | Amazon Egypt | configured | |
| walmart/bestbuy/temu/noon/jumia | ... | stub | placeholder only |

Derived lists: `PROVIDER_IDS`, `LIVE_PROVIDER_IDS`, `STUB_PROVIDER_IDS`, `SEARCH_PROVIDER_IDS`,
`PRODUCTION_PROVIDER_IDS` (constants re-export), `COMPARISON_STORES`, `REAL_CATALOG_PROVIDERS`.
Aliases: `alibaba→admitad`, `amazon-egypt→amazon-eg`, etc. Display/store metadata:
`PROVIDER_STORE_META`. NOTE: several UI components still hardcode display names outside the
registry (baseline debt to be removed during re-architecture).

## 3. Search flow (current)

`searchProducts()` (lib/search/engine.ts)
→ hydrate credentials (`integration_settings` + env) → parallel adapter fan-out
   (8 s per-provider timeout, failures non-fatal) + DB supplement
   (`lowest_prices_today` word-OR ILIKE, filtered to active providers)
→ `assembleProductionSearchResults()`: per-provider ranking → device primary/secondary
   queues → `balanceMarketplaceQueues` (equal-opportunity round-robin, max 2 consecutive)
→ DB/live de-dup (id + 30-char title prefix) → 1:1 interleave
→ 2 min in-memory cache (`prod-v17-marketplace-balance:<q>:<limit>`)
Consumers: /search page (server first page + /api/search/paged "Load more").

## 4. Catalog/homepage flow (current)

`getCatalogItems()` → cached 5 min → 4 sources:
A. curated queries through the same search engine,
B. `lowest_prices_today` (per-merchant scan, 40/merchant, US/USD),
C. affiliate URL ingestion pipeline (`lib/integration/affiliate-ingestion.ts`),
D. Admitad XML feed (`fetchAdmitadFeedProducts`).
Merge → dedup → `balanceFlatMarketplaceList`. Auto-ingest runs via `after()` on render.

## 5. Compare flow (current)

`/compare` page → hardcoded `COMPARE_QUERIES` → `searchProducts(q, 4)` → `enrichCompareResults`
(title similarity ≥ 0.55, price ratio bound 0.33–3, max 4 extra offers, one offer per store
slug) → `PriceComparisonTable`. PDP compare: `mergeCanonicalExternalOffersIntoComparison`
(reads `external_prices` + `prices` for `db-` ids). Matchers are NOT shared: search matching
(`matching.ts`), catalog match (>=0.52), DB persist (`findUniversalDuplicateProduct`).

## 6. PDP flow (current)

`app/[locale]/product/[id]` → `marketplace-product-detail.ts`: parse id (longest-prefix provider
match, `db-<uuid>` separately) → per-provider live adapters → DB fallback (`getDatabaseProductDetail`)
→ outbound affiliate redirect (`/api/affiliate/go` validated, click-tracked) when no internal page.

## 7. Product/offer types (the 3-model sprawl)

- `RawProviderListing` (lib/search/types.ts): providerId, externalId, title, imageUrl, price,
  originalPrice, discount, currency, storeName, category, rating, reviewCount, salesCount?,
  shipping?, inStock, productUrl, affiliateUrl?, countryCode?
- `NormalizedSearchListing` = RawProviderListing + id, storeSlug(=providerId), relevanceScore, matchTier, isDevice
- `UnifiedSearchProduct`: canonicalId "zorino-<titleHash>", lowest price + offers[]
- `SearchResultItem` (lib/data/homepage.ts): UI card shape (store, storeSlug, affiliateUrl, ...)
- `NormalizedCatalogItem` + `ProviderOffer` (lib/integration/catalog-types.ts): homepage/catalog shape
- `CanonicalListing` + `CompareOffer` + `CompareProductResult` (lib/providers/schema.ts): Zod-validated,
  defined but not wired into the live path
- DB legacy types (lib/types/entities.ts Product etc.) — largely parallel/unused by live path

## 8. Database schema snapshot (Supabase, 23 migrations)

- `products`: hub; `slug UNIQUE`, `search_vector tsvector + GIN`, aggregates lowest/highest_price,
  offer_count, savings_percent; **no provider column**; `sync_status`.
- `product_identifiers`: `UNIQUE(identifier_type, identifier_value)` — gtin/upc/ean/mpn/asin/sku/model.
- `product_sources`: `UNIQUE(store_id, external_product_id, country_code, currency)`.
- `product_variants`: `UNIQUE(product_id, store_id, external_id)`.
- `external_products`/`external_prices`: staging, `UNIQUE(provider, store_id, external_id, country_code, currency)`, `sync_hash`.
- `prices`: `UNIQUE(product_id, store_id, country_code, currency)`, `is_current`.
- `lowest_prices_today`: **denormalized read model** — product_name, image_url, lowest_price,
  original_price, discount_percent, store_name, provider, affiliate_url, external_url;
  `UNIQUE(product_id, country_code, currency)`; US/USD.
- `integration_settings`: key/value; RLS service-role only; loaded by `hydrateIntegrationCredentials`.
- `sync_jobs/sync_runs/cron_job_runs/affiliate_*/trending_*/engagement_*`: support tables.
- RLS: mostly public-read; writes service-role. `search_products_indexed` RPC exists (FTS) — unused by search page.

## 9. Direct vs Indirect acquisition (current reality, not modeled)

- DIRECT (API): AliExpress OpenAPI, eBay Browse (+ePN), CJdropshipping REST, Amazon Creators/PA-API + Oxylabs.
- INDIRECT (links/feeds): Admitad XML offers (affiliate link-based), affiliate URL ingestion (Amazon/Alibaba slugs),
  Amazon seed links, outbound affiliate redirect for Amazon US/EG.
- These two modes are NOT first-class today (Admitad is special-cased in ~4 places).

## 10. Resilience & observability (current)

- Per-provider 8 s timeout; non-fatal failures; health registry in-memory (`provider-health.ts`,
  30 min TTL, 3 consecutive failures → not live); evidence counts cached 10 min (`provider-evidence.ts`).
- Health endpoints: `/api/search/health` (cron-protected, live-only), `/api/integrations/status` (mgmt secret).
- No persisted per-provider health table; no circuit breaker/backoff; no rate-limit/error telemetry;
  no validation-rejection counters.

## 11. Data authenticity rules (current enforcement points)

- No mocked products in production paths; `lib/mock/*` is dev-only, never imported by production code.
- Seed products/coupons deactivated (migrations 007/009/023); placeholder-image rows filtered at read.
- Ratings/reviews never fabricated; Admitad items write rating 0 / reviewCount 0.
- Affiliate/product URL destination validation at ingestion and redirect (`lib/affiliate/product-url.ts`).

## 12. Known lifecycle controls (current)

- Cron (vercel.json): `/api/cron/refresh 0 6 * * *`, `/api/cron/sync 0 18 * * *`, `maxDuration 60`.
- CI (`.github/workflows/ci-cd.yml`): lint + typecheck + `npm test` + build on push/PR to main/dvelop.
- Deployment: Vercel Git integration on `jorino` → project `zorino` (main) → `zorino.org`. See the
  consolidation audit for project inventory (zorino_backup detached earlier; legacy projects untouched).