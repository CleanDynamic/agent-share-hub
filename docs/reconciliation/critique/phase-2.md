# Phase 2 critique — the frame (RC-P09c)

The frame RC-P05 to RC-P08 built, judged from its screenshots and measured in the browser: the nine-destination nav, the one search field, the phone bar and drawer, no right rail, one way to start a build.

## Method

- **Screens.** `e2e/audit/rc-critique.spec.ts` captures five routes (`/`, `/gallery`, `/bounties`, `/notifications`, `/library`) at 390, 768, 1024 and 1440 wide, in Exhibition and Dusk: 40 screenshots in `e2e/audit/critique/phase-2/`, which is gitignored. Regenerate them with `npx playwright test e2e/audit/rc-critique.spec.ts --project=desktop` from the spec as CRITIQUE-4 (74e04f7f) left it; RC-P14c re-pointed the spec at phase 3's addresses. The reader is the audit harness's signed-in reader; the builds are the twelve synthetic rows in `e2e/audit/fixtures/rcBuilds.ts`; nothing reaches the network. Reduced motion is emulated, so nothing is caught mid-reveal. The gallery's "Open bounties 12" is a fixture artifact: the fixture answers every count with its twelve rows.
- **Probes.** Some findings came from measuring the running app rather than from a picture, and each says so: the tab order, the placeholder's contrast, the nav's position at 768, 1024, 1280, 1440 and 1920 (on this tree and on the pre-phase tree, c4e33615), and the theme checklist's measurable items at 390, 768, 1024, 1400 and 1440.
- **Ratings.** Each skill's own scale. For the three critique skills in this pass:
  - **major issue**: a reader cannot reach a destination, cannot tell where they are, gets something other than what a control names, or finds the frame's anchor moved.
  - **minor issue**: friction or inconsistency, with the way forward still in view.
  - **pass**: no finding.

  A dimension takes its worst finding. Every major was then fixed or deferred under step 5: three fixed (CRITIQUE-1 to 3), two deferred, with reasons below and in the diary.
- **Scope.** The frame's own parts are judged, and so is page content that predates the phase, wherever it shows in the screenshots: Home's legacy feed, Library and Notifications. Findings in those pages are rated on the same scale. Most of them sit outside the files this pass may change, and go to the diary.

## Summary

| | Before the fixes | After the fixes |
|---|---|---|
| Rated dimensions and decision points (15) | major 7 · minor 7 · pass 1 | major 4 · minor 9 · pass 2 |
| Distinct major findings | 5 | 2, both deferred |
| Distinct minor findings and LOW rows | 25 | 25, all deferred to the diary |

The five majors:

| # | Finding | Where | Outcome |
|---|---|---|---|
| M1 | The desktop nav's nine rows and the wordmark could not be reached by keyboard | FlatShell.tsx | Fixed, CRITIQUE-1 |
| M2 | The phone top bar titled the Gallery "Discover" | AppShell.tsx, MobileTopBar.tsx | Fixed, CRITIQUE-2 |
| M3 | The search field's only visible label read 1.75:1 on Exhibition | NavSearch.tsx | Fixed, CRITIQUE-3 |
| M4 | The nav jumps between standard and wide routes: 259px at 1440 | flat-shell.css | Deferred: structural CSS (CONTRACT §2.2) |
| M5 | Search opens the Gallery, which ignores `q` and `focus=search` until RC-P10 | Gallery.tsx | Deferred: outside RC-P05 to RC-P08's files; RC-P10's first step |

---

## critique-composition

### Balance: minor issue

- **Observation.** Standard routes centre the 874px pair, the 240 nav plus the 634 column, with equal ground either side: 75px at 1024, 283px at 1440. At 768 the pair fills the width. Wide routes open to 1600 with a 24px inset. The nav's account block and theme control are pinned to its foot, which weights every screen evenly top to bottom. The frame shows two empty states. Bounties' sentence sits at the top of its column (y 118 at 1440); Library's is centred in its column (y 499).
- **Problem.** The two empty states disagree about where "nothing here" lives (m20). Each is balanced on its own, but moving between them makes the page's centre of gravity jump.
- **Fix.** Pick one placement for the frame's empty states, top-of-column after the heading as Bounties does, and use it on the next page to be touched. Minor, deferred.

### Whitespace: minor issue

- **Observation.** Nav rows are 40px with 4px between them; groups are split by an 8px, 1px, 8px divider; the wordmark stands 24px above the search field, and the search field 8px above Home. On Home at 1440 there are 382px of empty column between the competitions card (bottom at y 296) and "Nothing here yet" (y 678). On the phone, Notifications and Library leave an 84px empty band under the top bar, with the first tab at y 140.
- **Problem.**
  - The field's 8px sits nearer the within-group 4px than the between-group 21px, so it reads as Browse's first row rather than a tool above the nav (m7).
  - Home's gap is a visual cliff (m11).
  - The phone's band pushes the content down for nothing (m14).
- **Fix.**
  - 16px (SPACE.sm) under the field's wrapper, a new element that may take it.
  - Home's empty state after the strip, not at the column's foot (the Home prompt).
  - The phone header's space reclaimed in the Notifications and Library pages.

  All deferred.

### Rhythm: minor issue

- **Observation.** One row shape (40px, --r-control) repeats down the nav; the phone bar's five items are evenly spaced; notification rows are one height at an 8px gap. The gallery's cards keep one anatomy, but a row's cards end at different heights: 824, 851 and 828 at 1440, because titles run to one or two lines.
- **Problem.** The ragged row bottoms break the grid's cadence (m19). The card is fixed by the theme; its container is not.
- **Fix.** Let each grid row stretch its cards to the tallest, in the gallery grid rather than the card. Deferred: outside the phase's files.

### Gestalt Principles: major issue (deferred)

- **Observation.**
  - *Proximity:* the four nav groups read at a glance.
  - *Similarity:* every row shares one treatment; New build alone is filled on the phone bar, on purpose.
  - *Closure and figure-ground:* see law-of-figure-ground below.
  - *Continuity:* within a screen, the search field's box, the row boxes and the active wash share one left edge (x 16 in the nav). Across routes they do not. Measured with the nav's `x`:

    | Width | Standard routes | Gallery (wide) | Jump | Home before RC-P06 |
    |---|---|---|---|---|
    | 768 | 0 | 24 | 24 (and 24 down) | 0 |
    | 1024 | 75 | 24 | 51 | 0 |
    | 1280 | 203 | 24 | 179 | 53 |
    | 1440 | 283 | 24 | 259 | 133 |
    | 1920 | 523 | 184 | 339 | 373 |

- **Problem.** The frame's anchor moves under the reader on the commonest move, Home to Gallery and back. The wordmark, the search field and nine rows shift a fifth of the screen sideways and 24px down (M4). Before RC-P06 the nav had three positions at 1440: 133 on routes with a rail, 283 on routes without, 24 on wide routes. RC-P06 made every standard route agree, but moved the Home-to-Gallery jump from 109px to 259px.
- **Fix.** One nav edge in both modes, which is structural CSS on `.fs-frame` and `.fs-wide .fs-frame` (flat-shell.css:68 and :670) and so the owner's call, as §3.1 was. Options:
  - (a) Standard routes adopt the wide frame's geometry: nav at the 24px inset, the 634 column beside it, the ground to the right. This costs the centred reading pair.
  - (b) Wide routes keep the nav where standard routes put it, and the grid takes the rest. At 1440 this costs about 260px of grid.
  - (c) Keep the jump as the price of wide mode.

  Deferred with that reason.

---

## critique-visual-hierarchy

### Entry Point: major issue → minor issue after CRITIQUE-2

- **Observation.**
  - Desktop entry points: the gallery's display headline; the Bounties heading; on Home, the tab row and the compose strip's filled New; on Notifications and Library, a filled --recess "Back" button at the top-left.
  - Phone: the top bar's centre is the entry point. It shows the wordmark on Home, Bounties and Library, "Alerts" on Notifications, and, before the fix, "Discover" on the Gallery.
- **Problem.**
  - The Gallery's phone title named a destination the product no longer has, over a page the bar lit as Gallery (M2). RC-P05 had moved the old /discover page context onto /gallery.
  - "Alerts" disagrees with the nav's and drawer's "Notifications" (m5). On /upload, a route RC-P08b retires, the bar's title is "Upload", a word CONTRACT §13 removes (m6).
  - Home opens on For You, empty for a reader who follows nobody, next to a populated Builds tab, with six tabs where CONTRACT §14 sets two (m9).
  - A "Back" with no fixed destination is the first thing on two pages reached from the nav (m15).
- **Fix.**
  - CRITIQUE-2: /gallery takes the default context, the wordmark, as Home, Bounties and Library do, and the unreachable "discover" context is deleted. Re-shot at 390: the bar reads "buildgallery" in both rooms.
  - The rest are deferred: MobileTopBar's "Alerts" and "Upload" (minor); Home's tabs (the Home prompt); the Back buttons (ShellHeader and LibraryShell, outside the phase).

### Eye Flow: pass

- **Observation.**
  - Desktop reads down the nav, then down the column.
  - Gallery: eyebrow → headline → description → facets → the one-sentence order → grid.
  - Bounties: heading → sentence → action.
  - Phone: top bar → content → bar.
- **Problem.** None beyond Home's dead zone, counted under Whitespace.
- **Fix.** None.

### Weight: minor issue

- **Observation.** Page headings are Bodoni at 30px at 390 and 48px at 1440, against 16–17px body: 1.9× or more. Nav labels are 15/500; the active one is --text against --text2. Notification rows set their title at 13px/500, the description at 12px/400 and the date at 11px: the title is 1.08× the description.
- **Problem.** Inside a notification row the levels flatten (m16), and the whole row sits below the 16px body size the theme sets.
- **Fix.** Title at the body size, description in --text2 a step down, when the Notifications page is rebuilt. Deferred.

### Emphasis: minor issue

- **Observation.**
  - Desktop, signed in: one filled action per view (Bounties' "Browse the gallery"; Home's New).
  - Signed out at 1440: the rail's "Join free" and Bounties' "Browse the gallery" are both --action fills.
  - Phone: the bar's New build tile is filled everywhere, so / shows two filled controls (New, New build) and /bounties shows two (Browse the gallery, New build). All measured.
  - Home's legacy competitions card carries a "Reward" chip in breakage red.
- **Problem.** Two primaries compete where STATES.md row 19 says an empty state's action is secondary when the view already has a primary (m1). On Home both filled controls open the same composer (m2). The Reward chip borrows a part-category hue for emphasis, which the theme forbids (m12).
- **Fix.**
  - Bounties' empty-state action takes the secondary treatment (row 2) whenever the phone bar or the signed-out rail is on screen.
  - Home's strip drops its filled New, and the competitions card goes, when the Home prompt rebuilds Home.

  All deferred as minor.

---

## critique-affordance

### Clickability Signals: major issue → minor issue after CRITIQUE-3

- **Observation.**
  - Nav rows, bar items, drawer rows and buttons all read as controls. Measured at 390: the bar's items are 76×63 and the top bar's two buttons 56×44. In the open drawer, the six rows and Sign out are 48px tall, but Close is 36×36 and View profile is 35px tall, under the 44px minimum (m24).
  - The search field is a recessed well with a hairline. Its placeholder "Search builds" is its only visible label, and was drawn in the base stylesheet's grey: measured 1.75:1 on Exhibition's --recess, and 4.96:1 on Dusk (computed from the measured colours).
  - While a query is typed, the native clear "×" appears in the browser's own blue (m8).
  - Notifications' "View" is an 11px label on a 45×27 button with square corners (m17).
- **Problem.** On the default room, the label of the phase's one search field was under the theme's 4.5:1 text floor and its 3.0:1 UI floor (M3). The × is the only uncontrolled colour in the frame. Two drawer targets are smaller than a thumb. "View" is square, where the theme says nothing is square; it is small; and its label is generic.
- **Fix.**
  - CRITIQUE-3: the field takes the kit's placeholder utility, as ui/input.tsx does. Measured after: 4.55:1 on Exhibition, 5.73:1 on Dusk, now guarded by frame-no-rail.spec.ts.
  - The ×: `type="text"` with the search role kept, or a stylesheet rule (§2.1). Deferred.
  - The drawer's Close and View profile: a 44px hit area around the same visuals. Deferred.
  - "View": deferred to the Notifications rebuild.

### State Visibility: major issue → pass after CRITIQUE-1

- **Observation.**
  - Hover: nav rows take a --recess wash, gated to fine pointers. Active: STATES.md row 6, the 2px --action edge, 8% wash and --text label on desktop; on the phone, --action icon and label with a 2px mark.
  - Focus: the search field showed the theme's ring. The nine nav rows and the wordmark could take no focus at all. Probed at 1440: Tab went from the search field to the progress chip, the account block and the theme control, past every destination.
- **Problem.** A keyboard could not choose a destination (M1). The rows are `div`s with a click handler and nothing else.
- **Fix.** CRITIQUE-1: role="link", a tab stop, Enter, aria-current="page" on the current row, and the theme's one ring (FOCUS_RING_CLASS, STATES.md row 9). Probed after, in both rooms: wordmark → search → the nine rows, current marked → progress chip → View profile → account menu → theme → page. The ring is 2px --lit at a 2px offset. A mouse click leaves no ring.

### CTA Clarity: minor issue

- **Observation.** The labels name their acts: "Browse the gallery", "New build", "Search builds". Two exceptions:
  - The empty For You and Following tabs on Home offer "Open Discover", which lands on /gallery through RC-P05's redirect (m10).
  - Notifications' row action is a bare "View" (m17).

  Where two filled controls share a view, see Emphasis (m1, m2).
- **Problem.** "Open Discover" names a retired destination, so the label and the place disagree. "View" says nothing the row does not.
- **Fix.** "Open the gallery", the words the Builds tab already uses, in FeedShell's empty states (the Home prompt). Deferred.

### Action Discoverability: major issue (deferred)

- **Observation.**
  - Every destination is in view in the nav; the phone keeps six more in the drawer, behind Profile.
  - Search, desktop: Enter opens `/gallery?q=…`, and the field keeps showing the query there.
  - Search, phone: the top bar's "Search builds" opens `/gallery?focus=search`.
  - Library's empty state names blueprints, stages and blocks, in 13px type, and offers no action (m13).
  - The drawer's Sign out is painted --cat-breakage (m4).
  - The top bar's avatar opens the drawer the bar's Profile already opens (m3).
- **Problem.**
  - The Gallery does not read `q` or `focus` until RC-P10 (diary, RC-P07 "Open"). On the desktop the reader sees the whole gallery under a field that still shows the query, as though it were the matches. On the phone, a control named "Search builds" opens a page with no search field (M5).
  - Library's empty state breaks STATES.md row 19 and CONTRACT §13.
  - The borrowed red breaks row 16.
  - The avatar is a second route to one place.
- **Fix.**
  - M5 is RC-P10's first step: Gallery.tsx reads `q` through searchBuildIds and focuses a field on `focus=search`. Deferred: outside the files RC-P05 to RC-P08 changed.
  - The rest are deferred as minor.

---

## better-layout

**Hold structure until it breaks / Align to shared edges**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | src/components/shell/flat-shell.css:68 (`.fs-frame`: max 1200, centred, no inset); src/components/shell/flat-shell.css:670 (`.fs-wide .fs-frame`: max 1600, 24px inset) | Nav at x 283 on standard routes and x 24 on the Gallery at 1440 (259px); 179 at 1280, 51 at 1024, 24 at 768, 339 at 1920; 24px lower on wide routes | One nav edge in both modes: option (a) or (b) under Gestalt above, the owner's choice | The reader's anchor moves on the commonest move (M4). Nothing is blocked or clipped, so not HIGH. Structural: deferred (CONTRACT §2.2) |

**Group with space, not lines**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/shell/FlatShell.tsx:189 | 8px under the search field, against 4px between rows and 21px between groups | 16px (SPACE.sm) on the field's wrapper, a new element | The field groups with Browse's rows instead of standing as the nav's tool (m7) |

**Order by importance**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/shell/ShellHeader.tsx and src/components/library/LibraryShell.tsx, at 390 | First tab at y 140 under a 56px top bar: an 84px empty band | Tabs directly under the top bar | Content starts lower than it needs to on the smallest screen (m14) |
| LOW | src/components/AppShell.tsx:294 and :309 | Below 768px, MobileTopBar and MobileBottomNav mount after FlatShell's `<main>` | The top bar before the page in the DOM, its fixed position unchanged | The bar the eye reads first comes after the page for a screen reader and for Tab (m25) |

**Hint at hidden content**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/feed/FeedShell.tsx, the tab row at 390 | Six tabs in a 358px scroller (576px of content); "Trending" clipped mid-word, Recent and Bounties off-screen. They scroll into reach (measured) | A fade at the trailing edge, or two tabs as CONTRACT §14 sets | The clip is the only cue that more exists (m21) |

**Plan for growth and clipping**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/shell/flat-shell.css:331 (`.fs-nav-item` height 40px) | One-line labels in a fixed-height row | min-height with wrapping, when a second locale is planned | A longer translation of "Notifications" cannot wrap (m22). Not verified with pseudo-localisation |

**Logical properties**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/shell/flat-shell.css:365 (`box-shadow: inset 2px 0 0`) | The active edge is drawn on the physical left | An edge that follows the inline start | Would not mirror under RTL (m23). Not verified: no RTL build |

**Verification.**
- Measured in a browser: the nav and column at 768, 1024, 1280, 1440 and 1920, on this tree and on c4e33615.
- No horizontal overflow on the five routes at 390, 768, 1024, 1400 and 1440, in both rooms.
- DOM order: on the desktop it matches the reading order, nav then main. On the phone it does not (m25).
- Not verified: 200% zoom, the RTL mirror, pseudo-localisation.

**Approve.** No HIGH row. The MEDIUM and the LOWs stay as work to do, in the diary.

---

## law-of-figure-ground

**Home (/).** One ground, --bg, runs under the nav and the column alike. The stage is bounded only by the column's two --line hairlines, so it reads as a band of the room, not a panel. The figures are the compose strip and the competitions card, each a --glass surface with a hairline; the empty state sits directly on the ground and reads as ground-level text. The active state is unambiguous in both rooms. Home carries the nav's only --action mark, a 2px inset edge and an 8% wash, and its label moves to --text while its neighbours stay --text2. On the phone, Home's icon and label turn --action under a 2px mark. On Exhibition the search field's --recess well is the heaviest block in the nav, heavier than the active row's wash. The row still wins attention, because it holds the nav's only accent.

**Gallery.** In wide mode the cards are the figures: --glass with a --glass-border, each holding its cover as a second, inner figure, and the nesting stops there. The facet chips are outlined figures on the ground. The one dashed-edge card (a gap) differs by its edge, not by its ground, which keeps it one of the set. On Dusk the glass reads lighter than the lavender ground, and on Exhibition lighter than the grey: the same order in both rooms. The active row is Gallery, marked as above. On the phone, the glass top bar floats over the scrolling column, and its hairline separates it. Before CRITIQUE-2 its title contradicted the bar's lit Gallery.

**Bounties.** Almost all ground: a heading, one --text2 sentence and one filled button. The button is the strongest figure on the page, which is right for the view's one action on the desktop. On the phone it shares that weight with the bar's New build tile (m1). The active row is Bounties; on the phone, Bounties is lit.

**Notifications.** Rows are bounded boxes on the ground. The two unread ones carry a 2px --action left edge, the same mark the active nav row carries, so the accent means "this one" wherever it appears. The All tab is underlined in --action. The desktop "Back" is a --recess block, the heaviest figure at the top-left, ahead of the page's content (m15). The active row is Notifications. On the phone, Profile is lit, because the drawer holds Notifications: the phone's rule, not an error.

**Library.** An empty state floats mid-column as the only figure: a --recess icon tile, a Bodoni headline and a line of --text2. Above it, two tabs with zero counts under an --action underline. The active row is Library. On the phone, Profile is lit, as on Notifications.

---

## hicks-law: Choice Audit

Decision points in the order a reader meets them: the search field, under the wordmark; the desktop nav; the phone bar.

| Decision point | n | Criterion | Default | Depth | Scent | Budget | Competing emphasis | Rating |
|---|---|---|---|---|---|---|---|---|
| Search field (desktop; the phone's magnifier opens the Gallery) | 1 field, the only one in the chrome | Results in evidence order: most reproduced, then most recently published (search_build_ids), shown by the Gallery once it reads `q` | Empty; "/" focuses it from anywhere not taking text | 1: type, Enter | The placeholder "Search builds", 1.75:1 on Exhibition before CRITIQUE-3 and 4.55:1 after. The result does not reflect the query until RC-P10 | One search box, the same everywhere: 1 (navBudget.test.tsx) | Its --recess well is the nav's heaviest block but carries no accent | major → major (M3 fixed; M5 deferred) |
| Desktop nav | 9 in 4 groups signed in; 4 signed out | Intent: Browse · Make · Talk · You | The current route marked; aria-current since CRITIQUE-1 | 1 | Nouns and icons; counts on Drafts, Messages and Notifications; a dot on Library | ≤ 9, ≤ 4 groups, one level: 9, 4, 1 | One accent, the active row | major → major (M1 fixed; M4 deferred) |
| Phone bar | 5 | Intent, in the budget's order: Home, Gallery, New build, Bounties, Profile | The current route lit; Profile lit for the six drawer routes | 1; drawer 2, by the split rule | Labels under icons; one unread dot on Profile | Exactly 5: 5 | New build is the bar's one filled tile; / and /bounties add a second filled control; the top bar's avatar is a second way into the drawer | minor → minor |

- **Search field.**
  - **Observation:** one box in every frame. Enter tidies the query and opens the Gallery with it.
  - **Problem:** its scent was unreadable on the default room (M3). Its outcome is the unfiltered Gallery, so a reader cannot dismiss or confirm a result by its matches until RC-P10 (M5).
  - **Fix:** CRITIQUE-3 for the label. RC-P10 for the results, deferred.
  - **Rating:** major, deferred.
- **Desktop nav.**
  - **Observation:** nine nouns in four intent groups, one level, one accent.
  - **Problem:** for a keyboard, n was zero (M1). The nav's position differs between standard and wide routes (M4, measured above), which raises b for exactly the repeat moves ⟦hicks-law › When Hick's Law Does Not Apply⟧ says to keep stable.
  - **Fix:** CRITIQUE-1 for reach. The owner's decision for position.
  - **Rating:** major, deferred.
- **Phone bar.**
  - **Observation:** five intent-ordered items with labels.
  - **Problem:** a second filled control on / and /bounties raises a (m1, m2). The avatar duplicates Profile (m3); the v0 brief keeps it.
  - **Fix:** row 19's secondary treatment on the page's side, and the avatar decided at the next phone pass.
  - **Rating:** minor.

**Noted outside the three decision points.** The Gallery's facet rows show 9 options under Made for and 8 under Made with (counted in gallery-1440), over "≤ 6 visible, then More" ⟦hicks-law › Budgets⟧ (m18). FacetRail, in RC-P10's gallery work; the fixture's twelve builds are what make the rows long.

---

## buildgallery-theme: Before you call it done

The phase's surfaces are the nav and its search field, the phone bar, drawer and top bar, /bounties, and RouteBoundary's error state.

1. **Both themes checked.** PASS. All 40 screenshots are in both rooms, before and after the fixes. RouteBoundary's error state is not in this pass's screenshots; its colours are t.text and the outline Button (RC-P05).
2. **Every colour a semantic token.** PASS. The phase's files use `t.*` and `var(--…)` only, and the placeholder fix spends --text2. src/lib/theme/compliance.test.ts passes.
3. **Every new pairing measured; no amber text on Exhibition.** FAIL, then fixed. The search placeholder was 1.75:1 on Exhibition (M3); after CRITIQUE-3 it is 4.55:1, and 5.73:1 on Dusk. Amber appears only as light: the focus ring, and the freshness lamps on the Gallery's cards.
4. **Radius from the scale; no pills; no square corners.** PASS for the phase's surfaces:
   - The search field and nav rows are at --r-control; the ring follows the row's radius.
   - The probe found no pill-shaped control on the five routes at any width.
   - Outside the phase, Notifications' "View" has square corners (m17).
5. **Glass.** PASS. The highest count of blurred surfaces on any route and width is 14 (Gallery at 390); on Home, Bounties, Notifications and Library it is 1 to 3; nothing is nested. The single 16px value is held by src/lib/theme/glass.test.ts, which passes.
6. **Display face ≥ 20px; body ≥ 400 under 18px.** PASS. The probe found none on the five routes, at five widths, in both rooms.
7. **Reproduction and freshness together under the title.** PASS where cards show (Gallery). Each card in the first row carries "n reproduced" and "last confirmed working …" under its title; the stale card's lamp is dimmed.
8. **A gap keeps its category chip and reads as an invitation.** n/a: the phase adds no gap surface. The Gallery's dashed-edge card is unchanged.
9. **Motion gated; nothing animates layout.** PASS:
   - Nav rows transition background-color and color only, and their hover is gated to fine pointers.
   - The focus ring appears without a transition.
   - NavSearch's field uses uiTransition(), which is none under reduced motion.
10. **No horizontal overflow at 390 / 768 / 1400.** PASS. Measured on the five routes at 390, 768, 1024, 1400 and 1440, in both rooms.
11. **States designed.** PASS after CRITIQUE-1:
    - Nav: hover, active, and focus (CRITIQUE-1); disabled is n/a.
    - Search field: hover, focus ring, and a no-op below two characters; its results are RC-P10's (M5).
    - Bounties: empty (row 19) and error (RouteBoundary, row 21), with a --bg block while it loads; populated arrives with the bounties board.
    - Phone bar: active and unread dot.

---

## Re-rated after the fixes

The screenshots were re-taken after CRITIQUE-1 to 3: 40 files, the same five routes, four widths and two rooms.

| Finding | Was | Now | Evidence |
|---|---|---|---|
| M1 keyboard reach | major (State Visibility; hicks-law nav) | pass | Probe: Tab reaches the wordmark, the field and nine rows; ring drawn in both rooms; Enter follows; AppShell.test.tsx |
| M2 Gallery titled "Discover" | major (Entry Point) | pass | gallery-390-{exhibition,dusk}.png read "buildgallery"; AppShell.test.tsx; discovery-redirects.spec.ts on both projects |
| M3 placeholder 1.75:1 | major (Clickability; hicks-law search scent) | pass | Measured 4.55:1 / 5.73:1; frame-no-rail.spec.ts; the placeholder visibly darker in every Exhibition desktop shot |
| M4 nav position | major | major, deferred | Structural; the owner's decision |
| M5 search results | major | major, deferred | RC-P10 |
