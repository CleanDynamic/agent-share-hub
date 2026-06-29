## Problem

On `/upload/blueprint`, the typed article body, the action row (Insert Grid / Save / Publish), and the bottom status strip don't line up with the TopToolbar borders. The text content sits further left than the toolbar's left edge, and the bottom status bar spans wider than the toolbar. The whole editor surface looks unaligned and asymmetric.

Root cause: the `ArticleEditor` outer container is clamped to `maxWidth: 720`, but its internal pieces each redeclare their own width:

- `TopToolbar` sets `width: 100%` + `overflow-x: auto` and renders an inner row with `minWidth: 'max-content'` — when toolbar buttons overflow on narrow viewports, the scroll container stretches differently than the EditorContent below it.
- `EditorContent` (`.tiptap-article`) re-applies its own `maxWidth: 720` and `margin: 0 auto` on top of the already-clamped parent, which can desync with siblings that don't.
- The action footer row (Insert Grid / Save / Publish) and the `<StatusBar>` are rendered as direct children of the ArticleEditor root without an inner alignment wrapper, so they pick up the root's box but not the same horizontal padding as the ProseMirror content (which has `padding: 48px 24px 32px`).

Net effect: toolbar, text, button row, and status bar each end up on slightly different horizontal rails.

## Fix

Treat the ArticleEditor as a single 720px (760px for blogs) vertical spine and make every direct child sit on the exact same rail.

### Changes

1. `src/components/article/ArticleEditor.tsx`
   - Outer wrapper (line 748): keep `maxWidth: 720 / 760`, `margin: 0 auto`, but add `display: 'flex'`, `flexDirection: 'column'`, `gap: 0`, and a unified horizontal padding `padding: 0` (no inner offset).
   - `.tiptap-article` CSS: remove the inner `max-width` + `margin: 0 auto` (parent already clamps). Keep border/background, but set `width: 100%`.
   - `.tiptap-article .ProseMirror`: change `padding: 48px 24px 32px` → `padding: 32px 0 28px` so the text's left/right edges align flush with the toolbar's left/right edges instead of being inset.
   - `EditorContent` element (line 1090): drop the redundant `maxWidth` / `margin` inline styles; set `width: '100%'`.
   - `TopToolbar` wrapper: ensure it sits at `width: 100%` of the spine (already true) and that `border-radius` matches the editor border treatment top-only.
   - Action row (Insert Grid / Save / Publish, line 1176): wrap in a `width: 100%` container so right-edge alignment matches the toolbar's right edge exactly (no stray padding).
   - `StatusBar` wrapper (line 1263): already `width: 100%, minWidth: 0` — verify it inherits the same 720 spine and is not pushed wider by any ancestor.

2. `src/pages/Upload.tsx`
   - Article body wrapper (lines 1478–1484): remove the extra nested `<div style={{ width: '100%', maxWidth: 720 }}>` — the ArticleEditor now owns its own 720 clamp. Keep `padding: '24px 20px 40px'` and `justifyContent: 'center'` on the outer flex so only one source of truth controls the column width.
   - Header wrapper (line 1449): also drop any double-clamp; pass directly to `CompactUploadHeader` which already enforces its own 720 column.

3. `src/components/article/TopToolbar.tsx`
   - Toolbar root (line 837): keep `width: 100%`, `overflowX: 'auto'`, but add `boxSizing: 'border-box'` so the `padding: 8px 10px` doesn't push the toolbar beyond the parent's 720 rail.

### Result

After the fix, on `/upload/blueprint`:

```text
┌────────────── 720 px centred column ──────────────┐
│  TopToolbar (flush left, flush right)              │
│  ProseMirror text (flush left, flush right)        │
│  [             Insert Grid] [Save] [Publish]       │
│  StatusBar (flush left, flush right)               │
└────────────────────────────────────────────────────┘
```

All four pieces share identical left / right edges and consistent vertical rhythm. No visual changes to colors, fonts, or behavior — purely structural alignment.

### Out of scope

- No changes to the header toggle stack styling.
- No changes to TipTap content, slash commands, or comments overlay.
- No backend / data layer changes.
