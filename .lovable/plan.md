

## Clean Up Canvas Grid: Zoom, Drag, Block Positioning, and Visual Polish

### Problem
The canvas grid feels overwhelming on first load. Blocks are too large, zoom defaults to 100% which makes the grid feel cramped, dragging requires finding a tiny grip handle, and new blocks always start at column 1 instead of centered.

### Changes

**1. Make 50% the new "100%" — default zoom to 0.5** (`CanvasShell.tsx`)
- Change `useState(1.0)` to `useState(0.5)` for the zoom state
- Keep the zoom controls and display as-is (they'll show "50%" which is fine, or relabel to show "100%" when at 0.5 — but simpler to just keep the raw percentage)

**2. New blocks start centered below the lowest block** (`useCanvasDocument.ts`)
- In `addBlock`, calculate the center column: `Math.max(1, Math.floor((columnCount - colSpan) / 2) + 1)`
- Use this as the default `col` when no explicit position is given (instead of `col: 1`)
- Also update the toolbar's `onInsertBlock` call in `CanvasToolbar.tsx` to not hardcode `col: 1`

**3. Drag from anywhere on the block, not just the grip** (`CanvasBlock.tsx`)
- Remove the `if (!target.closest('.drag-grip')) return;` guard from `handleDragMouseDown`
- Keep the grip icon as a visual affordance but make the entire block surface draggable
- Only prevent drag when clicking toolbar buttons (stop propagation already handles this)
- Change cursor to `grab` on the block card, `grabbing` while dragging

**4. Clean up the upload page's initial canvas appearance** (`CanvasHeader.tsx` + `CanvasShell.tsx`)
- Tighten header padding: reduce from `24px` to `16px`
- Make the dot grid subtler: reduce dot opacity
- Reduce the empty canvas minimum height from `600` to `400`
- Make the TOC sidebar start collapsed when no blocks exist (change `useState(true)` to `useState(false)` or conditional on block count)

### Files to edit

| File | What |
|------|------|
| `src/components/canvas/CanvasShell.tsx` | Default zoom to 0.5, start TOC collapsed, reduce min canvas height |
| `src/hooks/useCanvasDocument.ts` | Center new blocks horizontally |
| `src/components/canvas/CanvasBlock.tsx` | Allow drag from entire block surface, update cursor |
| `src/components/canvas/CanvasToolbar.tsx` | Remove hardcoded `col: 1` from insert |
| `src/components/canvas/CanvasHeader.tsx` | Tighten padding |

