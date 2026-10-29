# SV-22 · OpenBuilds requests: briefs, model checks, reviews · plan

Branch `sv-22-requests-b`, from `origin/main` at ca8fb31 (SV-21 merged).

## Assumptions (checked on disk at ca8fb31)

- **No `builds.is_brief`, `builds.in_review`, `model_releases` or weekly challenge row exists** (grep over `src/` and `supabase/migrations/`: nothing). Three migrations are needed, one per part.
- **A gap is `build_nodes.is_gap`** (the strips read selects it). A brief is a published build with at least one gap node; `setBrief` checks that and the title (`hasTitle`, `publishBuild`'s own rule from SV-07). `missingForPublish` lives in `src/pages/site/compose/composeModel.ts`, not in `src/lib/build`; a brief is published through `publishBuild`, which already refuses a build with no title.
- **A brief's answers are its rebuilds**: `listRebuilds(buildId)` (published children by `parent_build_id`, newest first, at most 20). Each answer's `reproduction_count` is its runs. `compare.ts` takes two sides (`matchSteps(a, b)`, `shareRoot`) and the compare route is `/b2/:slug/compare/:otherSlug`, so "Compare answers" links the two newest answers; with fewer than two it is not drawn.
- **`OpenBuildsView` already draws `BriefRequest`, `ModelTestRequest`, `ReviewRequest`, `ReleaseCheck` and `WeekGoal`**; `LIVE_TABS` is `all, steps, sessions, parts`. `OpenBuildsPage` passes no `release` or `week`.
- **A model test is not a bounty.** There is no table of requests for a model: it is the model rows of a reproduced build (`getReproductionsByModel`: per build, per model, `worked` count; a failed run still creates the model's entry). `build_reproductions` has `model_used`, `worked`, no `result` text the page can rely on.
- **Admins**: `public.is_admin(uuid)` (profiles.is_admin, `SECURITY DEFINER`, `search_path` set). `model_releases` policies use `public.is_admin((select auth.uid()))` like the builds policies.
- **`bounties.solved_at` exists**; "closed" for the weekly goal is `status = 'solved'` and `solved_at >= date_trunc('week', now())` in UTC (`weekly.ts` uses the same Monday 00:00 UTC week). The goal row is a new `site_challenges` row (slug, title, goal, active), readable by everyone, written by admins.
- **Builds leave Builds through `listGallery` and its counts** (`gallery.ts`, the shared filter used by `countGalleryLenses`, `getGalleryStats`); `in_review` is added to that one filter. Direct links to the build stay open: a review is a held-out build, not a hidden one.
- **The migrations are not applied.** Every read works before: missing-column errors fall back (`isMissingColumn`, the pattern of SV-21's `RUN_COLUMNS`).

## Plan

- Part 1: migration `20261102120000_sv22_briefs.sql` (`builds.is_brief`, partial index with its `EXPLAIN`); `src/lib/bounty/briefs.ts` (`setBrief`, `listBriefs`); OpenBuilds Briefs tab live -> verified by: `briefs.test.ts`, `openBuildsModel.test.ts`, `OpenBuildsPage.test.tsx`.
- Part 2: migration `20261102130000_sv22_model_checks.sql` (`model_releases`, `release_check()` aggregate with its `EXPLAIN`); `src/lib/bounty/modelChecks.ts`; Model tests tab and the release check live, the check started in round 1 -> verified by: `modelChecks.test.ts`, page tests.
- Part 3: migration `20261102140000_sv22_reviews.sql` (`builds.in_review`, `site_challenges`); `src/lib/bounty/reviews.ts`; `listGallery` and counts leave reviews out; Reviews tab and the week's goal live -> verified by: `reviews.test.ts`, `gallery` filter test, page tests.
