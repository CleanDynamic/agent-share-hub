Plan to make drafts actually save and reopen correctly

1. Fix the current save failure
- Remove database fields from the draft save payload that do not exist in the current schema, especially the fields causing the logged error like `bounty_enabled`.
- Do the same cleanup for block inserts during draft saving, because several canvas/block-specific columns are also not present in the current `content_blocks` schema.
- Add explicit error checks after every important database write. If an insert/update/delete fails, the save flow will stop and show a clear error instead of pretending it saved.

2. Make Save create a real draft and keep editing that same draft
- When a new draft is created, update `currentDraftId` and replace the URL with `/upload?draft=<id>` so refreshing, backing out, or returning to Upload opens the existing draft instead of starting a new upload.
- Keep `draft_name`, `draft_saved_at`, `article_body`, and `stage_grids` stored on the draft record.
- After a successful save, show the saved draft name and timestamp.

3. Preserve the article editor and Stage Grid content
- Keep the TipTap article JSON as the source for the text editor contents.
- Save the Stage Grid store as one JSON snapshot in `stage_grids`.
- Restore both `article_body` and `stage_grids` when opening `/upload?draft=<id>`.
- On “Back to article” from the Stage Grid canvas, snapshot the grid and silently save if a draft already exists.

4. Add a proper “save before leaving” prompt
- Replace the currently-unused `guardedNavigate` logic with a real route-leave blocker for Upload.
- When the user tries to leave Upload with unsaved article/grid/form changes, show the existing “Save before leaving?” modal.
- Save Draft will create/update the draft, then continue navigation.
- Discard will leave without saving, and if it is a newly-created unsaved draft, remove it.
- Cancel will keep the user on the upload editor.

5. Add a safety fallback for “new upload” cases
- If the user has an unsaved draft and returns to `/upload?post_type=...`, the app should not silently reset their work.
- Once the draft has an id, the editor URL will stay tied to that draft, so coming back to Upload continues the same draft.
- Optional silent autosave will only update an existing draft; the naming screen remains the explicit way to create the first named draft.

Technical details
- Main files to edit:
  - `src/pages/Upload.tsx`
  - `src/components/article/ArticleEditor.tsx` only if the save dialog needs a small state/status refinement
- No database migration is needed for this fix. The backend already has the draft fields needed: `article_body`, `stage_grids`, `draft_name`, and `draft_saved_at`.
- The main bug shown in the console is a schema mismatch: draft saving sends removed columns like `bounty_enabled`, so the database rejects the save before the draft can be created.