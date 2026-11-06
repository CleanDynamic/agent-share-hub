# UX-11 · Clear out the old code

```
UX-11 · Clear out the old code
PASS, with the parts and checks listed under "Parts not done" and "Checks" not met in full
Branch / PR: claude/bold-feynman-ekzsaa (the branch the session gives; the prompt allows it). No pull request opened.
Facts in this prompt that were wrong on disk: see "Assumptions" (15 of them)
Baseline -> end: Vitest 11,705 passed / 31 failed (11,736 tests) -> 11,660 passed / 29 failed (11,689 tests). No new failure.
Compared boards: audit:design: the 7 vision boards pass; none is compared against an archived board.
Request rounds and requests for the page, before -> after: see "Page audit".
Names that differed from this prompt: src/routing/ -> src/lib/routing/; /u/:username -> /profile/:handle; see Assumptions.
Dead code seen: see "Kept, unsure" and "Already unused before UX-11".
Lovable messages needed: none. No migration, no edge function.
Parts not done: Part 2 and Part 3 done-whens, and Part 4's, are met in part only (see below); Part 8 changed nothing.
Questions for Miles: see below.
```

## Second follow-up: remove the whole request / bounty system (Miles' new answers)

**Status: PARTLY DONE. The code and the database are not both clear yet, and the database drop is deliberately held back.** Read "What is
left" before merging. This section supersedes the two before it where they disagree.

### Step 0: the count (NOT DONE: no database access from this session)

I cannot read the live database from here (no key, no connection), so I could not count the rows in each bounty-era table or in
`content_items` where `post_type = 'bounty'`, or the distinct owners. **So the "if another real person owns a row, stop at 3c" rule is
enforced by the database instead of by me:** `supabase/migrations/20261110120000_ux11_legacy_backup.sql` (safe to apply now, it only
copies) creates the schema `legacy_backup_20261110`, and gives you the count with one query after it is applied:

```
select * from legacy_backup_20261110.owner_summary();                       -- rows and distinct owners, per table
select user_id, array_agg(distinct table_name) from legacy_backup_20261110.owners() group by 1;   -- who they are
```
The drop migration (held back, below) will not run until `legacy_backup_20261110.allowed_owners` holds Miles' and his test accounts' ids
and every owner of a row is in it. If any other real person owns a row it raises and stops, and Miles decides.

### Done

| Step | What | Commit subject |
| --- | --- | --- |
| 1 | `/drafts/posts` redirects to `/drafts` in one hop (test row added); the older post drafts page, its link and its breadcrumb are deleted | `P1c` |
| 3a | The backup: `20261110120000_ux11_legacy_backup.sql` (17 tables, the bounty `content_items` rows, the bounty columns of every other row, the marked `build_nodes`, an owner count and an allow list). **Restore steps are in its header.** | `step 3a` |
| 3b | `/openbuilds/requests`, `/openbuilds/:id/solve`, `/bounties/:id/solve`, `/bounties` redirect to `/openbuilds` (rows in `retiredAddresses.test.tsx`); `/content/:id` redirects a bounty content item to `/` and still shows blueprints and blogs (test: `ContentDetail.retired.test.tsx`); the Older requests page, its route, link and breadcrumb, the request page, the session-offer dialog, `SolvePanel`, `GapPanel`, the solutions reads and writes, the accept / vote / discussion libraries and components, the old-request fixture and its three tests are deleted | `P3 readers` x3 |
| 3b | The build page loses the asks read, the solver credit, the gap panel, the solve sheet and the reward on a part and on a gap. Where it broke keeps its Still open list and its Reply. `listSolverHandles` (a profile lookup misnamed) became `lib/profile/handles.ts` | `P3 readers` |
| 4 | The 64 unreachable files: **43 deleted in 11 commits, one per folder** (`src/components/layout` + `src/hooks`, `src/components`, `auth`, `build`, `depth` + `trophies`, `feed` + `gallery`, `notifications` + `shell`, `src/lib/build`, `src/lib/reblog`, then the readers above). Each deleted with the tests that tested only it; mixed tests were edited. | `P4 ...` |
| 5 | knip reports **zero unused files**. Unreachable files from `src/main.tsx`: 64 -> 21, all kept (below). | |

**Kept of the 64, and why (21 files, all fixtures a live test imports, or types):**
`src/test/{setup.ts,tokenStyle.tsx,deno-globals.d.ts}`, `src/vite-env.d.ts`, `src/lib/theme/shadcn.ts` (the source `css-parity.test` checks `index.css` against),
`src/lib/build/buildsMapsTestSupport.ts`, `src/pages/site/signin/signinTest.tsx`, `src/pages/site/openbuilds/postModel.fixtures.ts`,
and in `src/pages/site/compose/`: `addMenuTestSupport.tsx`, `ca20Fixture.ts`, `ca20Harness.tsx`, `ca21Harness.tsx`, `ca23.harness.tsx`,
`ca26.menuHost.tsx`, `mapArtwork.ts`, `motionStub.ts`, `optionalKit.ts`, `postTabKit.tsx`, `sv07Backend.ts`, `sv07Harness.tsx`,
`sv18.fixtures.ts`. Not under /admin or /dev.

### Held back on purpose (in `design/audits/ux-11/pending/`, NOT in `supabase/migrations`)

- `20261110130000_ux11_drop_legacy_requests.sql` (3c): drops the 17 tables, 18 functions, the bounty `content_items` rows and every
  `bounty_*` column. Its first statement refuses unless the backup exists with at least as many rows as live and every owner is in
  `allowed_owners`. The dependency check and the `EXPLAIN` are in its header, and so is the Lovable message. **Applying it now would break
  Home, Builds, the legacy upload editor and notifications**, because code still reads those columns (below).
- `20261110125000_ux11_clear_open_marks.sql` (step 2): clears `is_gap` and `payload.gap_problem` on published builds' nodes that no
  topic is about. **The Unsolved mark and UX-08's "still open" mark are the same two columns**, so the code that reads a mark cannot be deleted
  without deleting UX-08's; only marks nothing in the new system stands behind can be cleared. The legacy composer's Unsolved
  toggle and the Build Card's "Open a bounty" switch were already removed.

### What is left (not done in this run), so the final proof is NOT met

The final grep still finds `bounty` in **196 files** and `solver` in **95** under `src/` (not counting `integrations/supabase/types.ts`, which is
generated), and 1 file each in `supabase/functions/`. Removing it means editing live pages, not deleting files, and I stopped rather than
guess in them. By folder, non-test: `lib/bounty` (18: the run-request rules, me-too, claims, briefs, reviews and the rest, still used by Home),
`lib/build` (9, `gallery.ts` and the feed), `components/brand` (8: `GapMarker`, `VacantFrame`, `CategoryChip`), `components/bounty` (8: the
"missing slot" badges used by the legacy article viewer and editor), `src/pages` (5: `PublishMetadata`, `Upload`, `Messages`, the legacy
upload), `lib/notifications` (5), `components/reblog` (5), `components/compose` (5), `lib/discover/queryBlueprints.ts` (29 matches),
`components/feed-card.tsx` (22), `lib/profile`, `lib/library`, `lib/feed`, `lib/messaging`, `lib/moderation`, `lib/analytics`, `components/article`
(the legacy editor's bounty mode), `components/publish/BountyDetailsCard.tsx`, and the theme.
**What still reads the database** (from the code, non-test): `bounties` (`lib/bounty`), `solutions` and the satellites (`lib/bounty`,
`lib/bounty-solver`), `content_items.bounty_*` (`queryBlueprints`, `feed-card`, `PublishMetadata`, `Upload`, `getCanonicalPayload`, `getBuildFeed`,
`Messages`), `top_solvers`, and `openbuild_posts.reward_gbp`. Every one has to go before the drop migration can be applied.
"request" is still in 389 files in `src/`; almost all are HTTP requests, the OpenBuilds product's own word (`listPosts`, "Start a topic")
or tests. I did not rename `SITE_NAV.bounties` (the OpenBuilds nav key) or the `/b/:id/leaderboard`-style redirect constants (`SOLVERS_ADDRESSES`).
`supabase/migrations/` and the generated types keep these names for ever (history); a clean grep there is not possible.
The next run: Home's run-request rules and me-too (move what UX-08 needs to `lib/openbuilds`), the gallery and discover reads, the legacy
upload editor's bounty mode and `PublishMetadata`, the article viewer's missing-slot machinery, the notification kinds, then the drop
migration.

### Checks (final tree)

- `tsc` clean. **Vitest 11,323 passed / 30 failed** (baseline 11,705 / 31): one new failure was mine and is fixed in the last commit (the UX-10
  migration "is the newest file" test, which my backup migration, newer than it, tripped); the rest are the baseline's. 383 fewer tests (the deleted code's own).
- knip: **0 unused files**; exports 729 -> 717, types 224 -> 229 (six types in files whose users I deleted; listed by `knip`).
- Lint: errors 1,419 -> 935, warnings 549 -> 531 (the deleted files' `any`s).
- `audit:size`: total JavaScript **6,724,798 -> 6,366,482 bytes, -358,316 (-5.3%)**, chunks 478 -> 440. First download 235.2 -> 231.6 KB; composer
  124.5 -> 124.2 KB (both over budget, as on main).
- `audit:pages`: see the line at the foot (run last, 14 minutes).
- Tier 1 Playwright: not re-run (stale on main, as measured earlier); the Playwright check of three old addresses
  (`e2e/tier3/retired-addresses.spec.ts`) is unchanged and was not re-run either.

### Questions for Miles

1. Apply the backup migration, run the two owner queries, and send me the answer: the drop stays held until you do.
2. Run the next prompt for the "what is left" list above (it is about 190 files of live code). Or tell me to split it by page.
3. The Unsolved mark and "still open" are one column. Should the clear-marks migration also clear marks that have a topic, or only the
   ones with none (as written)?

## Follow-up after merge: Miles' five answers

Branch restarted from main at `0f765a1` (UX-11 merged as #446). **This section supersedes the earlier text where they disagree** (Kept,
unsure; Questions 1 to 8; Parts 2 to 4 done-whens). Commits: P1b, P4b, P3b.

1. **`/content/:id` is read-only history for an old request (P3b).** It shows the title, what was asked (the article body), the
   status as recorded (`Status: Open when it closed | Closed | Solved`), any accepted solution (the provenance panel, the byline, and
   "View original"), and one line: "Requests have closed. Ask in OpenBuilds by starting a topic.", where "starting a topic" opens
   the New topic window (`PostingWindows`, kind `post`). Gone from the page: submit, vote, accept, fork, manage, pause, extend
   deadline, edit criteria, close, promote to blueprint, the discussion forum and its composer, the solver leaderboard, the
   meta-bounty body and pledge, and the author's Edit (it opened the retired editor). Gone from the article body: the "Submit a
   solution" button on missing stages and blocks (`SubmitSolutionButton`). `retiredSurfaces.test.tsx` passes unchanged (13 of 13).
   Also fixed on the way: two `useMemo`s in `ContentDetail` sat after its early returns, so the first render with data used more hooks
   than the loading one and React threw "Rendered more hooks". They are above the returns now. The new page test caught it.
2. **Every form of `/upload/bounty` redirects to `/drafts` in one hop (P1b)**, with or without `?id=` (both rows are in
   `retiredAddresses.test.tsx`). `BountyUploadShell`, `src/lib/bounty-legacy/` (the flag), the notice's bounty line and its e2e
   spec are deleted. **How many old bounty drafts exist: I cannot count them from this session (no database access).** Run:
   `select count(*) from content_items where post_type = 'bounty' and status = 'draft';` They stay untouched and cannot be opened.
   Two loose ends: the legacy `/drafts/posts` page still routes a bounty draft's click to `/upload/bounty?id=`, which now bounces to
   `/drafts`; `Upload.tsx` still maps type `bounty` to the same address.
3. **UX-08 is on main** (`stillOpenMarks`, `Step.stillOpen`, `startStillOpenTopics`), so the removals went ahead (P4b): the "Open a
   bounty" switch and its "What is left open" field on the Build Card and in More details, and the Inspector's Unsolved toggle with
   its problem field. Behind them: `onGapSwitch`, `setGapOn`, the `gap` writer, `composerGap`, `saveGap`, `gapProblemText`,
   `gapProblemPatch` and their tests. A gap node a maker already made stays in the build as a step marked still open. **One cost:**
   a part marked Unsolved in a rebuild, which only the legacy composer opens, can no longer be un-marked there. Tests that prove
   publishing, rebuild and `?from=` (`Publish`, `PublishSheet`, `RebuildSection`, `ComposeView`, `SandboxCard`, `ux07.p6`,
   `Compose`) pass; `RebuildSection` fails alone on main too, as before.
4. **`createBountyForGap` and `scripts/verify-bounty-flow.ts` are deleted.** The fixture is `src/test/oldRequest.ts`
   (`insertOldRequest(tables, { status })` pushes a `bounties` row, its build, its gap node and its `content_items` row straight into
   a table store; no newer columns). It feeds: `bounty.test.ts` (Older requests' `listOpenBounties` and an old request's `getBounty`),
   `pages/site/build/oldRequestGap.test.tsx` (Where it broke, open and closed), and `pages/ContentDetail.oldRequest.test.tsx`
   (`/content/:id`: 6 tests, including that no control that creates, manages, answers or accepts is on the page). No file under
   `src/` now inserts into `bounties` or writes a `content_items` bounty row.
5. **The 64 files that were already unreachable are left alone** (list below). Caused by this prompt and cleared in it:
   `ui/scroll-area.tsx`, the meta-bounty, leaderboard, management, promote and discussion components, `lib/bounty-competition/` (all but
   the `BlueprintAttributionBanner`), five `bounty-solver` files, `createBountyThread`, three notification triggers, and the exports
   behind them. knip: files 0 -> 1 (`FollowButton`, as before), exports 729 -> 715, types 224 -> 223; nothing newly flagged.

**Checks on the final tree.** `tsc` clean. Vitest 11,641 passed / 29 failed (baseline 11,705 / 31; 11,670 tests against 11,736); no
new failing test. Lint on every changed file: only the `any`s that were already there. Build: JS **6,724,798 -> 6,526,605 bytes
(-198,193, -2.9%)** against `72f55c9`, chunks 478 -> 464; `ContentDetail` alone -138,994. First download 235.2 -> 234.3 KB and
composer 124.5 -> 124.2 KB, both still over budget as on main. **Not re-run this time:** `audit:pages`, `audit:design`, tier 1 and
the screenshots (nothing a page's request count or board depends on changed; the first full audit is above).

**Questions that remain.** (a) The loose end in 2: should the legacy `/drafts/posts` page stop listing bounty drafts? (b) Should an
Unsolved part in a rebuild be un-markable somewhere? (c) The meta-bounty tables and `content_items.bounty_*` columns are now written
by nothing and read only by this page: drop later? (d) `lib/bounty-solver` still holds the solve page's draft and submit functions
(`/openbuilds/:id/solve` stays).

### The 64 files unreachable before UX-11, by folder, with the last commit that touched each

History in this repository was flattened, so most show the same commit. Test support files are included. `knip` does not report them,
because tests import them.

**`src/`**

- `vite-env.d.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/`**

- `BountyCard.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `FeedItem.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `FeedItemExpanded.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `FollowButton.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ReblogCard.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ReblogComposer.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ReblogDetailView.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `TipsTab.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/auth/`**

- `AuthCheckbox.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `AuthDivider.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/build/`**

- `BuildHeader.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `BuildTabs.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `CreatedViaLine.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `PortableExport.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `RebuildTree.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `RebuildsTab.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ReproductionAction.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `WhereNext.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `createdViaCopy.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/depth/`**

- `DepthRevealModal.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/feed/`**

- `BuildFeedItems.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/gallery/`**

- `cardBodies.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/layout/`**

- `LeftPanel.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `RightPanelExplore.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/notifications/`**

- `NotificationCard.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `NotificationRow.tsx`: d4d94fa 2026-11-04 UX-07 P5: notifications about topics and replies, leading to the topic at the reply

**`src/components/shell/`**

- `NavSearch.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/components/trophies/`**

- `badge-tile.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `pending-reveal-strip.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `showcase-strip.tsx`: 568f821 2026-10-31 SV-26 P2: account menu, bottom sheets, tooltip, sonner and helmet out of the first download

**`src/dev/fixtures/vision/`**

- `openbuilds.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/hooks/`**

- `useDraftCount.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `useNavBadges.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/lib/bounty/`**

- `legacyMeToo.ts`: bb31892 2026-10-31 SV-26 P5: keep the deliberate structured logs, no-console stays an error

**`src/lib/build/`**

- `buildUpdates.ts`: 237707c 2026-10-31 SV-27 P2: deployment tile types and changelog table
- `buildsMapsTestSupport.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `deploymentNeeds.ts`: 2d0ce9a 2026-11-01 SV-28 P1 to P6: team instructions, handoffs, mentions, jobs, approval step, workspace, t...
- `partnership.ts`: 7d12d73 2026-10-31 SV-27 P7: deployment in the composer

**`src/lib/reblog/`**

- `checkExcerptStillValid.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `getReblog.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `getReblogsByUser.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `index.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `realtime.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `updateReblog.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/lib/theme/`**

- `shadcn.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/pages/site/compose/`**

- `addMenuTestSupport.tsx`: 42f672c 2026-11-04 UX-02 P6, P7: the Add step tile menu, and one way to add
- `ca20Fixture.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ca20Harness.tsx`: 42f672c 2026-11-04 UX-02 P6, P7: the Add step tile menu, and one way to add
- `ca21Harness.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ca23.harness.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `ca26.menuHost.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `mapArtwork.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `motionStub.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `optionalKit.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `postTabKit.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `sv07Backend.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `sv07Harness.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `sv18.fixtures.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/pages/site/openbuilds/`**

- `postModel.fixtures.ts`: 8f18c03 2026-11-04 UX-06 P1: the post page at /openbuilds/topics/:id, its Thread and side column

**`src/pages/site/signin/`**

- `signinTest.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans

**`src/test/`**

- `deno-globals.d.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `setup.ts`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans
- `tokenStyle.tsx`: 929c0c1 2026-10-28 Re-ran EXPLAIN plans


## Part 0 · Baseline

Pulled main at `72f55c9` (UX-10 merged as #445); the branch started there. `node_modules` was missing; `npm ci`. The
`karpathy-guidelines` skill is not installed; its four rules were followed as written. Reports of UX-06 to UX-10 read (UX-04 and
UX-05 have none on disk). `design/audits/ux-0{8,9,10}/REPORT.md` carry the dead-code lists this prompt started from.

| Check at `72f55c9` | Result |
| --- | --- |
| `tsc --noEmit -p tsconfig.app.json` | clean (needs `NODE_OPTIONS=--max-old-space-size=6144`: the default 2 GB heap runs out) |
| Vitest | 11,705 passed, 31 failed, in 14 files (`lookRules` 12, `readerSteps` 4, `ux03.p4` 3, `ux03.p3` 2, and one or two each in `everything`, `onePrompt.snapshot`, `shapes`, `BuildSteps`, `BuildSteps.tiles`, `BuildView`, `readerSessions`, `ca20.p2`, `connection`, `ux02.p2`) |
| `npx knip` | **0 unused files**, 729 unused exports, 224 unused types, 278 duplicate exports, 3 unused dev dependencies (`@tailwindcss/typography`, `drizzle-orm`, `postgres`) |
| `npm run audit:size` | JS 6,724,798 bytes in 478 chunks. First download 235.2 KB (budget 200), composer chunk 124.5 KB (budget 120): **both already over budget on main** |
| `npm run audit:pages` | 37 of 39 pass. `report and targets` fails on main in this container: home 3 rounds (target 2), profile 3 rounds, `library-saved` 10 requests (baseline 8, one more allowed). `pageBaseline.json` on disk: home 26, builds 17, builds-maps 18, builds-classification 17, openbuilds 9, library-saved 8, library-collections 9, drafts 10, composer 19, build 12, profile 17, profile-followers 7, profile-following 7 |
| `npm run lint` | 1,419 errors, 549 warnings (all existing) |
| `audit:design` | 7 vision boards listed (no `openbuilds`) plus the refined boards |

### Assumptions (each fact the prompt states, and what the disk says)

1. **knip's unused-file count is 0, and cannot go down.** `knip.json` makes every `*.test.ts(x)` an entry, so code that only a
   test imports counts as used. "knip reports fewer unused files than Part 0's count" is therefore unsatisfiable. I measured
   reachability myself, from `src/main.tsx` through static and dynamic imports, tests excluded: **72 non-test files in `src/`
   are not reachable at baseline, 64 after.** Most are test support or already-dead shells (`FeedItem`, `ReblogCard`,
   `RightPanelExplore`, `trophies/*`); they are listed under `Already unused before UX-11`.
2. **`src/routing/retiredAddresses.test.tsx`** is at `src/lib/routing/retiredAddresses.test.tsx` (there is no `src/routing/`; the
   routing code and `retiredRoutes.test.tsx` are in `src/lib/routing/`).
3. **Solvers** was already retired by UX-08 P5: the three addresses (`/openbuilds/solvers`, `/bounties/solvers`,
   `/b/:id/leaderboard`) redirect straight to `/openbuilds` in one hop (`src/lib/routing/retiredRoutes.ts`), and the footer has no
   Solvers link. Only the page file `Solvers.tsx` and its two tests were left.
4. **There is no address for one request under `/openbuilds/requests`.** `/openbuilds/:bountyId/solve` is the only page that shows
   one old request (its brief, its steps, the answers). `OlderRequestsRoute` says "Each request's own page
   (/openbuilds/<id>/solve) is a different route and is never redirected", and live links point at it (Home's "Solve it",
   `openBuildsModel`, the requests page's "Answer"). It is the only reader page for something published, so by the prompt's own
   rule it is **Keep reading**. Not redirected, not deleted.
5. **`/creator/:username`** goes to `/profile/:handle`, not `/u/:username` (UX-10 kept `/profile/:handle`; there is no `/u/`
   route). `/profile` and `/profile/:handle` are the canonical routes and stay.
6. **The older discovery addresses** (`/browse`, `/discover`, `/discover-legacy`, `/recent`, `/fyp`, `/feed`, `/category/:slug`)
   already redirected, to `/builds` (SV-11 retired the Gallery feed), not to `/`. Five of them did so with `Navigate`, which
   **dropped the search string**. They now use `KeepSearchRedirect` (the prompt asks for the search to be kept). They were left
   pointing at `/builds`, not `/`: Home does not take their search, and `/builds` is what they did.
7. **`legacyCompose` is still needed.** `ComposeRoute` opens it for a rebuild (`parent_build_id`), anything with `?from=`, and a
   draft arriving with `state.intake`. Case A of Part 4.
8. **`SolvePanel` is not solving-only**: the live build page (`BuildPage.tsx`) and `GapPanel` render it. `AcceptSolutionDialog`,
   `OriginalSolutionDialog`, `BountySolutionsSection`, `BountyDiscussionForum`, `ProvenanceOverview`, `BountyByline`,
   `SolverLeaderboard`, `BountyCompetitionHeader`, `MetaBountyHeader`, `MetaBountyBody`, `BountyManagementPanel(Container)`,
   `PromoteToBlueprintDialog`, `BlueprintAttributionBanner`, `src/lib/bounty-solver/`, most of `src/lib/bounty-competition/` and
   `createBountyThread` are all imported by `ContentDetail.tsx`, which is `/content/:id`, a Keep-reading page of 2,467 lines that
   shows an old bounty and lets its author accept, close and promote it. The prompt says delete a file only when no live route
   reaches it, so none of these were deleted and `ContentDetail` was not cut.
9. **`/upload/bounty?id=` is tested as live** (`legacyBountyCreateRetired.test.tsx`: "a bounty draft already in progress still
   opens its editor"), `Upload.tsx` navigates to it, and the legacy `/drafts/posts` page routes a bounty draft back to it. A
   redirect to `/compose/new` would strand a bounty draft that can still be finished. **Kept**, with `BountyUploadShell` and the
   gate in `src/lib/bounty-legacy/flags.ts`. `/bounty/new` (whose submit was frozen and wrote nothing) was redirected.
10. **`/content/:id/edit`** is linked from `ChangelogTab`, and **`/publish/:contentItemId`** is where `Upload.tsx` sends a
    finished legacy upload; **`/project/:id`** is linked from `FeedItem` and `Admin`. Live links, so not redirected. **`/convert/:contentItemId`** is
    linked from nowhere and the composer has its own `ConvertWindow`, so it redirects to `/drafts`.
11. **UX-10's report says `getMakerFigures` is "still read by `MakerFigures`"**. It is not: `MakerFigures.tsx` reads
    `makerStats`; nothing but `figures.test.ts` imported `figures.ts`.
12. **`ThreadPreviewCard` has no bounty branch** (a grep finds none). Nothing to remove there.
13. **`pageBaseline.json`** says `openbuilds: 9` and `profile: 17` (the prompt says 14 and 11; UX-09 and UX-10 regenerated them).
14. **Playwright** in this container: the installed `@playwright/test` wants Chromium build 1208, the container has 1243, so the runs
    use `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`. The config's own dev server binds IPv6 and fails here (`EAFNOSUPPORT`), so
    tier 1 ran against `vite --host 127.0.0.1`.
15. **The tier-1 suite is partly stale on main.** In a 9-spec subset (280 tests) 16 fail on this branch; the four specs that hold them fail
    14 to 15 tests on `72f55c9` too (they expect `/gallery`, `.fs-frame` and other things SV-02 to SV-11 removed), and `wide-layout` fails whole.

Two readings, the safer taken: Assumption 4 (kept, not redirected) and Assumption 9 (kept). Both are in the questions.

### Inventory (the final table)

| Item | Verb | Outcome |
| --- | --- | --- |
| `/openbuilds/solvers`, `/bounties/solvers`, `/b/:id/leaderboard` | Redirect | already one hop to `/openbuilds`; covered by `retiredAddresses.test.tsx` |
| `pages/Solvers.tsx` + `Solvers.test.tsx`, `solvers.budget.test.tsx`, `e2e/tier3/solvers-board.spec.ts`, the breadcrumb branch | Delete | **deleted** (P2) |
| `/openbuilds/:id/solve`, `/bounties/:id/solve`, `BountySolveShowPage` | Keep reading | kept (Assumption 4) |
| `/bounty/new` + `pages/BountyUpload.tsx` | Redirect, Delete | redirects to `/compose/new`; page deleted (P1, P3) |
| `/upload/bounty` + `BountyUploadShell` + `bounty-legacy/flags.ts` | Keep | kept (Assumption 9) |
| `/upload`, `/upload/blueprint`, `/upload/blog` | Inventory only | unchanged. Each mounts the legacy upload page under `LegacyUploadRoute` (a banner naming the replacement); they still save and publish `content_items` |
| `/browse`, `/discover`, `/discover-legacy`, `/recent`, `/fyp`, `/feed`, `/category/:slug`, `/gallery` | Redirect | to `/builds`, search and hash now kept (P1). `/browse` is in the sitemap: UX-13 should check it |
| `/creator`, `/creator/:username`, `/my-uploads`, `/saved` | Redirect | already one hop (`/profile`, `/profile/:handle`, `/library`); now covered by the test |
| `/profile`, `/profile/:handle` (+ followers, following) | Keep | canonical |
| `/convert/:contentItemId` + `ConvertPrompt` (+ test) | Redirect, Delete | redirects to `/drafts`; deleted (P1, P3). The route moved inside `Layout` because the redirect draws Drafts' placeholder, which needs the frame's providers: outside it the redirect crashed (found by the new test) |
| `/content/:id/edit`, `/publish/:id`, `/project/:id` | Keep | live links (Assumption 10) |
| `/content/:id`, `/b/:id`, `/b/:id/thread`, `/b/:slug/lineage` | Keep reading | `retiredSurfaces.test.tsx` passes untouched |
| `/saved`, `/notifications`, `/messages`, `/library`, `/search`, `/analytics`, `/admin`, `/admin/login`, `/dev/*` | Keep | untouched |
| `createMetaBounty.ts` | Delete | **deleted** (P3); its frozen-behaviour assertions removed from `legacyBountyCreateRetired.test.tsx` and `legacyMetaRedirect.test.ts` |
| `BountyResponseComposer`, `src/lib/bounty-gen1/`, `gen1ResponsesRetired.test.tsx`, `e2e/tier3/gen1-bounty-frozen.spec.ts` | Delete | **deleted** (P3). The composer rendered `null` and had no importer |
| `promoteBountyToBlueprint`, `PromoteToBlueprintDialog`, `BountyManagementPanel*`, `MetaBounty*`, `BountyCompetitionHeader`, `SolverLeaderboard`, `SolvePanel`, accept/original/solutions components, `bounty-solver/`, `createBountyThread` | Keep | reached by `/content/:id` and the build page (Assumption 8) |
| `BountyCard`, `lib/bounty/legacyMeToo.ts` | Keep, unsure | `BountyCard` is imported only by `FeedItem.tsx`, which nothing mounts and which is out of this prompt's scope |
| `BountySection.tsx` (+ test), `useBuildBounties.ts`, `e2e/tier3/bounty-publish.spec.ts` | Delete | **deleted** (P4) |
| `PublishControl` (the plan, the drafts, the filing step, the outcome), `ComposeTopBar` / `ComposeFrame` / `CentrePanel` / `NodeTree` / `TreeNode` (the asks read, the pill) | Edit | **bounty branches removed** (P4). `PublishSheet`'s slot stays for the rebuild section; its comment was corrected |
| `Inspector`'s Unsolved toggle, `SandboxCard` and `MoreDetails`' "Open a bounty" switch | Keep, unsure | see below |
| `createBountyForGap` | Keep, unsure | the only insert into `bounties` left; no production caller; `scripts/verify-bounty-flow.ts` needs it |
| `pages/CreatorProfile.tsx`, `components/profile/MakerLink.tsx`, `lib/profile/{makerBuilds,figures,searchMakers}.ts` (+ tests), `trackLabel`, `remainingLine` | Delete | **deleted** (P5) |
| `ActivityGrid`, `RankRung`, `LevelRing`, `AvatarLevelRing`, `levelView`, `xpLine`, `TRACK_ITEMS` | Keep | other importers (dev catalogue, Your progress, the header) |
| Barrel exports left by the above (`convertContentItem`, `findConversion`, `planConversion`, `readSource`, `getNodeTypes`, two types; `TOP_SOLVERS_LIMIT`, `Solver`, `listBountiesForBuild`; `SubBountyDefinitionInput`) | Delete | **removed** (P6) |
| `design/reference/vision/source/OpenWork.dc.html` | Move | to `source/archive/`; the archived index entry follows (P7). The board `archive/openbuilds.html` and its index entry were already archived by UX-09 |
| `src/pages/dev/VisionOpenBuilds.tsx` and its `KitPages` entry | Delete | **deleted** (P7). The fixture `openbuilds.ts` stays: `OpenBuildsView.test.tsx` uses it |

## What each part did (one commit per part)

- **P1** `App.tsx`: `/bounty/new` and `/convert/:contentItemId` redirect; the seven discovery addresses keep search and hash.
  `src/lib/routing/retiredAddresses.test.tsx` renders the real `<App/>` at 19 old addresses and checks, in one hop (one
  `replaceState`, no `pushState`), that each lands on its new address; five more rows check the search string and hash. The test
  caught the crash above. `e2e/tier3/retired-addresses.spec.ts` opens three on the built site (`vite preview`) and passes.
- **P2** Solvers page, its two tests, its e2e spec and the breadcrumb branch (and its two test rows).
- **P3** `BountyUpload`, `createMetaBounty`, the gen-1 composer and flag, `ConvertPrompt`, with the tests of their frozen behaviour.
- **P4** the legacy composer's publish sheet stops filing bounties.
- **P5** the old profile page and the profile code nothing reads.
- **P6** the exports those left unused.
- **P7** the board's source and its dev page. A first version of this commit left `lookRules.test.ts` naming the deleted dev page, so
  the whole file (2,707 tests) failed to load; found by the full Vitest run, fixed in the same commit (amended, not pushed).

## Checks

- **Type check**: clean after every part (`--noUnusedLocals` shows only what was already there).
- **Vitest (full, final tree)**: 11,660 passed, 29 failed. Failing files are the baseline's, minus `ca20.p2` and `ux02.p2`, which
  passed this time (they are timing-sensitive; they failed at baseline). **No new failing test.** 47 tests fewer than baseline:
  the deleted files' (Solvers, BountySection, ConvertPrompt, gen-1, figures, searchMakers) and the cases cut from three others.
  `retiredSurfaces.test.tsx` passes untouched.
- **Lint (whole repo)**: 1,419 -> 1,388 errors, 549 -> 542 warnings. Every changed file is clean except the `any`s that were already there.
- **Build and size**: JS 6,724,798 -> 6,684,011 bytes (**-40,787 bytes, -0.6%**); chunks 478 -> 474. Removed: `BountyUpload`,
  `ConvertPrompt`, and two small shared chunks (`WorksWithPicker`, `openTargets`) that merged into `Upload` (+4,729) and others;
  `build` -11,285, `Compose` -9,470. First download 235.2 -> 234.8 KB and composer 124.5 -> 124.5 KB: both still over budget, as on main.
- **knip**: files 0 -> 1 (`FollowButton.tsx`: its only importer is `RightPanelExplore.tsx`, which `knip.json` ignores; it was "used" by the deleted
  `CreatorProfile`). Exports 729 -> 722, types 224 -> 224, nothing newly flagged. Dependencies unchanged: the three unused
  dev dependencies were there before and no deleted code used them, so none were removed.
- **audit:design**: 7 vision boards pass; the list has no `openbuilds`.
- **Page audit**: see below.
- **Tier 1 (desktop and mobile)**: not run in full (it did not finish in 9 minutes). A subset of 9 specs (280 tests) gave 16 failures;
  the four specs that hold them were re-run on `72f55c9` and on this branch side by side: 14 failures each, the same 13 plus one
  flaky test on each side (`build-site-frame:73`, which fails on both in isolation, expecting `/gallery`).
- **Not run**: `audit:perf`, `audit:themes`, `audit:contrast`, `audit:motion` (no page changed), the full Playwright suite in Light and Dark,
  and the 1440 / 390 screenshots of each nav page (see Parts not done).

## Page audit

`npm run audit:pages` on `72f55c9` and on this branch (both in this container, `PW_CHROMIUM_PATH` set; each takes 14 minutes):

- 37 of 39 tests pass on both. The two that fail are the report steps, and fail on both: `report and targets` (main: home and profile
  at 3 rounds, `library-saved` 10 requests; branch: `library-saved` 10 requests, and home and profile now read 2 rounds at best) and
  `page changes: report and thresholds` (branch: "Back to Builds (cold): Back landed 1331 px from where the page was left"; on main
  that report step stopped earlier, on the first-screen rounds, so it is not a comparison).
- **No audited page was removed, so no baseline entry is deleted. No live page's cold request count went up from a code change.**
  Cold counts moved between runs in both directions (branch, first full run against main's: builds 18 -> 16, openbuilds 10 -> 8,
  drafts 8 -> 7, library-collections 5 -> 10, build 8 -> 9). The two that went up were re-measured five times each, twice:
  `library-collections` 10 then 8, `build` 8 then 9, with the same code. That is the cold window (`dm_presence`, `user_progress`) falling
  inside or outside the audit's clock, as UX-08's report says.
- `e2e/audit/support/pageBaseline.json` is **unchanged** (13 entries): there is nothing to delete, nothing went down by removal, and
  the rule forbids raising an entry. Changed entries: none.

## Parts not done

- **Part 2 done-when** (`grep -ri solver src` finds only historical comments or `is_trusted_solver`): not met, deliberately. 594
  matches in 77 non-test files remain: `ContentDetail`, `BuildPage` (a solver's credit on a node), the Older requests page ("Top solvers"), the
  activity feed, `lib/bounty-competition/`, `lib/bounty-solver/`, `GapPanel`, `StageGridNode` and the notifications; every one is
  in a Keep-reading path (Assumption 8) or is a database column or function name. I did not list all of them.
- **Part 3 done-when** (nothing under `src/` can insert into `bounties` or write a `content_items` bounty row): met for the
  forms and for `createMetaBounty`. Three writers remain: `createBountyForGap` (no production caller; kept because
  `scripts/verify-bounty-flow.ts` builds its round trip on it), `pledgeToSubBounty` (spawns a sub-bounty from an existing
  meta-bounty on `/content/:id`) and `BountyUploadShell`'s insert (gated by `assertLegacyBountyCreateEnabled`, which throws first).
- **Part 4 done-when** (no composer surface shows `bounty`, `reward` or `solve` copy): not met. The live composer's Classification
  sheet has an "Open a bounty" switch (`SandboxCard`, `MoreDetails`: "Leave one part open for someone else to solve ... a reward
  on Bounties after publishing") and the legacy Inspector has an Unsolved toggle whose help mentions a bounty. Changing them
  changes copy on a live page, which the prompt forbids, and removing the Inspector's toggle would leave a gap-marked part that
  cannot be un-marked. They are UX-08's open Question 1. Left.
- **Part 4, "Vitest and Playwright for publishing, rebuilding and `?from=` flows"**: the Vitest ones pass (`Publish`, `PublishSheet`,
  `RebuildSection`, `Compose`); `RebuildSection.test` fails when run alone, on `72f55c9` too (it passes in the full run). No
  Playwright flow for publishing exists that can run without a signed-in session.
- **Part 6 "knip reports fewer unused files"**: impossible (Assumption 1); one file (`FollowButton`) is reported.
- **Part 8**: no entry changed. No audited page was removed and none went up (see Page audit). The baseline file was not edited.
- **Part 9 screenshots and the full Playwright suite**: not taken / not completed (see Checks).

## Kept, unsure

- `/openbuilds/:id/solve` and `BountySolveShowPage` (the only per-request page; live links).
- `/upload/bounty`, `BountyUploadShell`, `bounty-legacy/flags.ts` (a bounty draft in progress is finishable; `promoteBountyToBlueprint` uses the flag).
- `/content/:id/edit`, `/publish/:id`, `/project/:id` (live links).
- Everything `/content/:id` imports (Assumption 8), and `createBountyThread` in `lib/messaging`.
- `createBountyForGap` (the script above).
- `BountyCard`, `lib/bounty/legacyMeToo.ts` (imported by the unmounted `FeedItem`).
- `FollowButton.tsx` (imported by the unmounted `RightPanelExplore`).
- `lib/build/convert.ts` and its test: nothing in the app calls them any more (only the deleted page did), and they stay exported from
  the file itself. A whole file for a later prompt.
- `ActivityGrid`, `RankRung` (dev catalogue), `trackColors` in `components/profile-game/tokens.ts` (no importer, left: not on UX-10's list).
- The Inspector's Unsolved toggle and the live Classification "Open a bounty" switch.
- `docs/retired-surfaces.md` still names the deleted files; it is a history of NS-P42 to NS-P54 and was not edited.

## Already unused before UX-11

- knip: 729 exports (722 now), 224 types, 278 duplicate exports, `@tailwindcss/typography`, `drizzle-orm` and `postgres`.
- 64 non-test files in `src/` that nothing reachable from `src/main.tsx` imports. Not caused by this prompt, not touched: `FeedItem`,
  `FeedItemExpanded`, `FollowButton`, `ReblogCard`, `ReblogComposer`, `ReblogDetailView`, `TipsTab`, `BountyCard`, `LeftPanel`,
  `RightPanelExplore`, `NotificationCard`, `NotificationRow`, `trophies/*` (3), `build/*` (BuildHeader, BuildTabs, CreatedViaLine,
  PortableExport, RebuildTree, RebuildsTab, ReproductionAction, WhereNext), `DepthRevealModal`, `lib/reblog/*` (6), `lib/bounty/legacyMeToo.ts`,
  `lib/build/{buildUpdates,deploymentNeeds,partnership}.ts`, plus about 25 test harness and fixture files.
- `src/lib/profile/types.ts`: `AuthorStats`, `Primitive`, `ZoneContentResult`, `ZoneName`; `profileFeedModel.ts`: `SPACES_SHOWN`.

## Now unread in the database

Nothing new is wholly unread. What only the deleted code touched, and nothing else reads or writes now:

- `bounty_responses`, `bounty_me_too`, `bounty_response_verifications` (generation 1): the composer that inserted them is gone (it
  rendered `null` already); the March migration was never applied to the dev project (the NS-P44 note).
- Nothing reads `solutions` for a maker's earnings or `build_reproductions` for a maker's proofs from the profile any more (`figures.ts`, `makerBuilds.ts`);
  other pages still read both tables.
- The meta-bounty tables and `content_items.bounty_*` columns are still read and written by `/content/:id`.

## Unused edge functions

None became unused: no deleted file called one (a search of the deleted files for `functions.invoke` finds nothing).

## Totals

- Files deleted: **24** (plus 1 moved). 47 files changed, 151 insertions, **6,326 deletions**.
- Chunks removed: 4 of 478 (474 remain).
- Change in total JavaScript: **-40,787 bytes** (6,724,798 -> 6,684,011).
- Tests: 47 fewer (deleted with what they tested); none skipped or disabled.

## Questions for Miles

1. **Can the legacy composer be retired fully?** No: a rebuild, `?from=` and an intake still open it (Assumption 7). It lost its bounty
   filing. Retiring it needs the new composer to take rebuilds and Build File intake first.
2. **Can Older requests be retired once no request is open?** `OlderRequestsRoute` already redirects to `/openbuilds` when none is open. But each request's own page
   (`/openbuilds/:id/solve`) has no other home and is linked from Home and the requests page. Should a closed request be moved to a topic page, or kept as it is?
3. **Retire `/content/:id`'s bounty controls** (accept, close, extend, promote, pledge)? They are the last writers of bounty rows and they
   keep about ten components and four libraries alive. Deleting them means editing a 2,467-line reader page; I did not.
4. **Should `/upload/bounty?id=` stop opening a bounty draft?** It is the one place a bounty draft can still be finished.
5. **The live composer's "Open a bounty" switch and the legacy Inspector's Unsolved toggle** (UX-08's Question 1): retire them in a prompt of their own?
6. **Drop any unread table in a later prompt?** The three gen-1 tables above are the only candidates; none of them exist in the dev project.
7. **`createBountyForGap`**: delete it and rewrite `scripts/verify-bounty-flow.ts` to insert its own bounty?
8. **The 64 unreachable files** (list above): one prompt to delete the reblog, feed-card and trophy leftovers?

## What Miles needs to do

Merge the pull request, then press Publish > Publish changes. This prompt has no Lovable message.
