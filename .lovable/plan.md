## Phase 15.7 — Finish all deferred reblog items

Pick up everything that earlier passes punted. Three packs, delivered together.

### Pack A — Visibility & counts

1. **ContentDetail "X reblogs" trigger**
   - Add a visible button in the engagement row of `src/pages/ContentDetail.tsx` showing `reblog_count` with the Repeat2 icon.
   - Clicking it opens the already-mounted `ReblogsListModal` (state already exists, just needs the trigger and a label).
   - Hide when count is 0; otherwise render "12 reblogs".

2. **Home "Most reblogged today" chip query**
   - In `src/pages/Home.tsx`, when the chip is active, swap the Recent reblogs query for one filtered to `created_at >= now() - 24h` and sorted by `(like_count + comment_count*2 + reblog_count*3)` desc.
   - Keep the same `_feedType: "reblog"` shape so `FeedReblogAdapter` still renders.

3. **Discover "Reblogs" chip query mixing**
   - In the Discover page query layer, when the chip is active, query `reblogs` (filter `hidden_at IS NULL`) instead of `content_items`, mapping the rows through `FeedReblogAdapter`.
   - When inactive, behave as today.

4. **Profile stats panel reblog count**
   - Add a "Reblogs" stat to the author stats panel using `count(*) from reblogs where rebloger_id = profile.user_id and hidden_at is null`.
   - Place next to existing stats (followers / blueprints / etc).

### Pack B — Sharing & mobile

5. **DM share renderer for reblogs**
   - Extend `src/components/dm/ShareToDMModal.tsx` to accept `kind: "post" | "reblog"` and serialize a reblog share payload (`{type:"reblog", reblogId, slug, snippet}`) into the DM message metadata.
   - In `src/components/dm/ThreadView.tsx`, detect reblog share payloads and render an inline `EmbeddedOriginalCard`-style preview that links to `/b/:slug`.
   - Add a "Share to DM" entry in `FeedReblogAdapter`'s overflow menu.

6. **Mobile bottom-sheet variants**
   - In `ReblogComposeSheet.tsx`, branch on viewport (<768px): render as bottom-anchored sheet with drag handle and full-width media controls instead of the centered dialog.
   - In `FeedReblogAdapter` overflow menu, on mobile open a `Drawer` from the bottom instead of a `DropdownMenu`.
   - Reuse existing shadcn `Drawer` primitive; no new deps.

### Pack C — AI-PDF export

7. **Reblog support in `supabase/functions/generate-ai-pdf/index.ts`**
   - Accept `{ kind: "reblog", reblogId }` in addition to current post payload.
   - Fetch the reblog + embedded original post + author info.
   - Render a header block: "Reblog by @user — N words" + reblogger text + media thumbnail, followed by a divider and the embedded original rendered as today (title, author, blocks).
   - Update the "How to read this document" preamble to explain the reblog/quote structure (2 short paragraphs).
   - From `ReblogDetail.tsx`, expose an "Export AI-PDF" action that calls the function with the reblog payload.

### Notes & constraints

- No new tables. Uses existing `reblogs`, `dm_messages`, `content_items`, `profiles`.
- Respect `hidden_at IS NULL` everywhere reblogs surface publicly.
- Cast Supabase update payloads `as any` per project memory.
- Random UUID realtime channels.
- Keep edits scoped to UI/data wiring + the one edge function; no migration needed.

### Technical surface (files touched)

```text
edit  src/pages/ContentDetail.tsx           # Pack A.1
edit  src/pages/Home.tsx                    # Pack A.2
edit  src/pages/Discover.tsx (or query hook) # Pack A.3
edit  src/components/profile/*StatsPanel*   # Pack A.4
edit  src/components/dm/ShareToDMModal.tsx  # Pack B.5
edit  src/components/dm/ThreadView.tsx      # Pack B.5
edit  src/components/reblog/FeedReblogAdapter.tsx # B.5, B.6
edit  src/components/reblog/ReblogComposeSheet.tsx # B.6
edit  supabase/functions/generate-ai-pdf/index.ts # C.7
edit  src/pages/ReblogDetail.tsx            # C.7 trigger
```

### Verification

- Open a reblogged post → "12 reblogs" button → modal lists rebloggers.
- Toggle Home "Most reblogged today" → feed reorders, only reblogs from last 24h.
- Discover Reblogs chip → only reblogs.
- Profile → reblog count appears.
- DM share a reblog → recipient sees inline preview, link works.
- Mobile width → compose opens as bottom sheet; overflow opens drawer.
- Export AI-PDF from a reblog → PDF contains reblogger text + embedded original + updated preamble.