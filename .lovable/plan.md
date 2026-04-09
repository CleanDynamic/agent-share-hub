

## Canvas Editor Fluidity Overhaul

### Problems from screenshots
1. **Add Block picker** appears as a floating popover to the side — should be a dropdown in the toolbar
2. **No horizontal scroll** — canvas is locked to viewport width, blocks get crammed
3. **Blocks too large** — default `colSpan: 12` (full width) and `rowHeight: 32` make everything oversized
4. **Move handle not obvious** — entire block is drag-target but cursor doesn't indicate this clearly; needs a visible grip handle
5. **Resize handles only appear on hover** — not discoverable enough
6. **Canvas feels crammed** — no padding/gaps between blocks, everything edge-to-edge

### Changes

**1. Move "Add Block" into toolbar dropdown** (`CanvasToolbar.tsx`)
- Add an "Add Block" button with a `+` icon to the toolbar
- On click, show a dropdown (anchored upward from toolbar) listing all block types with accent colors and descriptions
- Clicking a type inserts a block at the next available row
- Remove the floating `+` button from `CanvasInsertZone.tsx` (keep the component for the block type data export only)

**2. Enable horizontal scrolling** (`CanvasShell.tsx`)
- Change `overflowX: 'hidden'` to `overflowX: 'auto'` on the main scroll area
- Set a minimum canvas width of `1200px` so the grid always has room, even on narrow viewports
- This lets users pan horizontally when blocks extend beyond the viewport

**3. Reduce default proportions** (`useCanvasDocument.ts` + `CanvasInsertZone.tsx`)
- Change default `rowHeight` from `32` to `24` — tighter vertical grid
- When inserting blocks, default `colSpan` from `12` to `6` (half-width) and `rowSpan` from `1` to `4` — blocks start at a usable but not overwhelming size
- Add `8px` padding/gap around blocks by insetting their pixel position by 4px on each side in `CanvasBlock.tsx`

**4. Add visible move grip** (`CanvasBlock.tsx`)
- Add a persistent small grip icon (⠿ or `GripVertical` from lucide) at the top-left of every block in edit mode
- Only this grip triggers drag — stop the entire block surface from being a drag target (prevents accidental drags while editing)
- Style: subtle, becomes more visible on hover

**5. Make resize handles always visible in edit mode** (`CanvasBlock.tsx`)
- Show right, bottom, and corner resize handles at reduced opacity (0.3) always in edit mode
- Full opacity on hover (existing behavior)
- This addresses Heuristic 1 (visibility) and 6 (recognition)

**6. Block spacing/padding** (`CanvasBlock.tsx`)
- Add 6px inset on all sides so blocks don't touch each other edge-to-edge
- Reduce inner content padding from `16px` to `12px`

### Heuristic mapping

| # | Heuristic | How addressed |
|---|-----------|---------------|
| 1 | System status | Resize handles always visible; grip handle shows block is movable |
| 2 | Real world | Block types in toolbar dropdown with plain descriptions |
| 3 | User control | Horizontal scroll, explicit move grip, resize from any edge |
| 4 | Consistency | All blocks follow same sizing, spacing, handle patterns |
| 5 | Error prevention | Drag only via grip (no accidental moves while editing) |
| 6 | Recognition | Persistent resize handles, labeled block type dropdown |
| 7 | Flexibility | Horizontal scroll for wide layouts, half-width default blocks allow side-by-side |
| 8 | Minimalist | Smaller default blocks, less cramming, breathing room |
| 9 | Error recovery | Ghost overlay during drag already shows valid/invalid positions |
| 10 | Help | Block type descriptions in toolbar dropdown |

### Files to edit
- `src/components/canvas/CanvasToolbar.tsx` — add "Add Block" dropdown
- `src/components/canvas/CanvasShell.tsx` — enable horizontal scroll, pass `onInsert` to toolbar, set min canvas width
- `src/components/canvas/CanvasBlock.tsx` — add grip handle, persistent resize handles, spacing inset, reduce padding
- `src/components/canvas/CanvasInsertZone.tsx` — remove floating `+` button (export block types only)
- `src/hooks/useCanvasDocument.ts` — reduce default `rowHeight` to 24

