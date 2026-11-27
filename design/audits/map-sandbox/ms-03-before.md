# MS-03 before: order and two-way rules

Run in the same session and on the same branch as MS-02 (`claude/new-session-nrz4jm`), on top of MS-02's commits. MS-02 is not merged yet; see the pull request.

## Assumptions

| Prompt says | Found |
| --- | --- |
| `stages.ts` says how two sessions ran side by side | A session ran beside the one above it when its `sessions_meta` entry has `withAbove: true` or `parallelWith` names the one above (`withAboveOf`); `stagesOf` then puts it in the same stage. That is about sessions, not tiles, so it gives no order fact: sessions side by side have no order between them unless a link joins them, which is what the facts say anyway. |
| `tileLinksOf` covers every kind of link (uses, file made by, tests, calls, runs after, is defined in) | Yes for all six: `uses` (an output, or a tool), `reads` (a file, through the file's maker when the files list names one: "file made by"), `tests` (a check using an output), `calls` (a decision called from a code tile), `runs after` (`runsWhen`), `is defined in` (`definedIn`). |
| ...and misses none | One: a **Result** is not a `Step` (it is a `ListResult` with `from`, the number of the step it came from), so `tileLinksOf` never sees it. A Result placed before the tile it came from would pass. `orderFacts` takes the results as an optional fourth argument and adds `{ before: that tile, after: the result, why: "makes" }`. |
| A child's links count as its top-level tile's | `Step.children` and `Step.sentWith` are walked; every link is lifted to the top-level tiles at both ends, and a link inside one top-level tile is dropped. |
| Refusal sentences are built from `tileName` in `sessionMap.ts` | `tileName` gives "Check 6" and "Code 5", not "Tile 6" and "tile 5". The code wins: the sentences read "Check 6 tests Code 5, so it can't come before it." and the tests check that. |
| "Tile 6 tests tile 5" for a pair in one session | Part 1 keeps links only across sessions, but this example is a link inside Session 2. Within a session the pair's fact is the session fact; when a link joins the same two tiles in the same direction, the fact carries the link's verb and sentence. |
| `phoneOrder` (MS-02) is replaced with box order from tile bands | Bands live in `mapOrder.ts`, which imports `mapGeometry.ts`. So that `mapGeometry.ts` doesn't import `mapOrder.ts` back, `phoneOrder` moves to `mapOrder.ts`. |
| `allowedDrops` for a tile: insert on a box edge | MS-01 has no single operation that moves a placed tile into a new box beside another. The candidate is `splitBox` (the tile into a new box) then `insertNode` (that box beside the target), both MS-01 operations. The last tile of a box gets no edge candidates: moving its box does that. |

## Plan

- Part 0: this file -> verified by: reading it against `sessionMap.ts`, `stages.ts` and `graph.ts`.
- Part 1: `orderFacts` with `mustPrecede` and `canBeSimultaneous`, sentences in `MAP_ORDER_COPY` -> verified by: `mapOrder.test.ts` (facts of the support inbox, reachability, simultaneous pairs).
- Part 2: `bandsOf`, `readingOrder`, `bandOf`, `phoneOrder` from tile bands -> verified by: `mapOrder.test.ts` (1 and 4, 2 and 5, 3 and 6, 7 and 8, then 9; order independence).
- Part 3: `orderRefusal`, `orderProblems` -> verified by: `mapOrder.test.ts` (tile 6 above tile 5, S1 below S3, the swap of S1 and S2).
- Part 4: `allowedDrops`, `allowedTileSlots` -> verified by: `mapOrder.test.ts` (the swap allowed, the timing on 50 tiles).
- Part 5: `twoWayRefusal`, `isLevel`, `slideToLevel`, `twoWayProblems` -> verified by: `mapOrder.test.ts` (1 and 4, 4 and 5, 3 and 4, sliding, problems).
- Part 6: the named tests -> verified by: `npm test`, `npm run lint`, `npx tsc --noEmit`.
