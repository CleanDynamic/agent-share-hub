# UX-09 · Connections and plumbing

## Part 0 · Baseline

Pulled main at `cfcd64f` (UX-08 merged as #443, then three Lovable commits). `node_modules` was missing; `npm ci` installed the lockfile.
Branch: `claude/practical-newton-dh2e09` (the branch the session gives; the prompt allows it), one commit per part (Part 10 has two:
the board and titles, then the baseline).

Reports read first: UX-06's, UX-07's and UX-08's (`design/audits/ux-0{6,7,8}/REPORT.md`). UX-04 and UX-05 have none on disk (UX-06,
UX-07 and UX-08 say the same). Reused, not rebuilt: `src/lib/openbuilds/` (`listTopicsAbout`, `replyDraft`, `connections`), `PostCard`
(the prompt's `TopicCard`), the New post window through `PostingWindows` (the prompt's New topic window), `ReplyBox`, `failedRunDraft`,
`ReportDialog`, `PageLink`.

The `karpathy-guidelines` skill is not installed in this session; its four rules were followed as the prompt states them.

Screenshots: `design/audits/ux-09/{before,after}/{topic,drafts,space}-{1440-noon,1440-dusk,390-dusk}.png`, taken over the browser
world UX-05 to UX-08 use (`e2e/tier3/support/openbuildsWorld.ts`), before against a dev server on main (a worktree at `cfcd64f`),
after against this branch, by one throwaway spec (not committed: in `e2e/tier3` it would run with the suite). The world has no build
page, Library, Messages or report queue, so those surfaces have no screenshots (see Parts not done). Light is `noon`, Dark is `dusk`.

### Assumptions (each fact the prompt states, and what the disk says)

1. **`BreakageBody.tsx`.** It has no rows of failed *runs*. Its rows are recorded breakages (`collectBreakages`: a written-up breakage
   part and the step it links, or a breakage event), each with a replay step (`start`, "step 11") and no model. `Gap` and its
   `Solve it` button (opens the old request's solve sheet) are as stated. **Safer reading:** the breakage rows are the rows the tab
   has, so each gains `Start a topic`; the words name the replay step and no model (`Didn't work for me at Step 4.`), and nothing is
   marked still open, because a breakage names a replay step, not a step tile (`about_node_id` must be a node).
2. **The prefill.** UX-08's `failedRunDraft` (`src/pages/site/home/runTopic.ts`) is shared, not copied. Its step now takes
   `nodeId: string | null`, and still open is marked only when there is a node.
3. **A gap's still-open topic.** A step tile marked still open is `is_gap` (UX-08), and its topic is `about_node_id` = the gap. The build
   page already reads those topics (`listTopicsAbout`, UX-07), so Reply needs no request of its own (`stillOpenTopicsByNode`).
4. **"Opens that topic's reply box".** No address opened the reply box. The foot box now has `id="reply-box"`, so
   `/openbuilds/topics/<id>#reply-box` brings it into view through the page's existing `#reply-` arrival scroll, with its field focused.
5. **`RebuildsBody.tsx`.** Cards are `GalleryCard`s; a rebuild's source is `builds.parent_build_id` (with `source_handle_at_fork`). A
   rebuild attached to a reply is a `post_attachments` row of kind `build`. Read by the source build (`build.parent_build_id`), so the
   read starts with the cards (no second round).
6. **`DraftsView.tsx` and `draftsModel.ts`.** UX-06 names a reply's draft `Reply: <heading>` and records **no** topic: no column or
   link. Part 3 adds `builds.made_for_topic_id`.
7. **Drafts' row is a link.** Each draft row is one `IntentLink` to the composer. A link to the topic inside it would be a link inside
   a link (invalid HTML, and two targets in one tab stop). **Safer reading:** `For @maya's topic` is text in the row, not a link.
8. **"The success toast" on publish.** The composer shows no toast when a build is published (`ComposePage.onPublish`: only
   `Build not published` and UX-08's still-open failure). `Reply with it` has no toast to join. Not built.
9. **Library's `Used in`.** One RPC, `saved_items_used_in()` (SV-17), one row per item and arm, read by `savedItemsUsedIn` for both Library
   and the composer's Add from Library. The prompt's `js-set-map-lookups` grouping is the `Map` built from those rows.
10. **Add from Library (SV-18).** It lists **saved items and collections** (`listSavedItems`, `collectionSavedItemIds`), not drafts. A step
    made in a reply lives in Drafts (UX-06) and reaches Add from Library only once it is saved. So "it needs nothing new" holds in
    that nothing is missing from the window's own scope, but not for the reason the prompt gives. Built nothing.
11. **`HeaderSearch.tsx`.** It has **no groups, no rows and no keyboard list**: one field that sends the query to `/builds?q=` on Enter
    (`useGallerySearch`, `normaliseQuery`). It searches with no function of its own. Part 5's premise is false; not built.
12. **`siteNav.ts`.** `isOpenBuildsPath` is private and covers `/openbuilds` and `/bounties`; `sectionForPath` already returns `bounties`
    for every `/openbuilds/` address, and the nav and the dock set `aria-current="page"` from it. Nothing to change there; tests added.
13. **`breadcrumbTrail.ts`, `useBreadcrumb.tsx`.** No trail for a space, a topic or `/openbuilds/requests` (they fell to `Home`). The
    title context held one string; a topic's trail needs its space too, so `useCrumbTitle` takes an optional parent crumb. Trails keep
    the site's leading `Home /` (every trail on disk starts there).
14. **`Dock.tsx`, `MobileHeader.tsx`.** The dock has its OpenBuilds tile; unchanged.
15. **`Messages.tsx`, `createBountyThread`, `createDirectThread`.** `dm_threads.pinned_content_type` has the check
    `IN ('bounty', 'blueprint')`, **and `pinned_content_id` is a foreign key to `content_items(id)`**, the legacy table. A topic's id
    (`openbuild_posts`) can never be stored there, however the check is widened. Direct threads are also one per pair
    (`dm_threads_direct_pair_unique`), so a direct thread can't be "created once and pinned to the topic" for a second topic. Part 7's
    premise is false; not built (see Questions).
16. **`src/lib/moderation/reports.ts`.** `ReportTargetType` is `build | comment`, as stated; reports are read by `listOpenReports` for the
    admin's `ReportsQueue`. `resolve_report` sent every non-build target to `build_comments` (an `ELSE`).
17. **A topic's `···` menu.** On the topic's own page the topic card had **no** menu (`PostView` passed no moderation); in a space's feed
    it is moderators only. Replies have a `···` for the topic's author and moderators.
18. **Notification choices.** No page lets a person choose their notifications. `profiles.notification_preferences` exists and
    `createNotification.ts` reads a coarse `{kind: false}` from it, but nothing in `src/pages` writes or shows it.
19. **The old OpenBuilds board.** `design/reference/vision/dusk/openbuilds.html` and its `index.json` entry, as stated. The repo's
    retired boards are in `design/reference/archive/` (UI-P99), but the board's fonts are linked as `../../fonts/`, which from there would
    point at `design/reference/archive/fonts/` (no Geist). **Safer reading:** an `archive` folder beside `dusk/`,
    `design/reference/vision/archive/`, where `../../fonts/` still resolves.
20. **`pageBaseline.json`.** `openbuilds: 14`, as stated.
21. **`SeoHead`.** The description quoted ("Published builds that take contributions...") is on **`/openbuilds/requests`**
    (`OpenBuildsPage.tsx:327`), not on `/openbuilds`. `/openbuilds` (`OpenBuildsFeedPage`) was titled `OpenBuilds · buildgallery` with
    "Post anything, reply with anything. ...". The requests page's SeoHead is left as it is (the part names `/openbuilds`, a space and a
    topic).

Two readings, the safer taken: Part 1's breakage rows (1), Drafts' line as text (7), the archive folder (19), and Part 8's Hide
(below, Part 8).

### Plan

- Part 1: `Start a topic` on each breakage row through `failedRunDraft`; `Reply` on a gap to `#reply-box` or the solve sheet -> verified by:
  `build/ux09.p1.test.tsx`, `BuildPage.test.tsx`, `buildModel.test.ts`, `PostPage.test.tsx` (`#reply-box`).
- Part 2: `listRebuildsMadeInReply` (one request by the source), the line under the card -> verified by: `openbuilds/madeInReply.test.ts`,
  `build/ux09.p2.test.tsx`; rounds read from the code (the read starts with the cards).
- Part 3: `builds.made_for_topic_id`, written by `makeReplyDraft`; `listDraftTopics` beside the list; the line -> verified by:
  `openbuilds/ux09.p3.madeFor.test.ts`, `drafts/ux09.p3.test.tsx`; Playwright `openbuilds-post.spec.ts` (step tile in a reply, then Drafts).
- Part 4: `saved_items_used_in()` gains `topics`; `savedItemsUses` -> verified by: `savedItems.test.ts`, `library/ux09.p4.test.ts`.
- Part 5: premise false -> the report.
- Part 6: three trails and a parent crumb -> verified by: `shell/ux09.p6.test.tsx` and the existing shell tests unchanged.
- Part 7: premise false -> the report.
- Part 8: `openbuild_post` through the report flow; Report in the topic's and replies' menus -> verified by: `reports.test.ts`,
  `ReportsQueue.test.tsx`, `PostPage.test.tsx`, `test/security/ux09Migrations.test.ts`.
- Part 9: no page -> the report's question.
- Part 10: the board to `vision/archive/`; `openBuildsSeo.ts`; the baseline -> verified by: `openbuilds/ux09.p10.test.ts`,
  `audit:design --list`, `audit:pages` with `PAGES_ONLY=openbuilds`.

## What each part did

- **Part 1** (`cd1d6bf`). Each breakage row has a ghost `Start a topic` (the replay button's own `Button`, 28, 11px), accessible name
  `Start a topic: <row name>`, shown on a published build; signed out it goes to sign in and back. It opens the build page's existing
  `PostingWindows` with `failedRunDraft({ buildId, model: null, step: { number: <replay step>, nodeId: null } })`. `Gap`'s primary is
  `Reply` (`Reply: <gap title>`): to `/openbuilds/topics/<topic>#reply-box` when the gap has a still-open topic, else to the solve sheet as
  before; with neither, no button. No `Solve it` remains in `BreakageBody.tsx`.
- **Part 2** (`108d854`). `Made in reply to @maya's topic` in `--label` after the card, `@maya's topic` a `PageLink` to the reply
  (`replyHref`). `@maya` is the topic's author (the reply's root). One request for the tab, started with `listRebuildCards`.
- **Part 3** (`9aba510`). Migration `20261108120000_ux09_made_for_topic.sql`. `makeReplyDraft(title, tile, topicId)` writes the column in
  its own update, started beside the session write; a refusal (the column is missing until applied) is reported and the reply goes on.
  Nothing else writes it. Drafts reads `listDraftTopics` beside the list (also in the route's prefetch: the same round) and draws
  `For @maya's topic` under the title in `--label`. A missing column reads as no lines. Playwright: the UX-06 step tile spec now also
  checks the column was written and Drafts shows `For @kit's topic` (passes). `Reply with it`: not built (Assumption 8).
- **Part 4** (`c4ca6f2`). Migration `20261108130000_ux09_used_in_topics.sql`: `saved_items_used_in()` returns
  `(saved_item_id, builds, topics)`; the new arm counts distinct topics (a topic or a reply in it, not hidden) attaching the saved step.
  `savedItemsUses` adds the rows up per item (a plain `Map` of the rows would let the topics row overwrite the builds count);
  `savedItemsUsedIn` stays builds only, for the composer's `used in n builds`. Library's Used in column is builds and topics; its detail
  reads `2 builds · 1 topic`. Before the migration, topics read as 0.
- **Part 6** (`e613175`). `Home / OpenBuilds / <space>`, `Home / OpenBuilds / <first space> / <heading, at most 40 characters>`
  (`Home / OpenBuilds / <heading>` in no space), `Home / OpenBuilds / Older requests`. `SpacePage` and `PostPage` name their crumbs.
- **Part 8** (`89d1b51`). Migration `20261108140000_ux09_report_topics.sql`. `reportTarget` takes `openbuild_post` with the same five
  reasons. The topic card on its page has a `···` (`More for this topic`) with `Report` for everyone but its author; each reply's `···`
  gains `Report` for everyone but the reply's author (Pin is now drawn only for those who may pin). The dialog is the existing one,
  titled `Report this topic` or `Report this reply`. The admin queue names the target (`Topic: “...”` / `Reply: “...”`, linked) under
  `OpenBuilds · <reason>`, in one more request started with the others, and offers Dismiss. **Hide:** the posts guard lets only a topic's
  author or a moderator of its space hide it; this branch didn't widen that to admins (superseded by Miles' answer 5: admins now hide for the site, below). `resolve_report` refuses hiding a topic in
  words, and its old `ELSE` (which would have hidden a *comment* with the topic's id) is now `ELSIF 'comment'`. See Questions.
- **Part 10** (`7b8a947`, `96a8922`). The board and its entry are in `design/reference/vision/archive/` (`openbuilds.html`,
  `index.json` with a `retired` note). `audit:design --list` now lists 7 vision boards and no `vision/dusk/openbuilds`. Titles through
  `openBuildsSeo.ts`. The baseline: `openbuilds 14 -> 9` (the only entry changed).

## Miles' answers, applied

Miles answered the questions below. Each answer is one commit on this branch, after the report commit (`e6593b7`).

1. **Notification settings page** (Question 1). Not built here: UX-15 adds Settings › Notifications (`/settings/notifications`), one
   switch per kind, read by rc_notify. This branch adds no notification kind of its own. `src/lib/notifications/keys.ts`
   (`NOTIFICATION_KEYS`) lists every kind rc_notify writes, each a stable key, and `keys.test.ts` reads every migration and fails when
   a kind passed to `rc_notify` or `rc_notify_savers` is missing from the list (`6198f3f`). The keys, for UX-15:

   | key | who is told, and of what | since |
   |---|---|---|
   | `rebuilt` | a build of yours, or one you kept, was rebuilt | RC-P19 (SV-20 adds savers) |
   | `published` | someone you follow published a build | RC-P19 |
   | `reproduced` | a build of yours, or one you kept, was run | RC-P19 (SV-20 adds savers) |
   | `comment` | someone commented on your build | RC-P19 |
   | `reply` | someone replied to your comment on a build | RC-P19 |
   | `like` | someone liked your build | RC-P19 |
   | `solution` | an answer came to your request, or to one on a build you kept | RC-P19 (SV-20 adds savers) |
   | `solved` | your answer to a request was accepted | RC-P19 |
   | `follow` | someone followed you | RC-P19 |
   | `post_reply` | someone replied to your topic or your reply | UX-04 |
   | `post_thread` | someone replied in a topic you started | UX-04 |
   | `post_mention` | someone mentioned you | UX-04 |
   | `post_like` | someone liked your topic or your reply | UX-04 |
   | `post_started` | someone started a topic from your build, part, session or step | UX-04 |
   | `post_pinned` | your topic or reply was pinned | UX-04 |

   Saved-item notifications (SV-20) reuse `rebuilt`, `reproduced` and `solution`; their `target_type` (`node`, `collection`) is what
   tells them apart, so UX-15 can offer them as one switch each or fold them in. Direct messages (`message_received`) are written by
   the client, not rc_notify, and are not in the list.
2. **Build comments becoming replies** (Question 2). Not in this run. `build_comments` and everything about comments is unchanged.
3. **Older requests retires itself** (Question 3, `0f23930`, `8ec019c`). `hasOpenRequests()` (`src/lib/bounty/openRequests.ts`) asks
   for at most one `bounties` row with `status = 'open'`. While one exists, nothing changes. Once none does:
   - the `Older requests` link under Your spaces on `/openbuilds` is not drawn (`OpenBuildsFeedView`'s `olderRequests`);
   - `/openbuilds/requests` (and `/bounties`, which lands there) redirects to `/openbuilds` (`OlderRequestsRoute`, keeping the query
     string);
   - each request's own page (`/openbuilds/<id>/solve`, `/bounties/<id>/solve`) is a different route and is never redirected, so build
     pages, Home and notifications still open it.
   Nobody does anything by hand, and no request row is touched. A failed check keeps the link and the page: only a definite "none
   open" retires them. The check does not hold up either page: the link appears when the answer comes, and the requests page renders
   beside the check. One request more on `/openbuilds` (in round 1, not waited for).
4. **Topics in Messages** (Question 4, `c9530d9`). Per-topic threads were not built in UX-09 (Part 7 stopped), so nothing had to be
   changed back. Now: a topic's `···` menu has `Message @maya` (for a signed-in reader who is not the author; signed out it goes to
   sign in). It opens or creates the one direct thread with her (`openTopicThread`, through the existing `createDirectThread`) and
   opens it with the topic waiting in the message box as a chip, as a build waits after the `@` picker. The topic goes as a card with
   the reader's note when they press Send (`sendTopicMessage`; the thread's preview says `Shared a topic`). Nothing is sent before
   that. In the thread the card (`TopicShareCard`: `Topic`, the heading, `@maya`, one link to the topic) is drawn like a build's, and a
   topic the reader can no longer read leaves the words alone. Migration `20261108150000_ux09_topic_messages.sql`: one nullable
   column, `dm_messages.shared_post_id`, with a partial index. `dm_threads` and `pinned_content_type` are untouched.
5. **Admins hide a reported topic or reply** (Question 5, `3dd8fd4`). Migration `20261108160000_ux09_site_hide_topics.sql`:
   - a second hide, `openbuild_posts.site_hidden_by` and `site_hidden_at`, apart from the space's `hidden_by`. `posts_guard_update`
     keeps each to its own side: only an admin sets or clears the site's (as themselves), and an admin acting as an admin cannot touch
     the space's. Policies use `(select public.is_admin((select auth.uid())))`;
   - the read policy: what the site hid is read by admins only. It is gone from every feed, space, list and search for everyone else,
     its author and the space's moderators included (every read, the feed function among them, is SECURITY INVOKER);
   - `reply_count` counts a reply that neither side hid;
   - `resolve_report`'s Hide on a topic or a reply sets the site's hide and closes every open report on it as hidden (it no longer
     refuses in words);
   - `site_hidden_posts_of(topic)` returns the caller's own entries in that topic that the site hid, with their first line.
   In Admin › Reports, a topic's or reply's row has `Hide` again; the dialog says `Hide this topic?` / `Hide this reply?` and what
   happens. A list `Hidden by the site` under the queue shows each with `Unhide` (an admin's update of the column back to null; the
   report stays resolved). Its author sees, on the topic's page, `Hidden by the site's moderators: your topic` (or `your reply`), the
   first line they wrote, `Nobody else sees it now.` and `How reporting works`, linked to `/terms#reporting`.
   Checked against a scratch Postgres 16, with the real UX-04 and UX-09 migrations over stub tables (applied twice): a non-admin's
   `resolve_report` is refused; the admin's Hide sets the column, stamps the time, resolves the report and lowers `reply_count`; anon,
   the author, the topic's author and the space's moderator then read 0 rows, the author's notice returns the reply and nobody
   else's; the moderator's and the topic author's updates of the site's hide change nothing (0 rows); the admin cannot clear the space's
   hide, cannot hide as someone else, cannot edit the words; Unhide clears both columns, restores `reply_count`, and anon reads it
   again; an insert that sets `site_hidden_by` is refused.
6. **`design/vision-kit.py`** (Question 10, `863038b`). The kit no longer carries the OpenBuilds board: `dusk/openbuilds.html`, its
   source `OpenWork.dc.html`, its picture `screens/vision/openbuilds.png`, and its `index.json` entry (the kit's index is now the one on
   disk). It has no profile board. It now writes 23 files; `--check`: 23 of 23 match. Running it changes nothing on disk, so it can
   never write the board back. The archive (`design/reference/vision/archive/`) is unchanged. The source and the picture stay where
   they are on disk, because the archive's `index.json` points at them. `audit:design` after running the kit: see Checks.

Questions 6 to 9 of the report (Reply with it, the Drafts line as a link, a breakage as the topic's still-open step, retitling the
requests page) were not answered and are still open; Question 9 matters less now, since the page retires itself.

## Report

```
UX-09 · Connections and plumbing
PASS, with Part 5 stopped on a false premise, Part 9 left to UX-15 and Part 7 built from Miles' answers, and the checks below that
  are not done or not comparable
Branch / PR: claude/practical-newton-dh2e09 (no pull request opened)
Facts in this prompt that were wrong on disk:
  - BreakageBody has no failed-run rows: its rows are recorded breakages, with a replay step and no model.
  - The composer shows no success toast on publish, so "the success toast adds Reply with it" has nothing to add to.
  - UX-06 recorded no topic on a reply's draft (no column, no link).
  - Add from Library lists saved items and collections, not drafts: a step made in a reply reaches it only once saved.
  - HeaderSearch has no groups, rows or keyboard list: it is one field that submits to /builds?q=.
  - sectionForPath already marks OpenBuilds on every /openbuilds/ address (spaces, topics, requests).
  - dm_threads.pinned_content_id is a foreign key to content_items, so no widening of pinned_content_type can pin a topic; direct
    threads are one per pair.
  - The topic card on its own page had no ··· menu; in a space feed it was moderators only.
  - The repo's archive for retired boards (design/reference/archive/) would break the board's ../../fonts links.
  - The quoted SeoHead description is on /openbuilds/requests, not /openbuilds.
Baseline → end: tests 11412 → 11492 (main in a clean worktree at cfcd64f: 29 failing in 12 files. Branch: the same 29 in the same
  12 files, listed under Checks. No new failure.)
Compared boards: not comparable: UX-09 has no board (no picture comes with it). The OpenBuilds board is retired from the comparison
  (audit:design --list: 7 vision boards, no openbuilds). Screenshots: design/audits/ux-09/{before,after}/.
Request rounds and requests for the page, before → after:
  - /openbuilds (audit:pages, PAGES_ONLY=openbuilds, built bundle): cold 9 requests in 2 rounds, from inside the app 3 in 1,
    warm 0. Baseline 14 → 9 (regenerated; it was SV-03's number before UX-05 replaced the page).
  - Build page, Rebuilds tab: one more request (listRebuildsMadeInReply), started with listRebuildCards: no extra round (read by
    the source build, so it does not wait for the cards' ids). Not measured by audit:pages, which opens the build page on its
    first tab.
  - Build page, Where it broke: no new request (the gap's topic comes from listTopicsAbout, already read).
  - Drafts: one more request (listDraftTopics), in the same round as the list and the first prompts, and in the route's prefetch.
  - Library: no new request (the same RPC returns one more column).
  - Topic page: no new request on arrival; the report queue gains one request (openbuild_posts by id), started with the others.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): not run (audit:perf was not run; see Checks).
Built but not live yet: Message @maya needs 20261108150000 (until then Send says "Something went wrong." and the topic stays in the
  box); the site's Hide of a topic or reply needs 20261108160000 (until then resolve_report refuses it, the queue says "Something went
  wrong.", Hidden by the site lists nothing and no notice shows). Drafts' For @maya's topic needs 20261108120000; Used in's topics needs 20261108130000; reporting a topic needs
  20261108140000 (until then the insert is refused by the check and the dialog says it could not send). Each read works before its
  migration.
Layers built only because a target failed: none.
Names that differed from this prompt: TopicCard → PostCard; New topic window → NewPostWindow (through PostingWindows); "rows of failed
  runs" → breakage rows; isOpenBuildsPath → sectionForPath (isOpenBuildsPath is private); retired boards' archive →
  design/reference/vision/archive/.
Raw values without a token: none. New lines use t.label, t.text2 and the host's sizes (12px lines, the 28 ghost Button).
Motion cut back after watching: none. Nothing added moves.
Dead code seen (for SV-26):
  - BreakageBody, RebuildsBody, ReportsQueue and ReportDialog are not in lookRules' list; adding them fails on their older lines only
    (spacing 7/3/9/10 in BreakageBody, a bare lucide Network icon in RebuildsBody, untouched shadcn Button and Dialog in the two
    moderation files). Left off the list rather than restyled, since restyling changes the page.
  - The requests page's SeoHead (OpenBuildsPage.tsx:327) still says "open steps to answer, with rewards".
  - UX-05's OpenBuilds feed line "Post anything, reply with anything." (OpenBuildsFeedView.tsx:244) now differs from the page's
    description ("Start a topic with anything, ...").
Copy changed:
  - "Solve it" -> "Reply" · src/pages/site/build/BreakageBody.tsx:112 (accessible name "Solve it: <gap>" -> "Reply: <gap>", :111)
  - (new) "Start a topic" / "Start a topic: <row>" · src/pages/site/build/BreakageBody.tsx:76-77
  - (new) "Didn't work for me at Step <n>." (failedRunLine, no model known) · src/pages/site/home/runTopic.ts:22
  - (new) "Made in reply to @<handle>'s topic" · src/pages/site/build/RebuildsBody.tsx:68
  - (new) "For @<handle>'s topic" · src/pages/site/drafts/draftsModel.ts:58
  - Library detail "Used in: 3 builds" -> "3 builds · 1 topic" when topics attach it · src/pages/site/library/libraryModel.ts:199
  - (new) trails "Home / OpenBuilds / <space>", ".../<space>/<heading>", ".../Older requests" · src/components/shell/breadcrumbTrail.ts:85-87
  - (new) menu item "Report", trigger "More for this topic" · src/components/post/PostCard.tsx:143,152; reply menu "Report" ·
    src/pages/site/openbuilds/PostReplies.tsx (ReplyMenu)
  - (new) dialog titles "Report this topic" / "Report this reply" · src/components/moderation/ReportDialog.tsx:61
  - (new) queue "OpenBuilds · <reason>", "Topic: “...”", "Reply: “...”", "A topic or reply that is no longer there" ·
    src/components/moderation/ReportsQueue.tsx:124, src/lib/moderation/reports.ts:201-203
  - (new, Miles' answers) "Message @<handle>" · src/pages/site/openbuilds/PostPage.tsx (topic's ··· menu); "Topic" card ·
    src/components/messages/TopicShareCard.tsx; thread preview "Shared a topic" · src/lib/messaging/topics.ts;
    "Couldn't open the conversation. Try again." · PostPage.tsx
  - (new, Miles' answers) "Hide this topic?" / "Hide this reply?", "It leaves every feed, space and search. Its author sees it was
    hidden by the site's moderators; only admins can unhide it. Every open report on it closes.", "Hidden by the site", "Hidden
    <time>", "Unhide" · src/components/moderation/ReportsQueue.tsx
  - (new, Miles' answers) "Hidden by the site's moderators: your topic" / "...: your reply", "Nobody else sees it now.", "How
    reporting works" · src/pages/site/openbuilds/SiteHiddenNotice.tsx
  - (removed when no request is open) "Older requests" · src/pages/site/openbuilds/OpenBuildsFeedView.tsx
  - /openbuilds title "OpenBuilds · buildgallery" -> "OpenBuilds"; description "Post anything, reply with anything. Spaces are made and
    run by the people in them." -> "Start a topic with anything, reply with anything. Spaces are made and run by the people in them." ·
    src/pages/site/openbuilds/openBuildsSeo.ts:17-18
  - Topic title fallback "Post · OpenBuilds" -> "Topic · OpenBuilds"; description "A post on OpenBuilds." -> "A topic on OpenBuilds.";
    text cut 160 -> 150 · src/pages/site/openbuilds/openBuildsSeo.ts:28-30
Lovable messages needed (send in this order):
  1. Apply supabase/migrations/20261108120000_ux09_made_for_topic.sql exactly as written. Change nothing else.
     Then run the EXPLAIN (ANALYZE, BUFFERS) statement in its header and paste the plan back.
  2. Apply supabase/migrations/20261108130000_ux09_used_in_topics.sql exactly as written. Change nothing else.
     Then run the EXPLAIN (ANALYZE, BUFFERS) statement in its header and paste the plan back.
  3. Apply supabase/migrations/20261108140000_ux09_report_topics.sql exactly as written. Change nothing else.
  4. Apply supabase/migrations/20261108150000_ux09_topic_messages.sql exactly as written. Change nothing else.
     Then run the EXPLAIN (ANALYZE, BUFFERS) statement in its header and paste the plan back.
  5. Apply supabase/migrations/20261108160000_ux09_site_hide_topics.sql exactly as written. Change nothing else.
     Then run the two EXPLAIN (ANALYZE, BUFFERS) statements in its header and paste the plans back.
Parts not done:
  - Part 3, "Reply with it" in the publish toast: the composer has no publish success toast. The Playwright half "publishes the draft,
    and replies with it" is not done for the same reason.
  - Part 5, Search finds topics and spaces: HeaderSearch has no groups to add to (it submits to /builds?q=).
  - Part 9, Notification choices: left to UX-15 (Miles' answer 1). The stable keys it will use are listed under Miles' answers.
  - The Terms page: the author's notice links to /terms#reporting, but the app has no /terms route (SignupForm links /terms too),
    so the link lands on Not found until a Terms page with a #reporting section exists. The address is one constant,
    TERMS_REPORTING_HREF in src/lib/moderation/siteHidden.ts.
  - No notification tells an author the site hid their topic or reply; they find out on its page. Say if one is wanted (it would be
    a new rc_notify key, and probably not one a person can switch off).
  - Before and after screenshots of the build page (Where it broke, Rebuilds), Library, Messages and the report queue: the browser
    world has no build page, Library or queue. Covered by Vitest only.
  - audit:perf and audit:motion: not run (see Checks).
Questions for Miles (1 to 5 and 10 are answered: see "Miles' answers, applied"; still open):
  6. Part 3's Reply with it: should publishing a build show a success toast at all (it shows none today)? If so, Reply with it can
     join it for a draft made in a reply.
  7. Drafts' For @maya's topic is text inside the row's link. Should it be its own link (the row would need two links side by side,
     the title to the draft and the line to the topic)?
  8. Where it broke's Start a topic names the replay step and no model, and marks nothing still open (a breakage is not a step tile).
     Should a breakage written up as a part be markable as the topic's still-open step?
  9. The requests page (/openbuilds/requests) keeps its SeoHead "OpenBuilds · buildgallery" / "open steps to answer, with rewards".
     Retitle it "Older requests · OpenBuilds"?
```

## What Miles needs to do

In order: (1) merge the pull request (none is open yet: ask for one, or open it from the branch `claude/practical-newton-dh2e09`);
(2) press Publish › Publish changes; (3) send the five Lovable messages above, in order, and paste back the five EXPLAIN plans.
Older requests needs nothing: it goes by itself the first time no request is open.

## Checks run

- `npx tsc --noEmit -p tsconfig.app.json` (with `NODE_OPTIONS=--max-old-space-size=8192`: the default heap runs out): clean, after
  every part.
- `npm test`: main in a clean worktree at `cfcd64f`: 11412 tests, 29 failing in 12 files. This branch: 11492 tests (+80), the same 29
  failing in the same 12 files, none new: `src/components/build/ux03.p4.test.tsx`, `src/lib/build/{everything,onePrompt.snapshot,
  readerSteps,shapes}.test.*`, `src/lib/theme/lookRules.test.ts` (`BuildSteps`, `BuildView`), `src/pages/site/build/{BuildSteps,
  BuildSteps.tiles,BuildView,readerSessions}.test.tsx`, `src/pages/site/compose/{connection,ux03.p3}.test.tsx`. Two tests asserted the
  old copy and were updated with it (`BuildPage.test.tsx` "Solve it", `buildModel.test.ts` the gap's shape), one asserted the old
  reply menu (`PostPage.test.tsx`: a reader now has Report there), and one mock named the old Used in read (`LibraryPage.test.tsx`).
- `eslint` on every changed file at each commit: 0 errors. The repo-wide `npm run lint` was not run (1430 errors on main per UX-07).
- `npm run build`: passes. `scripts/check-size.mjs`: fails on main and here, first download 233.3 KB (UX-08's after: 233.0; budget
  200), composer chunk 124.5 KB (UX-08's after: 124.6; budget 120). The budgets bind after SV-26.
- `audit:pages` with `PAGES_ONLY=openbuilds` on the built bundle: all 27 tests pass; openbuilds cold 9 requests in 2 rounds (target 2),
  from inside the app 3 requests in 1 round.
- `npx playwright test e2e/tier1 --project=desktop --project=mobile`: 358 passed, 9 skipped, 99 failed. The same nine spec files run on
  main fail 96 of the same tests (stale `/gallery` addresses, specs that launch their own Chromium and look for a headless shell this
  container lacks, and wide-layout timeouts). The three that failed only here: `build-site-frame.spec.ts:215` (desktop and mobile)
  asserted `Solve it` and was updated (passes now); `rebuild-site-frame.spec.ts:70` (desktop) counts idle count reads as writes and
  fails on main too (2 of 3 runs on main, 2 of 2 here: timing, not this branch).
- Playwright `e2e/tier3/openbuilds-post.spec.ts` and `openbuilds-spaces.spec.ts` (desktop): 9 passed, including the step tile spec
  extended for Part 3. Vite was started on 127.0.0.1 (the container has no IPv6) and `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- `npm run audit:design`: 31 comparisons (no `vision/dusk/openbuilds`), 14 passed, 10 skipped (no dev page), 7 failed:
  `refined/{dusk,noon}/{build-map,composer-map,composer-card}` and `refined/noon/prompt-window`. The same 7 fail on main in this
  container (run against a dev server on the main worktree). None is an OpenBuilds board, so Part 10's comparison is gone and none of
  the failures is this branch's.
- `npm run audit:themes`, `npm run audit:contrast`: both stop on a harness error (`page.evaluate: Cannot read properties of null
  (reading 'click')`) before judging a colour, on main and on this branch alike. Light and Dark were checked by eye in the
  screenshots; every new line uses a token already on its page (`t.label`, `t.text2`).
- Not run: `audit:perf`, `audit:motion` (this branch adds no motion and changes nothing in the composer's list).
- `python3 design/vision-kit.py --check`: 24 of 26 files match; `dusk/openbuilds.html` missing and `index.json` changed, as Part 10
  intends (see Questions 10). No test or CI step runs it.
- The diff has no em dash.
