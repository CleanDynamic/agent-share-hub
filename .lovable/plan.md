Implement a fully functional save flow for the upload editor.

1. Add a naming screen when the Save button is clicked
- The selected Save button in `ArticleEditor` will no longer directly save.
- It will open a centered glassmorphism modal asking for a draft name.
- The input will default to the current draft name, title, or `Untitled draft`.
- The modal will have Cancel and Save Draft actions.
- Pressing Enter in the input will save.

2. Make draft saving explicit and reliable
- Refactor `saveDraft` in `Upload.tsx` to accept an optional `draftName`.
- Save `draft_name` from the naming modal instead of always using the title.
- Keep `title` separate from `draft_name` so users can name drafts before final title details are complete.
- Update the saved draft status text to show the saved name and timestamp when available.

3. Preserve article and Stage Grid state before every save
- Before opening the naming modal, flush the current TipTap JSON into the upload page state.
- Save both:
  - `article_body` for the written article and embedded Stage Grid nodes
  - `stage_grids` for stages, blocks, and connections in the mini-canvas system
- Treat article-only and grid-only drafts as valid content, so a draft can be created even if the metadata form is mostly empty.

4. Save when leaving Stage Grid mode
- When the user clicks “Back to article” from the Stage Grid canvas, snapshot the grid store and silently update the current draft if one exists.
- This prevents block/layout edits made inside the canvas from disappearing when returning to the article.
- If no draft exists yet, the explicit Save button will create one via the naming modal.

5. Improve error handling and feedback
- Show a destructive toast if saving fails.
- Keep the Save button disabled while a save is running.
- Only show “Draft saved” after the database write succeeds.

Technical details
- Files to edit:
  - `src/components/article/ArticleEditor.tsx`
  - `src/pages/Upload.tsx`
- No database schema migration is needed because `content_items` already has `article_body`, `stage_grids`, `draft_name`, and `draft_saved_at`.
- The implementation will use existing Lovable Cloud tables and existing UI components (`Dialog`, `Input`, `Button`) where appropriate.