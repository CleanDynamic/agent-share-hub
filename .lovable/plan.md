

## Fix Bottom Toolbar Overflow and Page Horizontal Scroll

### Problems
1. **Toolbar pill is too wide** — it has too many items (Back, Undo, Redo, + Block, Templates, History, Notes, block count, Save, Publish, plus zoom controls in a separate pill) all in a single row. On the user's 1102px viewport it overflows and clips.
2. **Horizontal page scroll to dead space** — the grid div has `minWidth: 1200` which forces the scroll area wider than the viewport. Combined with `transform: scale(0.5)`, the browser still allocates 1200px of layout width before scaling, creating a scrollbar to empty space.

### Changes

**1. Fix horizontal overflow on the canvas** (`CanvasShell.tsx`)
- Remove `minWidth: 1200` from the grid container
- Instead, set `width: ${100 / zoom}%` so at 50% zoom the content fills the viewport naturally without forcing a scrollbar
- Set `overflowX: 'hidden'` on the main scroll area to prevent any dead-space scroll

**2. Consolidate and slim down the toolbar** (`CanvasToolbar.tsx`)
- Remove the separate zoom controls from `CanvasShell.tsx` — merge zoom −/+/% into the toolbar pill (replacing the block-count/status area which is low-value)
- Drop the text labels from Undo/Redo (icon-only buttons are clear enough)
- Drop the "Templates" and "History" text buttons — move them into a `⋯` overflow menu (three-dot button that opens a small popover with Templates, History, Notes)
- Keep the primary actions visible: Back, Undo, Redo, + Block, Save, Publish
- Add `max-width: calc(100vw - 32px)` to the toolbar pill so it never exceeds the viewport
- Reduce gap from 5 to 3px between items

**3. Merge zoom into toolbar** (`CanvasToolbar.tsx` + `CanvasShell.tsx`)
- Pass `zoom`, `onZoomIn`, `onZoomOut` as props to `CanvasToolbar`
- Render a compact `− 50% +` control inline in the toolbar
- Remove the separate fixed-position zoom widget from `CanvasShell.tsx`

### Files to edit

| File | What |
|------|------|
| `src/components/canvas/CanvasShell.tsx` | Remove `minWidth: 1200`, set `overflowX: 'hidden'`, remove standalone zoom widget, pass zoom props to toolbar |
| `src/components/canvas/CanvasToolbar.tsx` | Add `max-width`, merge zoom controls in, move Templates/History/Notes into overflow menu, slim down layout |

