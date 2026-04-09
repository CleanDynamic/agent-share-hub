

## Canvas Editor Overhaul: Modal Block Editing + Compact Grid Cards + Stage Tabs + Timeline View

### Core concept change

Instead of embedding full editors inside grid blocks (which causes sizing/overflow issues), switch to a two-layer model:

1. **Grid cards** — Small, fixed-size cards on the canvas showing only block type icon + name/title. Clicking opens a modal.
2. **Modal editor** — A centered dialog where the user fills out block content with the full editor (no size constraints).

This also adds stage tabs in the upload editor and a timeline view on the content detail page.

### Changes

**1. Block grid cards — compact representation** (`CanvasBlock.tsx`)
- In edit mode, replace the inline `BlockInlineEditor` with a compact card showing:
  - Block type icon/color accent bar
  - Block name (subheading or type label, e.g. "Prompt" / "My API Call")
  - A small preview snippet (first ~40 chars of textContent, truncated)
  - Click anywhere on the card opens the edit modal
- Keep the drag grip, resize handles, and delete button as-is
- Remove the `canvas-block-scroll` overflow approach — cards are now naturally small
- Default `rowSpan` can drop to 3-4 since cards are just labels

**2. Modal block editor** (`CanvasBlock.tsx` or new `BlockEditModal.tsx`)
- On click, open a dialog/modal centered on screen (max-width 600px, max-height 80vh, scrollable)
- Render `BlockInlineEditor` inside the modal at full size (no compact CSS overrides needed)
- "Done" button closes the modal and applies changes
- This completely solves the sizing problem — editors get proper space, grid stays clean

**3. Stage tabs in upload editor** (`CanvasShell.tsx`)
- If stages exist, render a tab bar above the canvas grid (one tab per stage + "All" tab)
- Selecting a stage tab filters visible blocks to only those assigned to that stage
- "All" tab shows everything (default)
- Add a "+" tab to create a new stage
- This gives structure to the editing flow without cluttering the canvas

**4. Timeline view on ContentDetail** (`ContentDetail.tsx`)
- Replace the flat canvas view with a vertical timeline layout when stages exist
- Each stage becomes a timeline node with:
  - Stage number + title as a heading
  - Blocks rendered sequentially underneath (using existing `ContentBlockViewer`)
  - A vertical line connecting stages
- If no stages, fall back to current linear block rendering
- Remove the spatial canvas grid from the detail page (it's an authoring tool, not a reading tool)

**5. Reduce default block sizes** (`useCanvasDocument.ts` + `CanvasToolbar.tsx`)
- Default `rowSpan`: 3 (cards are just type + name)
- Default `colSpan`: 4 (fits 3 blocks per row on a 12-col grid)
- This makes the canvas feel spacious with room for arrangement

### Files to edit

| File | What |
|------|------|
| `src/components/canvas/CanvasBlock.tsx` | Replace inline editor with compact card + click-to-open modal |
| `src/components/canvas/BlockInlineEditor.tsx` | Remove compact CSS overrides (no longer needed — modal has full space) |
| `src/components/canvas/CanvasShell.tsx` | Add stage tab bar above canvas, filter blocks by active stage |
| `src/pages/ContentDetail.tsx` | Replace CanvasShell view-mode with vertical timeline per stage |
| `src/components/canvas/CanvasToolbar.tsx` | Update default rowSpan/colSpan for new compact cards |
| `src/hooks/useCanvasDocument.ts` | Adjust default rowSpan to 3 |

### Heuristic coverage

| # | Heuristic | How |
|---|-----------|-----|
| 1 | System status | Card shows block type + name at a glance |
| 2 | Real world | Timeline on detail page matches mental model of sequential steps |
| 3 | User control | Modal can be closed without saving; stage tabs filter without deleting |
| 4 | Consistency | All blocks use same compact card pattern |
| 5 | Error prevention | Modal editing prevents accidental drag-while-typing |
| 6 | Recognition | Block type + color accent immediately identifies what each card is |
| 7 | Flexibility | Stage tabs for organized editing; "All" tab for overview |
| 8 | Minimalist | Grid shows only essential info; detail in modal on demand |
| 9 | Error recovery | Modal has cancel/done; changes apply on close |
| 10 | Help | Block type labels and color coding serve as inline documentation |

