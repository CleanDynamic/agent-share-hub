## Goal

Every button on the editor's top toolbar (the one at `/upload?post_type=build` → `ArticleEditor` → `TopToolbar`) must do something real. No more `"coming soon"` toasts triggered by the `soon()` helper.

## Currently non-functional buttons

Audited `src/components/article/TopToolbar.tsx`:

| Button | Current behaviour |
|---|---|
| Underline | `soon('Underline')` |
| Highlighter (icon) | `soon('Highlight')` |
| Align left / center / right / justify | `soon('Alignment')` (×4) |
| Checklist | `soon('Checklist')` |
| Toggle list | `soon('Toggle list')` |
| Insert image | `soon('Image')` (sometimes routes through prompt) |
| Insert video | `soon('Video')` |
| Insert block reference | `soon('Block reference')` |
| Block-style dropdown: Caption / Callout | `soon(...)` |
| Add block (FileText icon) | falls through to `soon('Insert')` if no handler |

The Undo/Redo, Bold/Italic/Inline-code, text-color, highlight-color swatch, list (bullet/ordered), outdent/indent, link, table, stage grid, divider, block-style heading/body/quote/code, save, publish are all already wired. We do not touch those.

## Fixes

All edits are in `src/components/article/TopToolbar.tsx` plus two small dependency additions and one wire-up in `ArticleEditor.tsx`.

### 1. Add the missing TipTap extensions

`src/components/article/ArticleEditor.tsx`:
- Add `import Underline from '@tiptap/extension-underline'`.
- Add `import TextAlign from '@tiptap/extension-text-align'`.
- Add `import TaskList from '@tiptap/extension-task-list'` and `TaskItem` from `@tiptap/extension-task-item`.
- Register them in the `extensions: [...]` array:
  - `Underline`
  - `TextAlign.configure({ types: ['heading', 'paragraph'] })`
  - `TaskList`, `TaskItem.configure({ nested: true })`

If a package is not yet in `package.json`, install via `bun add @tiptap/extension-underline @tiptap/extension-text-align @tiptap/extension-task-list @tiptap/extension-task-item`.

### 2. Rewire each "soon" button in `TopToolbar.tsx`

- **Underline** → `isActive('underline')`, `onClick={run((c) => c.toggleUnderline().run())}`.
- **Highlighter icon** → `isActive('highlight')`, `onClick={run((c) => c.toggleHighlight().run())}` (use default yellow when no color is selected).
- **Align left / center / right / justify** →
  - `isActive={editor?.isActive({ textAlign: 'left' }) ?? alignment === 'left'}`
  - `onClick={run((c) => c.setTextAlign('left').run())}` (and `'center' | 'right' | 'justify'` for the other three).
- **Checklist** → `isActive('taskList')`, `onClick={run((c) => c.toggleTaskList().run())}`.
- **Toggle list** → repurpose to a real "Toggle bullet/ordered" — since TipTap has no toggle-block primitive, we map it to `c.toggleBulletList().run()` *or* drop the button entirely. Decision: drop the button to avoid duplication with the existing Bulleted-list button (cleaner than a fake toggle).
- **Insert image** → open a small popover (reuse the existing `Popover` component pattern from `LinkPopover`) with two fields: URL and alt text, then call `editor.chain().focus().setImage({ src, alt }).run()`. No prompt fallback.
- **Insert video** → open a similar popover that accepts a YouTube/Vimeo/MP4 URL. For YouTube/Vimeo embed via an `<iframe>` HTML insertion using `editor.chain().focus().insertContent(\`<div class="video-embed">…</div>\`).run()`. For direct mp4 links, insert a `<video controls>` element. No new TipTap extension needed (uses raw HTML insertion which StarterKit allows).
- **Insert block reference** → call the existing `BlockReferenceExtension` trigger. It is already mounted in `ArticleEditor`. Wire the button to `editor.chain().focus().insertContent('@').run()` so the `@`-mention picker opens immediately.
- **Block-style: Caption** → set paragraph + apply class via `editor.chain().focus().setParagraph().updateAttributes('paragraph', { class: 'caption' }).run()`. Add a CSS rule for `.tiptap-article p.caption { font-size: 13px; color: hsl(var(--foreground) / 0.55); font-style: italic; }`.
- **Block-style: Callout** → wrap in blockquote with a `data-callout` attribute, styled in CSS to look like a callout. Implement as `editor.chain().focus().setBlockquote().updateAttributes('blockquote', { 'data-callout': 'true' }).run()`. Add a CSS rule for `.tiptap-article blockquote[data-callout="true"] { background: hsl(var(--secondary)/0.08); border-left: 3px solid hsl(var(--secondary)); padding: 12px 16px; border-radius: 6px; }`.

### 3. Cleanup

- Remove the `soon()` helper if it ends up unused. If still referenced (it isn't after this pass), keep it.
- `Add block` (FileText icon) is already wired to `onInsertBlock` from `ArticleEditor` (which calls `handleQuickInsert('stage')`). Leave as-is.
- `Stage grid` button (`LayoutGrid`) is wired identically. Leave as-is.

### 4. Out of scope

- The bottom `CanvasToolbar` (only mounted inside `CanvasShell` for legacy stand-alone canvas editing) — already fully wired, no change.
- Toolbar layout, colors, dividers, icons, and the publish/save buttons.

## Files touched

- `src/components/article/TopToolbar.tsx` — rewire the 10+ buttons listed above; add two small popovers (Image, Video) inline.
- `src/components/article/ArticleEditor.tsx` — register `Underline`, `TextAlign`, `TaskList`, `TaskItem` extensions; add CSS rules for `.caption` paragraph and `blockquote[data-callout]`.
- `package.json` — `bun add` the four `@tiptap/extension-*` packages.

## Verification

1. Reload `/upload?post_type=build`.
2. Type some text, select it, click each button:
   - Underline toggles underline.
   - Highlighter applies / removes a yellow highlight.
   - Align L/C/R/J actually shifts the paragraph.
   - Checklist creates a `[ ]` checkbox list with toggleable items.
   - Image button opens a URL+alt popover; submitting inserts the image.
   - Video button opens a URL popover; submitting inserts a playable embed.
   - Block reference button opens the `@` block-picker.
   - Block-style → Caption renders smaller italic grey paragraph.
   - Block-style → Callout renders the styled box.
3. No `"— coming soon"` toast fires from any toolbar button.
