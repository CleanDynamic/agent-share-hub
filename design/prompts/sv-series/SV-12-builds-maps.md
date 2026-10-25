# SV-12 · Builds: Maps

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-11, before SV-13. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-12-builds-maps`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-12 Builds: Maps` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-11 merged. **The file on disk wins.**

## Intent

The Maps view shows each filtered build's Map, read only: one box per session, one line wherever a tile in one session uses something from another, part labels. It must match `design/reference/vision/dusk/builds-maps.html`.

## Source

- Board: `design/reference/vision/dusk/builds-maps.html`, picture `design/screens/vision/builds-maps.png`, sample data in `design/reference/vision/source/BuildsMaps.dc.html`.
- Today: `src/lib/build/sessionMap.ts` (`tileLinksOf`, `sessionOfTiles`, `sessionLinksOf`) and the composer's Map, `src/lib/build/graph.ts` (`sessionGroups`), `src/lib/build/sessionLayout.ts`, SV-05's numbering function.

## Layout (exact values are in the board)

- The page head as the board draws it: "Builds" 20/500 with the sentence "Each build's Map: one box per session, one line where a tile in one session uses something from another." in `--text2`, and the view switch. (The board differs from the Table's head here, and the board wins.) Below it a row: a Filters control with the active count, the first four `FilterChip`s and "+ n more", a `Segmented` Horizontal, Vertical, and "n builds · n with a Map".
- 32 below, a grid of three columns, 24 apart (two below 1100px, one below 760px). Each card is a module (padding 16): a 220px well with the dot grid holding the Map, then title 500 and "@maker · n parts · n sessions" on the left, "n reproduced" and the lamp on the right.
- In the Map: part labels in Geist Mono 10, `--label`; session boxes (`--tile`, 1px `--tile-border`, radius 6, padding `4px 7px`, 36 high) with the session name 11/500 and "MODEL · n" in mono 10; lines 1.2px in `--line`.
- A build with one session draws its one box and "One session. A Map needs two."

## Rules for this prompt

- **Vercel rules:** `rendering-content-visibility` (cards past the first screen), `bundle-dynamic-imports` (this view is its own chunk, prefetched on hover of its segment), `js-index-maps` (lines are found with maps, not nested searches), `rendering-svg-precision` (coordinates rounded to one decimal).
- **One layout.** Positions come from the composer's own layout functions. No second layout.
- **Session names and numbers** come from SV-05's function, so a box reads the same as in the composer.
- **Motion:** none. The Map is drawn at rest; it doesn't animate in, and Horizontal or Vertical swaps at once. The composer's map morph (SV-06) is not used here.

---

## Part 0 · Read and plan

Find the function the composer's Map uses to lay out sessions and find lines between them. Measure what it needs per build (rows and columns) and how many bytes that is for a page of 24 builds. Write `Assumptions` and `Plan`.

Commit: `SV-12 P0: plan`.

## Part 1 · The view

`BuildsMapsView`, pure, takes per build: parts, session boxes with positions, lines. The dev page `vision-builds-maps` renders the fixture.

Commit: `SV-12 P1: Maps view`.

## Part 2 · Data

Build this only as far as a target needs:

1. **Read on demand.** One request for the page's builds' nodes (named columns only) and their session layout, then the composer's own functions. Target: under 300 KB and one request for 24 builds, started at the same time as SV-11's list where the ids allow, otherwise the moment it answers.
2. **Only if (1) misses the target:** a stored summary. `builds.map_summary jsonb` (parts, sessions, links), written by the composer with the classification facets, 1.5 seconds after tiles stop changing, through SV-07's `making` writers' queue. Write the migration file with its `EXPLAIN` note and give Miles the Lovable message.

Report which layer was built and the measured size. `npm run audit:pages` gains the Maps view with its round target.

Commit: `SV-12 P2: Maps data`.

## Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-maps"` within 4%.

Commit: `SV-12 P3: compare and checks`.

---

## Report

The README's report, plus: `Maps data layer: on demand / stored summary · KB for 24 builds · requests`.

## What Miles needs to do

Merge, then Publish › Publish changes. If Part 2 built the stored summary, apply its migration through Lovable with the message the report gives.
