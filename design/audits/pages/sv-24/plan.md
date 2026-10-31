# SV-24 · Builds data: filter sets, groups, filter layout, columns: assumptions and plan

Branch: `claude/run-sv24-c8ciqf` (the session's branch; the prompt names `sv-24-builds-data-b`), from `origin/main` at 46707d6 (SV-23 merged).

## Assumptions (checked on disk)

- The board's panel pieces exist in `BuildsFiltersView` and are withheld by the page: `savedSets` (`SavedSetRow { id, name, count, href }` and `onSaveCurrent`), `onMove` (grips, today ArrowUp/ArrowDown on the grip), and in `BuildsTableView` `columnsLabel` (a static label, no chooser) and `footer.onCalculate` (a button, no behaviour). `BuildsPage` passes none of them ("NOT LIVE YET").
- The address is the state (`galleryParams.ts`: `parseGalleryParams` / `galleryHref`, keys in a fixed order). An open filter set has to be named somewhere the page can read; it is a new last key, `set=<uuid>`, which is only a marker for "the layout is kept in this set". The filters themselves stay in the address.
- `saved_items` (SV-17) already allows `kind = 'filter_set'` (check constraint, `snapshotFor` passes `{ name, query }` through) and Library's Filter sets kind lists those rows (`itemDetail` shows `snapshot.query`). So a filter set made here is also kept in Library as a saved item with `ref = filter_sets.id` and `snapshot = { name, query: <address search> }`, best effort, so Library lists it with no change of its own.
- `filter_sets` and `filter_set_members` do not exist (grep of `supabase/migrations`, `src`). `guilds` and `guild_members` exist (20260612120000) and are unmounted.
- OpenBuilds' Groups section is withheld in `OpenBuildsPage` ("NOT LIVE YET ... Groups (SV-24)"); `OpenBuildsView` takes `groups?: SideListProps` (`rows: { id, label, detail?, to }`).
- The table has 12 columns (`ColumnId`, `COLUMN_ORDER`); the board's "12 of 24" needs 12 more. The row already carries the whole classification (`classifiedAs`), `shape`, so the other 24 are: Task, Setting, Role, Technique, Modality, Method, Autonomy, Data, Oversight, Age, Skill (the eleven classification facets that are not already a column) and Shape. All come from the loaded page: no request.
- The footer's calculations are over `rows` (the loaded page), no request. `medianOf` exists.
- The Builds first screen is one round (`audit:pages` Builds `maxRounds: 1`). The saved-sets list and the open set are signed-in reads that do not depend on another read: they start in that round (no extra round). Signed out, neither is read.
- `localStorage` is already used for `builds:facets:v1` (try/catch, a versioned key); the layout follows it as `builds:layout:v1`.

## Decision: a Group is a public filter set with members, not a guild

`guilds` has a purpose, an emblem, a founder role and a `member_cap`, its writes are service-role only and it sits behind `FLAG_GUILDS` (false). A Group on OpenBuilds is "the field and tools of your builds": a filter someone can open. A guild carries no filter. A public filter set already is one, so a Group is a public `filter_sets` row and `filter_set_members` says who follows it. Nothing is read from or written to the guild tables.

## Plan

- Part 1: migration `20261104120000_sv24_filter_sets.sql` (`filter_sets`, `filter_set_members`, owner-write policies with `(select auth.uid())`, public sets readable by anyone, `list_filter_set_groups()` SECURITY INVOKER, EXPLAINs in the header); `src/lib/build/filterSets.ts` (list mine, get, create, rename, set public, delete, join, leave, groups; Library kept in step); the panel's Saved filter sets section (Save current, open, rename, delete, join/leave) and OpenBuilds' Groups go live; degrades to nothing until the migration is applied -> verified by: `filterSets.test.ts`, `galleryParams` tests (`set`), `BuildsPage.test.tsx`, `OpenBuildsPage.test.tsx`, `BuildsViews.test.tsx`, `sv24Migration.test.ts`.
- Part 2: `layoutModel.ts` (the layout, its validation and storage, reorder, calculations, columns, all pure) and `useBuildsLayout` (localStorage `builds:layout:v1`, or the open set's own `query.layout`); the grip's menu (Move up, Move down) and pointer drag (transform on the dragged filter, one write per frame, positions read once at the start); resize (a handle on a checklist, with keys); the Columns chooser (24, 12 shown); Add a calculation (sum, median, most common) -> verified by: `layoutModel.test.ts`, `useBuildsLayout.test.tsx`, `BuildsViews.test.tsx`, `buildsModel` tests.
- Checks: tsc, `npm test`, lint, build, e2e tier1, `audit:design` for the builds boards, `audit:pages` (Builds and OpenBuilds stay at their rounds).
