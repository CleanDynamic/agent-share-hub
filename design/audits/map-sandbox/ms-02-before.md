# MS-02 before: geometry

Run on the session branch `claude/new-session-nrz4jm` (the session's git rules name it), from main at `5bde19a` with MS-01 merged. MS-03 follows in the same session and branch; see the pull request.

## Assumptions

| Prompt says | Found |
| --- | --- |
| `MAP_WIDTH` lives in `mapLayout.ts` (MS-00) | Yes, same values, keys in another order. Moved to `mapGeometry.ts`; `mapLayout.ts` imports it (the reader clamps to it). `mapGeometry.ts` imports only types from `mapLayout.ts`, so there is no import cycle at run time. |
| The README's types (`MapLayout`, `MapBox`, `MapRegion`, `MapTilePart`) exist | Yes, in `mapLayout.ts`. |
| `MS-01` operations take a `fits` check that MS-02 supplies | Yes (`Fits = (layout) => string \| null`). `fitsOf(layout)` is `fitsWidth(layout, layout.width)`, ready to pass. |
| `canvasRecipes.ts` holds the frame padding | Not yet (MS-05 makes it). `REGION_INSET = 16` lives in `mapGeometry.ts` with a comment, as the prompt says. |
| The tiles' real heights come from the List's tile (MS-05) | No measuring exists yet. `geometryOf` takes a `Measure`; tests pass a fixed one with the heights of `01-finished-map.png`. |
| The `supportInbox` and `fiftyTiles` fixtures exist | Yes (`src/dev/fixtures/mapSandbox.ts`). The Result tiles (`r9`, `r50`) are in `results`, not `steps`. |
| "Grid step" for free widths | Not defined anywhere. Taken as 12 px (one per column), so the 12 columns stay whole pixels wide at every width the snap gives. |
| "x of the 12-column grid lines" | With a 24px gutter between columns, each column has a left and a right line. `columnLines` holds both (24 values, 0 and the width included), so a box edge snapped to a line meets the next box across exactly one gutter. |

## Plan

- Part 0: this file -> verified by: reading it against `mapLayout.ts` and the fixtures.
- Part 1: `MAP_GRID`, `MAP_WIDTH` in `mapGeometry.ts`; `mapLayout.ts` imports `MAP_WIDTH` -> verified by: `mapLayout.test.ts` still green, `tsc`.
- Part 2: `TileSize`, `BoxChrome`, `Measure` types -> verified by: `tsc` and the test measure.
- Part 3: `geometryOf` (widths with snap and minimum, heights that grow, regions, collapsed, shared edges, gutters, column lines), `fitsWidth`, `neighboursAt` -> verified by: `mapGeometry.test.ts` (support inbox at 960, no overlaps and full cover, 960 to 720, snapping, row height and collapse).
- Part 4: `slotsOf` (stack with indent, across with its refusal, grid, notes) -> verified by: `mapGeometry.test.ts` (across refuses with the width it needs).
- Part 5: `snapX`, `snapY` -> verified by: `mapGeometry.test.ts`.
- Part 6: `widthPresets`, `snapWidth`, `phoneOrder` -> verified by: `mapGeometry.test.ts`.
- Part 7: the named tests and the 50-tile timing -> verified by: `npm test`, `npm run lint`, `npx tsc --noEmit`.
