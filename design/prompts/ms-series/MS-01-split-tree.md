# MS-01 · The split tree

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-00 has merged. Read the README, then `MODEL.md`: "The canvas is one rectangle, completely filled", "How boxes divide the canvas" and "Shaping the canvas". Look at `design/reference/sandbox/02-tree-of-splits.png` and `03-shaping-tools.png`. Pull main. Branch `ms-01-split-tree`. Open one pull request titled `MS-01 map split tree`.

Pure TypeScript in `src/lib/build/mapLayout.ts`. No React, no pixels, no order rules: MS-02 adds geometry and MS-03 adds order. Every operation takes a `MapLayout` and returns a new one (never mutating) or a refusal.

## The contract every operation keeps

- **Full.** The tree still covers the canvas: every split's children fill it, and `across` sizes still add up to 1.
- **Normal.** A split left with one child is replaced by that child. A split whose child is a split of the same direction is flattened into it, with sizes multiplied through. Ids of nodes that survive never change.
- **Content untouched.** No operation changes which tiles exist or their order inside a box, except where it says so.
- **Result type.** `type TreeResult = { ok: true; layout: MapLayout; changed: string[] } | { ok: false; reason: string }`. `changed` lists the ids whose size or place changed, for undo and for announcements. Reasons live in `MAP_LAYOUT_COPY`.

Write `normalise(layout)` first and run it at the end of every operation. Then add a test helper `expectFull(layout)` that checks the first two points, and call it in every test of this prompt.

## Part 0: plan

The README's audit file and plan.

## Part 1: finding things

- `nodeById(layout, id)`, `parentOf(layout, id)` (with the child's index), `pathTo(layout, id)`.
- `boxOfTile(layout, tileId)`, `placedTiles(layout)`, `boxes(layout)` in tree order.
- `neighbours(layout, id)`: for a node, the siblings it shares a full edge with, with the side (`left`, `right`, `top`, `bottom`). This needs only the tree: two adjacent children of the same split share a full edge; nothing else does at this level. MS-02 adds neighbours across branches using geometry.

## Part 2: the shaping operations

Each one is a pure function. Their minimum-size refusals need widths, so each takes an optional `fits?: (layout) => string | null` check that MS-02 supplies. MS-01 tests pass a stub.

1. **`splitBox(layout, boxId, dir, at = 0.5, newTiles = [])`.** Replaces the box with a split of `dir` holding the box and a new empty box (or a box with `newTiles` from the same session, taken out of wherever they were). If the box's parent is already a split of `dir`, the new box joins that split beside it instead of nesting, sharing the box's size at `at`. The original keeps its contents, title, explanation and style.
2. **`removeBox(layout, boxId)`.** The box's space goes to its neighbour in the same split: the previous sibling, or the next one if it's first. Its tiles become unplaced. The last box on the canvas can't be removed.
3. **`mergeBoxes(layout, aId, bId)`.** Only when they are adjacent children of the same split (a full shared edge) and both hold tiles of the same session (a text box merges with anything). Tiles join in build order: take a `buildOrder: (tileId) => number` argument. The merged box keeps the first box's id, title, explanation and style, and the second's if the first has none.
4. **`moveEdge(layout, splitId, index, delta)`.** Moves the edge between child `index` and `index + 1` of an `across` split by `delta` (a proportion). Clamped so neither side passes the minimum (through `fits`). For a `down` split it changes `sizes[index]`, the extra height, which can't go below 0.
5. **`spanBox(layout, boxId)`.** Stretches the box across the full width of the nearest `down` split's row it sits in. Its siblings in that row stay in a row of their own, placed directly below it. Returns the new layout; MS-03 decides whether the order allows it.
6. **`evenOut(layout, splitId, indexes?)`.** Sets the chosen children's sizes equal, sharing the space they already take. Others stay.
7. **`matchSize(layout, ids, axis)`.** Gives each box the width (`across` parents) or extra height (`down` parents) of the first. Only boxes whose parent split runs on that axis change. A box that can't change is named in the reason.
8. **`swapBoxes(layout, aId, bId)`.** The two boxes trade places and sizes. Everything about each box goes with it.
9. **`insertBox(layout, boxId, targetId, side)`.** Takes a box out (`removeBox` without unplacing its tiles) and splits it in beside `targetId` on `side` (`left`, `right`, `top`, `bottom`), at half the target's size. This is what a drop on an edge does in MS-08.
10. **`moveTile(layout, tileId, toBoxId, buildOrder)`.** Moves a tile into another box, landing in build order. Refused when the target holds another session ("Prompt 4 is in Session 2. This box holds Session 1.": the copy takes the tile's name and both session names) and when it's the last tile of its box ("Remove the box instead"). Needs `sessionOf: (tileId) => string`.
11. **`placeTile(layout, tileId, boxId | null, ...)`.** From Sources: into a box (same rules as `moveTile`) or, with null, into a new box split from the box it's dropped beside (`insertBox` semantics).

## Part 3: regions

1. **`frameRegion(layout, of, boxIds)`.** Wraps the boxes in a region when they are exactly the children (or the whole) of one split, so the region is a rectangle. Otherwise returns `{ ok: false, reason, proposal }`, where `proposal` is the smallest rearrangement that makes them one: move the fewest boxes, keeping every other box in place, using `insertBox`. The proposal is a layout, applied only when the maker accepts (MS-09).
2. **`openRegion(layout, regionId)`.** Replaces the region with its child: the boxes stay in exactly the same places.
3. **`moveRegion`** reuses `insertBox` and `swapBoxes` on the region node: make both accept any node id, not only boxes, and rename them `insertNode` and `swapNodes` with the box names kept as thin wrappers.

## Part 4: tests

`src/lib/build/mapLayout.test.ts`, extended. For every operation: the normal case, every refusal, `expectFull` on every result, ids kept, and the original layout unchanged (deep-frozen input). Plus:

- Splitting a box inside a split of the same direction joins that split.
- Removing the second of three children of an `across` split gives its share to the first, and removing the first gives its share to the second.
- Merging two boxes whose tiles are 6 and 4 gives `[4, 6]` in build order.
- A property test with 500 random sequences of operations on the `fiftyTiles` fixture (a seeded generator, no new dependency): every result is full, normal, and holds every placed tile exactly once.

## Done when

- Every operation above exists, is pure, and keeps the contract.
- Nothing outside `mapLayout.ts` and its tests changed.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
