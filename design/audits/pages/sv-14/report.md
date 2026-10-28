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
Baseline → end: tests 9446 → 9503 (57 net: 22 lib, 13 model, 9 view, 13 page, lookRules per-file checks; the old
  board's two test files removed). Failing: 59 on main, the same 59 on the branch (AppShell, noRail, flat-shell, siteFrame,
  retiredSurfaces, onePrompt snapshot, BuildPage, sv03Migration, ca26.p3, theme compliance/motion/ns-classes/rcStates).
  Tier 1 (desktop + mobile, full): main 321 passed, 93 failed, 4 skipped; branch 316 passed, 98 failed, 4 skipped. The 5
  more are build-page, profile and sign-in specs: the sign-in ones pass on a re-run (flaky), and the build and profile
  "not there" ones fail on main too when re-run (twice, both viewports). No tier 1 spec visits /openbuilds.
  Tier 3: bounties-board.spec.ts rewritten for the new page, 6 of 6 pass. The other tier 3 specs that visit /bounties or
  /openbuilds (discovery-redirects, solvers-board, profile-builds) fail identically on main.
Compared boards: vision/dusk/openbuilds · 2.48% (60,611 of 2,446,560 px; threshold 4%). The frame's header is masked
  and starts 8 px higher than the board's, as on SV-11 to SV-13; the rest of the difference is that offset.
Request rounds and requests for the page, before → after (audit:pages, cold, signed in):
  1 round, 8 requests → 1 round, 14 requests (first visit from inside the app: 6). Target maxRounds 2 is set and met; the
  harness holds no open bounties, so round 2 (counts, makers, strips, marks) has nothing to read there. With rows, two
  rounds are proved by openBuilds.test.ts (the round-2 requests start only after the asks are answered, all together).
  pageBaseline openbuilds 8 -> 14: the page now reads the reader's requests (2), record (3 heads) and the top
  contributors (2), and no longer shares Home's ["bounty-board"] read, so the idle warm-up of Home's open requests is a
  second bounties request on a cold load.
  Placeholder match: OpenBuilds desktop and phone pass (the page draws OpenBuildsLoadingView itself until the requests
  arrive). audit:pages' page-changes thresholds (Back to Builds, Drafts to Profile) and the composer's New build test fail
  the same on main.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): no worse, yes. Same machine, back to back:
  branch home 2148/2036 ms, gallery 1708/1824, build 1360/1492; main 2092/2128, 2028/2116, 1360/1432 (noon/dusk).
  CLS 0.008 / 0.026 / 0.006 and DOM nodes the same on both; INP proxy 32 to 48 on both. OpenBuilds is not one of the
  routes audit:perf drives. "The feed reserves its slots" fails the same on main.
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
  - tsc, the build (OpenBuildsPage chunk 19.6 kB, 6.3 kB gzip), lint on every changed file: clean. Repo-wide lint: 1957
    errors on main and on the branch.
  - audit:themes and audit:contrast fail on routes this change does not touch (all theme leaks are composer routes); neither
    sweep visits /openbuilds. Every colour on the page is a token pair contrast.test.ts measures, and the coloured words
    are the README's state clauses.
  - The tab row scrolls sideways on a phone (the seven dev-page tabs were 50 px wider than 390); the page never does.
Request sizes (decided 28 Oct):
  - A bounty naming a gap node is a Step request; one naming none (gap_node_id null) is a Whole build request, chip
    WHOLE BUILD, drawn with one row for its build (title, maker, step count) in place of the strip. All lists both; Steps
    lists steps only (filtered on the server). SV-21, which adds request sizes, gives Whole build its own tab.
  - Its title is the bounty's gap_problem. A whole-build bounty has none: gap_problem is a key in the gap node's payload,
    and bounties has no text column (20260828140000_bounties_header_table.sql). Until it has one it reads "Open request
    on the whole build", with the build's title under it. Showing the maker's own words needs a column (for example
    bounties.problem text, written by createBountyForGap); proposed, not written.
Your record (decided 28 Oct):
  - build_reproductions has UNIQUE (build_id, user_id) in the migrations (build_reproductions_once_per_person,
    20260824120000, and idx_build_reproductions_unique_user_build, 20260825113022), so rows are builds. The live schema
    could not be read from here; to confirm, run:
      SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.build_reproductions'::regclass AND contype = 'u';
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'build_reproductions' AND indexdef ILIKE '%unique%';
    and paste the result back. If neither shows (build_id, user_id), the count would need to count distinct builds.
  - Builds reproduced counts worked = true on others' builds; Tried, didn't work counts worked = false and shows only
    above 0. Three exact head counts, together.
Questions for Miles:
  - A whole-build request's own words need a column on bounties (above). Say if you want the migration.
  - Please run the two build_reproductions queries above against the live database.
  - Your requests has no chevron: there is no page of the reader's requests yet. Your record's chevron opens the reader's
    profile. Top contributors' opens the solvers board.
  - A gap nested more than one level under a top-level step draws its tile alone, unnumbered (one request cannot name its
    ancestors), as the prompt allows.
```

## What Miles needs to do

Merge the pull request, then Publish › Publish changes. No migration. Old `/bounties` links keep working.
