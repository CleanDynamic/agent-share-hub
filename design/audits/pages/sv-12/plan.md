# SV-12 · Builds: Maps · plan

Checked on the day it ran, at `00479a7` (SV-11 merged), branch `sv-12-builds-maps`.

## Assumptions

Each fact the prompt states, and what is on disk.

- **Board, picture, sample data** exist: `design/reference/vision/dusk/builds-maps.html`, `design/screens/vision/builds-maps.png`, `design/reference/vision/source/BuildsMaps.dc.html`. `index.json` lists `builds-maps` at 1440 x 995 with the dev page `/dev/kit/pages/vision-builds-maps`. True.
- **`sessionMap.ts`** has `tileLinksOf`, `sessionOfTiles`, `sessionLinksOf`, `sessionMapFor` and `layoutSessionMap` (horizontal and vertical). True. The composer's Map draws from `layoutSessionMap(model, direction)`; that is the one layout.
- **`graph.ts` `sessionGroups`** exists; SV-05's numbering is `sessionNumbers.ts` (`numberSessions`), and `sessionGroups` numbers its groups with it. A box's number is `group.number`, so it reads the same as in the composer. True.
- **`sessionLayout.ts`** holds `getSessionOrder(made, rows)`. A published build keeps its order in `builds.making.session_order` (the build page reads `sessionOrderOf(build.making)`); `build_sessions` is a draft's table. Maps reads `making`, as the build page does (`buildModel.ts:809`).
- **SV-11 left the seams**: `BuildsMapsView.tsx` is a stub ("Not built yet") behind `buildsViews.ts` (lazy chunk, `prefetchView` on hover or focus of the segment), `BuildsPage.tsx` passes it `builds` (`BuildsOtherViewProps`), `BuildsView.tsx` draws `other` in the main column. True. `GalleryViewMode` already has `maps`.
- **The page differs from the Table's.** The board has no filter column: head (title, a sentence, the switch), then one row (Filters with count, chips, "+ n more", Horizontal/Vertical, "n builds · n with a Map"), then the grid. `BuildsView` is two columns with the filter column. So the Maps view needs its own page frame, `BuildsMapsPage`-shaped, inside the same `BuildsPage` container (same address state, same list).
- **`BUILDS_TABLE_COLUMNS` has no `making` and no nodes.** The Maps read is a new function; the Table's select does not change.
- **Missing premise, reported not fixed:** the board's "n with a Map" counts builds that have two sessions or more. `reproduced` per card is `reproduction_count`. The lamp is the existing lamp (`Lamp`); the board's two lit/dim states are its on/off for "reproduced at least once", checked against the component in Part 1.

## Measure: what the Map needs per build

Per build (rows and columns, named):

| Source | Rows per build | Columns |
| --- | --- | --- |
| `builds` | 1 | `id`, `making` |
| `build_nodes` (placed only: `position is not null`) | one per tile, files and children included, up to 2000 | `id`, `parent_id`, `position`, `type`, `title`, `payload` (the graph reads `uses`, `made_by`, `runs`, `decision`, `defined_in`, a file's title) |

`note`, `source_ref`, `event_id`, `is_gap`, `created_at` and `build_id` are not read by `buildSteps`, `sessionGroups` or `sessionMapFor` for the Map. The payload is the heavy column (code and prompt text live in it), so the first read asks the nodes of 24 builds at once and the size is measured, not assumed.

Bytes for a page of 24 builds (`24 x` the build's own): the audit harness (`pages.spec.ts`) reports KB of JSON per page; the `builds-maps` target is added so the number is measured on the fixture build the harness serves, and the same function is run over the largest dev fixtures in a unit test that prints the JSON size of the columns above. The 300 KB target is judged on those; the live database is not reachable from here (no secrets, and the audit never fetches the live site), so the report says what was measured and where.

## Plan

- **Part 0: this file** -> verified by: the facts above checked against the files; `git diff` is only this file.
- **Part 1: `BuildsMapsView` (pure) and its dev page `vision-builds-maps`** -> the view takes, per build, `parts`, `boxes` with positions, `lines`, the card's words; drawn at 400 x 220 in the well (`viewBox`), positions from `layoutSessionMap`, scaled to fit with one scale (no second layout); single-session card says "One session. A Map needs two."; Horizontal/Vertical is a `Segmented` that swaps at once; phone: one column. -> verified by: a Vitest on the view (roles and names, single-session line, direction switch, grid, `content-visibility` past the first six), the fixture mapped from `BuildsMaps.dc.html`, the compare in Part 3.
- **Part 2: data** -> `listBuildMaps(ids)` in `src/lib/build/buildsMaps.ts`: one request (`builds` + embedded placed nodes, named columns, `.limit()`), then `buildSteps`, `sessionGroups`, `sessionMapFor` and `layoutSessionMap`, all pure, per build; started the moment the list answers (the ids come from it, so two rounds, the second one request); key `['build', 'listBuildMaps', ids]`, `keepPreviousData`. -> verified by: unit test on a fixture (same boxes as the composer's Map for the same build), request count 1 and bytes on the fixture, `audit:pages` target `builds-maps` (`maxRounds: 2`). **Stored summary (`builds.map_summary`) is not built** unless the measured size misses 300 KB.
- **Part 3: compare and checks** -> `npm run audit:design -- --grep "vision/dusk/builds-maps"` within 4%; the series checks.

## Decisions taken in the safer reading

- The Filters control in the Maps row opens the same filter panel as the Table's, in place under the row (a button with `aria-expanded`), so filters are "the Table's, kept across views" as the board's note says.
- Layout inside a card: the composer's layout is in px at 164 x 38 boxes; the board's well is 400 x 220 with 92 x 36 boxes. One uniform scale (never non-uniform, the board's `preserveAspectRatio="none"` is not ported because it would squash text) maps the layout's box into the well; text stays 11 / 10 and the box keeps the board's size when scaled, so box sizes are the board's and positions come from the layout.
