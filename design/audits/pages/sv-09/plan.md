# SV-09 · Library: assumptions and plan

Branch: `sv-09-library`, from `origin/main` at afa23ee (after SV-08).

## Part 0.1 · Does Saved still load?

`e2e/tier3/library-builds.spec.ts` "saved builds render as the gallery's cards" was run against its faked backend
(`page.route`). It failed: the fake still answered `build_saves` with `{ build_id, created_at }` rows, the two-request
shape from before SV-03 P5. The code reads one request with the build embedded (`build:builds!build_saves_build_id_fkey(...)`),
so every save had no build and the page drew its empty state. With the fake answering the one-request shape the test
passes on the current code: **Saved loads**. The cause was the test's fake, not the page. Part 1 keeps the corrected fake
and adds a test against the new view.

Three other tests in that file (the Add to a collection dialog, opened from `/gallery`) fail on main for a reason outside
this page: they wait for `data-testid="gallery-grid"`, which no longer exists in `src/` since the Builds rework. Reported,
not fixed here.

## Part 0.2 · Elements

| Element (board) | Function | Exists |
| --- | --- | --- |
| "Library", "n saved · n collections" | `listMySavedBuilds` (count) + `listCollections` (length) | saved count: no, added as `total` on the first page of the same request (`count: "exact"`, one reader's saves are small) |
| Kinds: All saved, Builds | `listMySavedBuilds` | yes |
| Kinds: Parts, Sessions, Steps, Requests, Filter sets | saved items (SV-17) | no: drawn on the dev page only |
| Collections list (name, Public/Private, count), New | `listCollections` (updated_at), `startCollection` | yes |
| "Public · @handle", "Filter set" collection rows | saved collections of others, filter sets (SV-17, SV-24) | no |
| Changes figure and rows | `listActivityFor` (SV-15) | no: dev page only |
| Kind tabs, table (title, detail, Type, State, Last used) | `listMySavedBuilds`, `shape`, `isStale`, the save's `created_at` | yes |
| Used in column | SV-17 | no |
| Filters, Sort controls, filter chips, "Same filters as Builds" | Builds filter sets (SV-24) | no: the live table has one order, shown by its sorted header |
| Selected item panel (build): chip, state, title, Plaque, Model, Open, Copy | `GalleryBuild`, `Plaque`, `modelLabel`, `PageLink`, `copyToClipboard` | yes |
| Selected panel: version switch, diff well, "n lines changed", Edited | SV-19 | no |
| Selected panel: Used in, In collections, Your note, Use in a build | SV-17, SV-25, SV-18 | no |
| Collection preview: head, three rows | `listCollectionBuilds` | yes |
| "saved by n people", Start a build from this collection | SV-17 | no |
| Rename, make public or private, delete, add, remove | `renameCollection`, `updateCollection`, `deleteBuildCollection`, `requestAddToCollection` (the existing dialog), `removeBuildFromCollection` | yes |
| Another reader's library | `getLibraryOwner`, `listCollections({ ownerId })` | yes |

## Assumptions (checked on disk at afa23ee)

- Board `design/reference/vision/dusk/library.html`, sample in `source/Library.dc.html`, `index.json` dev page `/dev/kit/pages/vision-library` (today `VisionNotBuilt`). Present.
- SV-02 pieces in `src/components/vision/`: `SectionHead`, `PageFigure`, `PlainRow`, `TypeChip`, `InnerTile`, `DashedSlot`. The prompt's `UnderlineTabs` is `TextTabs` on disk, `FilterChip` is `ActiveFilterChip`; `Segmented` is `components/brand/Segmented.tsx` (a solid `--text` segment, not the board's raised `--control` one), so the version switch is drawn in the view.
- `TypeChip` has tones `evidence`, `breakage`, `lit`; the board's `ANSWER` chip is `--text`. A `text` tone is added.
- SV-03: Saved is one request (`listMySavedBuilds`, build embedded, keyset on `created_at`); the route table `library` entry prefetches it under `[LIBRARY_SAVED_KEY]` ("library-saved", not the `['<domain>', '<fn>']` convention; kept, because `EngagementRow` and the dialog invalidate it by that key). `usePageReady("library")` is in `LibraryBuilds.tsx`.
- SV-04: `PageArrival`, `PageLink`; the placeholder match test (`e2e/audit/page-placeholders.spec.ts`) checks `/library`.
- SV-08: the route table's `frame: { board: true }` gives the board's page area; Library takes it too.
- `isStale(build)` is in `src/lib/build/signals.ts`; `copyToClipboard` in `src/lib/deepLink.ts`; a build's page is `/b2/<slug>`.
- `GalleryBuild` carries no maker handle, so a saved build's detail line is its outcome, not "@maker".

## Plan

- Part 1: keep the corrected fake; a view test that Saved draws its rows and that a failed read says `Builds didn't load` with Retry -> verified by: `e2e/tier3/library-builds.spec.ts`, `src/pages/site/library/LibraryPage.test.tsx`.
- Part 2: `LibraryView` in `src/pages/site/library/` (each section its own component), `LibraryFrame.tsx` (columns, loading view = route Placeholder), fixture `src/dev/fixtures/vision/library.ts`, dev page `vision-library` -> verified by: `LibraryView.test.tsx`, the placeholder test, the dev page rendering.
- Part 3: `LibraryPage` wires saved builds, collections, preview, the writes and `/library/:handle`; the address holds kind, tab, item and collection; route table entry -> verified by: `LibraryPage.test.tsx`, `npm run audit:pages` (1 round).
- Part 4: `npm run audit:design -- --grep "vision/dusk/library"` within 4%, then the checks.

## Report (Part 4)

```
SV-09 · Library
PASS (with the notes below)
Branch / PR: sv-09-library / SV-09 Library
Facts in this prompt that were wrong on disk:
  - "Saved still loads" failed in e2e/tier3/library-builds.spec.ts, but the cause was the test's fake (the
    pre-SV-03 two-request shape), not the page. Fixed in the fake (P1).
  - `UnderlineTabs` is `TextTabs`, `FilterChip` is `ActiveFilterChip`, `Segmented` (brand) draws a solid segment,
    not the board's raised one, so the version switch is drawn in the view.
  - `GalleryBuild` carries no maker handle, so a saved build's detail line is its outcome.
Baseline → end: tests 9335 passed / 59 failed → 9373 passed / 60 failed. The 59 are the same 13 files that fail on main
  (as SV-08 recorded). The 60th, SandboxPage.add.test.tsx, timed out once under the full run and passes 3 of 3 alone;
  it is composer code this prompt does not touch.
Compared boards: vision/dusk/library · 2.8% (44,969 px) against 4%. Header masked. What remains: the app header is 48
  high and the board's 56; the board's "Last used ↓" is one text node.
Request rounds and requests for the page, before → after (npm run audit:pages, every read 120 ms late, median of runs):
  library-saved   cold 8 → 9 requests, 1 → 1 round; first (from inside the app) 2 requests, 1 round
  library-collections cold 9 → 9 requests, 2 → 1 round (collections now start with the saves)
  The extra request on /library is the collections list, now on the first screen. "pages: report and targets" passes.
Placeholder match (SV-04 P5): Library desktop and phone pass within 2 px. The test's chunk name moved from
  `Library` to `LibraryPage` with the file.
Web Vitals against the last after numbers: audit:perf not run in this container (see Parts not done).
Built but not live yet:
  - Parts, Sessions, Steps, Requests, Filter sets kinds; Used in; Your note; saved-by counts; Start a build from this
    collection (SV-17)
  - the version switch, the diff and Edited (SV-19)
  - the changes figure and rows (SV-15)
  - In collections (SV-25)
  - Filters and Sort controls, filter chips, "Same filters as Builds" (SV-24). The live table has one order, newest
    first, said by its sorted header.
  - Use in a build (SV-18). A selected build's primary is Open.
Layers built only because a target failed: none.
Names that differed from this prompt: UnderlineTabs → TextTabs; FilterChip → ActiveFilterChip; Segmented → drawn in
  the view (VersionSwitch, a radio group). The saved query key stays `[LIBRARY_SAVED_KEY]` ("library-saved"), not
  ['library', 'listMySavedBuilds'], because EngagementRow and the Add to a collection dialog invalidate it by that key.
Raw values without a token: Stale's `filter: brightness(.8)` · State column · `--label` (no filter is drawn).
Motion cut back after watching: none (no motion added).
Dead code seen: none beyond what this prompt removed (src/pages/Library.tsx, LibraryBuilds.tsx, libraryLoading.tsx and
  their tests).
Lovable messages needed: none.
Parts not done: audit:perf, e2e/tier1 (see the PR). Three tests in e2e/tier3/library-builds.spec.ts (the Add to a
  collection dialog, opened from /gallery) fail on main because `gallery-grid` no longer exists; not this page's.
Questions for Miles:
  - On a phone the table scrolls inside its own box. Should the phone drop Type and Used in instead?
  - The two collection dialogs are the existing shadcn Dialog, moved unchanged into CollectionDialogs.tsx; that file is
    not in lookRules.test.ts because the rules forbid that import. Redraw them with the vision modal pieces later?
```

Changes beyond the board, each needed by it: `listMySavedBuilds` returns `total` (an exact count on the first page, in
the same request); `PageFigure`'s meta line sits 4 under the number at a 20px line, as every board draws it;
`TypeChip` has a `text` tone (ANSWER); `SectionHead` exports its chevron.

What Miles needs to do: merge the pull request, then Publish › Publish changes. No migration.
