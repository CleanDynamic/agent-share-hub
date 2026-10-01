# UI-P21 — Data: the home signals

Follow `design/RULES.md`. This prompt makes **one commit per function** (UI-P21a, b, c); that overrides the one-commit rule for this prompt only.

**Goal.** Three counts the Home page (and the Gallery stats) need, which no function returns today. Mockup numbers ("702 builds lit today", "48 runs", "312 runs reported") are samples; these functions supply the real ones.

**Read first.** `src/lib/build/signals.ts` — the verified home of `recordReproduction`, `freshnessLabel`, `isStale`, `STALE_AFTER_DAYS = 120` and `computeCompleteness`; the new functions go beside them — `src/lib/progress/weekly.ts` (`weekStartUtc`), the Supabase types for `builds` and `build_reproductions`, the RLS policies on both tables in `supabase/migrations/`, and one existing test in `src/lib/build/*.test.ts` for the mocking pattern.

**Build.**
- **a) `countLitToday(): Promise<number>`** — builds whose `last_confirmed_at` (confirm the column name in the types) is within the last 24 hours, rolling. `select('id', { count: 'estimated', head: true })` with the filter.
- **b) `countReproducedToday(now = new Date()): Promise<number>`** — `build_reproductions` rows created since 00:00 UTC of `now`. Same count style.
- **c) `countRunsThisWeek(now = new Date()): Promise<number>`** — `build_reproductions` rows created since `weekStartUtc(now)`.

For each: typed, named, no `select('*')`, returns 0 on an empty result, throws a typed error on failure (match the module's existing error style), and a unit test with the client mocked (filter column, operator and boundary asserted; the UTC boundary tested at 23:59 and 00:01). If RLS does not let a signed-out visitor count these rows, **stop and propose** a `security invoker` SQL function returning only the number (policies written with `(select auth.uid())`), instead of widening a policy.

**Do not.** Add these to any component yet (UI-P27 does). Cache in module state.

**Done when.** Three commits, each green on `npx tsc --noEmit -p tsconfig.app.json` and `npm test`.

**Commit.** `UI-P21a: countLitToday` · `UI-P21b: countReproducedToday` · `UI-P21c: countRunsThisWeek`
