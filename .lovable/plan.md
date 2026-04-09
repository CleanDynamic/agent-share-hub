

## Fix Build Errors

There are 5 distinct issues across 4 files preventing the build from loading.

### 1. Mixed `||` and `??` operators (2 files)
**Files:** `BlockViewerInCanvas.tsx` line 55-57, `ExecutionPanel.tsx` line 50-51

JS doesn't allow mixing `||` and `??` without parentheses. Fix by wrapping the `||` chain in parens:
- `(block.resultAfter || block.textContent) ?? ''`
- `(block.textContent || block.text_content) ?? ''`

### 2. `setBlocks` doesn't exist on canvas document hook
**File:** `CanvasShell.tsx` line 369

The `useCanvasDocument` hook doesn't expose `setBlocks` in its return value. The template apply logic should use the existing `addBlock` method or call `restoreSnapshot` with a merged snapshot. Simplest fix: iterate `newBlocks` through `doc.addBlock` or use the internal `setBlocksRaw` by exposing `setBlocks` in the hook's return.

### 3. `canvas_versions` table not in Supabase types
**File:** `canvas/VersionHistory.tsx` lines 41-52

The `canvas_versions` table doesn't exist in the generated types. Fix by casting the query with `.from('canvas_versions' as any)` and typing the response manually, or create the table via migration.

### 4. `saved_items` table not in Supabase types + missing import
**File:** `feed-card.tsx` lines 171, 303, 579-586

Same issue — `saved_items` isn't in the generated types. Fix with `as any` casts. Also, `MoreHorizontal` icon is used but not imported from lucide-react.

### Technical details
- All `as any` casts are a pragmatic fix for tables that exist at runtime but aren't yet reflected in the auto-generated type file
- No database migrations needed — the tables likely already exist
- All fixes are straightforward edits, no architectural changes

