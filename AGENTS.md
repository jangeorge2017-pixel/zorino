<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verify before you build

- Run `npm run lint`, then `npm run typecheck`, then `npm run build` (mirrors `.github/workflows/ci-cd.yml`). No test suite exists for the app — don't invent a test command.
- ESLint is warning-only for `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `react-hooks/*`, and `@next/next/no-img-element` (see `eslint.config.mjs`). Passing lint with warnings is expected; don't "fix" them by default. `scripts/**`, `.next/**`, `next-env.d.ts` are globally ignored.

## Don't trust README.md

It describes Next.js 15 / NextAuth / local Postgres+Redis and `middleware.ts` — all stale. The repo is Next.js **16.2.9**, uses **Supabase** for storage, a **custom auth system**, and has no `middleware.ts`.

## Next.js 16 specifics

- `middleware.ts` is deprecated → this app uses `proxy.ts` (root) for i18n routing, geo-detection, and AR auto-redirect. Don't create a `middleware.ts`.
- i18n is next-intl (`i18n/` + `messages/{en,ar}.json`), configured in `next.config.ts` via `./i18n/request.ts`. Locales: `en` (default) and `ar`. URL is the source of truth (`localeDetection: false`).
- `next/image` remote host allowlist lives in `lib/images/product-image.ts` (imported into `next.config.ts`), NOT in the config file. Add new product image hosts there.
- Turbopack root is pinned to this dir in `next.config.ts` to avoid nested-lockfile resolution.

## Product provider architecture

### Provider registry
All providers are defined in `lib/integration/constants.ts` (`PRODUCTION_PROVIDER_IDS`). The search connector registry is in `lib/search/connectors/registry.ts` (`ALL_CONNECTORS`). These are the single sources of truth — adding a provider to both registers it for Homepage and Search automatically.

### Active providers (production — credentials on Vercel)
| Provider | Connector file | Status |
|---|---|---|
| AliExpress | `lib/search/connectors/aliexpress.ts` | Live API — app key/secret/tracking ID |
| eBay | `lib/search/connectors/ebay.ts` | Live Browse API — OAuth + ePN campaign |
| Admitad | `lib/search/connectors/admitad.ts` | Live XML feed — `ADMITAD_FEED_URL` env var |
| CJdropshipping | `lib/search/connectors/cjdropshipping.ts` | Live REST API — `CJDROPSHIPPING_API_KEY` env var |

### Stub providers (no production credentials — return [] until configured)
| Provider | Required env vars |
|---|---|
| Amazon | `AMAZON_CREATORS_CLIENT_ID` + `AMAZON_CREATORS_CLIENT_SECRET` |
| Walmart | `WALMART_API_KEY` |
| Temu | `TEMU_API_KEY` |
| Best Buy | `BESTBUY_API_KEY` |
| Noon | `NOON_API_KEY` |
| Jumia | `JUMIA_API_KEY` + `JUMIA_AFFILIATE_ID` |

Stub connectors use `isAvailable()` → returns false when env vars missing → skipped by the engine automatically. When credentials are added to Vercel, they activate on next deploy with zero code changes.

### Credential resolution order
1. Vercel Production Environment Variables (authoritative)
2. `integration_settings` Supabase table via `hydrateIntegrationCredentials()` (loaded per-request)
3. `.env.local` (local dev only)

## Unified product aggregation pipeline

### Search (`/search` page)
```
User query
  → searchProducts() [lib/search/engine.ts]
    → fetchProvidersInParallel()
      → getActiveSearchConnectors() — all registered connectors, isAvailable() checked
      → each connector.search(query) — returns RawProviderListing[]
    → assembleProductionSearchResults() [lib/search/production-pipeline.ts]
      → per-provider ranking → cross-provider dedup → marketplace balance
    → supplementary DB results from getSearchResultsFromDatabase()
      → interleaved with live results for broader coverage
  → SearchResultItem[] → SearchPageClient
```

### Homepage (homepage sections, deals, trending)
```
getCatalogItems() [lib/integration/catalog-service.ts]
  → loadMergedCatalogItems() — cached 5 min
    → Promise.all([
        fetchCatalogFromSearchEngine() — 8 curated queries through same search engine,
        getCatalogItemsFromDatabase() — Supabase lowest_prices_today (Admitad products),
        getIngestedCatalogItems() — affiliate URL ingestion pipeline,
        fetchAdmitadFeedProducts() — raw Admitad XML feed
      ])
    → deduplication across all sources
    → balanceFlatMarketplaceList() — fair round-robin across all present providers
  → NormalizedCatalogItem[]
```

### Shared components
- **Search engine** (`lib/search/engine.ts`): Single entry point for both Search and Homepage fan-out. All connectors searched in parallel.
- **Marketplace balancer** (`lib/search/marketplace-balance.ts`): `balanceFlatMarketplaceList()` and `balanceMarketplaceQueues()` — equal-opportunity round-robin, max 2 consecutive from one provider, new providers auto-participate.
- **Provider config** (`lib/integration/provider-config.ts`): `isProductionProviderConfigured()` — single source of truth for which providers are live.
- **Normalization** (`lib/search/normalization.ts`): `normalizeAliExpressRaw()`, `normalizeEbayRaw()`, `normalizeCJRaw()`, `normalizeAdmitadRaw()` — each provider has its own normalizer producing `RawProviderListing`.
- **Production pipeline** (`lib/search/production-pipeline.ts`): `assembleProductionSearchResults()` — ranking, deduplication, marketplace balancing for search results.

## Env & ops

- `.env.local` is required for local dev. Secrets: `SUPABASE_SERVICE_ROLE_KEY` is server-only; never log it.
- Production cron routes (`app/api/cron/*`) require `Authorization: Bearer CRON_SECRET` via `lib/security/cron-auth`. A single bundled `/api/cron/refresh` runs everything (Vercel Hobby 2-cron limit).
- Deploy: `npx vercel --prod --yes` (main branch auto-deploys via Vercel Git integration).
- `scripts/*.mjs` are one-off diagnostic/verify/generation tools run directly via `node scripts/<file>.mjs`. Many need live credentials and may hit external APIs — inspect before running, don't rely on them in the app.

## Supabase

- Schema lives in `supabase/migrations/*.sql` (apply with `npm run db:push`). Never seed/modify the DB schema outside migrations.
- DB stats (as of last audit): ~120K products in `lowest_prices_today`, all from Admitad, all `country_code = "US"`, `currency = "USD"`.
- `integration_settings` table is empty — all provider credentials come from Vercel env vars.

## Styling notes

- Homepage/hero logic lives in `lib/zorino-home/` and `components/zorino-home/`. Recent work heavily targets mobile-portrait and tablet hero UI — keep EN/AR geometry consistent.
- Several root-level CSS overrides are stacked in `app/` (`zorino-fixes.css`, `zorino-home.css`, `site-final-polish.css`, `design-system.css`, `badge-amber.css`). Check before adding a new one; the current fix lives in the last one.

---

# AGENT RULES: Product aggregation & provider integration

These rules apply whenever working on product data, providers, search, homepage products, or integration code.

## Core principle
Homepage and Search must consume the SAME unified live-product pipeline. No provider-specific hardcoded product lists. No provider-specific homepage code.

## Real data only
- Every product must come from a real provider API, feed, or connector.
- Never inject mock products, demo products, fake prices, fake ratings, fake images, or fake statistics.
- Never hardcode product names, counts, or statistics in UI components.
- The `lib/mock/` directory exists for local dev fallback only — never import from it in production pipeline code.

## Provider identity preservation
Each product must retain its original provider identity:
- Real provider/store name
- Real product name
- Real price and original price (when available)
- Real rating/reviews (when available)
- Real product image from the provider
- Valid product/affiliate URL

## Adding a new provider
1. Add the provider ID to `PRODUCTION_PROVIDER_IDS` in `lib/integration/constants.ts`.
2. Create a search connector in `lib/search/connectors/` implementing `SearchConnector` interface.
3. Register it in `lib/search/connectors/registry.ts` (`ALL_CONNECTORS`).
4. Add `normalize<Provider>Raw()` in `lib/search/normalization.ts`.
5. Add `is<Provider>Configured()` in `lib/integration/provider-config.ts`.
6. Add the provider to `STORE_META` in `lib/integration/provider-context.ts`.
7. Add remote image patterns to `lib/images/product-image.ts` if needed.
8. **No changes needed to Homepage or Search pages** — the unified pipeline auto-discovers active providers.

## Never remove or disable a working provider
When adding or fixing one provider, never remove, disable, or weaken another provider's integration. All active providers must continue contributing products.

## Fair distribution
- `balanceFlatMarketplaceList()` ensures equal-opportunity round-robin across all present providers.
- Max 2 consecutive picks from one provider while peers have stock.
- New providers participate automatically when they return results.
- Do not add provider-specific weighting or quota logic outside the balancer.

## Verification requirements
Before claiming any provider integration or pipeline change is complete:

### Code verification
1. `npm run lint` — passes (warnings acceptable per eslint.config.mjs)
2. `npm run typecheck` — passes with no errors
3. `npm run build` — succeeds

### Connector verification
For each active provider, verify the connector returns real products:
- Run a search query and confirm the provider appears in results
- Verify each result has: real name, real price, real image, real provider identity, valid URL

### Live production verification
After deploy, use Playwright or equivalent to verify:
- Homepage shows products from multiple providers (not just one)
- Each product card shows correct provider name, price, image
- Search returns results from multiple providers for the same query
- Provider identity is preserved in search results
- Affiliate/product redirect URLs work

### What does NOT count as verification
- Source code inspection alone
- Connector unit tests alone
- API response inspection alone
- Static product count references
- Mock data appearing as real data

## Deployment workflow
When code changes are requested:
1. Make the changes
2. `npm run lint && npm run typecheck && npm run build`
3. `git add . && git commit -m "<description>" && git push`
4. `npx vercel --prod --yes` (or verify auto-deploy from main)
5. Wait for deployment to complete
6. Verify live production with Playwright on both Homepage and Search
7. Report actual live verification results — never claim success without it
