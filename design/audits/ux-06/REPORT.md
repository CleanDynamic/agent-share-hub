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

## Report

```
UX-06 · The post page
PASS, with the parts and checks below that are not done or not comparable
Branch / PR: claude/ux-06-post-page
Facts in this prompt that were wrong on disk:
  - The address. The prompt says /openbuilds/posts/:id; UX-05 made every post's link /openbuilds/topics/:id (topicHref) and
    redirects /openbuilds/posts/:id there. The page is at /openbuilds/topics/:id; both addresses open it. Before this branch,
    every card in the feed linked to a page that did not exist (the "before" screenshots are the 404).
  - Harness and Model lists are not in src/lib/build/: they are src/lib/tools/registry.ts (WORKSPACE_AI_TOOLS, isPickable,
    fitsStep from src/lib/tools/modelRules.ts) and src/lib/models/registry.ts (offeredTextModels). The words come from
    src/lib/build/harnessWords.ts (HARNESS_COPY.label, NO_HARNESS) and the session dialog's "Not named" for no model.
  - "As Builds draws covers": no Builds view draws a cover on disk (Table, Maps, Classification). No Wall card has a picture area.
  - "Update from draft ... replaces the snapshot": authenticated has SELECT and INSERT on post_attachments and no UPDATE policy
    (20261107130000_ux04_posts.sql). Not built; see Questions.
  - UX-05's report: PR #439's description holds only attribution lines and no report file was committed.
  - builds.made_with is text[] on disk; UX-05's card read it as a string and called .trim() on it, which throws for any post with
    a build attached. Fixed in P1 (harnessOf in src/lib/openbuilds/cardWork.ts), under a failing test first.
Baseline → end: tests 11092 → 11241 (main: 31 failing in 14 files, all in build, compose and lookRules, none touched here; at the
  end 29 fail in 12 files, every one of them among main's 31. Two compose tests that failed on main passed this run. No new failure.)
Compared boards: not comparable: UX-06 has no board (the prompt says no picture comes with it). Looks are ported from the tokens
  and components the prompt names. Screenshots: design/audits/ux-06/{before,after}/post-{1440-noon,1440-dusk,390-dusk}-{thread,wall}.png
Request rounds and requests for the page, before → after: before, no page (404). After, read from the code and the specs: round 1
  getPost (two requests in a row, as UX-04 wrote it: the post with two levels of replies embedded, then the thread's edges); round 2,
  readPostExtras, all at once: builds facts, the steps for Line up, the work the cards name (readCardWork: up to four requests in one
  round), signed pictures, the reader's likes, and the space (four requests, readSpaceCrowd). Three rounds in all. getSpaceCrowd
  (from a slug) would have taken up to three more in a row, so a one-round read by id was built (commit 6c6c731).
  Not measured by npm run audit:pages: its harness (e2e/audit/support) has no OpenBuilds posts, so the page never reaches its ready
  mark there. Adding posts to that harness is the follow-up; the page target would be maxRounds 3.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): not run (audit:perf measures the harness's pages, which do not
  include this one); no other page's code changed but the card's harness reading and two optional props.
Built but not live yet: none. Every section draws from live reads.
Layers built only because a target failed: readSpaceCrowd (one round instead of getSpaceCrowd's up to three), counted from the code.
Names that differed from this prompt: /openbuilds/posts/:id → /openbuilds/topics/:id; src/lib/build/ harness and model lists →
  src/lib/tools/registry.ts, src/lib/models/registry.ts.
Raw values without a token: none. Spacing outside the scale, allowed in lookRules with the reason: 38 (replies to a reply, the
  prompt's number), 28 (between side sections, as OpenBuilds' SideSection), 10 12 (a pressable tile, as UX-05).
Motion cut back after watching: none. The page adds no motion; the Thread and Wall switch changes the address with nothing
  animating (the browser spec counts animations: zero).
Dead code seen: none new.
Lovable messages needed: none (no migration).
Parts not done:
  - Part 5, Update from draft in an in-progress card's ··· menu: no write path (no UPDATE policy on post_attachments).
  - Part 5, covers on Wall cards: nothing on disk to draw them as.
  - npm run audit:design, audit:pages, audit:perf, audit:themes, audit:contrast for this page: no board, and the audit harness has
    no posts. Light and Dark were checked by eye in the screenshots.
Questions for Miles:
  1. Update from draft needs a migration: GRANT UPDATE (snapshot) on post_attachments to authenticated, with a policy letting a reply's
     author replace the snapshot of their own reply's attachment, and the authorship trigger run on UPDATE too. Should UX-07 or a
     data prompt write it?
  2. Covers on the Wall: which component should draw them? The build page's hero draws a cover; the Builds views draw none.
  3. A hidden reply leaves the Thread for everyone, moderators included (they can still see it in the database). Should moderators
     see it greyed in place, as a hidden post in a space is?
  4. Line up steps draws every step number as a column (eight fit the box, more scroll sideways). The prompt's "at most eight" could
     also mean cap at eight columns; the safer reading draws them all.
  5. The repo-wide npm run lint reports 1430 errors on main and on this branch alike; none are in files this branch touches.
```

## Checks run

- `npx tsc --noEmit -p tsconfig.app.json`: clean (with `NODE_OPTIONS=--max-old-space-size=8192`; the default heap runs out).
- `npm test`: 11241 tests, 29 failing, all already failing on main (see Baseline → end).
- `npm run lint`: 1430 errors and 529 warnings, the same count as main; 0 errors in this branch's files.
- `npm run build`: builds. `scripts/check-size.mjs` fails on main and on this branch: first download 232.3 KB on main, 232.9 KB here
  (+0.6 KB: the route entry and its Placeholder), composer chunk 123.5 KB on both. The budgets bind after SV-26.
- Playwright `e2e/tier3/openbuilds-post.spec.ts` (8 specs) and UX-05's `openbuilds-spaces.spec.ts`: pass on desktop. The container's
  Chromium is not the version the project's Playwright pins, so they ran through a local config that points at /opt/pw-browsers/chromium,
  and Vite was started on 127.0.0.1 (the container has no IPv6).
- `npx playwright test e2e/tier1 --project=desktop --project=mobile`: 359 passed, 9 skipped (wide-layout on mobile), 0 failed.
- UX-05's `openbuilds-spaces.spec.ts` failed once with a click timeout while the full unit suite ran beside it, and passed on every
  run alone.

## What Miles needs to do

Merge the pull request, then press Publish › Publish changes. No Lovable message: this prompt has no migration.
