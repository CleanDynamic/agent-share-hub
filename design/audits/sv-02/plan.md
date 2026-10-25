# SV-02 plan

## Assumptions (checked at 7359c68 on main, after SV-01 merged)

- `design/vision-kit.py` is on main; `python3 design/vision-kit.py` wrote 26 files and `--check` reports "26 of 26 files match". The boards, `index.json`, pictures and `design/scripts/render-vision-board.mjs` were NOT yet committed on main (untracked after the run); Part 1 commits them.
- All 8 boards in `design/reference/vision/dusk/` have no `<script>`, no `NEW ·` note and no Google Fonts link; their `@font-face` points at `../../fonts/` which is `design/reference/fonts/`. All 8 are comparable.
- `design/prompts/sv-series/` is on main with the README, SV-01 to SV-26.
- `SITE_NAV` keys `gallery` and `bounties` exist and stay; `PRIMARY_LINKS` labels are Gallery/Bounties today. `/gallery`, `/bounties`, `/bounties/solvers`, `/bounties/:bountyId/solve` are routes in `src/App.tsx`.
- `design-compare.spec.ts` reads only `design/reference/index.json` (kind `refined`); it has no mask for the header.
- `KitPages.tsx` `VIEWS` is keyed by the board's `page`; a missing page renders `data-design-ready="false"`.
- Primitives that exist: `Segmented` (well track, 2px padding, `--control` segment, radio or link semantics: matches the board recipe, reused, not rebuilt), `Row` (40/48/56 only, 12.5 text: not the board's 40/44/48/52/56 at 13), `CardHead` (13.5 title, not 14/12), `Tile`/`Panel` (radius 6/module, not `InnerTile`), `UnderlineTabs` (40 high, 24 gap, 2px edge: differs from the board's 36/20/1px), `FilterChip` (a toggle, not a removable filter), `LampDot`, `Plaque`, `Avatar` (reused as they are).

## Where a board and its prompt disagree (board wins for looks)

- The Maps and Classification page heads differ from the Table's.
- The Add from Library window's border is `--control-border`.
- Only Home and Builds draw a header search; the live `SiteHeader` (with `HeaderSearch`) stays and the compare masks the header.

## Plan

- Part 1: commit the boards, pictures, renderer script, `index.json` -> verified by: `vision-kit.py --check` 26/26, board heights re-measured at 1440 wide.
- Part 2: Builds and OpenBuilds names, routes, redirects, breadcrumbs, Dock, drawer -> verified by: updated `siteNav.test.ts`, `navBudget.test.tsx`, new route/redirect and breadcrumb tests.
- Part 3: compare harness reads `vision/index.json`, masks the header, 8 placeholder dev pages -> verified by: `npm run audit:design -- --grep "vision/"` lists 8, all skipped; refined unchanged.
- Part 4: new pieces in `src/components/vision/` (one file each, no barrel): `SectionHead`, `PageFigure`, `PlainRow`, `TypeChip`, `ActiveFilterChip` (the prompt's `FilterChip`; the name is taken by a toggle in `brand/`), `TextTabs` (the prompt's `UnderlineTabs`; same reason), `InnerTile`, `DashedSlot`; `Segmented` reused from `brand/` -> verified by: a unit test per piece for accessible name and token use, plus `lookRules.test.ts` entries.
- Part 5: all README checks, em dash and secret search.
