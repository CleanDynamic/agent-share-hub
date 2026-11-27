# MS-01 before: the split tree

MS-01 runs on top of MS-00 in the same session and branch (MS-00 is not merged yet; see the pull request). Checked against MS-00's `src/lib/build/mapLayout.ts`.

## Assumptions

| Prompt says | Found |
| --- | --- |
| `mapLayout.ts` holds the README's types and `MAP_LAYOUT_COPY` | Yes, from MS-00 Part 1. |
| `newMapNodeId` makes node ids | Yes (`m-` and a uuid). Operations that make a node take an optional `newId` so tests can make ids they can predict. |
| The `fiftyTiles` fixture exists for the property test | Yes (`src/dev/fixtures/mapSandbox.ts`, MS-00 Part 3). There is no `startFromBuild` yet (MS-05), so the test builds its own plain starting tree: one box per session, stacked. |
| `fits?: (layout) => string \| null` is how minimum sizes are checked | Nothing supplies it until MS-02. Every operation that changes a size takes it in an options object; tests pass stubs. |
| `moveTile` needs `sessionOf` and its refusal names the tile and both sessions | There are no names in the tree. `moveTile` and `placeTile` take `tileName` and `sessionName` (default: the id and the key), which the editor fills from the build. |
| `matchSize` gives "the width of the first" | The tree has no pixels, but a node's share of the canvas width is the product of the `across` sizes above it, which is exact apart from gutters. Widths are matched as that share; MS-02 can pass a `fits` check for the minimum. Heights are the `down` extra heights, as the prompt says. |
| "A split whose child is a split of the same direction is flattened, sizes multiplied through" | For `across` the child's sizes are multiplied by its share. For `down` sizes are extra heights in px, not shares: the children keep their own and the inner split's extra height goes to its last child, so the minimum height is kept. |

## Plan

- Part 0: this file -> verified by: reading it against `mapLayout.ts`.
- Part 1: `TreeResult`, `normalise`, `nodeById`, `parentOf`, `pathTo`, `boxOfTile`, `placedTiles`, `boxes`, `neighbours` -> verified by: `mapLayout.test.ts` (`expectFull` on every result, frozen inputs).
- Part 2: the eleven shaping operations, each pure with its refusals in `MAP_LAYOUT_COPY` -> verified by: `mapLayout.test.ts`, one `describe` per operation (normal case, every refusal, ids kept, input unchanged).
- Part 3: `frameRegion` (with a proposal), `openRegion`, `insertNode` and `swapNodes` with `insertBox` and `swapBoxes` as wrappers -> verified by: `mapLayout.test.ts`.
- Part 4: the named cases and the 500-sequence property test on `fiftyTiles` -> verified by: `mapLayout.test.ts`.
