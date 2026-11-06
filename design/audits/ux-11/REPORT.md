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
