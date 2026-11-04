# UX-06 · The post page

## Part 0 · Baseline

Pulled main at `e081738` (UX-05 merged as #439). `node_modules` was missing in the container; `npm ci` installed the lockfile.

UX-05's report: PR #439's description holds only the attribution lines, and no report file was committed, so UX-06 read UX-05's
nine commits and the files instead.

### Assumptions (each fact the prompt states, and what the disk says)

1. **The address.** The prompt says to add `/openbuilds/posts/:id`. On disk UX-05 made `/openbuilds/topics/:id` the address of a
   post (`topicHref` in `src/components/post/postCardModel.ts`, used by every card and the replies strip), with
   `/openbuilds/posts/:id` a redirect to it (`TopicRedirect`, `src/App.tsx`). Nothing answers `/openbuilds/topics/:id` yet, so every
   card link lands on Not found today. Safer reading: build the page at the address every link already uses, and keep the redirect,
   so both addresses open the page. Changing the address would change UX-05's links and tests for no gain.
2. **`getPost`.** Exists in `src/lib/openbuilds/posts.ts`: the post, its replies two levels deep (50, then 20 under each), oldest
   first, authors and attachments embedded, and `replyCount` at every depth from a second read of the thread's (id, parent) pairs.
   The route's prefetch uses it unchanged.
3. **How a rebuild records its source.** `builds.parent_build_id` (ON DELETE SET NULL, `src/lib/build/rebuild.ts`), with the
   source's title and maker's handle frozen at fork time in `source_title_at_fork` and `source_handle_at_fork`. `Rebuilt from @maya`
   reads `source_handle_at_fork`, as `RebuildCredit` and the build page do.
4. **SV-18's insert path for a saved step.** `insertSavedTile(snapshot, item, place, context)` in `src/lib/build/fromLibrary.ts`
   (pure: the new tile with the snapshot's method, `source_ref { node_id, build_id, saved_item_id }`, and the maker credited by
   `creditFor`), written with `writeNodeRows`. Outside the composer it is called exactly so by `startBuildFromItems`
   (`src/lib/build/startFromCollection.ts`). A step's snapshot is `stepSnapshot(node, build)` in `src/lib/library/savedItems.ts`;
   for a published step `currentSnapshotOf({ kind: "step", buildId, ref })` makes it from the source as it is now.
5. **Making a draft with one session and one step tile.** `createBuild({ title })` (`src/lib/build/builds.ts`) and
   `addSessionCopy(buildId, { key, meta, tiles })` (`src/lib/build/addSession.ts`, SV-07 P2; the same writer SV-18 and SV-21 use),
   with `newSessionKey()` and `todayDay()` from `src/lib/build/making.ts`. A prompt tile is type `prompt` with `payload.text`;
   a code tile is type `code` with `payload.source` (`CODE_TYPE`, `src/lib/build/graph.ts`).
6. **Harness and model lists.** The prompt says to read them from `src/lib/build/`. They are not there: the harnesses are the AI
   tools of `src/lib/tools/registry.ts` (`WORKSPACE_AI_TOOLS`, `SUGGESTED_TOOLS`, `isPickable`) and the models are
   `offeredTextModels()` in `src/lib/models/registry.ts`. The words are `HARNESS_COPY.label` ("Harness") and `NO_HARNESS` from
   `src/lib/build/harnessWords.ts`. Those are what the composer's own pickers read; the composer folder is not imported.
7. **`useCardColumns`.** In `src/pages/site/builds/BuildsFrame.tsx`: three columns, two below 1101, one below 761.
8. **The `···` menu on cards.** `ModerationMenu` in `src/components/post/PostCard.tsx`: a `PostControl` labelled `···` as a
   `DropdownMenuTrigger`, Pin or Unpin, then Hide (which asks its reason in one field) or Unhide.
9. **Segmented.** `@/components/brand/Segmented`, as UX-05's picker and feed use it.
10. **Pinning and liking.** `pinPost`, `unpinPost`, `hidePost`, `likePost`, `unlikePost` exist (`posts.ts`). The database lets the
    root's author or a moderator of its space pin. Nothing reads whether the reader liked a post: a small read is added.
11. **Who moderates.** `getSpaceCrowd(slug, viewerId)` (`spacesFeed.ts`) gives the space, its maker, moderators, members and the
    reader's role. It needs the post's first space, so it is the page's second round.
12. **Replacing a reply's snapshot (Part 5, `Update from draft`).** No write path: `authenticated` has `SELECT, INSERT` on
    `post_attachments` and no update policy (`20261107130000_ux04_posts.sql`). Building it needs a new grant and policy, which the
    README forbids inventing. Reported, not built.
13. **Covers on the Wall (Part 5).** "As Builds draws covers": no Builds view draws a cover on disk (Table, Maps and Classification
    have none since SV-11 retired the Gallery feed). With nothing to copy, every Wall card is drawn with no picture area, as UX-03
    Part 2 decided for a build with none. Reported.
14. **The composer's folder.** UX-05's `NewPostWindow` imports `../compose/modalRecipes` and `../compose/PublishChecklist`. That
    is left as it is; nothing UX-06 adds imports from `src/pages/site/compose/`.

### Plan

- Part 1: route `/openbuilds/topics/:id` in the route table (prefetch `getPost`), `PostPage` and a pure `PostView`, `postModel`
  (order, pins, nesting, the step filter), the side column, the states -> verified by: `postModel.test.ts`, `PostView.test.tsx`,
  `PostPage.test.tsx`; Playwright `openbuilds-post.spec.ts` (feed to post, Thread and Wall, address, no fade).
- Part 2: `ReplyBox` (one open at a time, the one primary), the picker in reply mode, sending ahead of the server -> verified by:
  `ReplyBox.test.tsx`, `AttachPicker.test.tsx`; Playwright replies on a step.
- Part 3: the step tile editor inside the reply box; `makeReplyDraft` in `src/lib/openbuilds/` over `createBuild` and
  `addSessionCopy` -> verified by: `replyDraft.test.ts`, `StepTileEditor.test.tsx`; Playwright makes a step tile and finds the draft.
- Part 4: `Add to a draft` menu; `addStepToDraft` over `insertSavedTile` and `writeNodeRows` -> verified by: `addToDraft.test.ts`;
  Playwright adds a step to a draft.
- Part 5: the Wall in `useCardColumns`' columns -> verified by: `postModel.test.ts` (card kinds), `PostWall.test.tsx` (columns,
  the primary opens the picker); Playwright opens the Wall.
- Part 6: Line up steps -> verified by: `lineUp.test.ts` (when it shows, the changed rule, the sentence), `LineUpSteps.test.tsx`
  (caption, header cells).
- Part 7: the phone order and `openbuildsPost.budget.test.tsx` -> verified by: the budget test; Playwright at 390, no sideways scroll.
