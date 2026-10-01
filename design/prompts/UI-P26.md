# UI-P26 — Data: maker figures, runs of my builds, people this week

Follow `design/RULES.md`. **One commit per function** (UI-P26a, b, c).

**Goal.** The Profile stats row and the Activity right column.

**Read first.** `components/profile/MakerFigures.tsx` and `EarnedNumbers` (the queries they already make — move them, do not duplicate them), `lib/build` `listBuildsByCreator`, the rebuild / fork tables used by `getRebuildTree`, accepted solutions in `lib/bounty`, `build_reproductions`.

**Build.**
- **a) `getMakerFigures(userId): Promise<MakerFigures>`** in `src/lib/profile/figures.ts`: `{ buildsHung, reproducedByOthers, rebuildsOfWork, bountiesSolved, bountyEarningsGbp }` — builds they published; reproductions of those builds by anyone other than them; published rebuilds whose source is one of their builds; bounties where their solution was accepted, and the sum of those rewards. Move the existing queries out of `MakerFigures` / `EarnedNumbers` into this function and make those components call it (their rendering unchanged). Estimated counts where a count is all that is needed.
- **b) `getRunsOfMyBuilds(userId, days = 90, now = new Date()): Promise<{ series: number[]; rebuildLiveIndex: number | null }>`** in `src/lib/build/runs.ts`: daily reproductions of the viewer's builds for `days` UTC days (oldest first; `.limit(5000)` with the same capped-warning pattern as UI-P23), and the day index of the most recent published rebuild of one of their builds inside the window (the chart's dashed marker), or `null`.
- **c) `countPeopleWhoRanMyBuildsThisWeek(userId, now = new Date()): Promise<number>`** in `runs.ts`: distinct reproducers (excluding the viewer) of the viewer's builds since `weekStartUtc(now)`, `.limit(2000)` on the rows fetched to de-duplicate.
Never call or reference `award_xp()` (see HANDOFF §5.7).

**Commit.** `UI-P26a: getMakerFigures` · `UI-P26b: getRunsOfMyBuilds` · `UI-P26c: countPeopleWhoRanMyBuildsThisWeek`
