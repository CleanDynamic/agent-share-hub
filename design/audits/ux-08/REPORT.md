# UX-08 · Asking starts a topic

## Part 0 · Baseline

Pulled main at `1f61642` (UX-07 merged as #442). `node_modules` was missing; `npm ci` installed the lockfile. Branch:
`claude/ux-08-asking-starts-topic-u8328l` (the branch the session gives), one commit per part.

Reports read first: UX-06's and UX-07's (`design/audits/ux-06/REPORT.md`, `ux-07/REPORT.md`). UX-04 and UX-05 have none on disk (UX-06's
report says the same). Reused: `src/lib/openbuilds/`, `PostCard` (the prompt's `TopicCard`), the New post window (`NewPostWindow`, the
prompt's New topic window) with its `draft` prefill, `PostingWindows`, `listPosts`, `createPost`, `topicHref`, `splitBody`.

Before/after screenshots: **not taken.** The audit harness and the faked backend (`e2e/tier3/support/openbuildsWorld.ts`) were not run
in this session (see Parts not done); Light and Dark were checked through the tokens only (every colour is a `t.*` token already on the
page, nothing new was drawn).

### Assumptions (each fact the prompt states, and what the disk says)

1. **The composer's request paths.** `SessionHead.tsx`, `AskNextSessionRow.tsx`, `OpenRequestDialog.tsx`, `openRequestCopy.ts` and
   `src/lib/build/openRequest.ts` are as stated, and the marks are stored as stated (`sessions_meta[key].open`, `workstreams[i].open`).
   **Wrong:** the session head's menu item is `Open as a request…` (`SESSION_HEAD_COPY.openAsRequest`), not `Open Session n as a request`;
   that string (`OPEN_REQUEST_COPY.openSession(n)`) was the *dialog's title*. The prompt's `Mark Session <n> still open` is used as the
   menu item, the dialog's title is `Still open: Session <n>`.
2. **The live composer never filed its marks.** Only the legacy workspace's `PublishControl` (`fileBounties`, reached through `Compose`
   for a rebuild or a `from` parameter) turned `openTargetsOf(making)` into bounties. `ComposePage.onPublish` (the live composer) filed
   nothing, so a mark made in the live composer had no effect at all before this branch. Part 1 files topics from `ComposePage.onPublish`.
3. **A step tile can be marked as a gap in the live composer: no.** `Step` had no gap field; `is_gap` was written only by the legacy
   Inspector's toggle (`Inspector.tsx`) and the legacy `BountySection`. Part 1 adds `Step.stillOpen`, `setStillOpen` (graph.ts) and
   `useComposePrompts().setStillOpen`, storing `is_gap` and `payload.gap_problem` (`src/lib/build/gaps.ts`'s key).
4. **Home's failed-run path.** `openRequestFromRun` in `src/lib/bounty/runRequests.ts`, called from `HomePage.tsx`'s `onOpenRequest`,
   with the toast `Request opened.`, as stated. **Wrong:** a run (`build_reproductions`) records `model_used` and a note, **no failing
   step**. "Its failing step marked still open" cannot be read from the disk.
5. **Home's `Open requests`.** `RequestsSection` in `HomeView.tsx`, fed by `listOpenBountyCards` (also the route table's Home prefetch),
   as stated. The same read also fed `asks` (details on old request rows in the feed).
6. **Builds.** `LENS_LABEL.unsolved` `Open requests`, the filter `Has an open request`, its chip, as stated. `gallery.ts` reads open
   requests with `bounties!inner` (`listBuildsTableRows`, `countGalleryBuildRows`, `countOpenBountyBuilds`, `listGalleryRows`).
7. **Solvers.** `/openbuilds/solvers`, `/bounties/solvers` (both `Solvers`) and `/b/:id/leaderboard` (a `Navigate` to `/openbuilds/solvers`)
   in `App.tsx`; the footer link in `SiteFooter.tsx`, as stated.
8. **Names.** `listTopics` is `listPosts`; the New topic window is `NewPostWindow` (title `New post`, button `Post`, not `Start topic`);
   `TopicCard` is `PostCard`. The prompt's copy rule (never `post` for a topic in new shown copy) is kept for what this branch adds; the
   window's own words are UX-05's and are not changed here.

### Plan

- Part 1: copy, `Step.stillOpen` and the tile menu, `startStillOpenTopics` after publish, the checklist group -> verified by:
  `compose/ux08.p1.tile.test.tsx`, `compose/ux08.p1.checklist.test.tsx`, `openbuilds/stillOpen.test.ts`,
  `SandboxPage.openRequest.test.tsx`; `npm run audit:motion`.
- Part 2: `failedRunDraft`, the window opens from Home -> verified by: `home/ux08.p2.test.tsx`.
- Part 3: `stillOpenRows`, the section's words, the query and the prefetch -> verified by: `home/ux08.p3.test.tsx`, `HomePage.test.tsx`.
- Part 4: the lens, the filter, the chip, the computed columns and the migration -> verified by: `build/ux08.p4.test.ts`, `buildsTable.test.ts`.
- Part 5: three redirects, the footer -> verified by: `routing/retiredRoutes.test.tsx`, `breadcrumbFooter.test.tsx`.

## Report

```
UX-08 · Asking starts a topic
PASS, with the parts and checks below that are not done or not comparable
Branch / PR: claude/ux-08-asking-starts-topic-u8328l (no pull request opened)
Facts in this prompt that were wrong on disk:
  - The session head's menu item was "Open as a request…", not "Open Session n as a request" (that was the dialog's title).
  - The live composer never filed its marks: only the legacy workspace's PublishControl did. ComposePage.onPublish filed nothing.
  - A step tile could not be marked in the live composer: Step had no gap field (is_gap was the legacy Inspector's).
  - A run (build_reproductions) records model_used and a note, no failing step: "its failing step marked still open" is not
    readable from the disk, so the line reads "Didn't work for me on <model>." and no step is marked (failedRunDraft takes a step
    if a caller ever knows one).
  - listTopics is listPosts; the New topic window is NewPostWindow (title "New post", button "Post", no "Start topic"); TopicCard is PostCard.
  - Home's Open requests read also fed the details on old request rows in the feed (asks); with the read gone those rows draw
    without them.
  - tsc, npm test, npm run lint, audit:motion and the size budget all fail on main in this container (see Checks).
Baseline → end: tests 11241 → 11412 (main, from UX-07's report: 31 failing in 14 files. End: 29 failing in 12 files, every one a
  file that fails on main too; see Checks). No new failure.
Compared boards: not comparable: UX-08 has no board (the prompt says no picture comes with it). Each page keeps its look; only
  words, data and one menu item changed, all with pieces already on those pages.
Request rounds and requests for the page, before → after:
  - Home (/): the Open requests read (listOpenBountyCards: 3 requests) is replaced by Still open (listPosts: 1 request, topics with
    their author, attachments and spaces embedded), started in round 1 once the session check says which scope. The route table's
    prefetch moved with it (same key). audit:pages: home read 21 requests when opened from inside the app (main: 21) and 26 cold
    (main: 25, the extra is the space_members read of the Still open scope). Rounds: best of 5 runs 2 on both branches; the
    default best of 3 read 3 on this branch in one run and 2 on main (the audit's own note says a busy main thread opens gaps that
    read as a round), so the audit's "report and targets" step reports home at 3 rounds there. library-saved reads 8 or 10 cold on
    both branches from run to run (dm_presence and user_progress fall inside or outside the window); this branch changes nothing there.
  - Builds: still one request for the Table and one per lens count; the two computed columns ride in the same select / filter.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): not run (audit:perf not run in this session).
Built but not live yet: Part 4's two computed columns need the migration; until it is applied the Builds reads are made again as they
  were (open requests alone), once, and the page works.
Layers built only because a target failed: none.
Names that differed from this prompt: listTopics → listPosts; New topic window → NewPostWindow ("New post" / "Post"); TopicCard →
  PostCard; "Open Session n as a request" menu item → SESSION_HEAD_COPY.openAsRequest "Open as a request…".
Raw values without a token: none. Nothing new is drawn but one 12 / 400 `--label` line (`Still open`, under a marked tile's title)
  in the tile recipes' own text role.
Motion cut back after watching: none. Marks appear at once; nothing animates.
Dead code seen (for SV-26):
  - listOpenBountyCards, OPEN_BOUNTIES_PAGE_SIZE, the card types and board.test.ts: no caller in src but tests. Read "leave the
    function if other callers remain" as production callers; deleting a whole read is reviewed on its own.
  - createBountyForGap's fromRunId option: no caller left (openRequestFromRun was its only one). The from_run_id column and
    openBuilds.ts's read of it stay for existing requests.
  - src/pages/Solvers.tsx, src/lib/bounty/solvers.ts (listTopSolvers and the rest; OpenBuildsPage and the route table's prefetch
    still read listTopSolvers for the legacy requests page's Top solvers), the breadcrumbTrail entries for /openbuilds/solvers and
    /bounties/solvers, e2e/tier3/solvers-board.spec.ts. OpenBuildsPage.tsx:406,412 and ContentDetail.tsx:1965,2240 link to the
    retired addresses and now land on /openbuilds.
  - PublishControl.tsx's fileBounties and ofTargets, BountySection.tsx, the Inspector's gap toggle (legacy workspace), and the live
    Classification sheet's "Open a bounty" switch (details.setGapOn): they still create requests (see Questions 1).
  - OpenRequestDialog / OPEN_REQUEST_COPY / openTargetsOf keep their request-era identifiers (the prompt says rename none).
Lovable messages needed:
  Apply supabase/migrations/20261107180000_ux08_still_open_builds.sql exactly as written. Change nothing else.
  Then run the three EXPLAIN (ANALYZE, BUFFERS) statements in its header and paste the plans back.
Parts not done:
  - The Playwright flows (Part 1: mark a step tile, publish, find the topic on OpenBuilds; Part 2: from a failed run to a published
    topic). The faked backends (openbuildsWorld, the audit fake) do not model the composer's publish together with create_post; the
    same chain is covered in pieces by Vitest: the mark stored on a SandboxPage mounted on supabase-js (SandboxPage.openRequest.test),
    the topics written once and not again (stillOpen.test), the toast (stillOpen.test), the window opening prefilled from a failed
    run (HomePage.test, ux08.p2.test).
  - Before and after screenshots, audit:design, audit:perf, audit:themes, audit:contrast (not run), audit:motion (run, see Checks:
    it fails at its first moment on main in this container, so no composer moment can be judged).
  - ComposePage.onPublish's wiring to sendStillOpenTopics is type-checked and read, not run by a test.
Questions for Miles:
  1. "When it is done, nothing on the site creates a new request": three paths still do. The legacy workspace's publish sheet
     (PublishControl: gaps and the session / part marks, reached for a rebuild or ?from), the Inspector's gap toggle, and the live
     composer's Classification sheet "Open a bounty" switch (a gap part made for publishing). They are outside this prompt's four
     paths and were left. Retire them in a prompt of their own?
  2. A mark made in the live composer and then published through the legacy workspace would also file a bounty. Remove ofTargets there?
  3. Pressing Publish changes after a failed send retries only what did not go (a mark already posted is not posted again). The
     toast says "Try again from the build page", but the build page has no retry. Should it, or should the words say "Publish changes"?
  4. The checklist's "This opens n still-open topics" counts every mark, including ones already posted. Count only those not yet posted?
  5. A topic started from a mark is "about" the step (about_node_id) for a step tile, and carries no about_* for a session or part.
     Right?
  6. A step tile marked still open drops out of completeness and the build's evidence (is_gap, as the disk treats a gap): marking the
     only prompt can put "Prompt" back in Required. Intended?
  7. The Table's Open column adds still-open topics to the count but its reward is still the largest open-request reward. Add topic
     rewards?
  8. A failed run stores no step. Should runs record the step they failed at, so the topic can mark it still open?
  9. Home no longer reads the open requests, so old request rows in the Asks / Topics filter lose their solutions, closing date and Me too
     count. Acceptable until Older requests are migrated?
```

## What Miles needs to do

In order: (1) merge the pull request (none is open yet: ask for one, or open it from the branch `claude/ux-08-asking-starts-topic-u8328l`);
(2) send the Lovable message `Apply supabase/migrations/20261107180000_ux08_still_open_builds.sql exactly as written. Change nothing else.`
and paste back the three EXPLAIN plans from its header; (3) press Publish › Publish changes.

## Checks run

- `npx tsc --noEmit -p tsconfig.app.json` (with `NODE_OPTIONS=--max-old-space-size=8192`: the default heap runs out): one error, the
  `readSpaceCrowd` cast in `src/lib/openbuilds/postPage.ts` (UX-06's, also on main). Nothing new.
- `npm test`: 11412 tests, 29 failing in 12 files after the last fix: `src/lib/theme/lookRules.test.ts` (12, all `BuildSteps`),
  `src/lib/build/readerSteps.test.ts` (4), `everything.test.ts`, `shapes.test.ts`, `onePrompt.snapshot.test.tsx`,
  `src/pages/site/build/{BuildSteps,BuildSteps.tiles,BuildView,readerSessions}.test.tsx`, `src/pages/site/compose/connection.test.tsx`,
  `ux03.p3.test.tsx` (2), `src/components/build/ux03.p4.test.tsx` (3). All fail on a clean checkout of main too (re-run in a
  worktree for every file except `ux03.p4`, which failed in the first run of the suite before any change). A run before the last
  commit also failed `src/lib/build/galleryCounts.test.ts` (3): it asserted the old open-request join; updated in the last commit.
- `eslint` on every changed file: 0 errors (20 warnings, `react-refresh/only-export-components` and hook dependencies; none on a
  line this branch wrote except `StillOpenTile.tsx`, which exports a hook beside a component). The repo-wide `npm run lint` was not run
  (1430 errors on main per UX-07).
- `npm run build`: passes. `scripts/check-size.mjs`: fails on main and here. First download 233.0 KB (main 233.1, budget 200),
  composer chunk 124.6 KB (main 123.7, budget 120): this branch adds 0.9 KB to the composer chunk (the tile menu items, the
  checklist group and the pure mark reader; the topic writer and the spaces menu load on use).
- `npm run audit:motion`: fails at its first moment, `remove-a-tile` (frame gaps and a 42% jump), 32 did not run; main fails at the
  same moment in the same way here. Part 1 adds no motion: marks and the `Still open` line appear at once, no tile is added or
  removed. The moments could not be compared.
- `audit:pages` (served on a built bundle): 11 of 11 page tests pass; the report step fails on `home` (rounds, noise above) and
  `library-saved` (requests, noise above), neither from this branch.
- Not run: `npx playwright test e2e/tier1` (both projects), `audit:design`, `audit:perf`, `audit:themes`, `audit:contrast`.
- The diff has no em dash.
