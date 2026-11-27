# MS-10 · Inside a box

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-09 has merged. Read the README, then `MODEL.md`: "Inside a box" (both sections). Look at `07-inside-a-box.png`. Pull main. Branch `ms-10-inside-a-box`. Open one pull request titled `MS-10 map inside a box`.

Layout, reorder, indent, Show, titles, explanations, notes and text boxes. None of it changes a tile's content or the build's order.

## Part 0: plan

The README's audit file and plan. Use MS-00's table "What a tile can show" for Show.

## Part 1: layout

1. The floating bar for a box gets a group: Stack, Across, Grid (a segmented control, the composer's existing one). With Grid, a second control: 2 or 3 columns.
2. Switching re-flows tiles in build order. The box grows or shrinks to fit; neighbours adjust through the shared edges (geometry does this).
3. Across that would make tiles narrower than their minimum (MS-02 returns the width needed): instead of refusing outright, the bar shows "Widen the box to fit 3 tiles side by side?" with Widen, which applies `moveEdge` first, if the neighbours have room; otherwise the reason.
4. Notes side: Left, Right or Off for the box's notes column.

## Part 2: reorder

Dragging a tile up, down or across inside its box shows a line where it would land. Only positions from `allowedTileSlots` (MS-03) are offered; the others are skipped. Keyboard: with a tile selected, Alt and an arrow moves it to the next allowed slot, or announces "Tile 6 comes after tile 5, so it can't move up." Store the result as the box's `tiles` order only when it differs from build order in a way the order allows (tiles that ran together); otherwise leave `tiles` in build order.

## Part 3: indent

Drag a tile right by one step, or press Tab with it selected, to indent it one level under the tile above (`indent[tileId]`); Shift Tab brings it back. Three levels at most, and never deeper than the tile above plus one. Indented tiles get the thin bracket (`canvasRecipes`) and a title one step smaller. Indent never changes order. The first tile of a box can't be indented.

## Part 4: Show

Selecting a tile shows, on its floating bar, a checkbox for each part it actually has (from the table): Text, Settings, Files, Code, Picture. Parts it doesn't have aren't offered. Each part has one fixed place in the tile's format; switching it on adds it there and the box grows. Store in `show[tileId]`; remove the key when it's back to the default.

## Part 5: titles, explanations, notes

1. **Box title.** Click the title (or press Enter on a selected box, then E) to edit it inline. Empty means the session's own title is drawn. 80 characters.
2. **Explanation.** The line under the title; for the maker an empty one shows "Add an explanation" as a placeholder that is never drawn for readers or saved. 280 characters.
3. **Note.** "Add note" on a tile's floating bar writes `notes[tileId]`, drawn in the box's notes column beside the tile with a leader line. 200 characters. A note moves with its tile, including into another box. If the box's notes column is Off, turning a note on sets it to the side with more room.
4. All text editing uses the composer's existing inline text field and its limits display. Text is plain: no Markdown.

## Part 6: text boxes

The toolbar gets **Text**: it splits a new text box (no tiles, a title and explanation only) from the selected box's top, or at the very top of the canvas when nothing is selected. A text box has no session and can sit anywhere the tree allows; it takes part in no order check. This is how the intro on `01-finished-map.png` is made. Tidy (MS-12) never removes a text box that has text.

## Part 7: tests

- Layout switches keep build order; Grid with 3 columns fills row by row; Across offers to widen and widens.
- Reorder offers only allowed slots; keyboard announces refusals.
- Indent: max depth, first tile refused, order unchanged.
- Show offers only parts the tile has and grows the box.
- Titles, explanations and notes save, respect limits, and placeholders never reach reader mode.
- A text box can be added, edited, moved, and is ignored by `orderRefusal`.

## Done when

- Every control above works by pointer and keyboard and saves as one undo step each.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
