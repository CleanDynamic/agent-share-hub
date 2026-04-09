

## Keyboard Shortcuts, Undo, Stage Bug Fix, and Draft-on-Exit

### 1. Keyboard shortcuts on the canvas grid (`CanvasShell.tsx`)

Add a `selectedBlockId` state. Blocks get a visual selection ring when clicked. Then wire up these keyboard handlers:

- **Backspace / Delete** — delete the selected block (with no confirmation, since it's undoable)
- **Ctrl/Cmd + Z** — undo last action
- **Ctrl/Cmd + Shift + Z** — redo
- **Ctrl/Cmd + D** — duplicate selected block
- **Ctrl/Cmd + A** — select all blocks (multi-select)
- **Escape** — deselect all
- **Arrow keys** — nudge selected block by 1 grid unit (col or row)
- **Tab** — cycle selection to next block in reading order

Pass `selectedBlockId` and `onSelect` to `CanvasBlock` so clicking a block selects it (separate from opening the edit modal — single click selects, double click opens modal).

### 2. Undo/Redo system (`useCanvasDocument.ts`)

Add an undo stack to the canvas document hook:
- Maintain `undoStack: CanvasSnapshot[]` and `redoStack: CanvasSnapshot[]` as refs
- Before every mutation (addBlock, deleteBlock, moveBlock, updateBlock), push the current `{blocks, arrows, stages}` snapshot onto the undo stack and clear the redo stack
- `undo()` — pop from undo stack, push current state to redo stack, restore the popped snapshot
- `redo()` — pop from redo stack, push current to undo, restore
- Cap undo stack at 50 entries
- Expose `undo`, `redo`, `canUndo`, `canRedo` from the hook

Add an Undo button to `CanvasToolbar.tsx` (next to Save).

### 3. Fix stage tab bug (`CanvasShell.tsx`)

The bug: when a stage is selected but all its blocks are filtered out (or stage is newly created with no blocks), `filteredBlocks` is empty and the canvas shows nothing. Also, blocks added while a stage tab is active don't get assigned to that stage.

Fix:
- When `activeStageTab` is set and a new block is inserted via the toolbar, auto-assign it to the active stage
- If a stage tab is selected but has no blocks, show an empty state message ("No blocks in this stage yet — add one or drag blocks here")
- When a stage is deleted, reset `activeStageTab` to null
- Pass `activeStageTab` to the toolbar's `onInsertBlock` so new blocks auto-get the stage assignment

### 4. Save-to-drafts on exit (`Upload.tsx`)

When the user navigates away from the upload page:
- Intercept with `beforeunload` event for browser back/close
- Intercept with react-router navigation using `useBlocker` (react-router v6.4+) or a custom prompt
- Show a confirmation dialog: "Save as draft before leaving?" with three options: **Save Draft**, **Discard**, **Cancel**
- If "Save Draft" — trigger the existing draft save logic, then navigate
- If "Discard" — delete the draft row if it was auto-created, then navigate
- If "Cancel" — stay on the page

### Files to edit

| File | What |
|------|------|
| `src/hooks/useCanvasDocument.ts` | Add undo/redo stack, expose undo/redo/canUndo/canRedo |
| `src/components/canvas/CanvasShell.tsx` | Add selectedBlockId state, keyboard event handler, pass selection props to blocks, fix stage tab assignment |
| `src/components/canvas/CanvasBlock.tsx` | Add selection visual (ring), change single-click to select, double-click to open modal |
| `src/components/canvas/CanvasToolbar.tsx` | Add Undo/Redo buttons |
| `src/pages/Upload.tsx` | Add beforeunload + navigation blocker with save/discard/cancel dialog |

