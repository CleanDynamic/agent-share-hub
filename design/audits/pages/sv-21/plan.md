# SV-21 · OpenBuilds requests: runs, claims, sessions and parts · plan

Branch `sv-21-requests-a`, from `origin/main` at a97cd1e (SV-20 merged, its migration applied).

## Assumptions (checked on disk at a97cd1e)

- **A run is a `build_reproductions` row** (`id`, `build_id`, `user_id`, `confirmed_at`, `model_used`, `worked`, `note`), unique per (build, person). The database refuses a maker's own reproduction, so every `worked = false` run is someone else's, which fits "the maker sees it".
- **`gap_problem` is a key in a gap node's payload** (`GAP_PROBLEM_KEY`, `gaps.ts`), not a column. A run is about the build, not a node, so its request is a Whole build request (`gap_node_id` null, legal in the schema, drawn by SV-14). That request has nowhere to keep words: the board's whole-build title is a stand-in (`openBuildsModel.ts`). **Premise false: `bounties` has no column for a run or for a problem.** The migration adds `bounties.problem text` and `bounties.from_run_id uuid references build_reproductions(id) on delete set null`. The code works before it is applied (the missing-column pattern of SV-16's `contributors.ts`).
- `createBountyForGap` already reads the build's maker as author and the insert policy admits only the maker or an admin, so "only the maker" is held by the database. The new input is `{ problem, fromRunId }`.
- **Home's feed row (`repro_note`) carries the build, the reproducer's handle and `worked`, not the run's id.** The run is found when the maker presses the button, by build and handle. The build page's runs list does not exist until SV-25, so Part 1 ships the writer, the button component and Home's line; SV-25 places the button.
- **No claims table or code exists** (`request_claims`, `claim` search: nothing in `src/lib`, `supabase/migrations`). `OpenBuildsView` already draws `yourClaims` (`SideListProps`) and `OpenBuildsPage` does not pass it.
- **`sessions_meta[key].open` and `workstreams[key].open` do not exist.** `SessionMeta` and `Workstream` (`making.ts`) have no `open`. `setSessionMeta` is SV-07's single-path writer for sessions. Parts have no matching writer: `workstreams` is written through `patchMaking`. Both go through the `making` step in `making.ts`; no Supabase call is added to a component.
- `addSession` copies prompt text, model and source only (`TILE` rows, no events), and `AddTarget` takes an existing build and a part. "Offer a session" reuses it into the contributor's fork.
- OpenBuilds' tabs `sessions` and `parts` exist in `OPEN_BUILDS_TABS`; `LIVE_TABS` is `all`, `steps`. `RequestSize` is `all | step`.
- Fork build id: forks are builds with a source; `rebuild.ts` creates them. Claims record the fork once it exists.
- No migration is applied from here.

## Plan

- Part 1: `openRequestFromRun` and `findFailedRun` in `src/lib/bounty/runRequests.ts`; `OpenRequestFromRun` button; Home's failed line, maker only -> verified by: `runRequests.test.ts`, the button and Home view tests.
- Part 2: migration `20261101120000_sv21_requests.sql` (`request_claims`, the two `bounties` columns, policies, the active-claim index with its `EXPLAIN`); `src/lib/bounty/claims.ts` (claim, release, list); OpenBuilds facts and Your claims wired -> verified by: `claims.test.ts`, `OpenBuildsPage.test.tsx`.
- Part 3: `open` on `SessionMeta` and `Workstream`; Open as a request in the tile menu and an "Ask for the next session" ghost row through `motion.expect`; Offer a session and accept; OpenBuilds Sessions and Parts tabs live -> verified by: `making` tests, `BuildList` tests, `openBuilds.test.ts`.
