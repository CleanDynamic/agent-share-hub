# SV-13 · Builds: Classification

```
SV-13 · Builds: Classification
PASS (with the open points under Questions)
Branch / PR: sv-13-builds-classification / "SV-13 Builds: Classification"
Facts in this prompt that were wrong on disk:
  - The Classification view had no filter column on its board (like Maps), so it is its own page shape (head, one row, grid), not BuildsView's column; BuildsView's `other` now carries only the Table's error.
  - `shownValues` folds a correction into "stated"; the board tells "stated" and "corrected" apart, so the model reads `disputes` itself.
  - The board's sample words are not all taxonomy labels ("Sales" is a Field area, "Marketing and sales"; "Sales outreach" is the value under it). The fixture uses the lists' ids where a label matches and the maker's own words where not.
Baseline → end: tests 9416 → 9446 (30 new: 9 model, 11 view, 2 page, and 8 lookRules per-file checks). Failing: 58 on main, the same 58 on the branch (AppShell, noRail,
  flat-shell, siteFrame, retiredSurfaces, onePrompt snapshot, BuildPage, sv03Migration, theme compliance/motion/ns-classes/rcStates).
  Tier 1: 306 passed, 96 failed, 4 skipped on this machine. The builds spec file passes whole (50 of 50, 12 of them new: /builds?view=classification).
  The 96 are wide-layout, backdrop, Home, Build, profile, rebuild, post-thread and auth-entry specs; the 11 I re-ran on main fail the same way there.
Compared boards: vision/dusk/builds-classification · 2.5% (51,714 of 2,089,440 px; threshold 4%). The frame's header is masked and starts 8 px higher
  than the board's, as for SV-11 (Table 2.2%) and SV-12 (Maps 1.6%); every row, rule and line of type is that 8 px apart and no more.
Request rounds and requests for the page, before → after (audit:pages, cold): /builds?view=classification 1 round, 17 requests, 15.6 KB, the Table's own.
  Added to pageTargets (maxRounds 1) and pageBaseline (17). Table 1 round / 17; Maps 2 rounds / 18.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): no worse yes. gallery noon/dusk 1336/1372 ms, CLS 0.026, INP 24 (SV-12: 1288/1356, 0.026, 32/24).
  Classification is not one of the three routes audit:perf drives. audit:perf's "feed reserves its slots" test fails the same on main.
Built but not live yet: none.
Layers built only because a target failed: none.
Names that differed from this prompt: none (BuildsClassificationView was the SV-11 stub and is now the pure view; it is its own chunk as before).
Raw values without a token: none.
Motion cut back after watching: none (no motion; the value underline appears at once on hover).
Dead code seen: none new. Removed because this change left it unused: buildsOther.ts (BuildsOtherViewProps), the Suspense and skeleton around BuildsView's `other`.
Lovable messages needed: none
Parts not done: none
Facets derived / declared only:
  Derived (derive.ts fills them): What was built, Role of AI, Techniques, Modality, Build method, Autonomy, Tools and stack, Human oversight, Skill needed, Cost to run.
  Declared only: Field, Task, Setting, Data handled, Age suitability. Data handled reads "stated", as the board draws it.
  Tools and stack is derived and may also hold the maker's own tools (declared.stack); those follow the derived ones, and a Tools value with no derived part reads "stated".
Audits that fail on routes this change does not touch: audit:themes and audit:contrast fail (neither sweep visits Builds or any vision page; not run against main).
Questions for Miles:
  - A facet with no value shows "None" in the label colour with no source line. The board never draws an empty facet. Keep, or leave empty rows out of the card?
  - A derived facet with no kept tile ids reads "derived" and never "from 0 tiles". The board has no such case.
  - A value's link adds its facet to the filters already in the address (and drops the view), so the Table shows the builds that match both. The board says "filter by it" only.
  - The maker's own words (a custom Field, Task or tool) are plain text: they have no id to filter by.
  - The chooser opens from "Facets shown" under the row and keeps at least one facet. The board draws the control closed only.
```

## What Miles needs to do

Merge the pull request, then Publish › Publish changes. No migration.
