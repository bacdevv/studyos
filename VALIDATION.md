# Validation — 2026-10-08

## Executed

- `pnpm build`: production build passed, final routes include `/[section]`, `/api/data`, auth callback/reset, login and setup. Temporary visual QA route was removed before the final build.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 24 passed (15 analytics/validation + 9 PostgreSQL integration tests).
- Playwright: 4 passed on desktop and mobile; 2 authenticated lifecycle runs explicitly skipped because no confirmed test-account credentials were supplied.
- Visual QA: dashboard empty state and habit dialog rendered in Chromium; desktop 1440px and mobile 390px inspected; no page JavaScript errors or horizontal document overflow. Mock empty API data was used only in the temporary QA harness, never in application source or Supabase. Screenshots are in `docs/`.
- Supabase REST connectivity: reachable with supplied publishable key; returned `PGRST205` because `public.habits` was absent. No remote database schema, user records, or account settings were modified.

## Database coverage

The exact SQL migration ran in PGlite/PostgreSQL with test-only auth schema/roles. Tests checked owner read/write, cross-user hidden rows, blocked forged owner insert, composite foreign-key isolation, duplicate habit log prevention, idempotent manual save, overlap rejection and transaction rollback, idempotent focus transitions and anonymous access denial.

Focus tests intentionally allow 10ms between start/resume and pause/finish so both intervals have positive duration; zero-duration clicks are safely omitted by the production function.

## Not executed / remaining gates

- Supabase production migration and RLS checks against two real Auth accounts.
- End-to-end signup/email confirmation, password reset email delivery, and authenticated CRUD in the user's Supabase project.
- Docker build/start: Docker engine unavailable here.
- Vercel deployment: no Vercel account integration supplied.
- Course, reading, goal/task, CSV import and account deletion modules are outside this MVP milestone.

## Tooling note

Next.js 16.4.0 and React 19.3.0 were resolved from npm. ESLint 9.39.5 is deliberately retained because the installed Next lint plugins' peer ranges exclude ESLint 10; the package is marked deprecated by npm, but the compatible configuration passes lint. Upgrade ESLint when those plugin peer ranges support it. Runtime production code uses the current Proxy convention, App Router and Supabase SSR helpers.
