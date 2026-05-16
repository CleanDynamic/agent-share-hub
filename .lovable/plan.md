# Finish Phase 10 Threaded Comments — Edit/Delete/Report

The v0 ThreadedComment UI, drawer integration, deep-link wiring, post/reply/react handlers, and parent/post-author notifications are already in place. The remaining gap from the spec (excluding realtime, optimistic insertion, and the full-screen `/b/{slug}/thread/{id}` route, per your direction) is the **More menu**: edit-within-5-minutes, soft-delete, and report. This pass closes that gap and tightens a few small loose ends.

## Scope

1. **Backend lib functions** (`src/lib/content-detail/`)
   - `updateComment.ts` — `updateComment({ commentId, authorId, body })`
     - Verifies caller is `author_id`.
     - Enforces 5-minute edit window (`now() - created_at <= 5 min`); throws otherwise.
     - Rejects if `deleted_at` is set.
     - Updates `body`, `body_text` (re-extract plain text), `updated_at = now()`.
   - `softDeleteComment.ts` — `softDeleteComment({ commentId, authorId })`
     - Verifies caller is `author_id`.
     - Sets `deleted_at = now()`; trigger already decrements parent `reply_count`.
   - `reportComment.ts` — minimal stub that inserts into existing `content_reports` table if present, otherwise toasts "Thanks, we'll review."
   - Export from `src/lib/content-detail/index.ts`.

2. **Drawer More menu** (`src/components/content-detail/PrimitiveCommentDrawer.tsx`)
   - Replace stub `handleDrawerMore` consumer with a small popover (anchored to MoreHorizontal button) offering:
     - **Edit** (only if viewer is author AND within 5 min) → opens inline edit textarea in place of body; Save calls `updateComment`, refetches; shows `(edited)` marker automatically since `updated_at !== created_at`.
     - **Delete** (only if viewer is author) → confirm → `softDeleteComment` → refetch; UI renders `[Comment deleted]` placeholder with children intact (already supported).
     - **Report** (any viewer except author) → `reportComment`; toast confirmation.
   - Menu state lives in the drawer (single open menu id at a time), mirroring `openComposerId`.
   - Pass `viewerId` down to `ThreadedComment` via a new optional prop so the menu can decide which items to show. Alternative: keep all logic in drawer and pass `onMore(commentId, anchorRect)` — chosen approach: drawer renders the menu using a portal positioned next to the More button.

3. **ContentDetail wiring** (`src/pages/ContentDetail.tsx`)
   - Replace stub `handleDrawerMore` with implementations that call the new lib functions and `refetchDrawerThreads()` on success.
   - Pass `viewerId` (already passed) and add `viewerIsAuthor` derivation in the drawer using `viewerId === comment.author.id`.

4. **Small fixes**
   - Drawer currently uses `window.location.assign` for Continued thread navigation, which forces a full reload. Switch to React Router `navigate()` (drawer already lives inside a Router; pass a `navigate` callback from ContentDetail) — minor UX improvement aligned with the spec's "deep-link without losing state".
   - Ensure `toDrawerComment` propagates `updatedAt` (currently dropped) so `(edited)` renders.

## Out of scope (per your message)
- Realtime subscription updates to the open drawer.
- Optimistic insertion on post/reply.
- Dedicated full-screen `/b/{slug}/thread/{commentId}` route.

## Verification

- Post a comment → reply → reply-to-reply: parent `reply_count` increments at each level (trigger).
- Edit own reply within 5 min: textarea swaps in, Save persists, `(edited)` appears.
- Try editing after 5 min: button hidden; direct call throws.
- Delete a reply with children: placeholder renders, children remain visible; `reply_count` of its parent decrements.
- Report flow: viewer who is not author sees Report; submits without error.
- Notifications: replier's parent author gets `comment_reply`; post author gets `new_comment` for top-level only (already in `postComment`).

## Files touched

- new: `src/lib/content-detail/updateComment.ts`
- new: `src/lib/content-detail/softDeleteComment.ts`
- new: `src/lib/content-detail/reportComment.ts`
- edit: `src/lib/content-detail/index.ts`
- edit: `src/components/content-detail/PrimitiveCommentDrawer.tsx` (add More-menu popover, pass viewerId/onEdit/onDelete/onReport to ThreadedComment, propagate updatedAt)
- edit: `src/components/comments/ThreadedComment.tsx` (inline edit textarea state; render `(edited)` already supported)
- edit: `src/components/comments/types.ts` (add `viewerId`, `onEdit`, `onDelete`, `onReport` props)
- edit: `src/pages/ContentDetail.tsx` (`handleDrawerMore` → real edit/delete/report, propagate `updatedAt` in `toDrawerComment`, pass `navigate` for Continued thread)
