# SV-09 · Library

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-08, before SV-10. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-09-library`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-09 Library` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-08 merged. **The file on disk wins.**

## Intent

Library holds what the reader keeps from any build, says what changed in it, and hands it to the composer. It must match `design/reference/vision/dusk/library.html`. This prompt builds the whole view and wires saved builds and collections, which exist. Saving smaller things arrives in SV-17, edits in SV-19, the changes list in SV-15.

## Source

- Board: `design/reference/vision/dusk/library.html`, picture `design/screens/vision/library.png`, sample data in `design/reference/vision/source/Library.dc.html`.
- Today: `src/pages/Library.tsx` (tabs Saved and Collections, `/library/:handle`), `src/lib/social/saves.ts` (`listMySavedBuilds`), `src/lib/library/builds.ts` (`listCollections`, `getCollection`, `listCollectionBuilds`, `addBuildToCollection`, `removeBuildFromCollection`, `startCollection`, `renameCollection`, `deleteBuildCollection`, `getLibraryOwner`).

## What earlier prompts left here (keep all of it)

- **SV-03 Part 5:** Saved is one request (`build_saves` with the build embedded, newest first, paged by `created_at`), the cause of "Something went wrong" was found or reported, and a failed panel reads `Saved didn't load` with `Retry`. Keep the request and the panel error. The panel error names the kind: `Builds didn't load`, `Collections didn't load`.
- **SV-03 and SV-04:** the route table entry, `usePageReady("library")`, the `Placeholder` and its match test, `PageLink`.

## Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Columns `208px minmax(0, 1fr) 340px`, 48 apart. Below 1200px the right column moves under the others; below 800px one column (phone order: kinds as a row of `UnderlineTabs`, then the main column, then the selected item).
- **Left:** "Library" 20/500, "n saved · n collections"; 28 below, the kinds as rows 34 high (the selected one `--selected-fill`, radius 6): All saved, Builds, Parts, Sessions, Steps, Requests, Filter sets, each with its count. 32 below, "Collections" with New, then rows 40 high (name 12.5, "Public", "Private", "Filter set" or "Public · @handle" in 11.5 `--label`, count right), then "Ordered by your last use".
- **Main:** `PageFigure` "n changes" with meta "Since your last visit · n edited · <n removed> · <n reproduced on <model>>", chevron. Change rows 40 high: a `TypeChip` whose text is toned (`EDITED` `--lit`, `REMOVED` `--cat-breakage`, `RUN` `--evidence`, `ANSWER` `--text`), the item 500, the detail in `--label`, the age right. 48 below: `UnderlineTabs` (the kind's own tabs; for Steps: Steps, Changed, Removed), Filters and Sort controls, `FilterChip`s and "Same filters as Builds", then a plain table: Step (title 500, "Step 7 · <build> · @maker" in 11.5), Type, State (Same `--text2`, Edited `--lit`, Removed `--cat-breakage`, Stale dimmed), Used in (right), Last used (right, sorted). The selected row has `--selected-fill`.
- **Right:** the selected item in a module (padding 16): `TypeChip`, state on the right; title 14/500; source line; a `Segmented` "Your saved version" and "Current version"; the content in a well (Geist Mono 11.5, line-height 18; a removed line struck through in `--cat-breakage`, an added line in `--evidence`); "1 line changed since you saved it on <date>"; `PlainRow`s Model, Source build (count and lamp), Used in, In collections; "Your note" textarea; Use in a build (primary), Copy, Open source. 32 below, a collection preview: `SectionHead` with chevron, three numbered rows, "Start a build from this collection".

## Rules for this prompt

- **Vercel rules:** `async-parallel` (the kinds' counts, the collections list and the first table page start together), `rerender-derived-state-no-effect` (the selected item is read from the address, not copied into state), `rerender-no-inline-components`.
- **Same page, new parameters:** choosing a kind, a tab, a sort or an item changes the address and keeps the old content until the new arrives, with no fade (README, Pages).
- **Counts:** the kinds' counts and "n saved" are estimated where the table is large; exact where small.
- **Motion:** none added.

---

## Part 0 · Read and plan

1. Check that Saved still loads (SV-03 Part 5): a test against a faked backend (`page.route`). If it fails again, find the cause, and fix it in Part 1 with a failing test first. If it passes, Part 1 adds only the test.
2. Table every element: element → function → exists or not. Write `Assumptions` and `Plan`.

Commit: `SV-09 P0: plan`.

## Part 1 · Saved stays fixed

The test from Part 0 is kept in the suite, and any fix it needed. If the cause is outside this page's code, report it with a proposed patch and continue.

Commit: `SV-09 P1: Library Saved stays fixed`.

## Part 2 · The view

`LibraryView` in `src/pages/site/library/` with every element of the board, for every kind, each section its own component (the selected panel adapts: a build shows its Plaque, Used in, In collections, Open; a step shows the version switch and content). The dev page `vision-library` renders the fixture. The route's `Placeholder` becomes this page's loading state.

Commit: `SV-09 P2: Library view`.

## Part 3 · Wire what exists

| Element | Source |
| --- | --- |
| Builds kind and its table | `listMySavedBuilds`: title, shape as Type, State (Same, or Stale from `isStale`), Last used from the save's time |
| Collections list, counts, public or private | `listCollections` (ordered by `updated_at`) |
| Collection preview | `listCollectionBuilds` |
| New, rename, delete, add, remove | the existing functions |
| Another reader's library | `/library/:handle`, their public collections, read only |
| Selected build: Open source, Copy | `PageLink` to the build page; `copyToClipboard` |

The address holds the kind, the tab and the selected item, so Back and a shared link land where the reader was. **Not live yet:** Parts, Sessions, Steps, Requests and Filter sets kinds, notes, Used in, saved-by counts and Start a build from a collection (SV-17); the version switch and Edited (SV-19); the changes list (SV-15); In collections (SV-25). The live page shows only kinds with a source.

`npm run audit:pages`: Library stays at 1 request round.

Commit: `SV-09 P3: Library data`.

## Part 4 · Compare

`npm run audit:design -- --grep "vision/dusk/library"` within 4%.

Commit: `SV-09 P4: compare and checks`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration.
