

# Plan: Upgrade the Article Editor from "Plain Text Box" to Full Rich Article Editor

## Current State

The architecture is **fully built and wired**:
- TipTap editor with StageGrid, BlockRef, Slash Command, and Format Toolbar extensions
- CSS styling for paragraphs, headings, code blocks, blockquotes, images, lists
- SlashCommandMenu with Stage Grid, Heading, Code Block, Image, Divider, Lists
- ArticleUploadShell with title, description, cover image, and bottom toolbar
- StageGridNodeView rendering embedded CanvasShell in edit mode

The problem: it currently looks and feels like a bare text area. The visual cues, empty-state guidance, and polish described in the plan are missing.

## What Needs to Change

### 1. Rich Empty State in the Editor
Replace the blank editor with a visually guided empty state that shows the user what they can do:
- A subtle placeholder that reads more like a template: "Start writing your article... Type / to insert a stage grid, heading, code block, or image"
- Add a centered insert hint when the editor is empty — show clickable quick-insert buttons (Stage Grid, Heading, Code, Image) as pill buttons, not just text

### 2. Enhanced Slash Command Menu Styling
The current SlashCommandMenu renders but needs visual polish:
- Frosted glass background matching the NeoScale aesthetic
- Larger emoji icons with better spacing
- Category grouping (Content / Structure / Media)
- Keyboard hint badges (↑↓ to navigate, Enter to select)

### 3. Stage Grid Node View Polish
The StageGridNodeView renders CanvasShell but needs:
- A clear visual boundary — the frosted glass border with the stage label header
- In edit mode: show "Click + to add blocks" when the stage is empty
- Ensure the CanvasShell embedded mode renders at the correct width with proper padding

### 4. Article Format Toolbar Enhancement
The BubbleMenu toolbar works but needs:
- Add heading toggle (H2/H3) buttons
- Add block reference insertion button
- Better visual styling matching the dark theme

### 5. Bottom Toolbar Enhancement
The toolbar has Back, /Insert, Save, Publish. Add:
- A visual indicator showing article structure (e.g., "3 paragraphs, 1 stage grid, 1 code block")
- Keyboard shortcut hints (Cmd+S to save)

### 6. Editor Content Area Styling
- Add a subtle left margin guide line for the article column
- Ensure proper spacing between embedded stage grids and surrounding prose
- Add a gentle fade-in animation when nodes are inserted

## Files to Edit

| File | Changes |
|------|---------|
| `src/components/TipTapEditor.tsx` | Add rich empty state with quick-insert buttons, better placeholder |
| `src/components/SlashCommandMenu.tsx` | Visual overhaul — glass styling, grouping, keyboard hints |
| `src/components/ArticleFormatToolbar.tsx` | Add heading toggles, block ref button |
| `src/components/ArticleUploadShell.tsx` | Bottom toolbar enhancements, structure indicator |
| `src/styles/tiptap.css` | Enhanced spacing for stage grid nodes, transitions |
| `src/lib/StageGridNodeView.tsx` | Empty state for new stage grids, visual polish |

## Technical Details

- No database changes needed — all TipTap extensions and DB tables already exist
- No new dependencies — TipTap, BubbleMenu, and all extensions are already installed
- The CanvasShell in embedded mode (`embedded={true}`) already handles the stage grid rendering
- StageGridExtension already creates `canvas_stages` and `article_stage_grids` rows on insert

