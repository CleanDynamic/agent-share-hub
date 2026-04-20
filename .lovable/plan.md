

## Plan: Inspector — Document variation

Wire the v0 `InspectorDocument` design into the workspace's Inspector tool, using the document store as the data source. Build the Inspector as a **kind-switcher** so future selection-aware variations (Block / Stage / Arrow / Prose) can drop in alongside it.

### Files touched (only two — strict scope)

1. **NEW** `src/components/workspace/tools/InspectorDocument.tsx` — paste the v0 component verbatim (visual + interaction code unchanged).
2. **MODIFY** `src/components/workspace/tools/InspectorTool.tsx` — replace placeholder with selection-kind switcher and wire the Document case to live data.

No other files change. `WorkspaceShell.tsx`, `RightPanel.tsx`, `Upload.tsx`, `documentStore.ts`, `documentPersistence.ts`, `CanvasHeader.tsx`, `LeftPanel.tsx`, `AppLayout.tsx`, and `BlobBackground.tsx` are not touched.

### Switcher structure (InspectorTool.tsx)

```text
useSelection() → selection.kind
  ├─ 'none'    → <InspectorDocument ...wiredProps />
  ├─ 'block'   → "Block inspector coming in Step 2"
  ├─ 'stage'   → "Stage inspector coming in Step 3"
  ├─ 'arrow'   → "Arrow inspector coming in Step 4"
  ├─ 'prose'   → "Prose inspector coming in Step 5"
  └─ 'multi'   → "Multi-select inspector coming later"
```

Placeholders use the same muted style currently in InspectorTool (Inter 13px, rgba(255,255,255,0.50)) — single line, no borders, no padding bloat.

### Data wiring for InspectorDocument

The right panel is mounted inside `RightPanel.tsx` with no props, so we **cannot** prop-drill from `Upload.tsx`. We use the **document store** as the single source of truth, which is what the persistence layer already syncs to Supabase.

| v0 prop | Source | Persistence path |
|---|---|---|
| `title` | Read/write `articleBody.title` (TipTap doc-level attribute, falls back to empty string) | Saved via `setArticleBody` → existing `articleDirty` flush in `documentPersistence.ts` writes `content_items.article_body` |
| `description` | Read/write `articleBody.description` (same channel) | Same as title |
| `coverUrl`, `onCoverAdd`, `onCoverRemove` | Read/write `articleBody.cover_url` | Same as title |
| `words` | Computed: count words in `articleBody` text nodes + every text/heading/quote block in `blocks` map | Read-only |
| `minToRead` | `Math.max(1, Math.ceil(words / 220))` | Read-only |
| `stages` | `Object.keys(stages).length` | Read-only |
| `blocks` | `Object.keys(blocks).length` | Read-only |
| `slug` | Read/write `articleBody.slug` | Same channel |
| `visibility` | Read/write `articleBody.visibility` (default `'private'`) | Same channel |
| `status` | Derived from `articleBody.published_at`: present → `'published'`, else `'draft'` | Read-only here |
| `onPublish` | Toggles `articleBody.published_at = new Date().toISOString()` (or clears for "Update" — keep as set-only for v1) | Same channel |
| `publishDisabled` | `true` when `title` is empty OR `slug` is empty | Computed |

**Why piggy-back on `articleBody`:** the existing persistence layer flushes `articleBody` as a JSON blob into `content_items.article_body` on every change, debounced at 400ms. This means we get autosave for all Inspector fields for free, with no new persistence code, no new DB columns, no touching `documentPersistence.ts`. The Upload.tsx form remains the canonical writer for *publish-time* fields (it serialises everything to dedicated columns on submit) — Inspector edits live in the article body until publish, which matches how the editor itself already works.

> **Note:** This is a deliberate trade-off. A "fully canonical" wiring would require touching `documentStore.ts` to add a `documentMeta` slice, plus `documentPersistence.ts` to flush meta to dedicated columns (`content_items.title`, `description`, `slug`, `visibility`, `cover_image_url`). The user's instructions explicitly forbid touching any other file, so I'm keeping all reads/writes inside the article body blob. If you'd rather have the Inspector write to dedicated `content_items` columns, that requires expanding scope to those two files — say the word and I'll re-plan.

### Stats computation (inline helper in InspectorTool)

```text
words = countWords(articleBody) + sum(block.properties.text || block.properties.content)
countWords(json) walks TipTap JSON, accumulating text node lengths split by /\s+/
```

Memoised with `useMemo` against `articleBody`, `blocks`. Stats panel re-renders on every keystroke but the count operation is O(n) over the doc — fine for typical article sizes.

### Right-panel fit constraints

- v0 component declares `width: 320, maxHeight: 640` — we **drop** the fixed width (let it fill the panel) and **drop** the `maxHeight` (the panel itself constrains height).
- Per the no-vertical-scroll rule on the right panel, the Inspector content as designed (Document + Stats grid + Publishing) measures ~580px tall when the cover is empty and the description is a single line. This fits comfortably inside the workspace body area below the 24px selection strip + 40px tab rail.
- The description textarea uses `resize: "vertical"` in the v0 code — we change this to `resize: "none"` so it can't be dragged past the panel height.

### Auto-switch behaviour (already wired)

`WorkspaceShell.tsx` already calls `setActiveTool('inspector')` when selection changes to block/stage/arrow. No change needed — when those kinds land, the switcher will render the relevant placeholder, and once Steps 2–5 ship those placeholders become real inspectors.

### Persistence model recap

```text
User types in Inspector field
  → setArticleBody({ ...articleBody, title: 'foo' })
  → documentStore subscriber sets articleDirty = true
  → 400ms debounce → flush('full')
  → UPDATE content_items SET article_body = ... WHERE id = $documentId
  → bumpDocumentVersion()
  → usePersistenceStatus → 'saved'
```

No new save buttons, no new toasts, no new RPC calls.

### Acceptance

- Open `/upload` in edit mode → right panel shows Workspace → Inspector tab is active by default → Inspector renders the Document variation (no selection).
- Type into Title / Description / Slug → values persist after refresh (via `article_body`).
- Add and remove cover via Inspector → preview shows immediately, persists.
- Words / Min to read / Stages / Blocks update live as you edit the article.
- Visibility dropdown opens, selects, closes; status pill reflects published_at.
- Publish button gradient stays orange; disabled when title or slug is blank.
- Selecting a block in the canvas auto-switches to Inspector and shows the "Block inspector coming in Step 2" placeholder.
- Right panel does not gain vertical scroll.

