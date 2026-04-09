

## Fix Canvas Block Sizing, Scrolling, and Zoom

### Root cause
The block editors (CodeBlockEditor, PromptBlockEditor, etc.) were designed for a full-page upload form — they have `rows={10}` textareas, multiple labeled sections, and no height constraints. When rendered inside a canvas grid cell that's only `4 × 24px = 96px`, they overflow massively, making one block fill the entire panel.

### Changes

**1. Constrain block content to its grid cell** (`CanvasBlock.tsx`)
- Set block height to the exact grid cell height (not `minHeight`)
- Add `overflow-y: auto` on the `.block-editor-area` div so content scrolls within the block
- Add a subtle scrollbar styled to match the dark theme
- This way each block is a fixed-size card on the canvas; users scroll inside it to edit

**2. Increase default block rowSpan** (`CanvasToolbar.tsx` + `useCanvasDocument.ts`)
- Change default `rowSpan` from `4` to `8` (gives `8 × 24 = 192px` — enough for a compact editor)
- For code blocks specifically, default to `rowSpan: 12` (~288px) since they need more room
- This makes blocks appropriately sized without taking over the screen

**3. Add canvas zoom control** (`CanvasShell.tsx`)
- Add a zoom level state (`0.5`, `0.75`, `1.0`, `1.25`) defaulting to `1.0`
- Apply `transform: scale(zoom)` and `transform-origin: top left` to the grid container
- Adjust `minWidth` and `minHeight` by `1/zoom` so the scroll area stays correct
- Add zoom buttons (−/+) and a percentage label to the bottom-right corner, separate from the toolbar
- Keyboard shortcuts: `Ctrl/Cmd + =` zoom in, `Ctrl/Cmd + -` zoom out, `Ctrl/Cmd + 0` reset

**4. Compact the inline editors for canvas context** (`BlockInlineEditor.tsx`)
- Add a `compact` mode wrapper that reduces font sizes, padding, and textarea rows
- Reduce `FieldLabel` font size and margins
- Override textarea `rows` to smaller values (code: 5 instead of 10, others: 2 instead of 3)
- Since we can't modify ContentBlockBuilder directly (it's shared), wrap each editor in a container with CSS that targets textareas and inputs: smaller font, tighter padding, reduced row count via `max-height`

**5. Fix vertical scroll extent** (`CanvasShell.tsx`)
- The canvas height calculation already adds 200px buffer, but the outer container may clip
- Remove `overflow: hidden` from the outermost shell div
- Ensure the scroll container uses `flex: 1; min-height: 0` so it properly fills and scrolls

### Files to edit
- `src/components/canvas/CanvasBlock.tsx` — fixed height, overflow scroll
- `src/components/canvas/CanvasShell.tsx` — zoom controls, scroll fix
- `src/components/canvas/CanvasToolbar.tsx` — larger default rowSpan per block type
- `src/components/canvas/BlockInlineEditor.tsx` — compact wrapper CSS
- `src/hooks/useCanvasDocument.ts` — default rowSpan adjustment

