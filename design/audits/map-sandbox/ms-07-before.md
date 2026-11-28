# MS-07 before: the shaping tools

Run on `claude/new-session-7s63fn` (the session's branch; the prompt names `ms-07-shaping`), from main at `384e779` (MS-06 merged in #530).

## Assumptions

| Prompt says | Found |
| --- | --- |
| MS-01 has every operation: `splitBox`, `mergeBoxes`, `moveEdge`, `spanBox`, `evenOut`, `matchSize` | All six are in `mapLayout.ts`, each returning a `TreeResult` and taking `fits` (`fitsOf` from `mapGeometry.ts`). |
| `spanBox`, then `orderRefusal` on the result | `spanBox` refuses any box with a frame between it and its row ("This box is inside a frame. Span the frame instead."). In the plain arrangement every box sits in a session region inside a part frame, so Span would be refused on every box of both fixtures. Nearest correct thing: `spanNode` now spans a box (with the frames that hold only it) across the row of the nearest down split **or frame** above it: inside a frame, the row ends at the frame. `spanInFrame` is no longer said and goes. Its MS-01 test changes to match. Reported. |
| `orderRefusal` on the result | `editor.check` (MS-06) is what `apply` runs: the same `orderProblems` facts, refusing only a fact the step newly breaks, so a layout that already breaks the order (the build changed) doesn't disable every tool. The tools check with it, so a button that is enabled is never refused by `apply`. Its sentence is `MAP_ORDER_COPY`'s ("Prompt 3 uses Prompt 4, so it can't come before it."), not the prompt's "Tile 3 would come after tile 7". Reported. |
| `mergeBoxes` refusals "These boxes hold different sessions", "These boxes don't share an edge" | `MAP_LAYOUT_COPY.differentSessions` is exactly the first. The second is `notNeighbours`: "These boxes don't share a full edge." Used as it is. `mergeBoxes` checks neighbours first, and boxes of two sessions are never siblings in the plain arrangement (each is in its session's region), so the bar checks sessions first, with the same sentence, so two sessions always read "These boxes hold different sessions". |
| `SharedEdge`, `snapX`, `snapY` | In `mapGeometry.ts` (MS-02). `geometry.edges` holds a `width` edge at each boundary of an `across` split and a `height` edge under every child of a `down` split. `neighboursAt` is there "for Match and Alt-drag". |
| `preview` drawn at 60% over the real layout | `useMapEditor` has `preview`, and MS-06 drew `shown` (the preview *instead of* the layout). The canvas now draws the layout and, over it, the preview's boxes at 60% (`MapCanvas`'s `preview`), so `shown` goes. The editor keeps the canvas's measure so the editor can work out a preview's geometry. |
| A box can't go shorter than its contents | `moveEdge` on a `down` split never takes the extra height below 0, and heights grow from the contents (`geometryOf`). |
| Minimum width for Split | `minBoxWidth(width)` (two columns, never under 160). Side by side needs `2 * min + gutter`; the refusal gives the difference, rounded up. Top and bottom has no width to refuse on. |
| `evenOut`, `matchSize` on a column | Both work on a `down` split's sizes, which are extra heights: Even out in a column evens the extra heights, not the drawn heights. Used as the prompt says (`evenOut` on the shared parent). Asked under Questions. |
| Key S | Free: `shortcutOf` gives S only with Ctrl or Cmd (Save). Board `03` gives Merge the key M; `MODEL.md` gives M to picking up a box (MS-08), so Merge has no key. Reported. |
| Ctrl or Cmd with the arrows | Free: `shortcutOf` gives no meaning to them. |
| The eight handles on a selected box ("MS-07 makes them work", MS-06) | The prompt doesn't ask for them; they stay drawn and inert. Asked under Questions. |

## Plan

- Part 0: this file -> verified by: reading it against the code.
- Part 1: Split: the menu in the floating bar, key S, the cut previewed and dragged with `snapX` or `snapY`, arrows step it, Enter or a click confirms, Escape cancels; the refusal with the px needed; the new half selected with its maker-only line -> verified by: `MapShaping.test.tsx` (Split).
- Part 2: Merge, enabled from `mergeBoxes` and the check, otherwise with its reason as title and description -> verified by: `MapShaping.test.tsx` (Merge).
- Part 3: shared edges: hit areas on every `SharedEdge`, the line and readout, `moveEdge` drags (chained along edges that line up), heights, Alt drag and its fallback, Ctrl or Cmd and the arrows, the box description -> verified by: `MapShaping.test.tsx` (Shared edge), `mapLayout.test.ts`.
- Part 4: Span (`spanNode` within a frame), Even out, Match -> verified by: `MapShaping.test.tsx` (Span, Even out, Match), `mapLayout.test.ts` (spanBox).
- Part 5: previews: the canvas draws `preview` at 60% over the layout; hover or focus of Span, Even out and Match shows it, leaving clears it -> verified by: `MapShaping.test.tsx` (previews), `MapCanvas.test.tsx`.
- Part 6: tests on `supportInbox` and `fiftyTiles`, ending with every tool's layout passing `mapLayoutRefusal` and `orderRefusal`; then `npm test`, `npm run lint`, `npx tsc --noEmit`.
