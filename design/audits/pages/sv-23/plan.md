# SV-23 · Builds data: stored counts, proof filters, runs per week: assumptions and plan

Branch: `claude/admiring-feynman-rdkgge` (the session's branch; the prompt names `sv-23-builds-data-a`), from `origin/main` at 11f7a9f.

## Assumptions (checked on disk)

- `builds.session_count` exists (`20261001280000_sessions_and_making.sql`, `NOT NULL DEFAULT 0`, `CHECK >= 0`). Its ONE writer today is
  `refreshMakingStats` (`making.ts`), which writes `sessions.length` of `listBuildSessions`: the IMPORTED sessions only. The composer shows
  `shownGroups(sessionGroups(...)).length` (`SandboxPage`, `sessionCount`), which also counts sessions made here (`typed-*`) and the ones the order
  holds. The two differ for a build with a typed session. To make the stored number the one the composer shows, the composer's counts write
  becomes the single writer and `refreshMakingStats` stops writing `session_count`.
- `step_count`, `part_count`, `agent_count` do not exist on `builds` (`part_count` and `step_count` in `imports.ts` and the MCP server are
  response fields counted from `build_nodes` and `build_events`, not columns). They are added, nullable: null means "not written yet", which is how
  the report counts builds with none.
- Definitions (the composer's): steps = `buildSteps(tree).length` (top-level steps); parts = the build's stored workstreams
  (`storedWorkstreamsOf(making)`, "Add a part"); agents = steps of kind `agent` anywhere in the tree (`flatten(steps)`, teams not counted);
  sessions = `shownGroups(groups).length`.
- Facets are written by `useClassificationCard`: 1.5 s (`DERIVED_WRITE_MS`) after the derived values change, through `writeClassification` →
  `updateBuild` (queued by `serial` when the build is watched). The counts are written the same way, 1.5 s after they stop changing, in the same chain.
- Builds list: `listBuildsTable` (gallery.ts), one request; `BuildsPage` starts the list, stats, lens counts and both facet reads together
  (`audit:pages` Builds `maxRounds: 1`). New reads come in the list's own select, or beside it in that round.
- `builds.reproduction_count`, `rebuild_count`, `like_count` (kept by trigger), `last_confirmed_at`, `last_confirmed_model` exist.
  `build_reproductions` has `build_id, user_id, confirmed_at, model_used, worked` (one row per person per build). A "run" is one of its rows.
- `model_key(text)` exists (SV-22 `20261102130000_sv22_model_checks.sql`) and is the registry's own comparison (`modelKey`, not exported yet).
- The views already draw `RangeSection`, `ClosedSection`, `WordSection` and the Steps/Sessions/Runs columns (`BuildsTableView`); `buildsModel.ts`
  withholds them (`LIVE_COLUMNS`, `steps: null`, `runs: []`).

## Plan

- Part 1: migration `20261103120000_sv23_stored_counts.sql` (3 columns, `session_count` if missing, partial indexes for Steps and Sessions, `builds_count_spread()`);
  `buildCounts.ts` (pure counts from steps and groups) + `useStoredBuildCounts` (written with the facets); `refreshMakingStats` stops writing `session_count`;
  Steps and Sessions columns, range filters and the median-steps footer go live; the list degrades to the old select until the migration is applied
  -> verified by: `buildCounts.test.ts`, `useStoredBuildCounts.test.tsx`, `buildsTable.test.ts` (ranges, missing column), `buildsModel` tests, `making.test.ts`.
- Part 2: migration `20261103130000_sv23_proof_filters.sql` (indexes for the ranges, `builds.worked_models` kept by trigger, `works_on_model_counts()`, `builds_count_spread()` widened);
  filters: Reproductions range, Rebuilds, Likes, Last confirmed (within n days), Confirmed or stale, Works on model; Runs, 12 weeks as an embed of the list's own select
  (runs of the last 84 days per build, bucketed by week on the client: no second request) -> verified by: `buildsTable.test.ts`, model tests, `BuildsPage.test.tsx`.
- Part 2.4: `npm run audit:pages`: Builds stays at one round.
