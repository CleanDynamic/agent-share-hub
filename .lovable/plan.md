

## Implement TipTap Article Editor with Embedded Stage Grids

This is a major architectural evolution: transforming the editor from "canvas IS the document" to "document CONTAINS canvases." The existing canvas system (CanvasShell, CanvasBlock, ArrowOverlay, DotGrid, etc.) is fully preserved and reused inside embedded Stage Grid nodes.

### The Shift

**Current**: Upload.tsx renders CanvasShell as the entire editor. ContentDetail.tsx renders StageTimeline as a flat list.

**New**: Both pages render a TipTap rich-text document. Stage Grids are custom TipTap nodes that embed miniature CanvasShell instances. Prose, headings, code blocks, images, and quotes flow around them.

### Phase 1 — Database Migration

Add `article_body JSONB` column to `content_items`:

```sql
ALTER TABLE public.content_items
  ADD COLUMN article_body JSONB;
```

This stores the TipTap document JSON. Stage grids within it reference `canvas_stages` and `content_blocks` rows by ID (not duplicated).

### Phase 2 — Install TipTap

Install core TipTap packages:
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`
- `@tiptap/extension-placeholder`, `@tiptap/extension-code-block-lowlight`
- `@tiptap/extension-image`, `@tiptap/extension-heading`

### Phase 3 — New Components

| Component | Purpose |
|-----------|---------|
| `src/components/article/ArticleEditor.tsx` | TipTap editor wrapper — edit mode. Manages extensions, slash command UI, toolbar stats |
| `src/components/article/ArticleViewer.tsx` | TipTap read-only renderer for ContentDetail |
| `src/components/article/StageGridExtension.ts` | Custom TipTap Node extension — defines the `stageGrid` node type with `stageId` attribute |
| `src/components/article/StageGridNode.tsx` | React NodeView component — renders an embedded CanvasShell (edit or view mode) scoped to one stage's blocks |
| `src/components/article/SlashCommandExtension.ts` | TipTap extension for `/` command palette: `/stage`, `/heading`, `/code`, `/image`, `/quote`, `/divider` |
| `src/components/article/SlashCommandMenu.tsx` | React popup for the slash command options |
| `src/components/article/BlockRefExtension.ts` | Inline TipTap node for `[[` block references — renders as clickable chips |

### Phase 4 — StageGridNode (the key piece)

This React component receives a `stageId` from the TipTap node attributes. It:

1. Filters `doc.blocks` and `doc.arrows` to only those belonging to this stage
2. Renders a mini CanvasShell (reusing DotGrid, CanvasBlock, ArrowOverlay) constrained to article width
3. In edit mode: full drag/drop, block insertion, arrow drawing — scoped to this stage
4. In view mode: compact grid, clickable blocks open a focal viewer panel
5. Stage title is editable inline at the top
6. Height auto-expands based on block positions (no fixed height)
7. Light grey background (`rgba(200,200,210,0.06)`) with subtle border to distinguish from prose — following the "light grey and viewable" requirement

### Phase 5 — Slash Command Palette

When the creator types `/` in the article body:

| Command | Action |
|---------|--------|
| `/stage` | Creates a new `canvas_stage` row, inserts a `stageGrid` TipTap node |
| `/heading` | Inserts H2/H3 heading node |
| `/code` | Inserts a code block (monospace, syntax-highlighted) |
| `/image` | Opens file picker, inserts image node |
| `/quote` | Inserts blockquote/callout |
| `/divider` | Inserts horizontal rule |

### Phase 6 — Update Upload.tsx

Replace the current CanvasShell-as-entire-editor pattern:

**Before** (line ~1202): `return <CanvasShell mode="edit" doc={canvasDoc} ...>`

**After**: Render the same header section (badges, title, description) followed by `<ArticleEditor>` which contains the TipTap editor. The CanvasShell still exists — it's now rendered *inside* each StageGridNode within the article.

The upload page structure becomes:
```
[Badges row] [Title input] [Description textarea]
─── Article Body ───────────────────
  TipTap editor (prose, headings, embedded stage grids)
────────────────────────────────────
[YOUR RESULTS section]
[Save draft] [Publish]
```

### Phase 7 — Update ContentDetail.tsx

Replace the current `<StageTimeline>` rendering with `<ArticleViewer>`. If the content has `article_body`, render it through TipTap read-only mode. Stage grids render inline as compact interactive canvases. If no `article_body` exists (legacy content), fall back to the existing StageTimeline view.

### Phase 8 — Light Grey UI Theme for Canvas

Per the heuristics requirement, all canvas/article UI uses light grey translucent styling:
- Article editor background: `rgba(200,200,210,0.04)` 
- Stage grid containers: `rgba(200,200,210,0.06)` with `border: 1px solid rgba(255,255,255,0.08)`
- Slash command menu: frosted glass panel matching existing glass aesthetic
- All text clearly visible (not black-on-black)
- Toolbar uses structure stats display: `3¶ 1H 2⊞` showing paragraph/heading/grid counts
- Empty state shows quick-insert pill buttons for common actions

### Phase 9 — Persistence

**Save flow**: When saving, serialize TipTap doc to JSON → store in `article_body`. Stage blocks and arrows continue saving to `content_blocks`, `canvas_arrows`, `canvas_stages` tables via `useCanvasDocument` (unchanged).

**Load flow**: Load `article_body` JSON → initialize TipTap. Each StageGridNode loads its blocks from the existing canvas document hook filtered by `stageId`.

### Phase 10 — Migration of Existing Content

For existing posts that have canvas blocks but no `article_body`:
- Auto-generate an article body on load: one StageGridNode per stage (or one for all blocks if no stages), preserving all existing block data
- This is a read-time migration, not a batch job

### Files Changed

| File | Change |
|------|--------|
| **New**: `src/components/article/ArticleEditor.tsx` | TipTap editor wrapper |
| **New**: `src/components/article/ArticleViewer.tsx` | Read-only renderer |
| **New**: `src/components/article/StageGridExtension.ts` | Custom TipTap node |
| **New**: `src/components/article/StageGridNode.tsx` | Embedded canvas renderer |
| **New**: `src/components/article/SlashCommandExtension.ts` | `/` palette extension |
| **New**: `src/components/article/SlashCommandMenu.tsx` | Slash command popup UI |
| **New**: `src/components/article/BlockRefExtension.ts` | Inline block references |
| **Modified**: `src/pages/Upload.tsx` | Replace CanvasShell-as-editor with ArticleEditor |
| **Modified**: `src/pages/ContentDetail.tsx` | Replace StageTimeline with ArticleViewer |
| **Modified**: `src/hooks/useCanvasDocument.ts` | Add method to filter blocks/arrows by stageId |
| **Modified**: `src/components/canvas/CanvasShell.tsx` | Add `embedded` prop for constrained rendering (no TOC, no header, auto-height) |
| **DB Migration**: Add `article_body JSONB` to `content_items` |

### Preserved (untouched)

All 17 canvas components remain: CanvasBlock, ArrowOverlay, DotGrid, CanvasTOC, CanvasToolbar, CanvasInsertZone, TemplateLibrary, VersionHistory, AnnotationsList, ExecutionPanel, BlockEditModal, MediaPopup, StageTimeline, BlockContextMenu, BlockInlineEditor, BlockViewerInCanvas, ClearAllDialog.

### Implementation Order

1. DB migration (article_body column)
2. Install TipTap packages
3. Create StageGridExtension + StageGridNode (the hardest piece)
4. Create SlashCommandExtension + SlashCommandMenu
5. Create ArticleEditor (edit mode wrapper)
6. Create ArticleViewer (view mode wrapper)
7. Update Upload.tsx to use ArticleEditor
8. Update ContentDetail.tsx to use ArticleViewer
9. Add legacy content migration logic
10. Apply light grey UI theme throughout

