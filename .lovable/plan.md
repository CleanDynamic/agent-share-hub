## Plan to fix the disappearing Stage Grid

The Stage Grid is being inserted into the TipTap editor, but when you open the grid canvas the app fully unmounts the article editor. The inserted grid is only captured by the parent `onChange` when TipTap fires an update. In this flow, the latest article JSON is not guaranteed to be cached before the editor is swapped out, so when you click “Back to article” it remounts from stale content and the grid is gone.

### What I will change

1. **Make ArticleEditor publish its current document immediately after grid insertion**
   - After the “Insert Grid” action runs, force-read `editor.getJSON()` and send it to the parent cache.
   - This ensures the parent always has the latest article body before the editor can be unmounted.

2. **Add a pre-open save hook for Stage Grid thumbnails**
   - When a Stage Grid thumbnail is clicked to open fullscreen, capture the current TipTap JSON first.
   - Store that snapshot in both:
     - `canvasDoc._articleBody`
     - `canvasDoc.articleBody`
   - Then open the fullscreen grid.

3. **Use the document store as an additional source of truth**
   - Update `useDocumentStore.articleBody` whenever the editor changes.
   - On remount, prefer the latest cached article body from `_articleBody`, then `articleBody`, then document store.

4. **Stop creating a mismatched extra canvas stage**
   - The grid insertion currently calls `canvasDoc.addStage()` which creates a separate unrelated stage id, while the TipTap grid uses its own id.
   - I will remove that extra call so one inserted Stage Grid has one stage id and one store record.

5. **Verify the exact flow**
   - Insert Grid.
   - Select/enter a template or open the grid canvas.
   - Click “Back to article”.
   - Confirm the Stage Grid thumbnail is still in the text editor.
   - Run TypeScript check.

### Technical files to update

- `src/components/article/ArticleEditor.tsx`
  - Keep a stable latest JSON cache.
  - Push current JSON to parent/store after grid insert and before fullscreen open.

- `src/components/article/SlashCommandMenu.tsx`
  - Remove the legacy `canvasDoc.addStage()` call that creates an unrelated stage.

- `src/components/article/StageGridNode.tsx`
  - Before `openStageAction(stageId)`, snapshot the current editor JSON into the parent article cache.

- `src/pages/Upload.tsx`
  - Read the latest article body from the parent cache/document store on remount.
  - Continue saving `stage_grids` and `article_body` as before.

This targets the immediate bug: the grid should remain visible in the article editor after returning from the grid canvas.