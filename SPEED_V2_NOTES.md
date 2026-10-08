# StudyOS Speed v2 — Performance patch

This version extends the previous optimized StudyOS MVP without changing your Supabase schema or RLS policies.

## What changed

- Configures Vercel Node Functions to run in **Singapore (`sin1`)** instead of the default US-East (`iad1`) with `vercel.json`. **Verify that your Supabase project is also in Singapore** under Supabase Project Settings before deploying. If your DB is in another region, change the code in `vercel.json` to the Vercel region closest to it.
- Stops `<Link>` from automatically prefetching server-rendered/authenticated route payloads for every sidebar entry. Navigation still uses History API and preserves the workspace state.
- Preloads feature JavaScript modules during browser idle time and on navigation hover/focus/touch to avoid first-use chunk downloads as much as possible.
- The top-level Workspace timer now updates only when the local calendar day changes, not every 30 seconds; Study Focus still has its own live timer.
- Introduces indexed analytics in `src/lib/analytics-fast.ts`. Calendar and trend charts now precompute per-day totals and habit completion, instead of scanning every record for each displayed date. The algorithm splits intervals at timezone-adjusted local midnight, including DST transitions.
- Memoizes Stats, Trends, and History so irrelevant parent re-renders do not re-run chart calculations.
- API GET includes `Server-Timing: auth;dur=..., data;dur=...` and `X-StudyOS-Version: speed-v2` headers to diagnose authenticated API latency.
- Footer displays `Speed v2` to confirm Vercel actually deployed this version.

## Deploy

1. Push the new source to the GitHub repository linked to Vercel.
2. Redeploy from the main branch, ensuring Root Directory is the directory containing `package.json` and `vercel.json`.
3. In Vercel Project > Settings > Functions, check the **effective Function Region**. For a Singapore-hosted Supabase project this should be `sin1`, not `iad1`.
4. Open StudyOS and confirm the footer contains `Speed v2`.
5. Open Chrome DevTools > Network > Fetch/XHR. Refresh once and select `/api/data`: in Response Headers verify `X-StudyOS-Version: speed-v2`, `Server-Timing` and note Request Timing. Compare before/after.
6. Switch between modules several times; there should NOT be a `/api/data` request for each click.

## Known limits and debugging

- First load after a hard refresh still needs authentication and a genuine Supabase API query. No personal data is stored in shared/static caches.
- First chart load still needs Recharts JavaScript; subsequent visits in the same browser session reuse loaded modules.
- Database and network latency cannot be measured without a real authenticated test account.
- Do not judge performance from `next build` alone; inspect the Browser Network/Performance panels and the server timing headers.
- A passing code transpilation test is NOT equivalent to a passing full `pnpm build`.

## Tests

- `pnpm test`: includes `tests/analytics-fast.test.ts` covering midnight splitting, DST, completion indexing and empty input.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` on a machine with installed dependencies.
- Smoke test: create a habit and study session, refresh, navigate between tabs, confirm data and timer state. For privacy, test RLS with two separate accounts.
