# MS-07 · Shaping tools

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-06 has merged. Read the README, then `MODEL.md`: "Shaping the canvas" (Split, Merge, Shared edge, Span, Even out, Match). Look at `03-shaping-tools.png`. Pull main. Branch `ms-07-shaping`. Open one pull request titled `MS-07 map shaping tools`.

Every tool calls the MS-01 operation, checks the MS-03 order where it moves anything, shows a preview first, and goes through `apply` from MS-06.

## Part 0: plan

The README's audit file and plan.

## Part 1: Split

1. The floating bar for one box gets **Split** with two choices, Side by side and Top and bottom (a small menu). Key S opens it with the box selected.
2. Choosing one shows a dashed line at the middle of the box (`preview`). Dragging it moves the cut; it snaps with `snapX` or `snapY` and shows the guide. Enter or a click confirms; Escape cancels.
3. Refused when either half would be under the minimum width: "Needs 160 px more room to split." (the real number).
4. The new half is empty and selected, with the line "Drop tiles from Session 2 here" for the maker (never drawn for readers or saved).

## Part 2: Merge

With two boxes selected, the bar shows **Merge**. Enabled only when `mergeBoxes` would succeed; otherwise disabled with its reason as the title and accessible description ("These boxes hold different sessions", "These boxes don't share an edge").

## Part 3: Shared edge

1. Hovering a gutter over a `SharedEdge` shows the resize pointer and the edge as a 2px `t.evidence` line along the gutter. Dragging moves it with `moveEdge`, snapping to grid lines and other edges (`snapX`), with a small readout of both widths in px.
2. Height edges (under a box in a `down` split) drag the box's extra height. A box can't go shorter than its contents.
3. **Alt drag** resizes only the one box's edge when that leaves no gap (its neighbour across that edge is a single box spanning the same length); otherwise it falls back to the shared drag and says so once.
4. Keyboard: with a box selected, Ctrl or Cmd plus an arrow moves its right or bottom edge by one grid step (left and up move the left or top edge, where it has one).
5. Edges are drag handles for pointer users only; they're hidden from screen readers, and the keyboard way is announced in the box's description once ("Ctrl and arrows resize").

## Part 4: Span, Even out, Match

1. **Span** on the bar for one box. Run `spanBox`, then `orderRefusal` on the result. Enabled or disabled with the reason ("Tile 3 would come after tile 7").
2. **Even out** when two or more boxes of the same split are selected, or one box (evens its whole row). `evenOut` on the shared parent.
3. **Match** when two or more boxes are selected: Match width, Match height. `matchSize`, refusing with the box in the way.

## Part 5: previews

Every tool shows its result before it applies: Split while dragging the cut, edges while dragging, and Span, Even out and Match on hover or focus of their button (draw `preview` at 60% opacity over the real layout, with no motion). Leaving the button clears it.

## Part 6: tests

Component tests for each tool on the `supportInbox` and `fiftyTiles` fixtures: the happy path saves one undo step; each refusal shows its reason and changes nothing; Alt drag falls back; keyboard resizing works; previews appear and clear. End with a check that after every tool the layout passes `mapLayoutRefusal` and `orderRefusal`.

## Done when

- Split, Merge, Shared edge, Span, Even out and Match work by pointer and keyboard, preview first, and refuse with a reason.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
