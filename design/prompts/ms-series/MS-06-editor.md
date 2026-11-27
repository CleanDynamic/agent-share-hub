# MS-06 · The editor shell

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-05 has merged. Read the README (Decision 13 especially), then `MODEL.md`: "How each formatting tool works" (the contract at its top) and "Undo". Look at `11-editor.png`. Pull main. Branch `ms-06-editor`. Open one pull request titled `MS-06 map editor shell`.

The Sessions view becomes an editor: the shell every tool plugs into. This prompt adds selection, the floating bar, Sources, the toolbar, undo and saving, and only one action of its own (remove a box). MS-07 to MS-12 add the tools.

## Part 0: plan

The README's audit file and plan. Also:

- Find whether the composer has an undo stack (search `SandboxPage.tsx`, `useBuildActions` or similar for undo). Say what it covers.
- Find the composer's live region (`announce`) and how keyboard shortcuts are registered there, so the map's don't clash with the List's.
- Decide Decision 13: can the composer's Sources panel (`SourcesPanel.tsx`) be on screen while the Map tab is open? Record the answer and the heading you use.

## Part 1: editor state

`src/pages/site/compose/useMapEditor.ts`:

1. Holds `layout` (the stored one, or `startFromBuild` until the first change), `selected: string[]` (node or tile ids; a tile and a box are never selected together), `hover`, and a `preview` layout used while a tool shows what it will do.
2. `apply(result: TreeResult, announce: string)`: on `ok`, pushes the old layout to undo, sets the new one, saves, and announces the sentence; on refusal, announces the reason and shows it by the pointer or the selection (Part 4). Every tool calls only this.
3. **Undo.** `undo()` and `redo()`, Ctrl or Cmd with Z and with Shift Z, 100 steps. One user action is one step, including the adjustments it caused. If the composer already has an undo stack that can hold map steps, use it and report; otherwise this one, which only covers the map.
4. **Saving.** The first change writes the full layout (the plain arrangement made real). After that, each step saves with `setMapLayout`, debounced 400 ms, through `makingStep`. A failed save shows the composer's existing save error and keeps the layout on screen; the next change retries. Legacy session keys are never written (MS-05 Part 1.6).
5. **Build changes.** When steps or groups change while the editor is open (a tile added in the List), re-read: new tiles are unplaced; removed tiles show as "Removed from the build" (README Decision 6); `twoWayProblems` and `orderProblems` are checked, and anything no longer allowed is listed in a one-line notice above the canvas with "Fix" (which applies MS-03's fixes) and nothing changes silently.

## Part 2: the Map view's columns

Replace the Sessions view's columns with: Sources (252 wide), 16, the canvas column. Measures go in `canvasRecipes.ts`. On widths under 1024 Sources folds into a button in the toolbar that opens it as a sheet, using the composer's existing sheet.

## Part 3: Sources

`MapSources`, in `MapEditor.tsx`:

1. A head: the heading (Decision 13) and "n of m placed".
2. The build's parts, sessions and top-level tiles, in build order, using the composer's existing row recipes and session labels (`MemberLabel`, `ToolMark`). Each tile row shows its number, title and "placed" or nothing; a removed tile shows "Removed from the build" and a Remove button.
3. Leave room in each part and session row for two small buttons, Frame and Outline, which MS-09 adds. Don't draw them yet: no control that does nothing reaches makers.
4. Selecting a session or part row scrolls the canvas to it and highlights it once (the composer's existing `flashOutline`).
5. Tiles can be dragged from here onto the canvas in MS-08. For now a row's menu has "Place on map", which calls `placeTile(layout, id, null, ...)` beside the last box of its session, or splits a new box at the end of its part.

## Part 4: selection and the floating bar

1. Click a box's title area selects the box; click a tile selects the tile; click the canvas background clears. Shift-click adds boxes to the selection (tiles select one at a time). Selected things get a 2px `t.evidence` ring and, for one box, eight handles (they do nothing until MS-07).
2. The floating bar sits above the selection's top-right corner (below it when there's no room), inside the canvas column, never covering the selection. It is a toolbar (`role="toolbar"`, arrow keys move between its buttons). In this prompt it holds the selection's name ("Box · S2", "Tile 5") and, for a box, Remove (with the confirmation the composer uses for other removals when the box holds tiles). MS-07 onwards add their buttons in groups, separated by a rule.
3. Refusals show as a one-line message by the pointer during a drag, or under the floating bar after a click, in `t.lit`, and are announced. They clear on the next action.

## Part 5: the toolbar

Above the canvas, inside the canvas column. Now: on the left Select; on the right Numbers (Build, Session, Part: it only changes `layout.numbers`), zoom (50 to 150%) and Fit. Later prompts add Text (MS-10), Arrow and the hidden-links counter (MS-11), and Tidy, Collapse and Background (MS-12) into the places `11-editor.png` shows, so leave the toolbar as a row of groups they can join. Keep the existing head controls (shown line, Map options) where MS-05 put them.

## Part 6: keyboard

- Tab moves through boxes in reading order; arrow keys move between tiles in a box; Enter on a box enters it, Escape leaves and then clears the selection.
- Delete removes the selected box (with the confirmation).
- Ctrl or Cmd Z and Shift Z undo and redo.
- Shortcuts only act while focus is in the canvas column, so the List's keep working.

## Part 7: tests

- `useMapEditor.test.ts`: apply, refusal, undo, redo, 100-step cap, debounced save calls `setMapLayout` once for three quick changes, first save writes the full plain arrangement, a failed save keeps the layout.
- `MapEditor.test.tsx`: selection, the floating bar's position and name, removing a box returns its tiles to Sources, Numbers changes badges, keyboard moves through boxes in reading order.

## Done when

- A maker can select, remove a box, place a tile from Sources, switch numbers, undo and redo, and every change is saved.
- No control that does nothing reaches the composer.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
