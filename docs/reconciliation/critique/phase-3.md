# Phase 3 critique — discovery (RC-P14c)

The discovery RC-P10 to RC-P14b built, judged from its screenshots and measured in the browser: the gallery's lenses and search, the two-tab Home, the bounties and solvers boards, the rebuild tree and where next.

## Method

- **Screens.** `e2e/audit/rc-critique.spec.ts` captures nine addresses at 390, 768, 1024 and 1440 wide, in Noon and Dusk: 72 screenshots in `e2e/audit/critique/phase-3/`, which is gitignored. The addresses are `/`, `/?tab=everyone`, `/gallery`, `/gallery?lens=proven`, `/gallery?q=agent`, `/bounties`, `/bounties/solvers`, `/b2/rc-build-7` (scrolled to its foot, where where-next is) and `/b2/rc-build-7/lineage`. Regenerate them with `npx playwright test e2e/audit/rc-critique.spec.ts --project=desktop`.
- **Fixtures.** The reader is the audit harness's signed-in reader, following two of the three fixture makers. The builds are the thirteen synthetic rows in `e2e/audit/fixtures/rcBuilds.ts`. This pass added a thirteenth build, so there is a three-generation family (1 → 7 → 13), a third open ask (with no reward), two solvers and the board's rows.
- **Filtered answers.** The spec answers builds, parts, media, bounties, solutions, profiles and follows through `e2e/audit/support/restFilter.ts`, so a lookup by slug gets one build. The harness itself still answers every table with all its rows, a pre-existing test-infrastructure defect deferred as m14. Nothing reaches the network. Reduced motion is emulated.
- **Probes.** Some findings came from measuring the running app, and each says so: card widths, blurred surfaces, document height, the contrast and focus probes run in RC-P13, RC-P14 and RC-P14b.
- **Ratings.** Each skill's own scale:
  - **major issue**: a reader cannot reach something the screen is about, or the same thing looks like two things.
  - **minor issue**: friction or inconsistency, with the way forward still in view.
  - **pass**: no finding.

  A dimension takes its worst finding. Every major was fixed inside the phase's files (CRITIQUE-5 and 6). No major is deferred.
- **Scope.** The phase's surfaces, plus whatever else shows in the screenshots (the frame, Home's compose strip). Findings outside RC-P10 to RC-P14b's files are rated and deferred.

## Summary

| | Before the fixes | After the fixes |
|---|---|---|
| The four critique skills' dimensions (16) | major 3 · minor 6 · pass 7 | major 0 · minor 6 · pass 10 |
| Distinct major findings | 2 | 0 (both fixed) |
| Distinct minor findings and LOW rows | 14, plus m14 (the audit harness) | the same 15, all deferred to the handover's list |

The two majors:

| # | Finding | Where | Outcome |
|---|---|---|---|
| M1 | Where-next cards drew their text body with no picture: the same build looked like a different card at the foot of a build page than in the gallery and on Home | src/lib/build/whereNext.ts, src/components/build/WhereNext.tsx | Fixed, CRITIQUE-5 |
| M2 | The lineage page never named the build it is about, and could not open it: its row says "you are here" and is not a link | src/pages/Lineage.tsx | Fixed, CRITIQUE-6 |

---

## critique-information-density

### Cognitive Load: pass

- **Observation.** Each surface asks for one kind of decision.
  - The gallery: one lens of four, then facets folded to six options and More.
  - Home: one of two tabs.
  - The bounties board: one way into each ask ("Open the build").
  - The solvers board: nothing to choose but a person.
  - The tree: a family read top to bottom.
  - Where next: at most three rows of three.
- **Problem.** None.
- **Fix.** None.

### Content Priority: minor issue

- **Observation.**
  - At 1440 the gallery's first row of cards starts at y 466, under the header, lenses, facets and the order line; the boards' first rows at y 290 (Bounties) and y 190 (Solvers).
  - At 390 the gallery spends about 640px before its first card. The eyebrow, the title, the search field, a five-line description, the lens row (two lines), Filters, a rule and the two-line order line leave the first card's picture starting at y 660 of the 780px above the bar.
  - The description says "ordered by how many people other than their creator have run them". The order line says it again: "most reproduced first, then most recently confirmed working".
  - With a query, the order line reads "2 builds · most reproduced first, …" and does not name the query.
- **Problem.**
  - On a phone, the gallery's own content starts at the fold, behind a header that states its order twice (m2).
  - The results line is where a reader checks what they searched for, and it does not say (m5).
- **Fix.**
  - A one-line description ("Builds written down completely enough to follow."), leaving the order to the order line.
  - "2 builds match "agent"" in the order line while a query is on.

  Both deferred as minor.

### Scanning Pattern: pass

- **Observation.**
  - The bounties board and the solvers board are left-aligned lists with their figures in DM Mono tabular-nums, on one edge each: rewards, positions, tallies, counts.
  - The tree's generations step in on one connector each.
  - Where-next rows share one leading edge.
  - Gallery and Home keep the card's fixed order: picture, title, credit, plaque, chips, open ask.
- **Problem.** None.
- **Fix.** None.

### Progressive Disclosure: pass

- **Observation.**
  - Facets fold at six with More in place, and into a Filters sheet below 1024.
  - The family tree is on its own page and, once opened, in the Rebuilds tab.
  - Where next asks for nothing until the reader nears the foot.
  - The boards page with "Show more", never by infinite scroll.
- **Problem.** None.
- **Fix.** None.

---

## critique-visual-hierarchy

### Entry Point: major issue → pass after CRITIQUE-6

- **Observation.** The display headline is the entry on every phase page: "Builds worth running", "Bounties", "Solvers", "Rebuilds of this". On Home it is the tab strip and the compose strip under it. Before the fix the lineage page's headline was "Rebuilds of this" with no build named anywhere above the tree.
- **Problem.** A reader arriving at /b2/…/lineage from a link met a headline about "this" and had to find the "you are here" row to learn what "this" was (M2).
- **Fix.** CRITIQUE-6: the eyebrow names the build ("INBOX TRIAGE AGENT, REBUILT FOR A SHARED SUPPORT MAILBOX" in the fixture). Re-shot at all four widths in both rooms.

### Eye Flow: pass

- **Observation.**
  - Gallery: eyebrow → headline → lenses → facets → order line → grid.
  - Boards: headline → sentence → rows, read across (reward → ask → way in; position → person → tally).
  - Lineage: the root, then down the connector.
  - Build page: the tabs, then where next's rows in intent order.
- **Problem.** None.
- **Fix.** None.

### Weight: minor issue → pass after CRITIQUE-5

- **Observation.** Before the fix, each where-next card's heaviest element was its outcome sentence, set large and bold in the empty media well, heavier than its own title. Titles on the boards are 16–17px against DM Mono 12–16 figures; the headlines are Bodoni at 30–48px.
- **Problem.** The where-next cards inverted the card's hierarchy, part of M1.
- **Fix.** CRITIQUE-5: the cards carry their pictures, and the title takes its with-picture size.

### Emphasis: minor issue

- **Observation.**
  - One filled control per desktop view: Home's New; nothing filled on the boards, the gallery or the lineage page.
  - On the phone, Home shows two filled controls that open the composer: the strip's New and the bar's New build.
- **Problem.** Two equal primaries doing one thing (m7, phase 2's m2, carried).
- **Fix.** The compose strip's New drops its fill on the phone, where the bar's New build is always present. FeedShell.tsx; deferred as minor.

---

## critique-affordance

### Clickability Signals: pass

- **Observation.**
  - Text links are underlined at rest: Solvers, Open the build, tree titles.
  - Row actions are outline buttons, full width below 1024 on the board.
  - Lens and facet chips are outlined, and selected ones take row 5's fill and Check.
  - Every new control has a hit area of 44px or more, measured in RC-P12 to RC-P14.
- **Problem.** None.
- **Fix.** None.

### State Visibility: pass

- **Observation.**
  - Selected lens and facet: --recess fill, --text border, Check (STATES.md row 5).
  - Home's tabs: an --action underline.
  - The tree: "you are here", aria-current.
  - Focus: the theme's one ring on the lens links, the facet chips, the text links, MakerLink and the tree's titles. On Noon the ring measures 1.8:1, the owner-escalated survivor of STATES.md row 9; on Dusk 7.47:1.
  - Loading: skeleton rows on the boards and the tree.
- **Problem.** None new; the Noon ring stays escalated.
- **Fix.** None.

### CTA Clarity: pass

- **Observation.** Labels name their acts: "Open the build", "Show more", "Clear filters", "See open bounties", "Rebuild this", "Browse the gallery", "Try again". Empty states give one sentence and one action, secondary where the frame spends the primary.
- **Problem.** None.
- **Fix.** None.

### Action Discoverability: major issue → pass after CRITIQUE-6

- **Observation.**
  - Every row and card on the phase's surfaces goes somewhere.
  - The lineage page offered every build in the family except the one it was about: its row is "you are here", not a link, by RC-P14's design.
  - The bounties board reaches the solvers board through "Solvers".
- **Problem.** A reader on a build's lineage page could not open that build from it (M2).
- **Fix.** CRITIQUE-6: "Open the build", a text link at the trailing end of the title row, as "Solvers" is on the bounties board.

---

## critique-composition

### Balance: minor issue

- **Observation.**
  - At 1440 the wide frame's boards sit on the column's leading edge: the solvers list at 720 (x 312–1032) and the bounties rows at 960 (x 312–1272). The ground to their right is empty.
  - On /bounties the title row and the facet rule run to x 1392, so "Solvers" sits 120px past the rows' edge.
- **Problem.** The board's right edge and its header's disagree, and the Solvers link reads as the page's rather than the board's (m10). The solvers board is left-heavy at 1440 (m11, LOW).
- **Fix.**
  - One 960 column for the whole bounties page: header, facets and rows in one new wrapper.
  - The solvers list may keep its 720 (a ranked list is read down, not across).

  Both deferred as minor.

### Whitespace: minor issue

- **Observation.**
  - Home's tab strip starts at y 0 on the desktop, while the nav starts 24px down (m8).
  - Every wide route's document is 24px taller than the viewport (1440×924 captured at 900; 1024×792 at 768), so the page scrolls 24px (m9).
  - At 390 the lineage page's "Open the build" wraps under the title, between title and sentence (m13).
- **Problem.**
  - A strip flush with the top edge reads as cut off.
  - The 24px scroll is a stray scroll on every wide page.
  - The wrapped link sits between the headline and its sentence.
- **Fix.**
  - Home's column takes the nav's 24px top inset (FeedShell).
  - The wide frame's height accounts for its inset (flat-shell.css: frame, outside the phase's files).
  - The link keeps its place.

  All deferred.

### Rhythm: minor issue

- **Observation.**
  - Within a gallery row, cards end at different heights, because titles run to one or two lines (phase 2's m19, carried) (m6).
  - Where next's cards are 192px at 768 and 205px at 1024, and titles clamp mid-phrase ("Inbox triage for on-call, with…") (m12).
  - Rows on both boards keep one height step and one hairline.
- **Problem.** Ragged row bottoms, and truncated titles at the narrow widths.
- **Fix.**
  - The gallery grid stretches a row's cards to the tallest.
  - Where next's grid keeps two columns in the md band and three from 1024. The card is fixed by the theme.

  Deferred.

### Gestalt Principles: major issue → minor issue after CRITIQUE-5

- **Observation.**
  - *Similarity:* the gallery, Home and where next all draw GalleryCard. Before the fix, where next's cards carried only their header columns, so each drew its outcome sentence in the media well where the gallery and Home show the cover. The same build ("Support reply suggester") appeared as two different-looking cards within one visit.
  - *Proximity:* rows and groups separate by the scale (8/16/24/40).
  - *Continuity:* see Balance (m10).
  - *Figure-ground:* the cards and boards on the room's ground, the dashed edges as the asks.
- **Problem.** The card's promise, one look everywhere, broke at the foot of the build page (M1).
- **Fix.** CRITIQUE-5: where next reads its rows through the gallery's own card select and embed caps (gallerySelect, withCardEmbeds, toGalleryBuild), and signs the covers as the gallery does. The remaining minor is m10.

---

## better-ui

**Surfaces: one component, one surface**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM (fixed) | src/lib/build/whereNext.ts; src/components/build/WhereNext.tsx | Where-next cards built from header columns: no picture, the outcome sentence set large in the media well | The gallery's card data and signed covers (CRITIQUE-5) | The same card must be the same surface everywhere it appears (M1) |

**Every state needs a static cue**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/pages/Bounties.tsx (SolversLink), src/pages/Lineage.tsx (OpenBuildLink), src/components/build/RebuildTree.tsx (TitleLink), src/components/profile/MakerLink.tsx | Text links have rest and focus states, no hover | A 2px underline on hover, gated to fine pointers | Hover confirms a target before the click (m15) |

**Transition only what changes**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| — | src/components/gallery/LensRow.tsx; FacetRail.tsx | `feedback("color", "background-color")` on chips | No change | Named properties, no `transition: all`: passes |

**Verification.** States were read from the code for every phase control: rest, hover, focus, selected, loading, empty and error. Motion was read from the code: the lens chips' colour transition is the phase's only one, and where next dropped its reveal in DISCOVERY-5. Not verified: motion at 10% speed (no new animation to replay).

**Approve.** No HIGH. The LOW stays as work to do.

---

## better-layout

**Align to shared edges**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | src/pages/Bounties.tsx (the board column's maxWidth 960 against a full-width header and FacetRail) | At 1440 two right edges: rows at x 1272, the title row and the rule at 1392 | Header, facets and rows in one 960 column | The Solvers link and the rule float off the board (m10) |

**Order by importance**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| MEDIUM | src/pages/Gallery.tsx, the header's description at 390 | About 640px of header before the first card; the description restates the order line | A one-line description | The phone meets the gallery's content at the fold (m2) |
| LOW | src/pages/Lineage.tsx at 390 | "Open the build" wraps between the headline and its sentence | Accept, or move it under the sentence at phone widths | The sentence belongs to the headline (m13) |

**Hold structure until it breaks**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/gallery/LensRow.tsx at 390 | Four lenses wrap three and one; UNSOLVED alone on the second line | One row: the chips' inline padding down a step at phone widths | The single-select row reads as two groups (m3) |
| LOW | src/components/build/WhereNext.tsx, 768–1023 | Two columns: cards 192px at 768, titles clamp | Accept (three columns gave 120px; measured) | The narrowest band of the wide frame (m12) |

**Plan for clipping**

| Severity | Location | Before | After | Why |
|---|---|---|---|---|
| LOW | src/components/shell/flat-shell.css (the wide frame) | Every wide route's document is 24px taller than the viewport | The frame's height minus its inset | A stray 24px scroll on every wide page (m9); outside the phase's files |
| LOW | src/components/feed/FeedShell.tsx | Home's tab strip at y 0 on the desktop | The column's top inset matches the nav's 24 | The strip reads as clipped (m8) |

**Verification.**
- No horizontal overflow at 390: asserted by bounties-board, solvers-board, lineage-rebuilds (six generations deep) and where-next.
- 768, 1024 and 1440: read from the 72 screenshots and the RC-P14b measurements.
- DOM order matches reading order on every phase page.
- Not verified: 200% zoom, the RTL mirror, pseudo-localisation.

**Approve.** No HIGH row. The MEDIUMs and LOWs stay as work to do.

---

## hicks-law: Choice Audit

Decision points in the order a reader meets them.

| Decision point | n | Criterion | Default | Depth | Scent | Budget | Competing emphasis | Rating |
|---|---|---|---|---|---|---|---|---|
| Gallery lens row | 4 | Intent: All, Proven, Rebuilt, Unsolved | All | 1 | Labels; the order line counts the result ("8 builds") | Exactly 4 (gallery.budget.test.tsx) | The selected chip only (row 5) | pass (wraps 3 + 1 at 390, m3) |
| Gallery facet: Made for | 6 visible (of 7), then More | Frequency, count descending; a selected option always visible | None | 1 (More in place; the Filters sheet below 1024) | Counts, but over the whole gallery, not the lens: "founder 3" under Proven | ≤ 6 then More; ≤ 2 groups | None | minor (m4) |
| Gallery facet: Made with | 6 visible (of 8), then More | Frequency | None | 1 | Counts, not lens-aware ("Claude 10" over 8 proven builds) | ≤ 6 then More | None | minor (m4) |
| Home tabs | 2 | Intent: the people you follow, then everyone | Following for a reader who follows anyone, else Everyone | 1 | Labels; the feed under each | Exactly 2 (home.budget.test.tsx) | The compose strip's New, the view's one primary (two on the phone, m7) | pass |
| Bounties facet: Made with | 5 | Frequency, count descending, then name | None | 1 (the Filters sheet below 1024) | Ask counts | 1 group, ≤ 6 (bounties.budget.test.tsx) | None: nothing filled while there are rows | pass |

- **Lens row.** Four intents in a single-select row, All by default. The order of builds does not change between lenses; only the set does. **pass.**
- **Facets (gallery).** Frequency-ordered, folded at six. Their counts describe the whole gallery, so under a lens they over-promise: "Claude 10" leads to at most the lens's eight. **Fix:** count within the lens (gallery_facets with the lens's filters). **minor, deferred.**
- **Home tabs.** Two, defaulted by whether the reader follows anyone. **pass.**
- **Bounties facet.** One group, five tools, counts of open asks. **pass.**

**Noted outside the decision points.**
- On the desktop, /gallery shows two identical "Search builds" fields: the nav's and the page's. Both carry the query (m1): two routes to one destination ⟦hicks-law › Common Failure Patterns⟧. The page's field exists for the phone, where the nav has none. **Fix:** hide the page's field at 768 and up, or the nav's on /gallery. Deferred as minor.
- The search results line does not name the query (m5).

---

## law-of-similarity: the card on /gallery, / and where next

- **/gallery.** GalleryCard in the grid layout: the cover in a fixed slot, then the title, the rebuild credit, the plaque (reproductions and freshness together), the chips, and the open ask on a dashed edge.
- **/ (Home, both tabs).** The same GalleryCard, with the layout the feed has used since BG-P09. The same order and treatment; the picture takes its own shape at the column's width.
- **Where next, before CRITIQUE-5.** The same component with different data. The rows carried only header columns, so the covers were missing and the pill was never asked for. Each card drew its outcome sentence, set large, in an empty media well, and the title stepped up a size. The same build ("Support reply suggester") looked like two different cards on one visit (M1).
- **Where next, after CRITIQUE-5.** The rows read through the gallery's own card select and embed caps, and the covers are signed as the gallery signs them. Re-shot at 390, 768, 1024 and 1440 in both rooms: the covers are in, and "Support reply suggester" carries its dashed edge and "1 part unsolved · £150", as in the gallery.

**Identical across the three: yes**, after CRITIQUE-5. The Home feed's picture sizing is the card's feed layout, which is part of the card's own definition.

---

## buildgallery-theme: Before you call it done

The phase's surfaces: the lens row and facet band, the gallery's search field and makers row, Home's two tabs and suggestions, the bounties and solvers boards, the rebuild tree (tab and page), where next.

1. **Both themes checked.** PASS. 72 screenshots in both rooms, before and after the fixes.
2. **Every colour a semantic token.** PASS. The phase's files use `t.*` only; src/lib/theme/compliance.test.ts passes.
3. **Every new pairing measured; no amber text on Noon.** PASS.
   - Contrast probes on /bounties, /bounties/solvers, the lineage page and the build page with where next in view: 0 text failures in both rooms, at 390 and 1440 (RC-P13, RC-P14, RC-P14b).
   - Amber appears only as light: the freshness lamps and the focus ring (Noon 1.8:1, escalated, STATES.md row 9).
4. **Radius from the scale.** PASS. Chips at --r-chip, rows and buttons at --r-control, cards at --r-card. Nothing pill-shaped; avatars are circles.
5. **Glass.** PASS. audit:glass passes. Where next in view: 9 blurred surfaces on the desktop and 11 on the phone, one blur value, nothing nested. The tree, the boards and the tab add none.
6. **Display face ≥ 20px; body ≥ 400 under 18px.** PASS. Headlines through PageHeader's sectionHead; everything else Figtree or DM Mono.
7. **Reproduction and freshness together under the title.** PASS on every card: gallery, Home, and where next (whose cards kept the plaque even before CRITIQUE-5; the covers were what was missing). The tree's rows carry the reproduction count alone, as RC-P14 specifies and as the Rebuilds tab's rows always have.
8. **A gap keeps its category chip and reads as an invitation.** PASS. The Unsolved card's dashed edge and "1 part unsolved · £150" in the gallery and, after CRITIQUE-5, in where next. The board's rows carry row 13's dashed edge; "No reward" is --text2, never red.
9. **Motion gated; nothing animates layout.** PASS. The lens chips transition colour and background only. Where next dropped its reveal (DISCOVERY-5; motion.test.ts). Skeletons stop under reduced motion.
10. **No horizontal overflow at 390 / 768 / 1400.** PASS. Asserted at 390 by four tier-3 specs; 768, 1024 and 1440 read from the screenshots and measured in RC-P14b.
11. **States designed.** PASS. Every board and tree has populated, loading (row 20), empty (row 19) and error (row 21) states. Hover and focus on every control, selected on chips and tabs. Disabled: n/a.

---

## Re-rated after the fixes

The screenshots were re-taken after CRITIQUE-5 and 6: 72 files, the same nine addresses, four widths and two rooms. The corrected fixture also gives the bounties board its real answer counts ("2 solutions", "1 solution").

| Finding | Was | Now | Evidence |
|---|---|---|---|
| M1 where-next cards | major (Gestalt: Similarity); minor (Weight) | pass | build-foot-{390,768,1024,1440}-{noon,dusk}.png show covers and the open-ask pill; whereNext.test.ts holds the rows' embeds equal to listGallery's |
| M2 lineage page | major (Entry Point; Action Discoverability) | pass | lineage-*.png name the build in the eyebrow with "Open the build"; Lineage.test.tsx |
