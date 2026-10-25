# SV-14 · OpenBuilds

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-13, before SV-15. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-14-openbuilds`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-14 OpenBuilds` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-13 merged. **The file on disk wins.**

## Intent

The Bounties page becomes OpenBuilds: published builds that take contributions. It must match `design/reference/vision/dusk/openbuilds.html`. This prompt builds the whole view and wires step requests (today's bounties on gaps). The other request types, claims, the model release check and the weekly goal arrive in SV-21 and SV-22, builds contributed to in SV-16, Groups in SV-24.

## Source

- Board: `design/reference/vision/dusk/openbuilds.html`, picture `design/screens/vision/openbuilds.png`, sample data in `design/reference/vision/source/OpenWork.dc.html`.
- Today: `src/pages/Bounties.tsx`, `src/pages/site/bounties/BountiesView.tsx`, `src/lib/bounty/*` (`listOpenBounties`, `listOpenBountyCards`, `listTopSolvers`, `toggleMeToo`, `myMeToo`, `countSolutionsByBounty`, `solutionRebuild.ts`), `src/lib/build/gaps.ts`, SV-05's numbering function.

## What earlier prompts left here

- **SV-02:** `/openbuilds` is the route (`SITE_NAV.bounties`), `/bounties` redirects to it, and the solve sub-routes work at both paths.
- **SV-03 and SV-04:** the route table entry (keyed `bounties`), `usePageReady`, the `Placeholder` and its match test, `PageLink`.

## Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Columns `minmax(0, 1fr) 320px`, 72 apart, no rule between. Below 1000px one column, the side column after the main one.
- **Main column**, 48 between groups:
  1. **Model release check** (leads): `PageFigure` "n of n" with meta "Reproduced builds that work on <model> · released n days ago · <n fail> · <n not tested>", chevron. A row of one bar per reproduced build, 40 high, 2 apart (`--evidence` works, `--cat-breakage` fails, `--line` not tested). A legend, then "Run an untested build" (primary) on the right.
  2. **Requests**: `UnderlineTabs` All, Steps, Sessions, Parts, Briefs, Model tests, Reviews, and a Sort control on the right. Each request 28px top and bottom, hairline between:
     - head row: `TypeChip`, title 14/500, reward (or "No reward", "Any model") on the right;
     - meta 12 `--label`: "<build> · @maker · <origin> · <age>";
     - the problem in 13 `--text2` (step requests);
     - a body: for a step request, the build's top-level steps as tiles (`--tile`, 1px `--tile-border`, radius 6, padding `10px 12px`, "n · Type" in 11.5 `--label` over the step title), the open one a `DashedSlot` with "n · Type · open";
     - a facts line in 12 `--label` and one control on the right (Answer, Offer a session, Answer this brief, Reproduce on <model>, Reproduce to review).
- **Side column**, sections 28 apart with a hairline between, each with `SectionHead` and chevron: Your requests, Your claims, Your record (four `PlainRow`s), Groups, Top contributors (24 avatar, handle, count), then the one `InnerTile`: "This week · n%", a two-part 6px bar, "n of n requests closed".

## Rules for this prompt

- **Vercel rules:** `async-parallel` (requests, the steps strips, Your requests, Your record and Top contributors start together, except the strips, which need the requests' build ids), `js-index-maps` (steps grouped by build with one map), `rerender-no-inline-components`.
- **Two rounds, no more:** round 1 everything independent; round 2 the steps strips for the page's builds in one request.
- **Step numbers** in a strip come from SV-05's function, so "Step 7" here is "Step 7" in the composer and on the build page.
- **Same page, new parameters:** tabs and Sort keep the old requests until the new arrive, no fade.
- **Charts:** the release check's bars are hidden from screen readers, with a text summary on the group ("94 of 120 work on <model>, 9 fail, 17 not tested").
- **Motion:** none added. Me too updates its count at once.

---

## Part 0 · Read and plan

Read the files above. Table every element: element → function → exists or not. Write `Assumptions` and `Plan`.

Commit: `SV-14 P0: plan`.

## Part 1 · The view

`OpenBuildsView` in `src/pages/site/openbuilds/` with every element of the board, all request types included, each section its own component. The dev page `vision-openbuilds` renders the fixture. The route's `Placeholder` becomes this page's loading state.

Commit: `SV-14 P1: OpenBuilds view`.

## Part 2 · Wire step requests

| Element | Source |
| --- | --- |
| Step requests | `listOpenBounties({ home: "build" })` or `listOpenBountyCards`: gap title, `gap_problem`, reward, `closes_at`, `me_too_count`, solution count (`countSolutionsByBounty`) |
| The steps strip | the build's top-level steps around the gap, read for the page's builds in one request (named columns: `id, build_id, parent_id, type, title, position, is_gap`), numbered by SV-05's function. If one request can't serve the page, draw the gap tile alone and say so |
| Answer | the existing solve route, through `PageLink` |
| Me too | `toggleMeToo`, `myMeToo` |
| Sort | Most needed (`me_too_count`), Newest, Closing soon, Reward |
| Your requests | bounties whose build the reader made, with solutions not yet accepted |
| Your record: builds reproduced, answers accepted | a count of the reader's `build_reproductions` rows on others' builds; accepted `solutions` by the reader |
| Top contributors | `listTopSolvers`. If it has no 30-day window, use what it has and change the meta to match |

Only tabs with at least one live type are shown: All and Steps. **Not live yet:** session, part and claim pieces (SV-21); briefs, model tests, reviews, the model release check and the weekly goal (SV-22); builds contributed to (SV-16); Groups (SV-24).

`npm run audit:pages` gains OpenBuilds with its two-round target, and fails when it is missed.

Commit: `SV-14 P2: OpenBuilds data`.

## Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/openbuilds"` within 4%.

Commit: `SV-14 P3: compare and checks`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration. Old `/bounties` links keep working.
