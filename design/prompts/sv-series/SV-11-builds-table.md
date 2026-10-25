# SV-11 · Builds: the page and the Table

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-10, before SV-12. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-11-builds-table`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-11 Builds: page and Table` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-10 merged. **The file on disk wins.**

## Intent

The Gallery becomes Builds: one page with three views of the same filtered set (Table, Maps, Classification). This prompt builds the page frame, the filter panel and the Table, and retires the Gallery's views. It must match `design/reference/vision/dusk/builds-table.html`.

## Source

- Board: `design/reference/vision/dusk/builds-table.html`, picture `design/screens/vision/builds-table.png`, sample data in `design/reference/vision/source/Builds.dc.html`.
- Today: `src/pages/site/gallery/GalleryPage.tsx`, `GalleryDashboardView.tsx`, `GalleryDashboardPage.tsx`, `dashboardModel.ts`, `galleryModel.ts`; `src/lib/build/gallery.ts` (`listGallery`, `GalleryFilters`, `GALLERY_LENSES`, `GalleryFeedParams` with `patterns` and classification facet keys, `getGalleryStats`, `getGalleryFacets`, `getClassificationFacets`, `getBuildClassifications`, `countGalleryLenses`); `src/lib/classify/taxonomy.ts` (`FACETS`, `FACET_LABEL`, `TAXONOMY`).

## What earlier prompts left here

- **SV-02:** `/builds` is the route (`SITE_NAV.gallery`), and `/gallery` redirects to it.
- **SV-03 Part 4:** `listGallery` returns the classification columns in its own select, tries come with it where the table allows, and the facets can start alongside it.
- **SV-03 and SV-04:** the route table entry (keyed `gallery`), `usePageReady`, the `Placeholder` and its match test, `PageLink`, `keepPreviousData` for filters and lenses.
- **SV-10:** Home carries the feed.

## Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Page head: `PageFigure` "n builds" with meta "Of n published · <n reproductions> this week · n% confirmed in the last 120 days" (`--evidence` on the reproductions); on the right a `Segmented` Table, Maps, Classification (links; the view is in the address, `?view=`).
- 40 below: columns `256px minmax(0, 1fr)`, 56 apart. Below 1000px one column, filters first and collapsed to their heads.
- **Filter panel** (quiet): head "Filters", "n active · drag to reorder", an Add control. Then sections, each 20 top and bottom with a hairline above:
  - Saved filter sets (rows 36 high);
  - a word filter (Field, Works on model): a faint grip, the name 12.5/500, "A–Z · Count" as two text buttons (the chosen one `--text`), a checklist (14px box, label, count right, rows 30 high);
  - a number filter (Reproductions, Steps): the name and the current range on the right, a 32px histogram (in range `--label`, out of range `--line`), a two-handle slider, the end values;
  - a scale filter (Autonomy): four 6px segments in the taxonomy's order, end labels;
  - closed filters: one 44px row each, name, current value, chevron;
  - "Add a filter": the one `InnerTile` of the panel, listing every filter by group (Classification 15, Proof 6, Structure 8, OpenBuilds 3, Lineage 2, People 3).
- **Table** (leads, on the surface, no box): `UnderlineTabs` All, Reproduced, Rebuilt, Open requests (the four `GALLERY_LENSES`); Sort and Columns controls on the right. 16 below, the active `FilterChip`s and Clear all. 20 below, the table: header 11.5 `--label` 400 with the sorted column in `--text` and an arrow; rows 48 high with a hairline under each; columns Build (title 500, @maker 11.5), What was built, Field, Tools (marks), Steps, Sessions, Reproductions (number and lamp, right), Confirmed ("2d ago on <model>"), Runs 12 weeks (12 bars, 3 wide, 16 high, `--evidence`, zero weeks `--line`), Rebuilds, Open, Cost to run. The table is at least 1000 wide and scrolls inside its column. Footer row: count, most common values, median steps, total, "Add a calculation".

## Rules for this prompt

- **Vercel rules:** `async-parallel` (list, stats, lens counts and facets start together), `rendering-content-visibility` (table rows past the first screen), `rerender-derived-state-no-effect` (filters, sort, lens and view are read from the address, never copied into state), `rerender-no-inline-components`, `bundle-dynamic-imports` (Maps and Classification are separate chunks, prefetched on hover of their segment).
- **One round.** List, stats, lens counts and facets start at once; the page's first screen needs nothing after them. Classifications come in the list's own select (SV-03).
- **Same page, new parameters:** a filter, a lens, a sort or a view change keeps the old rows until the new arrive, with no fade. The view switch prefetches the other view's chunk on hover.
- **Counts:** "Of n published" and the facet counts are estimated where the table is large.
- **Real controls** (the board draws them as styled elements): the checklists are checkboxes with their labels; the number filters are two-handle sliders, each handle keyboard operable with `aria-valuetext` ("3 or more"); the histogram and the Runs 12 weeks bars are hidden from screen readers, with a text summary on the group; each grip is a button named "Move <filter>"; sortable column heads are buttons with `aria-sort` on their header cell.
- **Motion:** none added. Rows change at once.

---

## Part 0 · Read and plan

1. Read the files above. Table every filter and column: name → source → exists or not.
2. **The Gallery's views.** List every file only the Gallery's feed and dashboard views use, checked against the route list in `App.tsx`. They are retired in Part 1.
3. Write `Assumptions` and `Plan`.

Commit: `SV-11 P0: plan`.

## Part 1 · The page frame and view switch

1. `BuildsPage` in `src/pages/site/builds/` reads the filters, sort, lens and view from the address, loads once, and passes the same builds to whichever view is chosen. SV-12 and SV-13 add the other two views; until then they render "Not built yet". `/builds` renders `BuildsPage`. The route table entry `gallery` points at it, with its prefetch and `Placeholder`.
2. **Retire the Gallery's views.** The files Part 0 listed, which nothing now imports, are deleted with their tests (README: remove what your own change leaves unused). Anything another route still uses stays and goes in `Dead code seen`.

Commit: `SV-11 P1: Builds page, view switch, Gallery views retired`.

## Part 2 · Filter panel and table views

`BuildsFiltersView` and `BuildsTableView`, pure, with every element of the board, each section its own component. The dev page `vision-builds-table` renders the fixture.

Commit: `SV-11 P2: filter panel and table views`.

## Part 3 · Wire what exists

| Element | Source |
| --- | --- |
| Stats line | `getGalleryStats` |
| Lenses | `GALLERY_LENSES`, `countGalleryLenses` |
| Field, Task, Setting, What was built, Role of AI, Techniques, Modality, Build method, Autonomy, Data handled, Human oversight, Age suitability, Skill needed, Cost to run | classification facet keys (`facet:id`), OR within a facet, AND across; counts from `getClassificationFacets` |
| Tools and stack | `madeWith` and the stack facet |
| Shape, Patterns, Open requests | `shapes`, `patterns`, `openBounties` |
| A–Z and Count | sorts the values in the panel only; Autonomy, Age suitability, Skill needed and Cost to run keep the taxonomy's order and show "Scale order" |
| Sort | newest, reproduced, confirmed, rebuilt |
| Columns live now | Build, What was built, Field, Tools, Reproductions, Confirmed, Rebuilds, Open, Cost to run (from the list's own row) |
| Footer | count, most common Field and Tools on the page |

**Not live yet:** Steps and Sessions columns and filters, Runs 12 weeks, Reproductions as a range, Works on model, Last confirmed, Rebuilds and Likes as filters (SV-23); Saved filter sets, dragging and resizing filters, the Columns chooser, Add a calculation (SV-24). On the live page, Add a filter lists only filters that work.

`npm run audit:pages` gains Builds with a one-round target, and fails when it is missed.

Commit: `SV-11 P3: Builds data`.

## Part 4 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-table"` within 4%.

Commit: `SV-11 P4: compare and checks`.

---

## Report

The README's report, plus: `Gallery files deleted: (list)`.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration. Old `/gallery` links keep working.
