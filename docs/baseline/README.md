# ZORINO — Phase 0 Baseline Freeze

This directory captures the re-architecture **Phase 0 baseline**: the current architecture, UI/UX, and API contracts frozen before any redesign work begins. It is the reference against which future re-architecture parity is measured.

- Generated: 2026-09-07 (local, read-only)
- Reference git commit: `dbf1920` (branch `main`)
- Rule: the current production ZORINO (`zorino.org`) must remain visually/functionally unchanged until parity + acceptance + Playwright gates pass and production deployment is explicitly approved. See A00 re-architecture rule in `AGENTS.md` (phases pending).

## Contents
1. `architecture-freeze.md` — current architecture, pipelines, provider registry, types, DB schema snapshot.
2. `ui-snapshot.md` — routes, components, data contracts, and screenshot index (`ui/`).
3. `api-contracts.md` — server/API + cron route contracts.
4. `ui/` — production screenshots (read-only captures).

## Verification status at freeze
- `npm run lint` — 0 errors, 95 warnings (warning-only debt; acceptable per `eslint.config.mjs`)
- `npm run typecheck` — pass
- `npm test` (vitest 3.2.7) — 194 tests / 7 files, all pass
- `npm run build` — pass
- Production (`zorino.org`) untouched; no Vercel/GitHub changes.