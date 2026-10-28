# SV-14 · OpenBuilds

```
SV-14 · OpenBuilds
PASS (with the open points under Questions)
Branch / PR: sv-14-openbuilds / "SV-14 OpenBuilds"
Facts in this prompt that were wrong on disk:
  - SV-05's function numbers sessions (`numberSessions`), not steps. A step's number is its place among the build's
    top-level steps (`buildSteps` numbers `index + 1` of `topSteps`, graph.ts); the strip uses `topSteps`, so "Step 4"
    here is "Step 4" in the composer and on the build page.
  - `gap_problem` is not a column: it is a key in the gap node's payload (`GAP_PROBLEM_KEY`, gaps.ts). The strips read
    selects it by path.
  - `listOpenBountyCards` takes two rounds by itself (asks, then counts and makers), so a strips read after it would be a
    third. `listStepRequests` (new, src/lib/bounty/openBuilds.ts) puts the counts, makers, strips and Me too marks in one
    second round. `listOpenBounties` returns bare rows (no gap title, no build), so it could not serve either.
  - Which nodes are steps depends on three payload keys (`tested`, `setup`, `step`); the strips read selects those by
    path and nothing else of the payload. An untitled step's default title needs its text, so it shows its kind.
Baseline → end: tests @@TESTS@@
Compared boards: vision/dusk/openbuilds · @@DIFF@@
Request rounds and requests for the page, before → after (audit:pages): @@ROUNDS@@
Web Vitals against the last after numbers (LCP · CLS · INP proxy): @@VITALS@@
Built but not live yet:
  - Model release check, the week's goal, brief / model test / review requests: SV-22.
  - Session and part requests, Your claims, a request's origin ("opened from a failed run"), claim and failed runs: SV-21.
  - Builds contributed to: SV-16. Groups: SV-24.
  - Builds maintained: no prompt names its data; drawn on the dev page only.
  - A request's comment count: not in this prompt's table; left out of the live facts line.
  - Tabs: live shows All and Steps only, as the prompt says.
Layers built only because a target failed: none.
Names that differed from this prompt:
  - UnderlineTabs → TextTabs (SV-02's name; `UnderlineTabs` is the older 40px brand tabs).
  - "SV-05's numbering function" → `topSteps` (graph.ts) for steps; `numberSessions` numbers sessions.
  - `listOpenBounties` / `listOpenBountyCards` → new `listStepRequests` (reasons above). Home keeps `listOpenBountyCards`.
  - graph.ts's `kindOfNode` is now exported, for the strip's "n · Type".
Raw values without a token:
  - #4A4A50 (release check's not-tested bars and their legend mark) · OpenBuildsView ReleaseCheck · --line, as the README says.
Motion cut back after watching: none (no motion added; Me too's count changes at once).
Dead code seen: none new. Removed because this change left it unused: src/pages/Bounties.tsx, BountiesView, BountiesFrame
  and their test, the `bounty-board` dev page and its fixture, bounties.budget.test.tsx.
Lovable messages needed: none
Parts not done: none
Other checks:
  - The tier 3 board spec (e2e/tier3/bounties-board.spec.ts) is rewritten for the new page: 6 of 6 pass in Chromium.
  - Sort is the dropdown radio menu the Builds Table's Sort uses (SV-11), behind the board's control. A styled <select>
    cannot be drawn: index.css paints every select's fill and border with !important.
  - The type check of the whole app sits at the edge of Node's default 2 GB heap on main (2.15 GB used). The new reads go
    through a narrow builder, as gallery.ts's feed reads do; the branch uses 2.13 GB, below main.
@@CHECKS@@
Questions for Miles:
  - A build-level ask (a bounty naming no gap node) is still listed, with no strip and the title "Open request", as the old
    board listed it. The prompt calls step requests "bounties on gaps"; say if build-level asks should leave OpenBuilds.
  - "Builds reproduced" counts the reader's build_reproductions rows on others' builds, as the prompt says: two runs of one
    build count twice. Say if it should count builds.
  - Your requests has no chevron: there is no page of the reader's requests yet. Your record's chevron opens the reader's
    profile. Top contributors' opens the solvers board.
  - A gap nested more than one level under a top-level step draws its tile alone, unnumbered (one request cannot name its
    ancestors), as the prompt allows.
```

## What Miles needs to do

Merge the pull request, then Publish › Publish changes. No migration. Old `/bounties` links keep working.
