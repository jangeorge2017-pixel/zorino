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

## Data flow

- Catalog is **Supabase-first with mock fallback**. Without `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (copy `.env.example`), the app uses mock data (`data/products.ts`, `lib/mock`, `lib/data/*`) — this is expected, not a bug.
- Only **AliExpress** (and partially **eBay**) are live product providers. Providers are layered: `lib/data-layer/` (provider-agnostic access) → `lib/sync/providers/` (live HTTP clients) → `lib/integration/` (catalog-service normalizing offers for homepage/deals).
- Supabase schema lives in `supabase/migrations/*.sql` (apply with `npm run db:push`). Never seed/modify the DB schema outside migrations.

## Env & ops

- `.env.local` is required. Secrets: `SUPABASE_SERVICE_ROLE_KEY` is server-only; never log it. Data-layer code strips placeholder values.
- Production cron routes (`app/api/cron/*`) require `Authorization: Bearer CRON_SECRET` via `lib/security/cron-auth`. A single bundled `/api/cron/refresh` runs everything (Vercel Hobby 2-cron limit).
- `scripts/*.mjs` are one-off diagnostic/verify/generation tools run directly via `node scripts/<file>.mjs`. Many need live credentials and may hit external APIs — inspect before running, don't rely on them in the app.

## Styling notes

- Homepage/hero logic lives in `lib/zorino-home/` and `components/zorino-home/`. Recent work heavily targets mobile-portrait and tablet hero UI — keep EN/AR geometry consistent.
- Several root-level CSS overrides are stacked in `app/` (`zorino-fixes.css`, `zorino-home.css`, `site-final-polish.css`, `design-system.css`, `badge-amber.css`). Check before adding a new one; the current fix lives in the last one.
