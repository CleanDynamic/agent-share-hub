# MS-03 · Order and two-way rules

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-02 has merged. Read the README (Decisions 8 and 9), then `MODEL.md`: "The order the canvas can never break" and "Two-way arrows". Look at `04-order-and-two-way.png`. Pull main. Branch `ms-03-order`. Open one pull request titled `MS-03 map order and two-way rules`.

Pure TypeScript in a new `src/lib/build/mapOrder.ts`. This is the rule that makes the sandbox safe: no layout, drag or file can put a later tile before an earlier one. Everything later asks this module.

## Part 0: plan

The README's audit file and plan. Also confirm how `stages.ts` says two sessions ran side by side, and whether `tileLinksOf` covers every kind of link the build has (uses, file made by, tests, calls, runs after, is defined in). List any it misses.

## Part 1: what must come before what

`orderFacts(steps, groups, files)` returns, for top-level tiles only (a child's links count as its top-level tile's):

1. **Within a session:** each tile must come no earlier than the tile before it in that session. These pairs are `{ before, after, why: "session" }`.
2. **Across sessions:** every link from `tileLinksOf` where the two top-level tiles are in different sessions gives `{ before: from, after: to, why: verb }`. A tile that uses another must come no earlier than it.
3. **Reachability.** `mustPrecede(a, b)`: true when a chain of these pairs leads from `a` to `b`. Precompute it (the 50-tile fixture has at most a few thousand pairs).
4. **Simultaneous.** `canBeSimultaneous(a, b)`: different sessions and neither `mustPrecede(a, b)` nor `mustPrecede(b, a)`. For boxes: every pair of their tiles can be simultaneous.

Each fact carries a sentence for refusals, built from `tileName` in `sessionMap.ts`: "Tile 6 tests tile 5, so it can't come before it.", "Prompt 3 uses Prompt 4, so it can't come before it.", "Tile 6 comes after tile 5 in Session 2." Put the templates in `MAP_ORDER_COPY`.

## Part 2: bands from geometry

`bandsOf(geometry)`:

1. A tile's band comes from its own slot (`geometry.tiles`), not its box. Two slots share a band when their vertical spans overlap by more than half the shorter one. Bands are made by sweeping slots top to bottom, so the result never depends on input order.
2. Reading order is bands top to bottom, then left to right within a band.
3. `readingOrder(geometry): string[]` and `bandOf(tileId): number`.
4. Replace the stand-in in `phoneOrder` (MS-02) with box order from tile bands: a box comes at the reading position of its first tile.

## Part 3: the check

`orderRefusal(layout, geometry, facts): string | null`. For every fact `{ before, after }` with both tiles placed: refused when `after` reads before `before`, which means `bandOf(after) < bandOf(before)`, or the same band and `after` is to the left of `before` **and** they are in the same session. Tiles from different sessions in the same band are fine either way round: being level means "at the same time or either order", and a use between them is still shown by its line. Return the first broken fact's sentence (the earliest in reading order, so the message is stable).

`orderProblems(...)` returns all of them, for MS-14's check list.

## Part 4: allowed drops

The editor shows unavailable places during a drag. So:

`allowedDrops(layout, measure, facts, moving: { box: string } | { tile: string })` returns every candidate drop for the moving thing, each as `{ target, kind: "insert" | "swap" | "into", side?, allowed: boolean, reason?: string, result?: MapLayout }`:

- Candidates: every box edge (`insertNode`), every other box (`swapNodes`), and for a tile, every box of its session (`moveTile`).
- For each, apply the MS-01 operation, compute geometry, run `orderRefusal`. Refused candidates keep their reason.
- This must be fast enough to run when a drag starts: for the 50-tile fixture, under 50 ms for all candidates of one box. Reuse geometry for untouched branches if the plain way is slower. Measure it in a test and report the number.

`allowedTileSlots(box, tileId, facts)`: inside one box, the positions a tile can move to without breaking order (MS-10's reorder).

## Part 5: two-way rules

1. `twoWayRefusal(layout, geometry, facts, a: MapEnd, b: MapEnd)`:
   - Same session, or linked by any chain: "These happen one after the other."
   - Same thing twice, or an end that isn't placed: refused with a plain sentence.
   - Fine otherwise.
2. `isLevel(geometry, a, b)`: two tiles are level when their slots share a band. Two boxes are level when their rectangles share a band by the same overlap rule.
3. `slideToLevel(layout, measure, facts, a, b)`: when not level, the smallest change that makes them level. Try in order:
   - Give the higher box's `down` parent extra height above it (raise its `sizes` entry for the child before it), so the lower one's slot comes level.
   - Move the box to the other end's row with `insertNode`.
   Return the first result that is level and passes `orderRefusal`, or a refusal ("They can't be level without breaking the order."). MS-11 offers this to the maker.
4. `twoWayProblems(layout, geometry, facts)`: every stored two-way arrow that is no longer allowed or no longer level, after any change. MS-11 and MS-14 use it.

## Part 6: tests

`src/lib/build/mapOrder.test.ts`, on the `supportInbox` fixture laid out as on `01-finished-map.png` (build the layout by hand):

- Reading order puts 1 and 4 in one band, 2 and 5 in the next, 3 and 6 after, then 7 and 8, then 9.
- Moving tile 6's slot above tile 5 is refused with "Tile 6 tests tile 5, so it can't come before it."
- Putting S1's box below S3's is refused (7 uses 3).
- Swapping S1 and S2 is allowed (they ran side by side with no link between them); after the swap, 3 still reads after 4.
- Two-way 1 and 4: allowed and level. Two-way 4 and 5: "These happen one after the other." Two-way 3 and 4: refused (3 uses 4).
- `slideToLevel` for 1 and 4 when S2's box starts lower makes them level and passes the order check.
- `noUses` fixture: all three sessions can share one band.
- The timing tests for Part 4.

## Done when

- `mapOrder.ts` exists with every function above and tests.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
