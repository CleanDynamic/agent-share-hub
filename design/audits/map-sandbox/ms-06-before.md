# MS-06 before: the editor shell

Run on `claude/new-session-sk8l01` (the session's branch; the prompt names `ms-06-editor`), from main at `3adf758` (MS-05 merged in #528).

## Assumptions

| Prompt says | Found |
| --- | --- |
| The composer may have an undo stack (`SandboxPage.tsx`, `useBuildActions`) | Yes: `useBuildHistory` (CA-20), one history for the whole build, kept in `lib/build/buildHistory.ts`. It covers every write to the build's rows: tiles, sessions, parts, `making` (colours, links, the Classification, map settings), each step a snapshot difference undone by writing it back through the node queue (`restoreSnapshot`). It is capped at `HISTORY_LIMIT` = 50, and its Ctrl or Cmd Z is a document listener (`useBuildShortcuts`) that acts wherever focus is outside a field. It *could* hold a map step through `record({ sentence, undo, redo })`, but not as the prompt asks: 50 steps, not 100; every undo is an awaited database write in the build's queue, where a map step is a layout swap with a 400 ms debounced save; and Ctrl Z in the List would take back a map change the maker can't see. So the map has its own stack (`useMapEditor`), covering the map only, and its keys act only while focus is in the canvas column. Reported under Differences. |
| The live region `announce` | `useAnnounce()` from `BuildAnnouncer.tsx` (CA-26 P4): one polite region round the page; outside it, a no-op. The editor takes `announce` from it. |
| How shortcuts are registered | `useBuildShortcuts` adds one `keydown` listener on `document` and skips any event that is `defaultPrevented`, any field, and any open window. Its ids come from `shortcutOf` (`lib/build/shortcuts.ts`). The map's tiles are the List's cards, which carry `data-node-id`, so with focus on a map tile the List's Delete would remove the *step from the build*, and its arrows would move the List's selection. The canvas column's own `onKeyDown` (React, which runs before the document listener) handles the map's keys and calls `preventDefault` on every List shortcut it doesn't hand back (Delete, arrows, Home, End, Alt arrows, Cmd D, G, A, Z): Find (`/`), Help (`?`) and Save still reach the page. Outside the canvas column the map's keys do nothing. |
| Decision 13: can `SourcesPanel` be on screen with the Map tab | Yes. In the Map lens `SandboxView` draws Sources as its 52 rail at the left, which opens the full panel over the map (`SourcesFrame rail`). So the map's own column is headed **"On the map"**, not "Sources". |
| `setMapLayout` through `makingStep` | `setMapLayout(buildId, layout)` in `making.ts` already is one `makingStep`, refusing a layout `mapLayoutRefusal` refuses. The page runs it in the node queue, as `onMapSettings` does. |
| The composer's save error | Composer writes that fail call `sayFailed(cause, line, retry)` (`draftStart.ts`): the error toast with Retry. The map uses it with "Couldn't save the map. Try again." |
| Legacy session keys never written (MS-05 Part 1.6) | `startFromBuild` keys regions `{ session: "typed-legacy-<n>" }`. Before any write the editor re-keys a legacy session's region (and its outline, and dismissed two-way pairs) by its first tile's id (`forStorage` in `mapStart.ts`); reading maps those keys back (`fromStorage`). |
| `twoWayProblems`, `orderProblems`, "MS-03's fixes" | Both exist in `mapOrder.ts`. MS-03 wrote no fix function. The nearest correct thing: Fix sorts every box's tiles into build order, takes a tile that still reads before an earlier one off the canvas (it goes back to unplaced, in "On the map"), slides a two-way arrow that is no longer level with `slideToLevel`, and removes one that is no longer allowed. One step, undoable. Reported. |
| "Removed from the build" tiles get a Remove button | No tree operation takes a tile off the canvas. `unplaceTile` is added to `mapLayout.ts` beside `placeTile`: out of its box, or the box removed when it was the last tile. |
| Selection on `MapCanvas` | `MapCanvas` takes `selected: string \| null` and `onSelect(id)`, wired to tile clicks only. It now takes `selected: string[]` and `onSelect(id, add)`, draws the 2px `t.evidence` ring, one box's eight handles, box title clicks and background clicks, and reports its geometry (`onGeometry`) so the editor can check the order on what is drawn. |
| The composer's sheet, under 1024 | `shell/BottomSheet` (as `AddFromLibraryWindow` uses). |
| The composer's confirmation for removals | `SmallWindow` with `RecipeButton` and `DangerButton` (`removePieces.tsx`). |
| Session labels (`MemberLabel`, `ToolMark`) | Both exist (`groupLabels.tsx`, `refinedPieces.tsx`). Row recipes in `SourcesPanel.tsx` are module-private; the rows use the same pieces they're made from (`refinedStyles`' `text`, `ellipsis`, `bareButton`, `menuItem`; `hoverFill`, `ring`). |

## Plan

- Part 0: this file -> verified by: reading it against the code.
- Part 1: `useMapEditor.ts` (layout, selection, hover, preview, `apply`, undo and redo to 100, saving, build changes); `unplaceTile`; `forStorage` and `fromStorage` -> verified by: `useMapEditor.test.ts`, `mapLayout.test.ts`, `mapStart.test.ts`.
- Part 2: the Map view's columns, measures in `canvasRecipes.ts`, the sheet under 1024 -> verified by: `MapEditor.test.tsx`, `SessionMap.test.tsx`.
- Part 3: `MapSources` in `MapEditor.tsx` -> verified by: `MapEditor.test.tsx` (placed counts, removed tile, Place on map).
- Part 4: selection on `MapCanvas`, the floating bar, refusals -> verified by: `MapEditor.test.tsx`, `MapCanvas.test.tsx`.
- Part 5: the toolbar (Select, Numbers, zoom, Fit) -> verified by: `MapEditor.test.tsx` (Numbers changes badges).
- Part 6: keyboard -> verified by: `MapEditor.test.tsx` (Tab through boxes in reading order, Delete, undo keys).
- Part 7: tests, then `npm test`, `npm run lint`, `npx tsc --noEmit`.
