# UI-P12 — Charts, timeline, activity grid and rank rungs

Follow `design/RULES.md`.

**Goal.** The small data drawings, as hand-written SVG and styled elements. No chart library.

**Read first.** `components/progress/EngagementGrid.tsx`, `components/streaks/streak-calendar.tsx`, `components/build/eventDisplay.tsx`, `components/trophies/badge-tile.tsx`, `creator-mark-tile.tsx`.

**Reference.** Section `Charts`; `data-ui="chart-line"`, `chart-step`, `chart-histogram`, `sparkline`, `activity-grid`; the timeline on `desktop/*/build.html` ("Watch it get built"); rank rungs on `desktop/*/bounties.html` ("Top solvers") and creator marks on `desktop/*/profile.html`.

**Build.**
1. **`LineChart`** (`width`, `height`, `values`, `markerIndex`): five vertical gridlines at sixths in `--hairline`; 101 ticks along the bottom, every fifth 10px tall and the rest 6px, in `--line`; the series before the marker as a 1.5px polyline in `--label` at opacity .7; the series from the marker on as a 1.8px polyline in `--evidence` with an area under it (`--evidence` from opacity .28 to 0); a dashed vertical marker (`--text`, 1.4px, `3 3`) at the marker. Values map into `[14px from the bottom, 8px from the top]`.
2. **`StepChart`**: six gridlines at sevenths in `--hairline`; a step-after line in `--cat-agents` at 1.6px and the area under it (`--cat-agents` from opacity .4 to .03).
3. **`Sparkline`** (default 54–60 × 18–20): one 1.4px polyline in `--evidence`.
   **`Histogram`** (`width`, `height`, `values` 0–1, `fromIndex`): an SVG of `n` bars at `width / n` each, drawn `x = k·bw + 2`, `width = bw − 4`, height `max(4, v · (height − 6))`, sitting on the bottom edge; bars from `fromIndex` on are salmon `#E8A283`, the ones before are `--bar-base`; behind them a band from `x = fromIndex · bw` to the right edge in `rgba(140,120,196,.14)`. Both of those values are the same in both themes (see the end of `token-map.md`). Nothing uses it yet — it exists so the catalogue's Charts section compares, and so a distribution has a drawn form the day one is needed. Same file as the other charts.
4. **`ActivityGrid`** (`days`, 7 rows, as many columns as weeks): cells 12×12, radius 4, gap 3px, columns in a row with gap 3px (desktop and mobile Profile both show 22 columns: 22 × 15 − 3 = 327px). Empty day `--bar-base`; active days `--lit` at opacity .3, .55, .8 or 1 by volume quartile; a frozen day (`getStreakDays` kind `frozen`) is transparent with a 1.5px `--evidence` border. Repaint `EngagementGrid` / `streak-calendar` onto it.
5. **`Timeline`** (`events: {kind, at, text}[]`): a 1px `--line` rail 5px from the left, from 6px below the top to 16px above the bottom. Each item: a grid `16px 44px 1fr`, gap 10px, 14px below: an 11px dot coloured by `EventKind` (prompt `--cat-instruction`, milestone `--evidence`, breakage `--cat-breakage`, note `--label`, deploy `--lit`; on Dusk each dot glows `0 0 10px` in its own colour); the time in DM Mono 10px `--label`; the kind in DM Mono 10px, .08em, uppercase, in the same colour (deploy uses `--lit-ink`, because it is read), then the text in Figtree 12px `--text`, 2px below.
6. **`RankRung`** (`rank`, `tier: "highest" | "rare" | "common" | "none"`, `size: 28 | 32 | 40`): radius 9 (10 at 32, 12 at 40); highest: background `--lit`, text `--on-lit`; rare: background `--recess`, text `--text`; common: 1.5px border `--line`, text `--text`; none: text `--label`. The rank in Sentient (16 / 18 / 22px). Creator-mark tiles use the same ladder at 46×46 (radius 13) with a 20px trophy icon; the highest tile adds `box-shadow: var(--rank-glow)` (a glow on Dusk, none on Noon). Rarity is weight and fill, never a rainbow of hues.

**Done when.** Charts section compares within 0.04; the timeline, rungs and mark tiles are in the Compositions section.

**Commit.** `UI-P12: line, step and spark charts, activity grid, timeline, rank rungs`
