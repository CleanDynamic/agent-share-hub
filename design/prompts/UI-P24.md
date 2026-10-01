# UI-P24 — Data: the open bounty pool

Follow `design/RULES.md`.

**Goal.** The money and counts shown on the Gallery stats ("£4,250 · 23 asks") and the Bounties orbs ("Open pool", "Being solved · 61 solutions").

**Read first.** `src/lib/bounty/bounties.ts` — verified: `listOpenBounties({ home: "build" })`, `listBuildBounties`, `createBountyForGap`, `closeBounty` — `solutions.ts` (`countSolutionsByBounty`, `listSolutions`, `listSolverHandles`), `types.ts` (`BountyStatus = open | solved | closed | expired`), `gallery.ts`'s `countOpenBountyBuilds`, and the live `bounties` table's reward and deadline columns (confirm their names against the live schema, not the migrations — §8).

**Build** `getOpenBountyPool(): Promise<{ poolGbp: number; open: number; solutions: number; withSolutions: number }>` in `bounties.ts`:
- `open` from `countOpenBountyBuilds()`;
- `poolGbp`: select only the reward column of bounties with `status = 'open'` (the same filter `listOpenBounties` uses), `.limit(1000)`, summed in code; if the cap is hit, log once and add a `// TODO` for an aggregate RPC;
- `solutions`: the sum of `countSolutionsByBounty()` over the open bounties; `withSolutions`: how many open bounties have at least one (the Gallery's "Open bounties" bar is `withSolutions / open`).
Money stays an integer number of pounds; formatting (`£4,250`) happens in the view with `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })`. Tests for the sum, the open filter and zero bounties.

**Commit.** `UI-P24: getOpenBountyPool`
