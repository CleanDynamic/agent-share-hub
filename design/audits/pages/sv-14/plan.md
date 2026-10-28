# SV-14 · OpenBuilds · plan

Branch `sv-14-openbuilds`, from `origin/main` at db55291 (SV-13 merged).

## Part 0 · Elements

| Element (board) | Function | Exists | Round |
| --- | --- | --- | --- |
| Model release check: "n of n", meta, chevron, one bar per build, legend, Run an untested build | none (SV-22) | no: dev page only | - |
| Tabs All, Steps, Sessions, Parts, Briefs, Model tests, Reviews | `TextTabs` (the prompt's `UnderlineTabs`, see SV-02) | yes. Live: All and Steps | - |
| Sort: Most needed, Newest, Closing soon, Reward | server order on the requests read (`me_too_count`, `created_at`, `closes_at`, `reward_gbp`) | added | 1 |
| Step request: chip, "Step n · <gap title>", reward or "No reward" | open `bounties` on builds, the build and gap node embedded (as `listOpenBountyCards`' select) | the select exists; a sorted, offset read added as `listStepRequests` | 1 |
| Step request meta: "<build> · @maker · <origin> · <age>" | the build's maker from `profiles` (as `listOpenBountyCards`); origin is SV-21 | yes / no (origin left out) | 2 |
| The problem (13 `--text2`) | the gap node's `payload.gap_problem` (`gapProblem`, `gaps.ts`), read as `payload->>gap_problem` in the strips read | added | 2 |
| The steps strip: "n · Type" over the title, the open one a `DashedSlot` | the builds' top-level steps and gap nodes, one request (`listStepStrips`), numbered by `topSteps` (graph.ts), typed by `REF_KIND` | added | 2 |
| Facts: claimed by, failed runs, comments | SV-21 (claims, runs); comments not in this prompt | no | - |
| Facts: "n days left", "n answers", "Me too n" | `closes_at`, `countSolutionsByBounty`, `me_too_count`; pressed from `myMeToo`; `toggleMeToo` | yes | 2 |
| Answer | the solve route `/openbuilds/:bountyId/solve`, through `PageLink` | yes | - |
| Session, brief, model test, review requests | SV-21, SV-22 | no: dev page only | - |
| Your requests: "<build> · <gap>", solver | submitted `solutions` on open bounties of the reader's builds, one request (`listMyOpenRequests`), handles by `listSolverHandles` | added (two requests) | 1, 2 |
| Your claims | SV-21 | no | - |
| Your record: Builds reproduced, Answers accepted | head counts of `build_reproductions` (reader, others' builds) and accepted `solutions` by the reader (`getMyRecord`) | added | 1 |
| Your record: Builds contributed to (SV-16), Builds maintained (no prompt names its data) | - | no | - |
| Groups | SV-24 | no | - |
| Top contributors: 24 avatar, handle, count, "last 30 days" | `listTopSolvers` gains `sinceDays` (the `top_solvers` function's `since_days`) | yes, option added | 1, 2 |
| This week · n%, two-part bar, "n of n requests closed" | SV-22 | no | - |

## Assumptions (checked on disk at db55291)

- `/openbuilds` is `SITE_NAV.bounties`; `/bounties` redirects to it (`KeepSearchRedirect`); the solve and solvers routes answer at both. The route table's `bounties` entry loads `src/pages/Bounties.tsx` and its Placeholder is `BountiesLoadingView`.
- `usePageReady("openbuilds", ...)` is in `Bounties.tsx`; `audit:pages` has an `openbuilds` target with `maxRounds: null`.
- **`listOpenBountyCards` takes two rounds by itself** (the asks, then their solution counts and makers together), so a strips read after it would be a third. The new `listStepRequests` runs the asks first and then, together, the counts, the makers, the strips and the reader's Me too marks: two rounds in all.
- **`gap_problem` is not a column.** It is a key in the gap node's payload (`GAP_PROBLEM_KEY`, `gaps.ts`). The strips read selects it by path, so no payload is read whole.
- **SV-05's function numbers sessions, not steps.** `numberSessions` (`sessionNumbers.ts`) numbers sessions; a step's number is its place among the build's top-level steps (`buildSteps` numbers `index + 1` of `topSteps`, `graph.ts`). The strip uses `topSteps`, so "Step 7" is the same number the composer and the build page show.
- **Which nodes are steps depends on three payload keys** (`tested` for a check, `setup`, `step`; `isStepNode` in `graph.ts`). The strips read selects those three by path and nothing else of the payload. An untitled step's default title needs its text, which is not read: it shows its kind ("Prompt").
- A gap nested deeper than one level under a top-level step cannot be placed in the strip from one request; its request draws the gap tile alone, as the prompt allows.
- `top_solvers(max_results, since_days)` has a window (`20261001160000_rc_top_solvers.sql`); `listTopSolvers` does not pass it yet.
- `build_reproductions` has `user_id`, `build_id` and an FK to `builds`; `solutions` has `solver_id`, `status`, an FK to `bounties`. No FK from `solutions.solver_id` to `profiles` is in the generated types, so handles are a second request (`listSolverHandles`).
- `TextTabs`, `SectionHead`, `PageFigure`, `PlainRow`, `TypeChip`, `DashedSlot`, `InnerTile` exist (`src/components/vision/`). `PlainRow` draws its label in `--text2` and its value 500, as the board's Your record.
- Home reads `listOpenBountyCards` under `["bounty-board"]`; it stays as it is.
- The old board (`Bounties.tsx`, `BountiesView`, `BountiesFrame`, the `bounty-board` dev page and its fixture, `bounties.budget.test.tsx`) is left unused once the route loads the new page, and is removed in Part 2.

## Plan

- Part 1: `OpenBuildsFrame.tsx` (columns, controls, loading view), `OpenBuildsView.tsx` (every section, every request kind, each its own component), `openBuildsModel.ts` (strip window, words), fixture `src/dev/fixtures/vision/openbuilds.ts`, dev page `vision-openbuilds`; the route's Placeholder becomes `OpenBuildsLoadingView` -> verified by: `OpenBuildsView.test.tsx`, `openBuildsModel.test.ts`, the placeholder match test.
- Part 2: `src/lib/bounty/openBuilds.ts` (`listStepRequests`, `listStepStrips`, `listMyOpenRequests`, `getMyRecord`), `listTopSolvers({ sinceDays })`, `OpenBuildsPage.tsx`, route table load, prefetch and frame, `audit:pages` target `maxRounds: 2`; the old board removed -> verified by: `openBuilds.test.ts`, `OpenBuildsPage.test.tsx`, `npm run audit:pages`.
- Part 3: `npm run audit:design -- --grep "vision/dusk/openbuilds"` within 4%, then the checks.
