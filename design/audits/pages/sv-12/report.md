# SV-12 · Builds: Maps

```
SV-12 · Builds: Maps
PASS (with the open points under Questions)
Branch / PR: sv-12-builds-maps / "SV-12 Builds: Maps"
Facts in this prompt that were wrong on disk:
  - BuildsMapsView was a stub behind buildsViews.ts (SV-11); it is now the pure view, and the lazy chunk is BuildsMapsPane.
  - The Maps page has no filter column (the board differs from the Table), so it is its own page shape, not BuildsView.
  - The board's Segmented is the brand Segmented (compact, size 30), which exists; the view switch is SV-11's ViewSwitch.
  - Published builds keep their session order in builds.making (as the build page reads it); build_sessions is a draft's table, so it is not read.
Baseline → end: tests 9392 → 9416 (24 new: 17 view, 7 data). Failing: 58 on main, the same 58 on the branch (AppShell, noRail,
  flat-shell, siteFrame, retiredSurfaces, onePrompt snapshot, BuildPage, sv03Migration, theme compliance/motion/ns-classes/rcStates).
  Tier 1: 294 passed, 4 skipped, 0 failed (12 of them new: /builds?view=maps).
Compared boards: vision/dusk/builds-maps · 1.6% (23,201 px; threshold 4%). The frame's header is masked and starts 8 px higher
  than the board's, as for SV-11.
Request rounds and requests for the page, before → after (audit:pages, cold): Table 1 round, 17 requests, 15.6 KB;
  Maps 2 rounds, 18 requests, 30.5 KB (the list, then one request for the Maps of 24 builds, started when the list answers).
  pageBaseline builds-maps 18, maxRounds 2.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): no worse yes. /builds noon/dusk 1288/1356 ms, CLS 0.026, INP 32/24
  (SV-11: 2304/2424 ms on a different run of the dev server; CLS the same). Maps itself is not one of the three routes audit:perf drives.
Built but not live yet: none.
Layers built only because a target failed: none. Maps data layer: on demand · 4.2 KB per fixture build, 98 KB for 24 (fixture; see Questions) · 1 request.
  Stored summary (builds.map_summary) NOT built.
Names that differed from this prompt: SV-05's numbering function is numberSessions, called by sessionGroups (group.number);
  UnderlineTabs/FilterChip as SV-11 noted (ActiveFilterChip is used for the row's chips).
Raw values without a token: #5A5A60 (Map lines) · BuildsMapsView · --line.
Motion cut back after watching: none (no motion; Horizontal and Vertical swap at once).
Dead code seen: none new.
Lovable messages needed: none
Parts not done: none
Audits that fail on routes this change does not touch: audit:themes (2138 leaks) and audit:contrast (101 failures) fail on the composer,
  links and references routes; neither sweep visits Builds. audit:pages' page-composer spec fails on a "New build" locator matching
  three buttons (seen after this change; not checked against main).
Questions for Miles:
  - Live size of the Maps read: the fixture is small; real builds carry long prompts and code. In the browser's Network panel, check the
    builds?select=id,making,build_nodes... request on /builds?view=maps. Over 300 KB for 24 builds means the stored summary
    (builds.map_summary, SV-12 Part 2 step 2) is needed; say so and it is a follow-up with its migration.
  - A build with more than about 4 stages is drawn at the readable size inside its 220px well and the well scrolls (a keyboard stop),
    rather than shrinking the text under 10px. Keep, or open the build instead?
  - The composer labels parts only when a build has two or more; the board also writes "PART A" on single-part builds. Followed the composer.
  - Chips in the row are the removable active filters (the board's are plain). Filters opens the Table's panel under the row.
```

## What Miles needs to do

Merge the pull request, then Publish › Publish changes. No migration.
