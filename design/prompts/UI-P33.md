# UI-P33 — Page: Bounties, solve and solvers

Follow `design/RULES.md` (§7).

**Goal.** `/bounties` as the reference — vacant frames, the solve panel and top solvers — plus the solve route and `/bounties/solvers`, and the mobile solve sheet.

**Read first.** `pages/Bounties.tsx`, `BountySolvePage.tsx` (find its route in `App.tsx`), `Solvers.tsx`, `bounty/SolvePanel.tsx`, `MissingBlockOverlay`, `AcceptSolutionDialog`, `src/lib/bounty/*` — verified: `bounties.ts` (`listOpenBounties({ home: "build" })`, `listBuildBounties`, `createBountyForGap`, `closeBounty`), `solutions.ts` (`submitSolution`, `acceptSolution`, `listSolutions`, `countSolutionsByBounty`, `listSolverHandles`), `solutionRebuild.ts`, `meToo.ts`, `types.ts` (`BountyStatus = open | solved | closed | expired`) — plus `gapProblem` in `build/gaps.ts` and `getOpenBountyPool` (UI-P24). A made-with facet, a deadline extension and a ranked solver list may not exist; check, and where they do not, drop that piece from the view and say so rather than inventing a table (HANDOFF §5.6 lists them as gaps).

**Reference.** `desktop/{noon,dusk}/bounties.html`, `mobile/{noon,dusk}/bounties.html`, `mobile/{noon,dusk}/solve.html`.

**Desktop.** A column, gap 12: the header panel, then a grid `minmax(0, 1fr) 420px` that fills.
- **Header** `Panel` padding 16px 20px: a row `space-between`, `flex-end`, gap 20. Left, gap 8: `Eyebrow` "Bounties"; `h1` `type.display(44)` "Open asks on real builds"; Figtree 13px `--text2` "The build works. One part is left open on purpose, with a reward for whoever solves it." Right, gap 10: `Segmented` 34/12 **Newest · Reward · Closing soon** (sort) and `Segmented` 34/12 **Bounties · Solvers** (Solvers → `/bounties/solvers`).
- **Frames**: grid `repeat(3, minmax(0, 1fr))`, gap 6px 14px, `VacantFrame`s (UI-P15) from `listOpenBounties({ home: "build" })` in the chosen sort. Selecting a frame (click or Enter) shows it in the solve panel and sets `?bounty=<id>`; the selected frame uses `--row-highlight`. The first frame is selected by default. Paging as today.
- **Right column**, gap 12:
  1. **Solve** `Panel` padding 14px 16px (fills). A dashed box (1.5px `--cat-breakage`, radius 14, padding 14, column gap 10): a row with the gap's `CategoryChip` and, right, DM Mono 10px `--cat-breakage` "OPEN · DEADLINE EXTENDED ONCE" ("OPEN" when not extended); "{part} for {build title}" in `type.display(24)`, −0.02em, line-height 1.05; `gapProblem()` in Figtree 12px `--text2`, line-height 1.5; `WallLabel` 3 columns — Reward "£{n}" (value in `--lit-ink`), Closes "{d MMM}", Me too {n}; a row gap 8: primary "Submit a solution" `ArrowRight` (the existing submit flow) and secondary "Me too" `Heart` (`toggleMeToo()`, `aria-pressed` from `myMeToo()`). 14px below: `PanelHead` (13px) "Solutions over time" / "Opened {d MMM} by @{handle}"; `StepChart` 360×84, 8px below, from the solutions' `created_at`. 10px below: `Eyebrow` "Solutions · {n}" and rows: height 44, padding 0 10px, radius 12, gap 10 — `Avatar` 26, the handle (Figtree 13px, grows), "submitted {relative}" (DM Mono 10px `--text2`), and for the bounty's author a secondary 28/11 "Accept" with `Check` (opens `AcceptSolutionDialog`). The newest row has `--row-highlight`.
  2. **Top solvers** `Panel` padding 12px 16px: `PanelHead` (14px) "Top solvers" / "Solutions accepted"; the top three solvers (`listSolverHandles()` plus each one's accepted-solution count; with no ranked list, rank the handles it returns by that count in code): rows 38px, 1px bottom `--hairline`, gap 10 — `RankRung` 28 (1 highest, 2 rare, 3 common), `Avatar` 24, the handle (Figtree 12px, grows), "{n} solved" (DM Mono 11px `--text2`); then a link "All solvers" → the solvers route (`/bounties/solvers` if it exists; otherwise omit the link and say so).
- **Solve route** (`BountySolvePage`): the same solve panel, full width of the column, under the breadcrumb Home / Bounties / **{part}**.
- **`/bounties/solvers`**: the header panel with Solvers selected, then one glass panel with the full ladder (`RankRung` 32, `Avatar` 28, Figtree 14px rows 48px; ranks 4+ use tier `none`).

**Mobile** (390×1400), gap 12:
1. Heading: `Eyebrow` "Bounties", `h1` `type.display(34)` "Open asks on real builds", Figtree 14px "The build works. One part is left open on purpose, with a reward."
2. A row `space-between`: `Segmented` 36/13 Bounties · Solvers; a secondary 36/13 showing the current sort ("Newest") that opens a `BottomSheet` with the three sorts.
3. Two orbs, centred, gap 12: `OrbSolid` 150 "Open pool" / "£{pool}" / "{open} asks"; `OrbGlass` 150 "Being solved" / "{solutions} solutions".
4. The frames, one per row, gap 4.
5. Top solvers `Panel` padding 14px 16px: rows min-height 48, `RankRung` 32, `Avatar` 28, Figtree 14px, DM Mono 12px.
Tapping a frame opens the **solve sheet** (`BottomSheet`, titled "Solve this part"; reference `mobile/*/solve.html`, height 640 at 844): grabber; the dashed problem card (radius 16, padding 14; chip + "EXTENDED ONCE"; `type.display(24)`; Figtree 14px; `WallLabel` 3); a full-width 48/15 primary "Submit a solution"; a full-width 48/15 secondary "Me too"; `Eyebrow` "Solutions · {n}" with rows min-height 48 (`Avatar` 28, Figtree 14px, DM Mono 11px). The page behind keeps its scroll position; the URL gets `?bounty=<id>` so Back closes the sheet.

**Done when.** The six Bounties boards (desktop and mobile, plus the two solve sheets) compare within 0.04; submitting, me-too, accepting and deadline extension behave as before.

**Commit.** `UI-P33: Bounties, solve and solvers in the site frame`
