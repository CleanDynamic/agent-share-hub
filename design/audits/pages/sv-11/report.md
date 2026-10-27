# SV-11 · Builds: the page and the Table

```
SV-11 · Builds: the page and the Table
PASS
Branch / PR: sv-11-builds-table / see the pull request "SV-11 Builds: page and Table"
Facts in this prompt that were wrong on disk:
  - SV-03 Part 4 did not leave "tries" with the list (getBuildTries was a second read, only the retired Gallery used it).
  - listGallery's select carries nodes, pictures and post_doc, and its search goes through search_build_ids, which
    gallery.ts says is not on live; the Table reads a new listBuildsTable instead (P0 plan).
  - BUILD_LIST_COLUMNS is not a name on disk (as SV-10 found).
  - The prompt's UnderlineTabs is TextTabs and FilterChip is ActiveFilterChip (SV-02's names); there is no vision
    Segmented, so the view switch is drawn in BuildsFrame.
Baseline → end: tests 9469 → 9376 (unit: the retired Gallery's tests go, 34 Builds tests come). Failing: 61 on main, the
  same 61 on the branch (AppShell, theme compliance/motion/ns-classes/rcStates, noRail, BuildPage, flat-shell,
  siteFrame, retiredSurfaces, sv03Migration, ca26, referenceActions, onePrompt snapshot); one composer test on each side
  fails only under load and passes alone. Tier 1: 295 passed, 4 skipped, 0 failed.
Compared boards: vision/dusk/builds-table · 2.17% (67,031 of 3,087,360 px; threshold 4%). Library and Drafts sit at the
  same ~3% floor on this machine: the frame's header is masked and starts 8 px higher than the board's.
Request rounds and requests for the page, before → after (audit:pages, cold): 4 rounds, 14 requests, 1945 ms, 31 KB →
  1 round, 17 requests, 1522 ms, 15.6 KB. Opened from inside the app: 4 rounds, 7 requests → 1 round, 10 requests.
  The three extra are the head counts the prompt asks for (the stats line and the lens counts), now parallel with the
  list instead of chained after it. pageBaseline.json builds 14 → 17 (as SV-10 did for Home); maxRounds 1.
Web Vitals against the last after numbers (LCP · CLS · INP proxy): no worse yes. /builds noon/dusk on main 2304/2424 ms,
  CLS 0.026, INP 48/48; branch, three runs: 2408/2472, 1992/2368, 2124/2168 ms, CLS 0.026, INP 40 to 80 (home moved by up
  to 344 ms between the same runs).
Built but not live yet: Steps and Sessions columns, Runs 12 weeks, the number filters (Reproductions as a range, Steps),
  Works on model, Last confirmed, Rebuilds and Likes as filters (SV-23); Saved filter sets, moving filters (grips),
  the Columns chooser, Add a calculation (SV-24). All drawn on /dev/kit/pages/vision-builds-table.
Layers built only because a target failed: none.
Names that differed from this prompt: UnderlineTabs → TextTabs; FilterChip → ActiveFilterChip; Segmented → ViewSwitch
  (BuildsFrame); listGallery → listBuildsTable for the Table's read.
Raw values without a token: #5A5A60 (grips, the A–Z · Count dot) · BuildsFiltersView · --line for the grips; the dot
  uses --label, because --line fails the contrast sweep as text (1.42:1).
Motion cut back after watching: none (no motion added; rows change at once).
Dead code seen:
  - gallery.ts: getFeaturedBuild, getGalleryShapeFacets, GALLERY_REQUIREMENT_KEYS, GALLERY_MAX_THRESHOLD and other
    index.ts re-exports nothing imports (there before SV-11).
  - galleryParams: for, with and model are still read and written; nothing reads them now (model is SV-23's Works on).
  - siteFrame.wide.test.tsx reads src/pages/site/GalleryPage.tsx, a path that did not exist before SV-11 either.
Lovable messages needed: none
Parts not done: none
Questions for Miles:
  - The lens tabs show their counts (countGalleryLenses, as the prompt wires); the board draws none. Keep them?
  - The board's tool marks are letter tiles; the live table shows the real logos from markFor in the same 16px tile.
  - pageBaseline for Builds rose to 17 requests for 1 round (see above). Fine, or should the stats share the lens counts'
    "all" figure (one fewer request, one new function)?
```

Gallery files deleted: `src/pages/site/gallery/` (BuildDetailSheet, GalleryBoard, GalleryBoardGroups, GalleryDashboardPage,
GalleryDashboardView, GalleryExtras, GalleryFeedView, GalleryPage, dashboardModel, galleryFrame, galleryModel, and their
tests); `src/pages/dev/GalleryFeedDemo.tsx`, `GalleryDashboardDemo.tsx` (and the Gallery half of `ClassificationDemo`);
`src/dev/fixtures/gallery-feed.ts`, `gallery-dashboard.ts`; `src/components/gallery/ClassificationFilters.tsx`;
`src/lib/build/dashboardAggregates.ts`; `src/lib/classify/collections.ts`; in `gallery.ts`: `listGalleryFeed`,
`listGalleryDashboard`, `getEngagementSeries`, `getBuildTries`, `getBuildPatterns`, `getBuildClassifications` and the
helpers only they used; the dashboard's address parameters; tests `galleryFeed`, `galleryDashboard`,
`dashboardAggregates`, `collections`; tier 3 `gallery-feed`, `gallery-discovery`, `gallery-repaint`, `gallery-dashboard`
and their backend. Tier 1 `gallery-site-frame` became `builds-site-frame`.

Test fixes outside the page, each because the page it tested changed: `page-placeholders` (the chunk is BuildsPage),
`page-scroll` (the Table's links are above the fold at the foot of the page, so the link is brought into view before the
position is read), `KeepSearchRedirect` (the placeholder says "Loading builds"), `design-compare` (the retired dashboard
board's clicks).

Environment notes: the pre-installed Chromium is newer than the pinned Playwright, so the audits ran with
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`; the tier 1 dev server was started on 127.0.0.1
because the container cannot bind IPv6.

## What Miles needs to do

Merge the pull request, then Publish › Publish changes. No migration. Old `/gallery` links keep working.
