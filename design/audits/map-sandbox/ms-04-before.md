# MS-04 before: lines

Run on `claude/new-session-i378np` (the session's branch; the prompt names `ms-04-lines`), on top of main at `625a25b` (MS-03 merged in #526).

## Assumptions

| Prompt says | Found |
| --- | --- |
| `tileLinksOf(steps, files)` gives the build's links | Yes (`sessionMap.ts`). It walks children and tiles sent with a step, so a link's ends can be a child: `mapLinks` lifts both ends to their top-level tile, as `orderFacts` does. |
| A line's id is the first link's `${from}>${to}:${verb}`, "as the README's `hiddenLinks` uses" | `tileLinksOf` dedupes on `${to}>${from}:${verb}` internally but exports no id. The README's form (`from>to:verb`) is used, built from the link's own `from`, `to` and `verb`. |
| Links come only from the build | A Result is not a `Step`, so `tileLinksOf` never links 7 to 9, though `01-finished-map.png` draws that line. `mapLinks` takes the Results as an optional fourth argument, as `orderFacts` does, and adds `${from}>${result}:makes`. Without it, nothing changes. |
| An inner drop line: "one directly under the other in Stack, with nothing between" | Worked out from the layout alone (`mapLinks` gets no geometry): consecutive tiles of one box in Stack. Across (consecutive, side by side, as 8 to 7 on the boards) and Grid (neighbours in a row or a column) count too, since their slots touch the same way; the drop is then horizontal. |
| `geometry.gutters` gives the gutters | Yes (MS-02): every gutter is a 24px rectangle between two children of a split, with `dir`, `splitId` and `index`. "A gutter index" in `linkGutters` is taken as the position in `geometry.gutters`, the only index that names one gutter on the whole canvas. Out of range: ignored. |
| Gutters meet at crossings | A gutter inside a frame stops at the frame's inset (16px plus the frame's head), short of the gutter outside. The graph therefore uses every gutter centre line across the whole canvas and keeps only the stretches that cross no box, so the inset between a frame and its box links the gutters. Frames are not boxes: a line may cross a frame line, as `01-finished-map.png` draws 3 to 7. |
| A port runs from the slot's edge to the box edge through padding, within its own tile's row | Where that stub would cross another tile of the same box (a middle tile of a Stack leaving from the bottom, a tile of an Across box leaving sideways) or reach no gutter (a box at the canvas edge), the next side is tried: the facing side, then the two sides across, then the back. |
| Lines between two tiles of one box that don't touch | The prompt doesn't say. Leaving the box and coming back would need a gutter on that side. They run in the box's padding instead (the side away from the notes in Stack, the bottom in Across), which is inside the end box's padding but alongside other tiles' rows. Reported. |
| Two-way arrows | Not routed here; MS-11 draws them from `isLevel` (MS-03). |
| The 50-tile fixture | `fiftyLayout()` in `mapSandboxTestSupport.ts` and `measureFor("fiftyTiles")`. |

## Plan

- Part 0: this file -> verified by: reading it against `sessionMap.ts`, `mapGeometry.ts` and `mapOrder.ts`.
- Part 1: `mapLinks` (lift, drop, merge, ids, dashed, hidden, inner) and `hiddenCount` in `mapLines.ts`, words in `MAP_LINES_COPY` -> verified by: `mapLines.test.ts` (1 to 2 inner, 6 to 5 dashed, merging, hidden counted).
- Part 2: `routeLines` (ports, the gutter graph, the bend-penalised search, the maker's gutter, bundling, arrowhead side) -> verified by: `mapLines.test.ts` (4 to 3 through the middle gutter, no diagonal, no box crossed, three lines 6 px apart, `linkGutters`).
- Part 3: the named tests and the 50-tile timing -> verified by: `npm test`, `npm run lint`, `npx tsc --noEmit`.
