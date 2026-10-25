# SV-25 · Build page: the connections

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-24, before SV-26. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-25-build-page`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-25 build page connections` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-24 merged. **The file on disk wins.**

## Intent

The build page is where most connections land. It has no vision board: it keeps its look. Each addition uses the existing quiet controls (the part comment marker, the engagement row, the facts strip).

## Rules for this prompt

- **One round more at most.** The build page's counts ("Used in", "In collections", the contributors) come with its first request or in one request alongside it. `npm run audit:pages` keeps the build page's target.
- **Counts:** "In n collections" is estimated where the table is large.
- **Links** go through `PageLink`.
- **Motion:** Save changes its glyph at once, as Like and Save do.

---

## Part 0 · Read and plan

Read `src/pages/site/build/BuildPage.tsx`, `src/components/build/*`, `PartCommentMarker.tsx`, `EngagementRow.tsx`, `Plaque.tsx`, SV-16's byline, SV-17's `saveItem`, and SV-21's request from a run. Write `Assumptions` and `Plan`.

Commit: `SV-25 P0: plan`.

## Part 1 · Save at every size

Each part, session and tile gets Save beside "Comment on this part", using `saveItem` (SV-17). Saved state shows as the filled glyph, as Like and Save do.

Commit: `SV-25 P1: save parts, sessions and tiles`.

## Part 2 · Counts that point back

1. A tile shows "Used in n builds" when n > 0 (tiles whose `source_ref` points at it, SV-17's index). Public.
2. The facts strip shows "In n collections" (public collections only).

Commit: `SV-25 P2: used in and in collections`.

## Part 3 · Links out

1. Each classification value is a link to Builds filtered by it.
2. The runs list: on a failed run, the maker sees "Open a request from this run" (SV-21 Part 1).
3. The byline shows contributors (SV-16).

Commit: `SV-25 P3: links out of the build page`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration.
