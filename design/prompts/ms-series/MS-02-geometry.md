# MS-02 · Geometry

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-01 has merged. Read the README (Decisions 7 and 8), then `MODEL.md`: "Columns come from shared edges", "Inside a box" and "Canvas size, readers' screens and builds with 50 tiles". Look at `02-tree-of-splits.png`, `07-inside-a-box.png` and `10-canvas-size.png`. Pull main. Branch `ms-02-geometry`. Open one pull request titled `MS-02 map geometry`.

Pure TypeScript in a new `src/lib/build/mapGeometry.ts`. It turns a `MapLayout` plus the tiles' measured heights into pixel rectangles. Nothing is drawn yet.

## Part 0: plan

The README's audit file and plan.

## Part 1: constants

```ts
export const MAP_GRID = { columns: 12, rhythm: 8, gutter: 24, padding: 20, snap: 6, minBoxColumns: 2, minBoxPx: 160 } as const;
export const MAP_WIDTH = { narrow: 720, standard: 960, wide: 1200, min: 640, max: 1600 } as const;
```

Move `MAP_WIDTH` here from `mapLayout.ts` (MS-00) and import it there.

## Part 2: what geometry needs from outside

Heights come from the tiles as drawn, so the function takes them as input and stays pure:

```ts
interface TileSize { height: number; minWidth: number }
interface BoxChrome { head: number; noteWidth: number }  // title + explanation height; width of the notes column when notes are on
type Measure = { tile(tileId: string, width: number, parts: MapTilePart[]): TileSize; chrome(box: MapBox | MapRegion, width: number): BoxChrome };
```

MS-05 supplies a `Measure` that reads real sizes from the List's tile as rendered (README Decision 14), so heights always match what the List draws. Tests supply a fixed one, using the heights `01-finished-map.png` was drawn with: prompt 113, file and tool 118, agent 140, code 145, check 148, result 118, and prompt with three settings rows 220.

## Part 3: `geometryOf(layout, measure)`

Returns:

```ts
interface MapGeometry {
  width: number; height: number;
  nodes: Record<string, Rect>;          // every node, canvas px
  tiles: Record<string, Rect>;          // every placed tile's slot
  gutters: Gutter[];                     // every vertical and horizontal gutter segment, for MS-04
  edges: SharedEdge[];                   // every draggable shared edge, for MS-07
  columnLines: number[];                 // x of the 12-column grid lines
}
```

1. **Widths.** The root gets `layout.width`. An `across` split gives each child its proportion of the width minus the gutters between them. Then each child's left and right edges are rounded to the nearest grid column line when within `snap` px of it, so columns line up across branches. A child's width never goes below the minimum (`minBoxColumns` grid columns, and never under `minBoxPx`); if the stored proportions would make one narrower, the neighbours give up the space, and `fitsWidth(layout, width)` reports it.
2. **Heights grow.** A box is as tall as its contents: `chrome.head` plus its tiles laid out (Part 4) plus padding, plus its `sizes` extra from a `down` parent. An `across` split is as tall as its tallest child, and every child is stretched to that height, so a row's boxes share top and bottom edges. A `down` split's height is its children plus the gutters between them. The canvas height is the root's height. Round every height up to the 8px rhythm.
3. **Regions.** A region's rectangle holds its frame: the child is inset by the frame's padding (from `canvasRecipes.ts` later; take it as a constant `REGION_INSET = 16` here, with a comment) and the name tab sits on the top edge.
4. **Collapsed.** A collapsed box or region is one line high (`chrome.head` only), and its tiles get no slots.
5. **Shared edges.** For every `across` split, each boundary between two children is a `SharedEdge { splitId, index, x, top, bottom }`. For `down` splits, the boundary under each child is a height edge. MS-07 drags these.
6. **Cross-branch neighbours.** `neighboursAt(geometry, id)`: boxes whose rectangles touch along a full or partial edge across any branch, with the overlap length. MS-07 uses it for Match and Alt-drag.

## Part 4: inside a box

`slotsOf(box, width, measure)`:

- **Stack:** tiles one under another, 16px apart, full width (minus the notes column when `notesSide` is set). An indented tile is inset by 24px per level, and its slot records `level` for the bracket.
- **Across:** tiles side by side, sharing the width equally, 16px apart, tops aligned. Refused when that makes any tile narrower than its `minWidth`: return the width the box would need, so MS-10 can offer to widen.
- **Grid:** `gridColumns` columns, filling row by row in build order; a row is as tall as its tallest tile.
- **Notes.** A note sits in the notes column beside its tile, top-aligned with it, with a leader line point recorded for MS-10.

## Part 5: snapping

`snapX(geometry, x, ignore?)` returns the nearest grid line or other edge within `snap` px, and the guide to draw (`{ x, from, to }`), or the input. `snapY` does the same with the 8px rhythm and other box edges. MS-07 uses these during drags.

## Part 6: width changes and phones

1. `widthPresets()` and `snapWidth(px)`: the free width snaps to narrow, standard or wide within 24px, otherwise to the nearest grid step, clamped to min and max.
2. `phoneOrder(layout, geometry)`: the order boxes stack in on a phone: reading order (bands top to bottom, left to right within a band). MS-03 owns bands; for now implement it with box rectangles (top, then left) and leave a comment that MS-03 replaces it with tile bands.

## Part 7: tests

`src/lib/build/mapGeometry.test.ts`:

- The `supportInbox` fixture's plain arrangement (build it by hand in the test for now) at 960 gives two boxes side by side in Part A with the same top and height, and the Result box spanning the width.
- No two node rectangles overlap except a parent and its descendants; together the leaves fill the root with only gutters between them.
- Changing the width from 960 to 720 keeps every proportion and every order of boxes.
- Edges within 6px of a grid line land on it.
- A row's height is its tallest box. Collapsing that box shrinks the row.
- Across refuses with the needed width when tiles would be too narrow.
- The 50-tile fixture computes in under 20 ms (measure it in the test with `performance.now()` over 20 runs; report the number).

## Done when

- `geometryOf`, `slotsOf`, snapping, `snapWidth` and `phoneOrder` exist with tests.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
