# ZORINO — API & Route Contracts (Phase 0 baseline)

## 1. Cron routes (all `Authorization: Bearer CRON_SECRET`, via `lib/security/cron-auth`)

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/refresh` | 0 6 * * * (vercel.json) | Bundled maintenance: sync, trending, lowest-prices, aggregates, notifications; heartbeat to `cron_job_runs` |
| `/api/cron/sync` | 0 18 * * * (vercel.json) | Heavy provider imports (`runDueSyncJobs` + stale-sync watchdog; `?force=1`) |
| `/api/cron/trending` | — | Trending ranks recompute |
| `/api/cron/lowest-prices` | — | `computeLowestPricesToday` (per country US/GB/AE/SA/DE) |
| `/api/cron/notifications` | — | Notification dispatch |
| `/api/cron/import-phase1` | — | AliExpress/eBay/CJ import bootstrap |

## 2. Public/client routes

| Route | Method | Auth | Purpose / shape |
|---|---|---|---|
| `/api/search/paged` | GET `q,offset,limit` | none | Paged search; JSON `{items, total, offset, limit, hasMore}` |
| `/api/affiliate/go` | GET `dest` (validated) | none (rate-limited, click-tracked, recorded to affiliate_clicks) | Outbound affiliate redirect; rejects non-product destinations |
| `/api/preferences` | GET/POST | cookie (no session) | country/currency/locale round-trip |
| `/api/trending/track` | POST | — | view/click/favorite/purchase events (validated productId + country) |
| `/api/ebay/notifications` | GET/POST | eBay verification token | challenge + account-deletion handling (OAuth/EPN) |

## 3. Health/admin routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/search/health` | GET | cron-secret | per-provider credential booleans + offer counts (live only, `executeGlobalSearch`) |
| `/api/integrations/status` | GET | `x-management-secret` (`MANAGEMENT_SECRET`); `?probe=1` live probe | provider/integration status |
| `/api/admin/import-report` | GET | admin-only | plain-text Phase 1 import report |

## 4. Auth

- `/auth/callback` — OAuth code exchange with `safeRelativeRedirectPath` (custom auth system — no NextAuth).

## 5. Contracts stability note

These contracts are frozen as the Phase 0 UI/API reference. The re-architecture will keep HTTP
surface behavior compatible while replacing internals; any intentional contract change will be
reviewed and approved before landing.