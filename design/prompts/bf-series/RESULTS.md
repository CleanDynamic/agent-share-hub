# BF series: results

Every fix id in the BF README's coverage table, the test that proves it, and the line that was reverted (in the working
tree only, never committed) to see that test fail. Each `proved` row was run three times by a script: the test alone
(passing), the fix reverted (failing), the fix restored with `git checkout -- <file>` (passing again). Checked on
11 and 12 November 2026 on `claude/blissful-hypatia-bnufn8`: main with BF-00 to BF-10 (BF-06 to BF-10 merged as #465
while this ran), plus BF-11 to BF-15.

| Id | Fix | Proved by (file · test name) | Reverted line that makes it fail | Status |
| --- | --- | --- | --- | --- |
| A1 | Filters button and one dialog | `builds/BuildsViews.test.tsx` · pressing Filters opens the dialog with the filter panel in it | `builds/BuildsView.tsx`: `<BuildsFilters {...filters} open={open} onOpenChange={setOpen} />` -> `null` | proved |
| A2 | Draft, then Apply once | `builds/BuildsPage.test.tsx` · ticking values in the dialog does not change the address or ask for the list | `builds/BuildsPage.tsx`: `onToggleOption: (sectionId, key) => setDraft(toggled(shown, sectionId, key)),` -> `onToggleOption: (sectionId, key) => go(toggled(shown, sectionId, key))` | proved |
| A3 | Groups and a name search | `builds/BuildsFiltersView.test.tsx` · in Find a filter shows Last confirmed and Confirmed or stale only | `builds/BuildsFiltersView.tsx`: `const shown = query ? sections.filter((section) => section.name.toLowerCase().includes(query)) :` -> `const shown = false ? [] :` | proved |
| A4 | A filter with nothing to choose says so | `builds/BuildsFiltersView.test.tsx` · a checklist with no values shows | `builds/BuildsFiltersView.tsx`: `{section.options.length === 0 ? (` -> `{false ? (` | changed: BF-07 keeps a filter with nothing to choose, last in its group, saying so, rather than hiding it; proved |
| A5 | Remove the open and closed lists, so nothing jumps | `grep -n "withOpened\|OPEN_BY_DEFAULT\|kind: \"closed\"" -r src` prints nothing; `builds/BuildsFiltersView.test.tsx` · toggling a value never changes the order of the filters in its group | (a grep: there is no line to revert) | proved |
| A6 | Drop filter reordering | `grep -rn "drag to reorder\|filterDrag\|data-filter-slot" src` prints only the test that asserts its absence (`BuildsFiltersView.test.tsx:142`, `no filter has a Move button`) | (a grep) | proved |
| A7 | One order control | `builds/BuildsFiltersView.test.tsx` · the dialog header has one control | `builds/BuildsFiltersView.tsx`: `<OrderValues order={props.order} onOrder={props.onOrder} />` -> `null` | proved |
| A8 | Saved sets in the dialog | `builds/BuildsFiltersView.test.tsx` · signed in: the first group is Saved | `builds/BuildsFiltersView.tsx`: `{savedSets ? <GroupButton name="Saved"` -> `{false ? <GroupButton name="Saved"` | proved |
| A9 | Autonomy as labelled buttons | `builds/BuildsFiltersView.test.tsx` · Autonomy draws one button per value | `builds/BuildsFiltersView.tsx`: `<ScaleButton key={segment.key} label={segment.label}` -> `<ScaleButton key={segment.key} label=""` | proved |
| A10 | Number fields on ranges | `builds/BuildsFiltersView.test.tsx` · a range filter has two number fields | `builds/BuildsFiltersView.tsx`: `label="At least"` -> `label="From"` | proved |
| B1 | A filter's column is drawn | `builds/buildsModel.filterColumns.test.ts` · drawnColumns: the reader's columns, then the filtered ones | `builds/buildsModel.ts`: `const added = new Set([...(on ? filtered : []), ...sorted]` -> `const added = new Set([...sorted]` | proved |
| B2 | A filtered head is marked | `builds/BuildsViews.test.tsx` · a filtered column's head is in --text | `builds/BuildsTableView.tsx`: `const label = filtered ? `${HEAD[id]}, filtered` : undefined;` -> `const label = undefined;` | proved |
| B3 | Every column sorts, both directions | `builds/BuildsPage.test.tsx` · every drawn column's head is a button when the whole list is loaded | `builds/BuildsPage.tsx`: `const sortable = new Set(allLoaded ? columns : columns.filter((id) => SERVER_SORT[id]));` -> `const sortable = new Set(columns.filter((id) => SERVER_SORT[id]));` | proved |
| B4 | One sort control | `builds/BuildsViews.test.tsx` · desktop: there is no Sort menu in the lens row | `builds/BuildsTableView.tsx`: `{phone ? <SortMenu` -> `{true ? <SortMenu` | proved |
| B5 | A second key with Shift | `builds/BuildsPage.test.tsx` · Shift-pressing Reproductions while sorted by Field | `builds/BuildsTableView.tsx`: `const withShift = event.shiftKey \|\| shiftKey.current;` -> `const withShift = false;` | proved |
| B6 | Match some conditions | `builds/BuildsPage.test.tsx` · the rows shown are those meeting at least two | `builds/BuildsPage.tsx`: `const matchApplies = match !== null && Boolean(matchList.data) && !matchList.hasNextPage;` -> `const matchApplies = false;` | proved (Part 1, in the browser); Part 2 not built: the gallery's size could not be read, see BF-14 P0 |
| C1 | Lens counts follow the filters | `builds/BuildsPage.test.tsx` · the All tab's number equals the number of rows the list reports | `builds/BuildsPage.tsx`: `const lensFilters = lensCountParams(params);` -> `const lensFilters = lensCountParams(clearedFilters(params));` | proved |
| C2 | The table shows it is updating | `builds/BuildsPage.test.tsx` · changing a filter: the old rows stay, marked as updating | `builds/BuildsPage.tsx`: `const updating = list.isPlaceholderData;` -> `const updating = false;` | proved |
| C3 | "1 of 2 builds" | `builds/BuildsPage.test.tsx` · with a filter on, the head reads "1 of 2 builds" | `builds/BuildsPage.tsx`: `const buildsLabel = filtered && stats.data ?` -> `const buildsLabel = false && stats.data ?` | proved |
| C4 | One way to show an empty value | `builds/BuildsViews.test.tsx` · a row with no steps, sessions, field | `builds/BuildsTableView.tsx`: `return row.built \|\| <Empty />;` -> `return row.built;` | proved |
| C5a | Use the width the rail took | `e2e/tier1/builds-filters.spec.ts` · desktop at 1440 by 900: the default table does not scroll sideways | `builds/BuildsView.tsx`: the Table wrapped in `<div style={{ marginLeft: 312 }}>` (the rail's width): scrollWidth 1275 in 970, fails; restored 1282 in 1282 | proved |
| C5b | The Build column is pinned | `builds/BuildsViews.test.tsx` · the Build head and every Build cell are position sticky | `builds/BuildsTableView.tsx`: `id === "build" ? { position: "sticky"` -> `false ? { position: "sticky"` | proved |
| C6 | Columns can be reordered | `builds/buildsModel.layout.test.ts` · chosenColumns keeps the saved order | `builds/buildsModel.ts`: `return ["build", ...[...new Set(saved)].filter((id): id is ColumnId => id !== "build" && offered.has(id))];` -> `return availableColumns(countsLive).filter((id) => id === "build" \|\|` | proved |
| C7 | Headers stay on one line | `builds/BuildsViews.test.tsx` · every column head has white-space nowrap | `builds/BuildsTableView.tsx`: `verticalAlign: "bottom", whiteSpace: "nowrap" });` -> `verticalAlign: "bottom" });` | proved |
| C8 | One set of names for filters and columns | none: `columnNames.test.ts` does not exist | (no fix to revert) | not done: BF-10 Part 1 stopped at its A5. With the heads renamed to the filters' names (Tools and stack, Last confirmed, Still open) the default table is 1315 wide in 1282 at 1440; Miles chooses longer heads or a short label for both places |
| C9 | The chooser is grouped, off the table | `builds/BuildsViews.test.tsx` · the popover opens to the left of its button | `builds/BuildsTableView.tsx`: `side={phone ? "bottom" : "left"}` -> `side="bottom"` | proved |
| C10 | The lamp is explained, hidden at zero | `builds/BuildsViews.test.tsx` · a build with no reproductions shows 0 and no lamp | `builds/BuildsTableView.tsx`: `{row.reproductions > 0 ? <RowLamp lit={row.lit} /> : null}` -> `<RowLamp lit={row.lit} />` | proved |
| C11 | Tools are named | `builds/BuildsViews.test.tsx` · each tool mark can be focused and names its tool | `builds/BuildsTableView.tsx`: `<span role="img" aria-label={tool.name} title={tool.name} tabIndex={0}` -> `<span role="img" title={tool.name}` | proved |
| C12 | A dash when there are no runs | `builds/BuildsViews.test.tsx` · a build with no runs in twelve weeks shows the empty mark | `builds/BuildsTableView.tsx`: `if (runs.every((value) => value === 0)) return <Empty />;` -> `(deleted)` | proved |
| C13 | The scrollbar is thin | `builds/BuildsViews.test.tsx` · the Table without the rail | `builds/BuildsTableView.tsx`: `scrollbarWidth: "thin",` -> `(deleted)` | proved |
| D1 | One head for all three views | `builds/BuildsMapsView.test.tsx` · the head is the shared head | `builds/BuildsMapsView.tsx`: `<BuildsHead figure={buildsLabel}` -> `<BuildsHead figure={`Maps: ${buildsLabel}`}` | proved |
| D2 | Zero sessions is not one session | `builds/BuildsMapsView.test.tsx` · a build with no sessions says | `builds/BuildsMapsView.tsx`: `card.sessions === 0 ? "No sessions yet" : card.sessions === 1` -> `card.sessions <= 1` | proved |
| D3 | One source for the session count | `src/lib/build/buildsTable.test.ts` · a row whose step_count is null has no session count | `src/lib/build/gallery.ts`: `sessionCount: typeof row.step_count === "number" && typeof row.session_count === "number"` -> `sessionCount: typeof row.session_count === "number"` | proved in code; backfill not yet run (no answer from Miles in the BF-03 report) |
| E1 | A pressed value filters in place | `builds/BuildsPage.test.tsx` · Classification: a value's link keeps view=classification | `builds/BuildsPage.tsx`: `const valueHref = (key: string) => galleryHref({ ...params, facets:` -> `const valueHref = (key: string) => galleryHref({ ...params, view: unde` | proved |
| E2 | Pressable values look pressable | `builds/BuildsClassificationView.test.tsx` · a value with a link is underlined at rest | `builds/BuildsClassificationView.tsx`: `textDecorationLine: "underline",` -> `textDecorationLine: "none",` | proved |
| E3 | The key sits beside what it explains | `builds/BuildsClassificationView.test.tsx` · is the element directly before the card grid | `builds/BuildsClassificationView.tsx`: `{cards.length === 0 && empty ? (` -> `<span />\n      {cards.length === 0 && empty ? (` | proved |
| E4 | An unclassified card collapses | `builds/BuildsClassificationView.test.tsx` · says "Not classified yet" once | `builds/BuildsClassificationView.tsx`: `const blank = card.rows.every((row) => row.values.length === 0);` -> `const blank = false;` | proved |
| E5 | Classification's filters are a dialog | `builds/BuildsClassificationView.test.tsx` · pressing Filters opens the dialog and does not draw the panel inline | `builds/BuildsClassificationView.tsx`: `{filters ? <BuildsFilters {...filters} open={filtersOpen} onOpenChange={setFiltersOpen} /> : null}` -> `null` | proved |
| F1 | Save current only with something to save | `builds/BuildsPage.test.tsx` · Save current is disabled when no filter is on and the layout is the default | `builds/BuildsPage.tsx`: `const canSave = !dirty && somethingToSave;` -> `const canSave = !dirty;` | proved |
| F2 | The save dialog says why Save is disabled | `builds/SetDialogs.test.tsx` · with no name, a hint reads | `builds/SetDialogs.tsx`: `Give it a name to save.` -> `(deleted)` | proved |
| G1 | Non-text marks reach 3:1 | `builds/marks.test.ts` · no Builds file paints a meaningful mark in --line | `builds/BuildsFiltersView.tsx`: `margin: "0 6px", borderRadius: 1, background: t.label }}>` -> `margin: "0 6px", borderRadius: 1, background: t.line }}>` | proved |
| G2 | No text under 12px | `builds/marks.test.ts` · no Builds view sets type under 12px | `builds/BuildsMapsView.tsx`: `<span style={text(12, 400, t.label)}>{`${card.maker` -> `<span style={text(11.5, 400, t.label)}>{`${card.maker` | proved |
| G3 | No pointer target under 24px on Builds | `e2e/tier1/builds-filters.spec.ts` · Table (sample data): no pointer target is smaller than 24 by 24 (and the other five target tests) | `builds/BuildsTableView.tsx` ToolMark: `padding: 4, margin: -4` removed: 21 targets under 24, fails; restored 0 | proved |
| G4 | Filters is the obvious action when on | `builds/BuildsViews.test.tsx` · FiltersButton: with three on it reads | `builds/BuildsFrame.tsx`: `{...rest} selected={on}>` -> `{...rest} selected={false}>` | proved |
| X1 | Maps draws the filters as a dialog | `builds/BuildsMapsView.test.tsx` · pressing Filters opens the dialog and does not draw the panel inline | `builds/BuildsMapsView.tsx`: `{filters ? <BuildsFilters {...filters} open={open} onOpenChange={setOpen} /> : null}` -> `null` | proved |
| X2 | One Clear all | `builds/buildsModel.clear.test.ts` · clearedFilters keeps lens, view and sort | `builds/buildsModel.ts`: `view: params.view, sort: params.sort, dir:` -> `view: params.view, dir:` | proved |
| X3 | One chip row in every view | `builds/BuildsMapsView.test.tsx` · six active filters draw six chips and Clear all | `builds/BuildsMapsView.tsx`: `<ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />` -> `<ActiveFilters chips={chips.slice(0, 4)} onRemove={onRemoveChip} onCle` | proved |

## Dead code seen

- `SortOption` and `SORT_OPTIONS` were deleted by BF-12 P3 (nothing else read them). Nothing else the series left unused is
  known.
- `filterDrag.ts` was deleted by BF-07 P3; `columnDrag.ts` (BF-13) follows its pattern.
- `sortableBy` is gone from `BuildsTableViewProps` (BF-12 P2).
- The BF-02 to BF-10 reports (commit messages) list no other dead code.

## Questions for Miles still open

- **C8, one set of names (BF-10).** Renaming the heads to the filters' names (Tools and stack, Last confirmed, Still open)
  makes the default table 1315 wide in 1282 at 1440. Longer heads and a wider frame, or one short label used in both
  places?
- **D3, the session count (BF-03).** Has `/dev/backfill-counts` been run, and what did its summary say? Until it is, a build
  saved before SV-23 shows the empty mark for Steps and Sessions.
- **B6, match in the database (BF-14).** How many builds are in the gallery today? Part 2 is built only past 200, or if you
  want it now.
- **B3, server sorts (BF-12).** Which columns do readers ask to sort once the list passes 50 builds? Only six sort in the
  database today.
- **A8, saved sets' name (BF-09).** Keep "saved filter sets", or rename to "saved views" (which reaches Library and
  OpenBuilds)?

## Not built, and why

- A tool's name with "+2" in the Tools cell (C11): the marks are named, one per tool.
- A count beside each value that follows the draft (A2): only the total follows it.
- A head row pinned while the page scrolls down (C5b): the table would need a region that scrolls both ways (BF-13 A4).
- Server sorts beyond the six database orderings (B3).
- Ranking or marking rows by how many conditions they met (B6), and lens counts that follow a match.
- Match in the database (BF-14 Part 2): gated on the gallery's size, which this session could not read.
- The facets and Tools and stack as countable conditions (BF-14): `builds.facets` is a snapshot taken at save time, not
  provably what the browser derives (BF-02 A4).
- The board redraw: the three Builds boards stay retired (BF-00); the BF README's design spec is the source of truth.
- BF-02 Part 3 (matching facets in the browser): its premise was false.
- BF-10 Part 1 (one set of names): stopped at its A5, as C8 above.

## Checks at the end of the series (12 November 2026), against BF-00's baseline

| Check | BF-00 baseline | End | Builds-related failure? |
| --- | --- | --- | --- |
| `npm test` | 11479 tests, 31 failed | 11771 tests, 33 failed (main alone: 11594, 33 failed) | none: the failures are build-page, compose and lookRules files main also fails |
| `tsc` | | clean after merging main (main had one error in `detailsOptional.tsx` earlier) | none |
| `npm run lint` | | 888 errors, all outside the series' files; the Builds files have warnings only | none |
| `npm run build` | | passes | none |
| e2e tier 1, desktop and mobile | | 351 passed, 134 failed, 27 skipped; every Builds spec passes | none: auth-entry, backdrop, wide-layout, home, build, profile, post-thread and signin frames |
| `/builds` requests and rounds (`audit:pages`) | cold 13 requests, 2 rounds; first 13, 1 round | cold 14, 2 rounds; first 13, 1 round; reload 11, 2 | none: Builds meets its targets; home and profile miss theirs |
| LCP, INP proxy, CLS for /builds (`audit:perf`, noon/dusk) | 1256/1260 ms, 24/32 ms, 0.043 | 1432/1480 ms, 32/24 ms, 0.007 | LCP is 180 ms worse, measured while other suites ran on the same machine; worth one quiet re-run |
| `audit:themes`, `audit:contrast` | fail | fail (home's ALT button; references-composer measured nothing) | none |
| Builds chunk | | `BuildsPage` 22.3 kB, `buildsModel` 62.9 kB, `builds` 55.2 kB raw | |

Diff of the series, searched: no em dash, no `select('*')`, no `transition` added under `src/pages/site/builds` (only
tests asserting it is empty), no `.only(`. The `.skip(` added are project gates (`desktop project only`), as the file
already used. Two dependencies entered `package.json` (`@lovable.dev/vite-plugin-*`) through Lovable's own "Changes"
commit on main, not through the series.
