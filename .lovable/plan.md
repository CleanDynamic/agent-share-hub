## Wire `recomputeMetadata` into save + publish

Phase 1 extractors are built but never run. This wires them up so the database self-describes whenever content changes — zero UI changes.

### 1. New file: `src/lib/metadata/scheduleRecompute.ts`

Debounce module with two exports:
- `scheduleRecompute(id)` — 5s debounce per content_item_id, fire-and-forget. Each new call resets the timer for that id.
- `flushRecompute(id)` — cancels any pending debounced run and awaits the recompute immediately. Used by publish.

Internally uses a `Map<string, Timeout>` so multiple posts being edited in parallel don't clobber each other. Errors are caught and logged, never thrown.

### 2. Edit `src/lib/documentPersistence.ts`

This is the single batched-write pipeline for the document editor (article_body + Stage Grid stages/blocks/connections). It already has a clean success point inside `flush()` after `bumpDocumentVersion` succeeds.

Add one line in `flush()` right after `usePersistenceStatus.getState().markSaved()`:

```ts
scheduleRecompute(documentId);
```

That single hook covers every editor change — article body, stage create/update/delete, block create/update/delete, connection create/update/delete — because all of them route through this flush.

Position-only flushes also call `markSaved`, but a position change can't affect any auto-detected field (block types, models, tools, word/stage/block/connection counts are all position-agnostic). To avoid wasted recomputes, only schedule when `kind === 'full'`.

### 3. Edit `src/pages/PostPreview.tsx` (publish handler at line 104)

Before flipping `status` to `'approved'`, run the recompute synchronously so the row goes public with fresh metadata:

```ts
await flushRecompute(draftId!);
await supabase.from("content_items").update({ status: "approved", ... });
```

### 4. Edit `src/pages/Upload.tsx` (one-shot publish at line 1307)

This path inserts a brand-new approved post + its `content_blocks` rows in one go (no document store). After the blocks are written and just before `setSuccess(true)` (line 1307), schedule (don't await — we don't want to delay the success toast):

```ts
scheduleRecompute(contentId);
```

5 seconds later the metadata fields populate in the background.

### Why no other write sites

- `ContentEdit.tsx` only edits top-level fields (title, description, monetisation) — none of those affect auto-detected metadata, so no hook needed.
- `ProjectUploadForm`, `ReblogComposer`, `ForkModal` operate on `projects` / reblogs, not `content_items` body content.
- `Drafts.tsx` is a list view, no writes to body content.

### Verification (manual)

After approval I'll:
1. Pick an existing blueprint id with `read_query`.
2. Run `recomputeMetadata` once via the codepath to confirm it writes.
3. Read back the row showing `block_types_used`, `models_referenced`, `tools_referenced`, `word_count`, `estimated_reading_minutes`, `stage_count`, `block_count`, `connection_count`, `last_metadata_recompute_at`.

(The full live edit→wait→verify loop you described needs you in the browser; I can't drive the editor from here, but I can prove the row populates correctly end-to-end via a direct invocation.)

### Files touched

- **new**: `src/lib/metadata/scheduleRecompute.ts`
- **edit**: `src/lib/documentPersistence.ts` (1 import + 1 conditional call inside `flush`)
- **edit**: `src/pages/PostPreview.tsx` (1 import + 1 await before status flip)
- **edit**: `src/pages/Upload.tsx` (1 import + 1 fire-and-forget call before `setSuccess(true)`)

Zero UI changes. Zero behaviour changes for users. Database becomes continuously self-describing.