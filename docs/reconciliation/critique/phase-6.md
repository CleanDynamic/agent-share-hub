# Phase 5 and 6 critique — identity and progress (RC-P28a)

What Phases 5 and 6 built, judged from its screenshots and measured in the browser: the profile on builds (RC-P21), one address for each personal page (RC-P22), analytics on builds (RC-P23), and the progress page with its XP, badges, challenges and parked features (RC-P24 to RC-P28).

## Method

- **Screens.** `e2e/audit/rc-critique.spec.ts` captures five ROUTES and one reference view at 390, 768, 1024 and 1440 wide, in Exhibition and Dusk, into `e2e/audit/critique/phase-6/` (gitignored). The frame scrolls its centre column inside itself, so each width gets the screen a reader lands on and, where the column is longer, the whole column (`-full`).
  - `/profile/maya.o`, read by the audit runner, who follows her;
  - `/profile`, read by the maker herself;
  - `/analytics` with her record (the reset note already read);
  - `/analytics` for a reader who joined after the reset (the note not yet read);
  - `/drafts`, hers.
  - The reference: `/gallery`, read by the audit runner, which the consistency audit compares the five against.

  Each run is 88 screenshots: 72 of the five routes (40 landing screens and 32 full columns; the drafts list fits one screen) and 16 of the Gallery. The first run is kept as `phase-6-before/`; the run after the fixes is `phase-6/`: **176 screenshots** kept. Four one-view re-runs took 56 more, each replacing its view's files: while the probes were tuned, the progress page before the fixes and the Gallery twice after; then the progress page in Exhibition once more after the fixture's week clamp, with identical probes. Regenerate them with `npx playwright test e2e/audit/rc-critique.spec.ts --project=desktop`.
- **Fixtures.** `e2e/audit/fixtures/rcProgress.ts`, on top of phase 3's builds and phase 4's social layer:
  - one maker, Maya Okafor, whose five gallery builds are joined by a sixth gone stale and two drafts;
  - her four figures (6 builds, 64 got working by others, 0 rebuilt by others, 1 gap solved) and her builds' numbers, with one build for each NEEDS YOU reason: two solutions waiting (Support reply suggester), a recent run that did not work (Menu costing sheet), not confirmed since a date 200 days back (Receipt photos to an expenses sheet);
  - level 6 at 1,230 XP;
  - badges in every tier, earned and not: First build and Solver (common), Founder, Proven and Keeper (rare), Well proven (highest) earned; Runner, Rebuilt, Family and Fixer not yet;
  - this week's three challenges under way: 2 of 3, 1 of 1, 1 of 1 (a one-step challenge can only read 0 or 1);
  - a new reader, Noor Haddad, with the row the sign-up trigger writes: level 1, no XP, no badges, `welcome_xp_shown_at` null.

  `user_progress`, `xp_events` and `user_badges` answer only the signed-in reader's own rows, as their read policies do. `content_items` is empty (the legacy clear's world). The harness can now sign in as any fixture person (`withSession(page, who)`). Nothing reaches the network.
- **Probes.** Beside each view the spec writes `probes-<view>-<theme>.json`, one entry a width, over the whole document (so a landing screen's probe also covers its full column):
  - `filled`: interactive elements painted `--action` in the topmost layer (phase 4's count);
  - `isolated`: every element that departs from the neutral ground and ink (a fill in `--action`, `--lit` or `--evidence-fill`, type in `--action`, `--evidence` or a category hue) and the container it sits in;
  - `amberText`: text drawn in `--lit`;
  - `type`, `buttons`, `sections`: the column's text styles, its controls (height, text, paint, radius) and its top-level blocks with the gaps between them;
  - `scrollers`: regions that scroll sideways, and a table's columns in view;
  - `overflow`: how far the document scrolls sideways.
- **A measuring trap, recorded.** Playwright launches Chromium with `--hide-scrollbars`, so every scrollbar measures 0px under the harness whatever the CSS says. The first reading of the builds table ("its bar is 0px tall") was that artefact: in the same Chromium without the flag, index.css's `::-webkit-scrollbar { width: 5px }` leaves horizontal bars at the default 15px. The probe no longer reports a scrollbar height, and the finding is rated on the real bar (m11).
- **Ratings.** Each skill's own scale:
  - **major issue**: a reader cannot reach something the screen is about, or the same thing looks like two things;
  - **minor issue**: friction or inconsistency, with the way forward still in view;
  - **pass**: no finding.

  A dimension takes its worst finding.
- **Scope.** Fixes only inside the files RC-P21 to RC-P28 changed, with STATES.md and tokens, and nothing against CONTRACT §2 and §4. A major finding outside that goes under "Critique findings deferred" in the handover, with its reason; so does every minor one.
- **Not installed:** hicks-law (its Choice Audit below uses the columns of `choice-audit-nav.md` and phase 4's record) and buildgallery-repo-map.
- **RC-P22's redirects** are not among the five views: they land on `/profile` and `/library`, whose screens are judged here and in phase 4, and `e2e/tier3/personal-redirects.spec.ts` proves the addresses at both projects.

## Summary

| | Before the fixes | After the fixes |
|---|---|---|
| The three critique skills' dimensions (12) | major 5 · minor 6 · pass 1 | major 3 · minor 8 · pass 1 |
| Distinct major findings | 9 | 3, each deferred with its reason |
| Distinct minor findings | 23 | the same 23, deferred to the handover's list (m1 to m23) |
| Views with amber text (of 12 view × room pairs, 48 probed screens) | 0 | 0 |

The nine majors:

| # | Finding | Where | Outcome |
|---|---|---|---|
| M1 | The header's strip counted the legacy post model: "0 blueprints · 0 blogs · 0 bounties" (profile_stats, a view over content_items) beside "6 builds" and "1 gaps solved", and its five counts were buttons that opened nothing ("View followers list" had no handler); its level chip, "BUILDER", was profiles.level, the approved-blueprint ladder, beside the XP level | src/components/profile/ProfileHeader.tsx; src/lib/profile/getProfileSummary.ts | Fixed, CRITIQUE-12 |
| M2 | The header's two earned numbers restated two of the four figures directly below in other words and another format: "64 reproduced" over "64 got working by others", "not yet rebuilt" over "0 rebuilt by others" | ProfileHeader.tsx (EarnedNumbers) | Fixed, CRITIQUE-13 |
| M3 | The founder badge was the old FounderMark: an `--action` pill beside the header's one primary, reading "Founding member — first 100" (founder is every account held before the reset), its words spilling out of its 30px pill at 390, 768 and 1440, where the progress page draws the same badge as a rare `--recess` tile named "Founder" | src/pages/Profile.tsx | Fixed, CRITIQUE-14 |
| M4 | On someone else's profile the avatar's level ring drew level 1 at 0% for every maker (`user_progress` is readable by its owner only), announced "Level 1, 0% to next level" for a maker at level 6 | Profile.tsx | Fixed, CRITIQUE-15 |
| M5 | The frame's level chip filled the level and its bars with `--action`: two primary-coloured fills in the rail on every desktop page, and on `/analytics` the same level in two lights, `--action` in the rail and `--lit` on the page | src/components/ambient/NavProgressChip.tsx | Fixed, CRITIQUE-16 |
| M6 | A new reader's first `/analytics` opened under the old WelcomeXpModal on an opaque ground: it promised that "streaks reward showing up" and "perk eligibility", which XP-DESIGN.md does not pay or has parked, hid the reset note, and set "Start your quest" in `--text` on `--action` (2.73:1, Dusk 2.24:1) | src/components/ambient/GamificationToasts.tsx | Fixed, CRITIQUE-17 |
| M7 | `/profile/:handle` at 768: the maker's name truncates to "M.." / "O.." ("M." / "O." after the fixes), because the identity row turns horizontal at Tailwind's `sm` (640) inside the frame's 462px column and the visitor's three actions take about 245px; at 1024 the column is 568px and the name fits | ProfileHeader.tsx:200 (`sm:flex-row`) | Deferred: the breakpoint is structural CSS on an existing layout element (CONTRACT §2.2) |
| M8 | On a phone, someone else's profile is titled with the reader's own name ("Audit Runner" over Maya Okafor's profile) | src/components/AppShell.tsx:296 (`title: profile?.display_name` for every route) | Deferred: AppShell.tsx is outside RC-P21 to RC-P28's files |
| M9 | `/drafts` at 390: each draft's title truncates to its first word ("Calendar t…", "Refund re…") beside a filled "Continue editing" per row | src/pages/Drafts.tsx:231, :291 | Deferred: Drafts.tsx is outside RC-P21 to RC-P28's files, and the row's layout is structural (§2.2) |

---

## critique-information-density

### Cognitive Load: major issue → minor issue after CRITIQUE-12 and CRITIQUE-13

- **Observation.**
  - The profile's first screen carried three rows of numbers: the header's earned numbers ("64 reproduced", "not yet rebuilt"), its strip ("212 followers · 38 following · 0 blueprints · 0 blogs · 0 bounties") and, under the header, the four figures (6 · 64 · 0 · 1).
  - One level is written three ways: "74/421" in the rail's chip, "1,230 XP" and "347 XP to level 7" on the progress page, and a ring with no number around the avatar.
  - The new reader's page tells someone who joined yesterday that "Progress has been reset", and YOUR BUILDS shows four zeros above its one-sentence empty state.
- **Problem.**
  - M1: the maker's output is stated twice and the statements disagree: "0 bounties" beside "1 gaps solved", no blueprints beside six builds. A reader has to decide which to believe.
  - M2: the same two facts in two words and two formats, a hand's width apart.
  - m12, m13, m14: smaller costs of the same kind, each with the way forward in view.
- **Fix.**
  - M1, fixed (CRITIQUE-12): the strip keeps the two counts of people, as text; the level chip and the three legacy counts go, and the profile stops reading profile_stats and profiles.level.
  - M2, fixed (CRITIQUE-13): the header no longer draws the earned numbers; the figures row is the one statement.
  - m12 to m14: deferred as minor.

### Content Priority: major issue (M9 deferred; M6 fixed)

- **Observation.**
  - Before CRITIQUE-17 the new reader's first `/analytics` was the welcome modal, edge to edge; the progress page, its reset note and its empty states were under it (M6).
  - `/drafts` at 390: two rows, each "Calendar t…" or "Refund re…" beside a 146px filled button (M9).
  - `/analytics` at 390: the six XP sources fill the first screen; NEEDS YOU, the three builds waiting on their maker, starts under the bottom bar (m7).
- **Problem.**
  - M6: the reader could not reach the page they opened.
  - M9: a drafts list whose names cannot be read is a list of buttons.
  - m7: what the maker acts on comes after what they read once.
- **Fix.**
  - M6, fixed (CRITIQUE-17): the toast bus no longer mounts the old welcome.
  - M9: the row's text should take the row's width and the action go under it below 768. Deferred (Drafts.tsx, structural).
  - m7: "How you earn" could close behind a disclosure, which is a state STATES.md does not list; the order is RC-P27's. Deferred.

### Scanning Pattern: minor issue

- **Observation.**
  - The progress page's sections are named by DM Mono eyebrows, 64 apart; the figures and the table's numbers are DM Mono with tabular digits, the table's aligned to the trailing edge.
  - The table is 998px wide in a 560px region (318 at 390): 3 of its 8 columns are in view at 1024 and 1440, 2 at 768 and 390 (the `scrollers` probe). The Build column shrinks to its 160px minimum, so titles wrap to three and four lines and each row is 50 to 100px tall for one number.
  - NEEDS YOU's lines break differently: the first reason sits beside its title, the other two wrap under theirs.
- **Problem.** m11: a row that is mostly a wrapped title reads down, not across, and five of the eight columns are found only by scrolling sideways past the last row, where the bar is a `--line` thumb on `--bg` (1.30:1 on Exhibition). m10 is rhythm, below.
- **Fix.** m11: fewer columns in view (the eight are RC-P23's), or rows that stack below the table's width. Deferred as minor.

### Progressive Disclosure: minor issue

- **Observation.**
  - The profile discloses the maker's work by tab (Builds, Rebuilds, Solutions), each paged by "Show more".
  - The progress page shows everything at once, in RC-P27's order, with "How you earn" always open.
  - The table's last five columns are behind a sideways scroll.
- **Problem.** m7 and m11, as above: the static rules come before the actions on a phone, and most of the table is disclosed by a scroll the page does not point to.
- **Fix.** As above. Deferred as minor.

---

## critique-visual-hierarchy

### Entry Point: major issue (M8 deferred; M4 and M6 fixed)

- **Observation.**
  - The profile's entry point is the avatar in its ring, 104px, the heaviest object in the header. To a visitor, before CRITIQUE-15, the ring was a grey circle with the lamp's dot at twelve o'clock, named "Level 1, 0% to next level" (M4).
  - The new reader's entry point was the welcome modal's 23px "Make things. Get recognized." (M6).
  - On a phone, Maya Okafor's profile is titled "Audit Runner", the reader's own name (M8); the reader's own profile is titled correctly, by the same code.
  - `/analytics` opens on a filled `--recess` "Back" over an 18px "Your Progress"; `/drafts` names itself nowhere, and the phone's top bar says "buildgallery" on both (m8).
- **Problem.**
  - M4: the most prominent element states something false about the maker, the same level looking like two levels depending on who reads.
  - M6: the entry point was a different product's promise.
  - M8: the phone tells the reader they are on their own profile.
  - m8: two pages whose first element is a way out.
- **Fix.**
  - M4, fixed (CRITIQUE-15): the ring is drawn on your own profile only.
  - M6, fixed (CRITIQUE-17).
  - M8: pass the page's own name to the top bar on `/profile/:handle`. Deferred (AppShell.tsx).
  - m8: the pages name themselves in the Gallery's header treatment. Deferred (ShellHeader and Drafts.tsx).

### Eye Flow: minor issue

- **Observation.**
  - The profile reads avatar → name → the one primary → bio → counts → figures → tabs → cards. The identity block rises into the cover band, so the cover's lower edge cuts it between the name and the handle at every width (m2).
  - The progress page reads straight down its six sections; at 390 the eye reaches NEEDS YOU after a screen of rules (m7), and the table's rows end at a clipped column (m11).
- **Problem.** Small detours: an edge that crosses the identity, a first screen of reference, a row that ends mid-word.
- **Fix.** m2, m7, m11 deferred as minor.

### Weight: minor issue

- **Observation.**
  - The progress page's title is Figtree 18/600 and its figures DM Mono 22/500: the numbers outweigh the name of the page.
  - On the profile the maker's name is Bodoni 22/500, the same size as the four figures' DM Mono 22, and the header's buttons are 12px (m3).
  - Badges carry their tier by fill alone (outline, `--recess`, `--lit`) and say it in their accessible names.
- **Problem.** Two levels of the hierarchy at one size (name and figures); a page title lighter than the numbers under it.
- **Fix.** Folded into m21 (one page-title treatment). Deferred as minor.

### Emphasis: major issue → minor issue after CRITIQUE-14 and CRITIQUE-16

- **Observation.**
  - Before the fixes, the maker's own header held two `--action` fills side by side (the FounderMark pill and "Edit profile"), and the rail's chip two more (the level and its bar) on every desktop page: four fills of the primary's colour in view on `/profile`, two on `/analytics`, which has no primary at all.
  - `/drafts` holds three filled controls (New draft, one Continue editing per row), four on a phone (m17); on a phone the profile pairs its primary with the bar's New build (m22).
- **Problem.** M3 and M5: the primary's colour spent on a badge and on progress, so the one filled action is no longer the one thing that differs.
- **Fix.**
  - M3, fixed (CRITIQUE-14): the founder badge is the catalogue's rare chip.
  - M5, fixed (CRITIQUE-16): the chip carries the level in `--lit` with `--on-lit`, as the page does.
  - After them, `--action` fills at 1440: profile 1 (the primary), `/analytics` 0, the Gallery 0; `/drafts` keeps its own three (m17, deferred with m22).

---

## critique-composition

### Balance: pass

- **Observation.** Every view is the frame's one column. The profile is weighted to the header and the grid, the progress page to its six sections, the drafts list to its rows at the top of the column. The Gallery is the wide frame.
- **Problem.** None.
- **Fix.** None.

### Whitespace: minor issue

- **Observation.**
  - At 390, `/analytics` puts about 80px of empty band between the top bar and "Your Progress", in the shell header (phase 2's m14 records the same band over /notifications and /library).
  - `/drafts` at 1440 is two rows at the top of an empty column.
- **Problem.** m9: the band reads as a load not finished.
- **Fix.** m9 deferred (ShellHeader).

### Rhythm: minor issue

- **Observation.**
  - The four figures sit on uneven columns: at 1440 they start at x 556, 644, 856 and 1028 (gaps of 88, 212 and 172), and "got working by others" wraps though the row spans the column: `repeat(4, auto)` at a width just under the four labels plus three 40px gaps (m1).
  - NEEDS YOU's lines break differently (m10).
  - The drafts rows are 12 apart, off the spacing scale (see the consistency audit).
- **Problem.** Small irregularities in repeated elements.
- **Fix.** m1, m10 deferred as minor.

### Gestalt Principles: major issue (M7 deferred; M3's overflow fixed)

- **Observation.**
  - At 768 the visitor's header runs its parts into each other: the name cut to one letter a line, and before CRITIQUE-13 "64 reproduced" under "Following" (M7).
  - Before CRITIQUE-14 the founder pill's words spilled above and below it, over "not yet rebuilt".
  - The identity block straddles the cover's edge (m2): the name reads as on the cover, the handle as under it.
- **Problem.** M7: proximity and figure-ground fail together, so the name, the handle and the actions stop reading as three groups.
- **Fix.**
  - M7: the row should turn horizontal only where the column can hold it (from 1024), or the actions go under the name below that. Deferred: a structural change to an existing layout element (CONTRACT §2.2), the owner's decision.
  - The spill: gone with the pill (CRITIQUE-14).
  - m2 deferred as minor.

---

## aesthetic-usability: the consistency audit

⟦aesthetic-usability › Applying It 5⟧: one rough screen lowers the rest. The five views against each other and the Gallery, on three axes, measured by the probes at 1440 unless a width is named.

**Spacing** (the gaps between each column's top-level blocks):

| View | Between blocks | Inside a block | On the scale (8/16/24/40/64) |
|---|---|---|---|
| Profile (both readers) | header → figures 24, figures → tabs 24 | strip 16 under the bio; figures 40 apart, 8 figure to label | yes |
| Progress page (both readers) | 64 between sections (SPACE.xl) | 16 inside each | yes |
| Drafts | rows 12 apart | 18 × 20 row padding, 6 inside | no: 12, 18, 20, 6 |
| Gallery | header → lenses 24 → facets 24 → results; summary → grid 24 | card gutters 24 | yes |

The progress page's 64 is RC-P27's, and the theme asks pivotal sections to earn more than connective ones. Drafts is the one view off the scale.

**Type scale** (distinct text styles in the column):

| View | Styles | Page title | Off the scale |
|---|---|---|---|
| Profile, own | 14 → 13 | the maker's name, Bodoni 22/500 | before CRITIQUE-14, the pill's Figtree 12.5/700 |
| Profile, visitor | 14 | the same | none |
| Progress page | 8 | "Your Progress", Figtree 18/600 in the shell header | none |
| Progress page, new reader | 7 | the same | none |
| Drafts | 7 | none | DM Mono 10 chips, Figtree 15/600 titles, Figtree 12 status line |
| Gallery | 9 | eyebrow and "Builds worth running", Bodoni 48/400 | none |

Four page-title treatments across six views (m21), and one view under the eyebrow's 12px floor (m19).

**Button weight** (height · text · paint · radius):

| Role | Profile | Progress page | Drafts | Gallery |
|---|---|---|---|---|
| Primary | Edit profile / Following: 33 · 12/600 · `--action` · 12 | none | New draft: 32 · 13/600 · `--action` · 8; Continue editing: 33 · 12/500 · `--action` · 12 | none (the phone bar's New build) |
| Secondary | Message, Share, More: 32–33 · 12/400 · glass · 12 | New build (new reader): 44 · 14/500 · transparent outline · 12 | Back: 32 · 13/500 · `--recess` fill · 8 | Filters (390): 40 · 14/500 · glass · 12 |
| Tertiary | tabs: 44 · 13/500 · ghost; engagement: 44 | Got it: 44 · 14/500 · ghost | — | engagement: 44; facet chips 28 · 12/500 · outline · 8 |

- The same roles come in three heights (32–33, 40, 44), three text sizes (12, 13, 14) and three secondary paints (glass, transparent outline, `--recess` fill). STATES.md row 2's secondary is the progress page's.
- The profile header's controls are under the 44px touch minimum on a phone (m3), and paint glass over a flat ground (m4).
- The shell header's buttons use the chip's 8px radius (m20).

**Verdict.** The progress page and the Gallery are the two consistent screens; the profile header and the drafts list are the rough ones. After the fixes the profile header no longer disagrees with the progress page about a badge (M3) or a level's light (M5). What remains is weight and title treatment, all minor (m3, m4, m19, m20, m21).

---

## von-restorff-effect: isolated elements per view

⟦von-restorff-effect › Best Practices⟧ audits for isolation inflation; CONTRACT §5 sets one filled primary action per view and one isolated element per section. Counted by the probe over the whole document: filled primaries in the topmost layer, and every isolated element (an `--action`, `--lit` or `--evidence-fill` fill, or type in `--action`, `--evidence` or a category hue). SVG strokes, such as the avatar ring's lit arc, are not counted. The same counts in both rooms.

| View | Filled primaries: before → after (390 · 768+) | Isolated elements at 1440: before → after | What they are, after |
|---|---|---|---|
| /profile/maya.o | 2 · 1 → 2 · 1 | 12 → 12 | Following; the rail chip's level and bar (`--lit`); one lamp a card (6) and three "PICKED" tags |
| /profile (own) | 2 · 1 → 2 · 1 | 13 → 12 | Edit profile; the rail chip (`--lit`); lamps and tags. The FounderMark's `--action` pill is gone |
| /analytics | 1 · 0 → 1 · 0 | 7 → 7 | the level bar and the three challenge bars, the one highest-tier badge, the rail chip; `--action` 2 → 0 |
| /analytics (new reader) | 1 · 1 → 1 · 0 | 2 → 1 | the rail chip's level (`--lit`); before, the modal's "Start your quest" |
| /drafts | 4 · 3 → 4 · 3 | 5 → 5 | New draft and two Continue editing (`--action`); the rail chip (`--lit`) |
| /gallery (reference) | 1 · 0 → 1 · 0 | 21 → 21 | one lamp a card (12), seven "PICKED" tags, the rail chip (`--action` 2 → `--lit` 2) |

- **Views with more than one filled primary in the topmost layer:** the profile at 390, for either reader (the header's primary and the bar's New build, m22), and `/drafts` at every width (m17). The progress page and the Gallery have one at 390, the bar's New build, and none wider.
- **Isolation inflation, before the fixes.** The primary's colour was spent on three things that are not actions: the founder badge (M3) and the rail chip's level and bar (M5). After CRITIQUE-14 and CRITIQUE-16, `--action` fills at 1440 are the page's one primary and nothing else, except on `/drafts`.
- **Per section, after.** The profile header has one filled element, its primary, and on your own profile the ring's lit arc as its one light; each card one lamp, and a "PICKED" tag where the build is in the gallery. The progress page has one bar in PROGRESS, one bar a challenge in THIS WEEK (a run of three identical bars, none isolated from the others), one lit tile in BADGES. The rail has one, its chip.

---

## hicks-law: Choice Audit

The profile's tabs and the progress page, in the order a reader meets them.

| Decision point | n | Criterion | Default | Depth | Scent | Budget | Competing emphasis | Rating |
|---|---|---|---|---|---|---|---|---|
| Profile tabs, someone else's | 3: Builds, Rebuilds, Solutions | The kind of work, most common first | Builds, in the gallery's order | 1, in place and in the address (?tab=) | Labels only. "Rebuilds" lists the maker's own builds that rebuilt something (two of hers) while the figure above, "rebuilt by others", counts other people's rebuilds of her work (0): one word, two sets (m15) | ≤ 4 tabs (profile.budget.test.tsx): 3 | The active tab's `--action` underline | minor |
| Profile tabs, your own | 3 tabs and a Drafts link | As above; Drafts last | Builds | 1; Drafts leaves the page for /drafts (m16) | As above; Drafts is set in the tabs' type | ≤ 4: 4 | As above | minor |
| Profile header, someone else's | Following (the primary), Message, More: Block user, Report user, Copy profile link | Frequency | None | 1; the menu is 2 | Block and Report write to the console and do nothing (m5) | One primary: 1 | None beyond the primary | minor |
| Progress page: NEEDS YOU | 3 lines, one a build | Urgency (solutions waiting, a run that did not work, stale), then the table's order | None: each line is its build's link | 1 | The reason beside each title | No control | None | pass |
| Progress page: YOUR BUILDS | 6 rows | Got working, then last confirmed, stated in one sentence and never offered | The stated order | 1 | Titles link to their builds | Sort controls: 0 | None | pass |
| Progress page: THIS WEEK | 3 challenges | XP-DESIGN.md's order | None: progress, not a choice | 0 | "n of m" beside each bar | ≤ 3 | One bar each, identical | pass |
| Progress page: BADGES | 10 | Earned first, then the catalogue's order | None | 0 | Name and tier in words | The catalogue's ten | One lit tile | pass |
| New reader | Got it (the note), New build (the empty state's secondary) | One per section | None | 1 | "Publish a build and its numbers show up here." | Row 19: one action per empty state | None filled | pass |

- **The profile.** Three tabs by kind of work, with the scent of one of them crossed by the figure above it (m15) and a link dressed as a fourth tab (m16). The header's menu offers two choices that do nothing (m5). **minor.**
- **The progress page.** No control beyond links, every order stated, every budget met. The parked features offer no way in (RC-P28's guards; the frame, the profile and the page are tested for it). **pass.**

**Noted outside the decision points.**
- The rail's level chip names every level "Builder" (its default `levelName`), a rank XP-DESIGN.md does not have, and its flyout's filled "View profile" has no handler of its own: pressed, it bubbles to the chip, which opens the progress page (m6).
- The drafts list's header offers "New draft" where the navigation offers "New build", for the same composer (m18).

---

## buildgallery-theme: Before you call it done

The phase's surfaces: the profile header, its figures and tabs; the progress page's six sections; the rail's and the drawer's level chip; the founder chip; the drafts list as the profile's Drafts link opens it.

1. **Both themes checked.** PASS. 176 screenshots in both rooms, before and after the fixes.
2. **Every colour a semantic token.** PASS. The fixes use `t.*` only; `src/lib/theme/compliance.test.ts` passes. The level chip's `color-mix(var(--action) 35%)` glow is gone.
3. **Every new pairing measured; no amber text on Exhibition.** PASS. The one new pairing is `--on-lit` on `--lit` (the chip's level), 7.29:1 on Exhibition and 7.49:1 on Dusk, as RC-P26 measured it for the highest-tier badge; the founder chip spends badgePaint's measured pairs. **"Amber never type", checked on every screenshot:** text drawn in `--lit`, counted by the probe over the whole document, so each landing screen and its full column:

   | View | 390 | 768 | 1024 | 1440 | Rooms | Runs |
   |---|---|---|---|---|---|---|
   | /profile/maya.o | 0 | 0 | 0 | 0 | both | before and after |
   | /profile | 0 | 0 | 0 | 0 | both | before and after |
   | /analytics | 0 | 0 | 0 | 0 | both | before and after |
   | /analytics (new reader) | 0 | 0 | 0 | 0 | both | before and after |
   | /drafts | 0 | 0 | 0 | 0 | both | before and after |
   | /gallery | 0 | 0 | 0 | 0 | both | before and after |

   Amber is a fill everywhere it appears: plaque lamps, the progress and challenge bars, the highest-tier badge, the avatar's ring, and after CRITIQUE-16 the rail chip. **Views with amber text: 0.** No text sits over a horizon: these pages carry no sky.
4. **Radius from the scale.** PASS for the phase's surfaces after CRITIQUE-14: chips and badges at `--r-chip`, controls at `--r-control`, cards at `--r-card`, the avatar and its ring circles. The FounderMark was a pill. Outside the phase: the shell header's Back and New draft are buttons at 8px (m20).
5. **Glass.** Minor: the profile header's secondaries and its two camera buttons are glass over a flat ground (m4). The progress page's mounted sections, the figures and the founder chip carry none; nothing is nested.
6. **Media framed; media-less builds show their cover.** n/a for the phase's own surfaces. Its cards are the gallery's, unchanged; the stale build with no media shows the card's text well, as GalleryCard does everywhere.
7. **Display face ≥ 20px; body ≥ 400 under 18px.** PASS. Bodoni at 22, 26 and 48; nothing under 400 weight under 18px. The drafts list's 10px chips are DM Mono and under the eyebrow's 12 (m19).
8. **Reproduction and freshness together under the title; model in mono.** PASS with a note: on two-column profile cards and three-column gallery cards the freshness line truncates before its model ("last confirmed working 3 da…"), and no title carries the rest (m23).
9. **A gap keeps its category chip and reads as an invitation.** PASS: the profile's "Support reply suggester" keeps its dashed edge and "1 part unsolved · £150".
10. **One primary action, one lit lamp per plaque, the lamp glows only on Dusk.** PASS at 768 and wider after CRITIQUE-14 and CRITIQUE-16 on the profile, the progress page and the Gallery; `/drafts` has three (m17), the profile two on a phone (m22). One lamp per plaque.
11. **Motion gated; nothing animates layout; the room never moves.** n/a: the phase adds no motion. Captured under reduced motion; the progress bars grow by transform and stop under it (RC-P27's tests).
12. **No horizontal overflow at 390 / 768 / 1400.** PASS: 0 on all 48 probed screens, before and after. The table scrolls inside its wrapper.
13. **States designed.** PASS. Populated (the maker), empty (the new reader: empty builds with a secondary New build, 0 of n challenges, ten "Not yet" badges), loading (skeletons at the final layout's size; the profile's lost its earned-numbers slot with CRITIQUE-13), error (SectionRefusal and the figures' refusal, row 21), and the kit's hover, focus and disabled states.

---

## Re-rated after the fixes

The screenshots were re-taken after CRITIQUE-12 to CRITIQUE-17: 88 files, the same six views, four widths and two rooms.

| Finding | Was | Now | Evidence |
|---|---|---|---|
| M1 the legacy strip and level chip | major (Cognitive Load) | fixed | profile-{own,visitor}-*.png: "212 followers · 38 following" as text, no chip; getProfileSummary.test.ts, Profile.test.tsx |
| M2 the earned numbers | major (Cognitive Load) | fixed | the header has no "reproduced" or "rebuilt"; the figures row says each once; Profile.test.tsx |
| M3 the founder pill | major (Emphasis; Gestalt) | fixed | profile-own-*.png: a `--recess` "Founder" chip; `--action` fills in the header 2 → 1; BadgeMark.test.tsx, Profile.test.tsx |
| M4 the visitor's level ring | major (Entry Point) | fixed | profile-visitor-*.png: the plain avatar; Profile.test.tsx |
| M5 the rail chip in `--action` | major (Emphasis) | fixed | every desktop screen: an amber level with dark ink and an amber bar; `--action` fills on /analytics 2 → 0; NavProgressChip.test.tsx |
| M6 the welcome over the new reader | major (Entry Point; Content Priority) | fixed | analytics-new-*.png: the reset note, level 1, the empty states; GamificationToasts.test.tsx |
| M7 the visitor's header at 768 | major (Gestalt) | major, deferred | profile-visitor-768-*.png: "M." / "O." |
| M8 the phone title on someone else's profile | major (Entry Point) | major, deferred | profile-visitor-390-*.png: "Audit Runner" |
| M9 the drafts titles at 390 | major (Content Priority) | major, deferred | drafts-390-*.png unchanged |
| The builds table's hidden columns (first read as M-level) | major, on a 0px scrollbar | minor (m11) | the 0px was Playwright's `--hide-scrollbars`; plain Chromium draws the bar 15px |

Dimensions, twelve in all: major 5 · minor 6 · pass 1 before; major 3 · minor 8 · pass 1 after. Each remaining major is one of the three deferred findings.
