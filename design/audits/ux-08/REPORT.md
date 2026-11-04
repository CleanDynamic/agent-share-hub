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
