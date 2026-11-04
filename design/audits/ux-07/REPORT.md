# UX-07 · Across the site

## Part 0 · Baseline

Pulled main at `86ac1d2` (UX-06 merged as #440). `node_modules` was missing; `npm ci` installed the lockfile. The session's branch is
`claude/friendly-gauss-8s7go9` (the prompt allows the branch the session gives), one commit per part.

UX-05's report: none on disk (UX-06's report says the same: PR #439's description holds only attribution lines). UX-06's report
(`design/audits/ux-06/REPORT.md`) was read, and UX-05's and UX-06's commits and files.

Before screenshots: `design/audits/ux-07/before/{home,build,profile,library,notifications}-{1440-noon,1440-dusk,390-dusk}.png`, taken
against the browser world in `e2e/tier3/support/openbuildsWorld.ts` (the faked backend UX-05 and UX-06 use), since the domain is
not live. After screenshots at the same paths under `after/`.

### Assumptions (each fact the prompt states, and what the disk says)

1. **Home's filters.** `HOME_FILTERS` in `src/pages/site/home/homeModel.ts` is `All`, `Builds`, `Rebuilds`, `Notes`, `Asks`, as
   stated. Notes are `repro_note` items, Asks are `bounty` items (requests).
2. **Home and topics.** `getBuildFeed` has returned UX-04's `post` and `reply_group` rows as `postItems` since 20261107170000, but
   **Home drew none of them**: `HomePage` only read `items`. Every topic and reply was missing from Home before this branch.
3. **`TopicCard`.** No such name on disk. The topic card is `PostCard` (`src/components/post/PostCard.tsx`) with `postCardModel`'s
   `toCardData`, used by every list of topics (UX-05). Used as the TopicCard throughout.
4. **The reply anatomy.** `Reply` in `src/pages/site/openbuilds/PostReplies.tsx` (UX-06). Its avatar, head, words and attachments
   were taken out as `ReplyAnatomy`, unchanged, so Home's reply groups draw the same anatomy without the Thread's actions.
5. **`EngagementRow`'s comment slot.** `EngagementRow` (`src/components/social/EngagementRow.tsx`) acts on a build only (likeBuild,
   saveBuild, Comment goes to `/b2/<slug>#comments`); a topic card showed it only for an attached build. A topic's own row did not
   exist. `TopicEngagementRow` was added in the same file: the same `Action` pieces, sizes and accessible names, Like and Save acting
   on the topic, and the comment slot (`data-engagement-action="comment"`) labelled Reply.
6. **`listTopicsAbout`.** Not on disk. `listPostsAbout(buildId)` and `countPostsStartedFrom(buildId)` were
   (`src/lib/openbuilds/connections.ts`). `listTopicsAbout` was built over them: the posts about the build, the topics started from
   it (root posts attaching it) and whether the maker allows topics, three requests in one round.
7. **`builds.allow_as_topic_source`.** The column on disk is `builds.allow_as_post_source` (20261107130000_ux04_posts.sql, in the
   generated types). Used as it is.
8. **`saved_items` kind `openbuild_post`.** The kind the database allows for a topic is `'post'` (20261107150000, section 4). Used
   as it is. No migration.
9. **Library's kinds (SV-09, SV-17).** `LIBRARY_KINDS`: All saved, Builds, Parts, Sessions, Steps, Requests, Filter sets. Topics is
   added last.
10. **The profile's tabs.** `WORKS_TABS`: Builds, Rebuilds, Reproduced, Collections (four). Topics makes five, the limit.
11. **The notification row (SV-20).** The Notifications page (`/notifications`) is `ActivityPage`, whose row is drawn from
    `activityRowOf` (`src/pages/site/activity/activityModel.ts`). `NotificationRow` (`src/components/notifications/`) is the other
    row. Both were taught the six UX-04 kinds; neither row's look changed.
12. **`#reply-<id>`.** No reply element carried an id, and `topicHref`'s `?reply=<id>` opens a *branch* of the thread (UX-06), not a
    scroll. `#reply-<id>` was added (`replyHref` in `postCardModel.ts`, the id on each Thread reply) and scrolled to on arrival with
    `centre` from `src/components/build/partNav.ts`, the helper the build page uses for `#node-<id>`.
13. **`?step=4`.** The post page's step filter is `?step=<node id>` (UX-06, `readPostAddress`). Step links use the node id.
14. **Where the composer keeps publish-time settings.** There is no publish settings panel. The one setting of that kind is Open a
    bounty (a gap part made for publishing), in the Classification sheet's Build details (`SandboxCard.tsx`, `BuildDetails`). The
    opt-out sits beside it. The app's switch is the Card's own (`role="switch"`, `BountySwitch`, now `CardSwitch` with a label).
15. **`spaces.reactions`.** `text[]` of `'dislike'` and `'rating'` (20261107120000). `reactToPost` existed; nothing took a reaction
    back, so `removeReaction` was added. The database's trigger already holds the rule that every space must allow the kind.
16. **Collections.** No UI puts a saved item of any kind (step, part, session, request) into a collection: `requestAddToCollection`
    takes a build id only, and `collection_items.saved_item_id` is read (Start a build from this collection) but never written from
    the Library. "Collections take topics as they take other kinds" therefore adds nothing. Reported, not built.
17. **Home and Drafts import nothing from the composer's folder.** On main, Home already reaches `src/pages/site/compose/` through
    shared pieces (`FeedPost` → `RefLinks` → `referencePieces`, the route table's placeholders), and Drafts imports
    `compose/referencePieces` directly (`DraftsView.tsx`). The safer reading kept: no file of Home imports from the folder, and Drafts
    imports nothing more than it did (`src/pages/site/home/ux07.imports.test.ts`).
18. **Checks on main in this container.** `tsc` reports one error on main (`src/lib/openbuilds/postPage.ts`, the `readSpaceCrowd`
    cast, UX-06's; not touched). `npm test`: 11241 tests, 31 failing in 14 files. `npm run lint`: 1430 errors. `npm run audit:motion`
    fails on main here (22 of 33 moments over their frame thresholds; see Checks).

Two readings, the safer taken:

- **Topics filter's address.** Relabelled, value kept as `asks` (`?kind=asks`), so links made before keep working.
- **`3 new replies`.** The Everyone feed's rows carry no new count (UX-04 leaves it null there and points at `getNewReplyCounts`). It
  is read with the topics. When nothing is new to the reader the group says every reply (`6 replies`), never `0 new replies`.
- **Discussed rows.** "Topics about this build" (`about_build_id`) are only those about a step; a topic started from the build with it
  attached has no `about_build_id`. The rows list both, once each, newest first; the meta counts them apart (`3 topics`,
  `used to start 2 topics`).
- **`2 replies` on a step.** Counts replies (not topics) about the step among the 50 posts read, and links to the topic holding most.
- **Who sees `Start a topic about this build`.** The maker always; others only while the maker allows topics (the attachment trigger
  would refuse them otherwise).
- **Where the reaction row is drawn.** On the post page, under the topic's card and each reply's actions, where the space's rules
  apply. Home and profiles do not draw it.

### Plan

- Part 1: `readFeedTopics` (lib), `homeTopics.ts` (topic and reply group items), `TopicItem` and `ReplyGroupItem` in `HomeView`,
  the Topics label and its kinds, `TopicEngagementRow`, the reply box under the card -> verified by: `home/ux07.p1.test.tsx`,
  `home/ux07.imports.test.ts`; Playwright `e2e/tier3/ux07-across.spec.ts` Part 1.
- Part 2: `listTopicsAbout`, `DiscussedSection`, `StepRepliesMark` through `BuildConnections` -> verified by:
  `components/build/ux07.p2.test.tsx`; request rounds read from the code (below).
- Part 3: the fifth tab, `listTopicsBy`, `profileTopicEntries` -> verified by: `profile/ux07.p3.test.tsx`, `ProfileView.test.tsx`.
- Part 4: `SavedKind` `post`, `savedPostIds`, Library kind Topics, `PostCard compact` -> verified by: `library/ux07.p4.test.tsx`.
- Part 5: the `post` target in `resolveNotificationTargets`, `notificationHref`, both rows, `#reply-<id>` -> verified by:
  `notifications/ux07.p5.test.tsx`; Playwright Part 5.
- Part 6: `getTopicSourceSetting`, the Card's Topics row, `onTopicSourceSwitch` -> verified by: `compose/ux07.p6.test.tsx`,
  `npm run audit:motion`.
- Part 7: reactions in `readPostExtras`, `ReactionRow` -> verified by: `openbuilds/ux07.p7.test.tsx`, `postPage.test.ts`.
- Part 8: `src/pages/ux07.budget.test.tsx`; Playwright Part 8 at 390.

## Report

```
UX-07 · Across the site
PASS, with the parts and checks below that are not done or not comparable
Branch / PR: claude/friendly-gauss-8s7go9 (no pull request opened)
Facts in this prompt that were wrong on disk:
  - TopicCard is PostCard (src/components/post/PostCard.tsx); listTopicsAbout did not exist (built over listPostsAbout).
  - builds.allow_as_topic_source is builds.allow_as_post_source; saved_items kind openbuild_post is 'post'.
  - Home drew no topic or reply before this branch: getBuildFeed's postItems were read and dropped.
  - EngagementRow acts only on a build; a topic had no Like, Reply or Save of its own (TopicEngagementRow added beside it).
  - #reply-<id> did not exist (replies had no id; ?reply= opens a branch); ?step=4 is ?step=<node id> on disk.
  - The Notifications page's row is ActivityPage's (activityRowOf), not NotificationRow; both now draw the kinds.
  - The composer has no publish settings panel: the one publish-time setting is Open a bounty, in the Classification sheet.
  - Collections take no saved item of any kind from the UI (builds only), so topics in collections adds nothing.
  - Drafts imports src/pages/site/compose/referencePieces directly on main; Home reaches the folder through shared pieces.
  - tsc fails on main with one error (postPage.ts readSpaceCrowd cast, UX-06's); unchanged here.
Baseline → end: tests 11241 → 11338 (main: 31 failing in 14 files. End: 29 failing in 12 files, every one among main's 31; two
  compose tests that fail on main passed this run. No new failure.)
Compared boards: not comparable: UX-07 has no board (the prompt says no picture comes with it). Looks come from the host pages'
  own pieces and tokens. Screenshots: design/audits/ux-07/{before,after}/{home,build,profile,library,notifications}-
  {1440-noon,1440-dusk,390-dusk}.png. The Library board's dev fixture keeps its seven kinds (Topics is not on the board).
Request rounds and requests for the page, before → after (read from the code; see audit:pages below):
  - Home: round 1 unchanged (the feed and the columns). Topics and reply groups draw from the feed rows in round 1. Round 2 adds
    readFeedTopics (the posts by id, the reader's likes and new reply counts: three requests together) and savedPostIds (one).
    The cards' work and pictures (readCardExtras, up to five requests together) need those posts, so they land in a third round,
    for topics only; a topic is drawn at once without its attachments and gains them then.
  - /b2/:slug: no extra round. listTopicsAbout's three requests start with the page's other reads by build id.
  - Profile Topics tab, when opened: two rounds (the page of posts, then their extras and the replies' topics together).
  - Library Topics kind: the kept list as before, then readTopicCards (the posts, then their work): two more rounds.
  - Post page: three rounds as UX-06 left it; the spaces' reactions and the thread's reactions are two more requests in round 2.
  - Composer: no request more on its open. The opt-out is read (one request) when the Classification sheet is first opened.
  - npm run audit:pages was not run: its harness (e2e/audit/support) has no OpenBuilds posts, so none of the reads above would
    return anything there. The /b2/:slug claim (no extra round) is read from the code: listTopicsAbout is a query keyed on the build
    id, enabled with the page's other reads by build id, and none of its three requests waits on another.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): not run (audit:perf measures the audit harness's pages, whose
  backend has no posts, so none of this branch's additions draw there).
Built but not live yet: none. Every addition reads live data (the database objects are UX-04's).
Layers built only because a target failed: none.
Names that differed from this prompt: TopicCard → PostCard; listTopicsAbout → listTopicsAbout (new, over listPostsAbout);
  allow_as_topic_source → allow_as_post_source; openbuild_post → post; ?step=4 → ?step=<node id>.
Raw values without a token: none. Spacing: only scale values (the Home items use grids for their avatar columns).
Motion cut back after watching: none. Nothing added moves.
Dead code seen: none new. MoreDetails.tsx (the old Card) still takes ComposeDetails; it ignores the new optional field.
Lovable messages needed: none (no migration).
Parts not done:
  - Part 4, collections taking topics: no path puts any saved item in a collection (see Facts).
  - Part 1's third round for the cards' attachments on Home (reported above, not removed: removing it needs the feed function to
    return attachments, a migration).
  - npm run audit:design, audit:perf, audit:themes, audit:contrast: no board, and the audit harness has no posts. Light and Dark were
    checked by eye in the screenshots.
Questions for Miles:
  1. Should build comments (build_comments) later become replies? They are unchanged here.
  2. Can Older requests be retired once no request is open? It stays the one label for existing requests.
  3. Home's topics take a third round for their attachments' work. Should get_build_feed return each topic's first attachment so
     the cards are whole in round 1 (a data prompt with a migration)?
  4. Collections take builds only from the UI. Should a later prompt let a reader put any saved item (a step, a topic) in one?
  5. Others see Start a topic about this build only while the maker allows topics. Should a reader also be able to start a topic
     *about* the build (no attachment) when the maker has switched it off? The database would allow that; the safer reading hid it.
  6. Reactions are drawn on the post page only. Should Home's and profiles' topic cards carry them too?
  7. The repo-wide npm run lint reports 1430 errors on main and on this branch alike; none are on lines this branch wrote.
```

## Checks run

- `npx tsc --noEmit -p tsconfig.app.json` (with `NODE_OPTIONS=--max-old-space-size=8192`): one error, the same one main has
  (`src/lib/openbuilds/postPage.ts`, `readSpaceCrowd`'s cast). None in this branch's lines.
- `npm test`: 11338 tests, 29 failing in 12 files, every one among main's 31 (build, compose and lookRules files this branch does
  not draw in). A first end run, made while the browser suite loaded the machine, showed three composer failures that main does not
  have: the opt-out's read started with the composer and broke the legacy page's publish sheet (`BountySection.test.tsx`). Fixed in
  a P6 follow-up commit (the read waits for the Classification sheet); the rerun is the line above.
- `npm run lint`: 1430 errors, the same count as main; 534 warnings (main 529: the five are react-refresh notes on new files that
  export a constant beside a component). No error on a line this branch wrote.
- `npm run build`: builds. `scripts/check-size.mjs`: first download 233.1 KB (UX-06 left 232.9), composer chunk 123.7 KB (123.5).
  Both over their budgets on main as well; the budgets bind after SV-26.
- `npx playwright test e2e/tier1 --project=desktop --project=mobile`: 97 failed, 360 passed on main in this container (they read a
  live backend whose schema is not the migrations'). The branch's failures are those 97 and four more that ran alongside the unit
  suite; the four pass run alone (`card-images`, two `signin-site-frame`, `ux03-feed`, all mobile). Run through a local
  Chromium path (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`) against Vite on 127.0.0.1 (the container has no IPv6).
- `npm run audit:motion`: fails on main in this container (frame gaps and long tasks: 22 of 33 moments over their thresholds,
  recorded with `MOTION_STAGE` so every moment ran). On the branch 18 moments are over, every one of them among main's 22. Nothing
  in the List changed; the Card's Topics row draws no motion.
- Playwright `e2e/tier3/ux07-across.spec.ts` (Parts 1, 5 and 8) passes, with UX-05's and UX-06's tier3 specs.
- The theme guard tests (`src/lib/theme/*.test.ts`) pass except main's lookRules findings in the build page's files; every file
  this branch added or changed that the guard can hold is in `lookRules.test.ts` (`ProfileView.tsx` is not, as on main: its existing
  spacing is outside the scale; the lines added to it use the scale).
- The diff holds no em dash.

## What Miles needs to do

Merge the pull request (none is open yet: ask for one, or open it from the branch `claude/friendly-gauss-8s7go9`), then press
Publish › Publish changes. No Lovable message: this prompt has no migration.
