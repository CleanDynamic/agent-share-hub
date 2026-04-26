## What's working

- TopToolbar visual design — premium Word-style strip with groups, dividers, tooltips, color swatches.
- Writing surface — Inter 15px / 1.75, orange caret + selection, blockquote/code/heading styles, italic placeholder.
- Slash menu — categorised palette, keyboard nav, action callbacks wired to TipTap.
- Save/Publish row, focus-mode background fade.

## What's broken (visible in your screenshot)

**1. TopToolbar buttons do nothing.** Every `onClick` is `noop`. Even though `editor` is passed in, it's discarded with `void editor`. Bold, Italic, headings, lists, code, alignment — none of them affect the document.

**2. StatusBar overflows and wraps.** At the current ~640px center panel width the bar tries to fit 11 items on one row, so labels collide ("01↑ Saved0 0 ⌄min words", "Edit 0 chars 100% …"). The MoreHorizontal "…" duplicate dropdown sits outside the bar in a separate 28px square button next to it, which looks tacked-on.

**3. Save/Publish row sits in dead space.** Floats far above the status bar with a big gap.

## Plan

### A. Wire TopToolbar to the editor (`TopToolbar.tsx`)

Replace `noop` with real TipTap commands, derive active state from `editor.isActive(...)`, and re-render on selection change with a small `useEditorState` subscription (forceUpdate on `editor.on('selectionUpdate' | 'transaction')`).

| Button | Command |
|---|---|
| Undo / Redo | `editor.chain().focus().undo()/redo()` + `editor.can().undo/redo()` for disabled state |
| Block style dropdown | reads current heading level / paragraph; sets via `setParagraph()` / `toggleHeading({level})` / `toggleBlockquote()` / `toggleCodeBlock()` |
| Bold / Italic / Underline* / Strike / Code | `toggleBold()` etc. with `isActive` highlight (* underline mark not in StarterKit — keep button but no-op with tooltip "Coming soon" if extension absent) |
| Subscript / Superscript | not in StarterKit — toast "Coming soon" |
| Bullet / Ordered / Task list | `toggleBulletList()`, `toggleOrderedList()`, task list → toast |
| Indent / Outdent | `sinkListItem('listItem')` / `liftListItem('listItem')` |
| Align left/center/right/justify | not in StarterKit — toast "Coming soon" |
| Link | reuses the same prompt logic as `Mod-k` shortcut — toast for now if `link` mark missing |
| Image | toast (slash menu handles real insert) |
| Inline code / Code block | `toggleCode()` / `toggleCodeBlock()` |
| Horizontal rule | `setHorizontalRule()` |
| Color swatches / Highlight | toast "Coming soon" (no color/highlight extensions installed) |
| Insert block (+) | already wired via `onInsertBlock` |

All visual styling stays exactly as it is — no layout/colour changes.

### B. Fix StatusBar layout (`StatusBar.tsx`)

The bar is too dense for a 640px panel. Changes (visual only, same height):

1. **Drop low-value items at narrow widths** by hiding everything except branch, save status, word count, focus, zoom, and the "…" menu when `< 720px`. Use a `ResizeObserver` on the bar's container so wider viewports still show errors/warnings/chars/collaborators/wifi.
2. **Move the external "…" (More options) button into the StatusBar itself** — it's already there. Remove the duplicate one rendered in `ArticleEditor.tsx` next to the bar.
3. **Add `whiteSpace: 'nowrap'` and `flexShrink: 0`** to every status item so nothing wraps mid-label ("min words" stacking).
4. **Tighten the title ellipsis** to `maxWidth: 100` so it never pushes other items off-screen.
5. **Right group `gap: 4`** instead of `2` so zoom controls don't crowd into the chars label.

### C. Tighten Save/Publish row (`ArticleEditor.tsx`)

- Remove the standalone `MoreHorizontal` dropdown button next to `<StatusBar/>` (moved into the bar in step B).
- Reduce the row's `padding` from `12px 0 8px` to `8px 0 6px` and remove `marginTop: 8` so it sits directly above the status bar.

### D. Verify

- Type "/" → slash menu opens. Pick "Heading 2" → editor inserts H2.
- Click **B** in toolbar with text selected → text becomes bold and the button shows the orange active state.
- Pick "Heading 1" from the block-style dropdown → current paragraph becomes H1; dropdown label updates.
- Resize panel → status bar drops secondary items instead of wrapping.

## Files touched

- `src/components/article/TopToolbar.tsx` — wire commands, add active-state subscription, swap `noop` for real handlers.
- `src/components/article/StatusBar.tsx` — responsive hide rules, nowrap, gap tweaks.
- `src/components/article/ArticleEditor.tsx` — remove duplicate "…" button, tighten Save/Publish row spacing.

No changes to `AppLayout.tsx`, `LeftPanel.tsx`, `RightPanel.tsx`, `BlobBackground.tsx`, the page background, or any layout positions.