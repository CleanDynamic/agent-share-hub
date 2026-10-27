# SV-11 · Builds, the page and the Table: assumptions and plan

Branch: `sv-11-builds-table`, from `origin/main` at f88f6ef (after SV-10).

## Part 0.1 · Filters and columns

| Board element | Source on disk | Exists |
| --- | --- | --- |
| Figure "n builds" | the list's own count (exact: shown in full) | yes |
| "Of n published" | `getGalleryStats().inGallery` (estimated head count) | yes |
| "n reproductions this week" | `getGalleryStats().reproducedThisWeek` | yes |
| "n% confirmed in the last 120 days" | `getGalleryStats().freshPct` (the window is `STALE_AFTER_DAYS`) | yes |
| Lens tabs All, Reproduced, Rebuilt, Open requests | `GALLERY_LENSES` (`all`, `proven`, `rebuilt`, `unsolved`), counts `countGalleryLenses` | yes |
| Field, Task, Setting, What was built, Role of AI, Techniques, Modality, Build method, Autonomy, Data handled, Human oversight, Age suitability, Skill needed, Cost to run | `facets` column, keys `facet:id` (`facetGroups`: OR within, AND across); counts `getClassificationFacets` | yes |
| Tools and stack | `made_with` (`madeWithSpellings`) OR the `stack` facet | yes |
| Shape | `shape` in `GALLERY_SHAPES` (no counts: `getGalleryShapeFacets` is nine requests) | yes |
| Patterns | `patterns` column, counts `getGalleryFacets().patterns` once `patternsLive` | yes |
| Open requests | the inner `bounties` embed (`openBounties`) | yes |
| A–Z, Count | panel only; Autonomy, Age suitability, Skill needed, Cost to run keep taxonomy order ("Scale order") | view |
| Sort: newest, reproduced, confirmed, rebuilt | `GalleryFeedSort`, `feedOrder` | yes |
| Saved filter sets, drag to reorder, resize, Columns chooser, Add a calculation | none | no (SV-24) |
| Reproductions as a range, Steps, Sessions, Works on model, Last confirmed, Rebuilds and Likes as filters | none (`reproduction_count` exists but the range filter is SV-23's) | no (SV-23) |
| Column Build: title, @maker | `title`; `maker:profiles!builds_creator_id_fkey(username)` embedded in the list's select | yes |
| What was built, Field, Cost to run | `classification` in the list's select (`shownValues`, `declared.field`) | yes |
| Tools (marks) | `made_with` through the tool registry and `markFor` | yes |
| Steps, Sessions | `session_count` exists; step count does not | no (SV-23) |
| Reproductions, lamp | `reproduction_count`; lit when `last_confirmed_at` is fresh (`isStale`) | yes |
| Confirmed "2d ago on <model>" | `last_confirmed_at`, `last_confirmed_model` | yes |
| Runs, 12 weeks | none per build per week | no (SV-23) |
| Rebuilds | `rebuild_count` | yes |
| Open | the `bounties` embed (open rows, `reward_gbp`) | yes |
| Footer: count, most common, median steps, total, Add a calculation | count and most common Field and Tools from the rows on the page; total reproductions on the page | partly (median steps SV-23, Add a calculation SV-24) |

## Part 0.2 · The Gallery's views

Routes in `App.tsx`: `/builds` renders `GalleryPage` (feed, or `?view=dashboard`), `/gallery` redirects. Nothing else routes a
Gallery file. Used only by the Gallery's feed and dashboard views (and their dev pages):

- `src/pages/site/gallery/`: `GalleryPage`, `GalleryFeedView`, `GalleryDashboardPage`, `GalleryDashboardView`,
  `BuildDetailSheet`, `GalleryBoard`, `GalleryBoardGroups`, `GalleryExtras`, `galleryFrame`, `galleryModel`,
  `dashboardModel`, and their tests.
- Dev pages `GalleryFeedDemo`, `GalleryDashboardDemo`, `ClassificationDemo` and the fixtures only they read.
- `src/components/gallery/ClassificationFilters.tsx` (the feed's facet menus), `src/lib/build/dashboardAggregates.ts`.
- In `gallery.ts`, functions whose only callers were those views: `listGalleryFeed`, `listGalleryDashboard`,
  `getEngagementSeries`, `getBuildTries`, `getBuildPatterns`, `getBuildClassifications`. Each is checked with grep after the
  files go; what something else still reads stays and is reported.
- Tests and specs that test only the retired views (tier1 `gallery-site-frame` is rewritten for Builds).

## Assumptions (checked on disk at f88f6ef)

- `/builds` is `SITE_NAV.gallery`; `/gallery` is `KeepSearchRedirect` to `/builds` (SV-02). Yes.
- **SV-03 Part 4:** `listGallery` selects `classification`; it does not carry tries (`getBuildTries` is a second read) and
  the facets start beside it on the Gallery. `listGallery`'s select carries nodes, media and `post_doc`, which a table never
  draws, and its search goes through `search_build_ids`, which `gallery.ts` says is not on live. The Table therefore reads
  a new `listBuildsTable` in `gallery.ts` that keeps `listGallery`'s membership rule, lens filters and open-ask embed, the
  feed's facet, tool, pattern, search and sort clauses, and selects only the table's columns, the maker and the open asks:
  one request.
- `BUILD_LIST_COLUMNS` is not a name on disk (SV-10 found the same).
- The prompt's `UnderlineTabs` is `TextTabs`, `FilterChip` is `ActiveFilterChip` (SV-02). `Segmented` (brand) draws a solid
  `--text` segment, not the board's raised `--control` on a `--well`; the view switch is drawn as three links in the frame.
- Route table entry `gallery`, `usePageReady("builds")`, the Placeholder match test (`page-placeholders.spec.ts`, chunk
  `GalleryPage`) exist.
- `getGalleryStats` is three estimated head counts; `countGalleryLenses` four; facets two RPCs. All start with the list.
- The address keeps `galleryParams.ts` (`f`, `shape`, `pattern`, `tool`, `lens`, `sort`, `q`). `view` becomes table (resting,
  never written), maps or classification; `open=1` is the Open requests filter. The dashboard's parameters go with it.
- Sort's resting value becomes `reproduced` (the board's "Sort Reproductions").

## Plan

- Part 1: `src/pages/site/builds/BuildsPage.tsx` reads the address, loads once, renders the Table, or "Not built yet" for
  Maps and Classification (each its own lazy chunk, prefetched on hover of its segment); route table `gallery` points at it
  with `BuildsLoadingView` as Placeholder; the Gallery files above deleted with their tests -> verified by: `BuildsPage.test.tsx`
  (view from the address), tsc, the placeholder spec.
- Part 2: `BuildsFrame.tsx` (columns, head, view switch, loading view), `BuildsFiltersView.tsx`, `BuildsTableView.tsx`, each
  section its own component; fixture `src/dev/fixtures/vision/builds-table.ts`; dev page `vision-builds-table` -> verified by:
  `BuildsTableView.test.tsx`, `BuildsFiltersView.test.tsx` (checkboxes, slider keys and `aria-valuetext`, grips named, `aria-sort`).
- Part 3: `listBuildsTable` with tests of the request it builds; `BuildsPage` wires list, stats, lens counts and facets in one
  round; `audit:pages` Builds `maxRounds: 1` -> verified by: `buildsTable.test.ts`, `BuildsPage.test.tsx`, `npm run audit:pages`.
- Part 4: `npm run audit:design -- --grep "vision/dusk/builds-table"` within 4%, then the README's checks.
