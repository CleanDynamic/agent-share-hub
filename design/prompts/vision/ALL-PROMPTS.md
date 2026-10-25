# Vision series: all prompts (VB-00 to VB-16)

The series README comes first; each prompt follows in run order.

---

## Vision series (VB-00 to VB-16)

The vision board redraws Home, Gallery (now Builds), Bounties (now OpenBuilds), Library and Drafts, and adds the composer's Add from Library window. These prompts build it. Each prompt names the board it must match and states what exists, what is new, and what stays out.

### Order

Run after CA-35 has merged (CA-31 and CA-33 own page and list motion; CA-35 deletes and moves files). Then in number order, one at a time, each after the one before has merged.

| Prompt | What it does | Board |
| --- | --- | --- |
| VB-00 | Names, routes, nav, shared pieces, the compare harness for these boards | none |
| VB-01 | Home | `home` |
| VB-02 | OpenBuilds page | `openbuilds` |
| VB-03 | Builds: Table | `builds-table` |
| VB-04 | Builds: Maps | `builds-maps` |
| VB-05 | Builds: Classification | `builds-classification` |
| VB-06 | Library | `library` |
| VB-07 | Composer: Add from Library window | `composer-add-from-library` |
| VB-08 | Drafts | `drafts` |
| VB-09 | Activity: one read for Home, Library and notifications | none |
| VB-10 | Contributor credit on tiles and sessions | none |
| VB-11 | Saved items below build size, collection kinds | none |
| VB-12 | Node versions, so a saved step knows it was edited | none |
| VB-13 | Notifications about builds | none |
| VB-14 | OpenBuilds requests: session and part size, claims, briefs, reviews, model release check | none |
| VB-15 | Builds: stored counts, Works on model, runs per week, filter sets, filter layout, columns | none |
| VB-16 | Build page: Save on every size, Used in, In collections, classification links, contributors | none |

VB-01 to VB-08 build each page's look exactly and wire the data that already exists. A section whose data does not exist yet is built in the view and shown on the dev page, and is not drawn on the live page until its data prompt (VB-09 to VB-16) lands. Nothing on a live page is faked.

### The boards

- `design/reference/vision/dusk/<board>.html`: standalone HTML, 1440 wide, Dusk. **Values in these files are exact.** Sizes, padding, gaps, radii, type sizes and weights, letter-spacing, borders and shadows are ported as they are. Open a file directly in a browser.
- `design/reference/vision/index.json`: the list of boards, their heights and their dev pages, read by `npm run audit:design`.
- `design/reference/vision/source/<Board>.dc.html`: the boards' sources. The sample data each board draws is in the `<script type="text/x-dc">` block at the end; the dev fixtures copy it from there.
- `design/screens/vision/<board>.png`: a render of each board, for looking at. When the HTML and the picture disagree, the HTML wins.

Every name, handle, number, date and sentence in a board is sample content. It is used only by the dev pages. The live page shows live data.

There is no Noon board. Build with tokens only, so Noon follows; check it with `npm run audit:themes` and `npm run audit:contrast`. There is no phone board; each prompt states the phone order.

### Visual grammar (from the boards and the reference screenshot)

These are the rules the boards follow. A choice the boards do not cover follows these.

1. **Frame and surface.** The header sits on `--frame` with no background or border. Below it, one surface: `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `40px clamp(16px, 5vw, 76px) 0` (Home: `24px clamp(16px, 2.2vw, 32px) 0`). The footer is inside it, with a hairline above.
2. **Few boxes.** Sections sit on the surface with no box. A box (module: `--module`, 1px `--module-border`, radius 8, padding 16) is used only where a board draws one: a card in a grid, the one inner tile on a page, a selected item's panel.
3. **Section head.** Title 14/500, line-height 1.3; meta line 12/400 `--label` under it, 2px apart; a 28px chevron button top right (`--control`, 1px `--control-border`, radius 6) that opens the section's page.
4. **Figure and meta.** A page's leading number is 20/500, -0.015em (Home's room: 32/500, -0.02em). Its meta line is 13 `--text2` with at most two clauses coloured by meaning: `--evidence` for worked or growth, `--cat-breakage` for failed, `--lit` for not tested or edited.
5. **Rows.** Hairline (`--hairline`) between rows, none after the last. Label left, value right. Min-height 40, 44, 48, 52 or 56 as the board draws it. Numbers right-aligned and tabular.
6. **Plain values.** Values are text. The only chips are the grey mono type chips (`STEP`, `PROMPT`: Geist Mono 10.5, line-height 18, padding `0 6px`, radius 4, `--control` fill, `--text2` text) and active filter chips (control recipe). The Plaque's evidence pill is used where `Plaque` is used today, not in table cells.
7. **Space.** 48 between groups on a page, 28 between items in a list of requests, 24 between cards, 16 inside modules, 72 or 56 between columns. Columns are separated by whitespace; Home alone keeps its hairline column rules.
8. **Colour only on data.** Bars, lamps, the coloured meta clauses, and states (`Edited` in `--lit`, `Removed` in `--cat-breakage`). The lamp is a 3px bar, radius 1, `--lit`, `--lamp-glow`; dimmed is the existing dimmed treatment from `Plaque`. Never amber text except a state word the board colours.
9. **One primary per view.** `--action` fill, `--on-action` text 500, radius 6, height 32. Every other action is a control.
10. **Tabs** are text buttons 36 high with a 1px `--text` underline on the selected one, over a hairline. **Segmented controls** are a `--well` track with 2px padding and a raised `--control` segment.
11. **Texture.** The dot grid (`radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px) only inside Maps and covers.
12. **Never.** Glass, blur, glow other than the lamp, gradients, icons inside labelled buttons, emoji, em dashes in shown copy, hover fades, scroll reveals.

### Colours: board value to token

The boards are written in raw Dusk values. Code uses `t.<token>` from `@/lib/theme/tokens`, never a hex.

| Board value | Token | Board value | Token |
| --- | --- | --- | --- |
| `#0F0F10` | `--frame` | `#EDEDEF` | `--text` (and `--action`) |
| `#19191B` | `--surface` | `#A0A0A6` | `--text2` |
| `#232326` | `--surface-border` | `#8E8E94` | `--label` |
| `#1E1E21` | `--module` (or `--window`) | `#26262A` | `--hairline` |
| `#29292D` | `--module-border` | `#34343A` | `--line` |
| `#232327` | `--tile` | `#121214` | `--on-action` |
| `#2E2E33` | `--tile-border` (or `--window-border`) | `#F5CB4C` | `--lit` |
| `#141416` | `--well` | `#86D193` | `--evidence` |
| `#27272B` | `--control` (and `--well-border`) | `rgba(134,209,147,.12)` | `--evidence-fill` |
| `#323237` | `--control-border` | `#E5807F` | `--cat-breakage` |
| `#2F2F34` | `--control-on` | `rgba(229,128,127,.12)` | `--cat-breakage-fill` |
| `#222226` | `--selected-fill` | `#8E8E95` | `--selected-edge` |
| `rgba(255,255,255,.055)` | `--dot-grid` | `rgba(0,0,0,.55)` | `--scrim` (the token value wins) |

`#5A5A60` and `#4A4A50` (drag grips, Map lines, not-tested bars) are not tokens: use `--line`, and list each place in the report. `#82A9E8` appears only in the boards' NEW notes, which are not built. Avatar colours come from `Avatar`; model marks come from `markFor` and the real logos (the boards draw placeholder letter tiles).

### How to work (every prompt)

- **Pull main first.** Check every name this prompt uses against the files: `grep` it, with every match. The file on disk wins. A name that is wrong or renamed is used as it is on disk and noted in the report.
- **Part 0 ends with written `Assumptions` and a `Plan`** (one line per part, with how it is verified).
- **Views are built apart from data.** `src/pages/site/<page>/<Name>View.tsx` is pure: typed props, no fetching, no `useAuth()`, no router hooks but `Link`. `<Name>Page.tsx` loads through `src/lib/<domain>/` functions only (query keys `['<domain>', '<fn>', ...args]`), maps the results to props, and renders the view. No Supabase call in a component.
- **Styling** is inline through `t` and the type roles in `@/lib/theme/type`. No new CSS classes. Keyframes only in `src/index.css`.
- **Dev page.** `src/dev/fixtures/vision/<board>.ts` maps the board's sample data (copied from its source file) to the view's props; the view renders at `/dev/kit/pages/vision-<board>` with `data-design-ready="true"` once fonts and data are in. Heavy routes and every `/dev/*` page are `React.lazy`.
- **Tests first.** Every behaviour a part adds starts as a failing test. Select by role and accessible name, or `data-testid`; never by class.
- **States.** Populated, loading (the existing `LoadingBlocks`, sized like the content), empty (one line and one action), error (one sentence and Retry). The boards show populated only.
- **Accessibility.** Real `<a>` and `<button>`, an accessible name on every icon-only control, `aria-current="page"` on the current nav item, no text under 10px, touch targets 44px on phone, inputs 16px on phone, reduced motion honoured.
- **Data rules.** Named columns, `.limit()` on every list, `(select auth.uid())` in policies. Never `select('*')`. `src/integrations/supabase/types.ts` is generated: cast at the call site, never edit it.
- **Migrations.** Never applied from Claude Code. Write the file (`YYYYMMDDHHMMSS_snake_case.sql`, after the newest one), correct whether or not a column already exists (`IF EXISTS`, catalogue lookups), with its `EXPLAIN` check in the header, and give Miles the Lovable message.
- **Never** install a dependency (propose it and stop), skip or disable a test, call `award_xp`, send repository files to an outside service, or fetch the site's domain.
- **Changes are surgical.** Unrelated dead code goes in a `Dead code seen` list in the report.
- **Questions go in the report.** Miles is not watching the session.
- **Checks before commit:** `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`, `npx playwright test e2e/tier1 --project=desktop --project=mobile`, and `npm run audit:design -- --grep "vision/dusk/<board>"` within the prompt's threshold.

### Report (every prompt)

```
PASS / FAIL
Compared boards: <board · diff %, or "not comparable: why">
Verified by: <commands run, with results>
Built but not live yet: <sections waiting on a data prompt, and which>
Names that differed from this prompt: <prompt name → name on disk>
Raw values without a token: <value · where · token used>
Dead code seen: <list>
Questions: <list>
Not covered: <list>
```

Then `What Miles needs to do`: merge, Publish › Publish changes, and any Lovable message or migration the prompt names.

---

## VB-00 Foundation: names, routes, shared pieces, compare harness

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

Every later VB prompt needs four things in place: the new page names in the nav, routes for them, the shared drawing pieces the boards repeat, and the compare harness reading the vision boards. This prompt builds those and nothing else. No page changes its layout here.

### Order

After CA-35 has merged. Before VB-01.

### Part 0 · Read and plan

1. Pull main. Read `src/components/shell/siteNav.ts`, `src/components/shell/breadcrumbTrail.ts`, `src/App.tsx` (the `/gallery` and `/bounties` routes), `src/components/shell/navBudget.test.tsx`, `src/components/shell/siteNav.test.ts`, `src/pages/dev/KitPages.tsx`, and `e2e/audit/design-compare.spec.ts`.
2. Open every board in `design/reference/vision/dusk/` in a browser, and `design/reference/vision/index.json`.
3. List the primitives that already exist for each shared piece in Part 3 (search `src/components/brand/`, `src/pages/site/compose/refinedStyles.ts`, `src/pages/site/compose/composeControls.tsx`, `src/components/brand/LampDot*`, `Plaque`, `Avatar`, `Glyph`, `Icon`). A piece that exists is reused, not rebuilt.
4. Write `Assumptions` and `Plan`.

### Part 1 · Names and routes

The nav reads, in order: **Home, Builds, OpenBuilds, Library, Drafts**. "Builds" replaces "Gallery". "OpenBuilds" (one word, capital B) replaces "Bounties".

1. Failing tests first: `siteNav.test.ts` and `navBudget.test.tsx` expect the new labels; a test that `/gallery?x=1#y` lands on `/builds?x=1#y` and `/bounties` on `/openbuilds` with search and hash kept; `sectionForPath` returns the Builds section for `/builds`, `/gallery`, `/b2/*` and `/rebuild/*`, and the OpenBuilds section for `/openbuilds`, `/openbuilds/*` and `/bounties/*`.
2. `PRIMARY_LINKS`: labels `Builds` and `OpenBuilds`, hrefs `/builds` and `/openbuilds`. Keep the `SITE_NAV` keys (`gallery`, `bounties`) so no caller breaks; change their values.
3. Routes: `/builds` renders what `/gallery` renders today; `/openbuilds` renders what `/bounties` renders today. `/gallery` and `/bounties` redirect with `replace`, keeping search and hash. Sub-routes (`/bounties/:bountyId/solve`, `/bounties/solvers`) keep working at their old paths and gain `/openbuilds/...` equivalents.
4. Breadcrumbs, the phone bottom nav, the profile drawer's nav list and any page title that names the section use the new names. Copy on legacy pages is not touched.
5. Commit: `VB-00 Part 1: Builds and OpenBuilds names and routes`

### Part 2 · Compare harness for the vision boards

1. `design-compare.spec.ts` also reads `design/reference/vision/index.json` (entries have `kind: "vision"`). A vision board's test title is `vision/<theme>/<page>`. Its dev page URL is `board.devPage` with `?theme=dusk&viewport=desktop`. The refined boards are unchanged.
2. Register eight lazy dev pages in `KitPages.tsx`: `vision-home`, `vision-openbuilds`, `vision-builds-table`, `vision-builds-maps`, `vision-builds-classification`, `vision-library`, `vision-composer-add-from-library`, `vision-drafts`. Until its page prompt lands, each renders one line, "Not built yet", with `data-design-ready="false"`, so the harness skips it.
3. Verify: `npm run audit:design -- --grep "vision/"` lists 8 boards, all skipped, and the refined boards behave as before.
4. Commit: `VB-00 Part 2: compare harness reads the vision boards`

### Part 3 · Shared pieces

Build only the pieces that do not already exist. Each takes props, styles through `t`, and has a unit test for its accessible name and its token use. The values below are from the boards; the board HTML is exact.

| Piece | What it draws |
| --- | --- |
| `SectionHead` | title 14/500 line-height 1.3, meta 12 `--label` 2px below, optional chevron button (28 square, `--control`, 1px `--control-border`, radius 6, a 12px chevron in `--text`) with an accessible name "Open <section>" |
| `PageFigure` | the leading number (20/500, -0.015em, line-height 1.2; `size="room"` gives 32/500, -0.02em, 1.1) and a meta line of 13 `--text2` built from parts, each part plain or toned `evidence`, `breakage` or `lit` |
| `PlainRow` | label left, value right, a hairline under every row but the last, `minHeight` 40 / 44 / 48 / 52 / 56 |
| `TypeChip` | Geist Mono 10.5, line-height 18, padding `0 6px`, radius 4, `--control` fill, `--text2` text, upper case |
| `FilterChip` | control recipe, height 26, radius 6, 12px: a `--label` key, the value in `--text`, an 18px remove button named "Remove filter <key>" |
| `UnderlineTabs` | text buttons 36 high, 20 apart, 500 weight, `--text2`; the selected one `--text` with a 1px `--text` underline over the row's hairline; `role="tablist"` |
| `Segmented` | `--well` track, 1px `--well-border`, radius 6, padding 2, gap 2; the selected segment `--control`, 1px `--control-border`, radius 4 |
| `InnerTile` | the one boxed tile a page may have: `--module`, 1px `--module-border`, radius 8, padding `14px 16px` |
| `DashedSlot` | an open slot: transparent, 1px dashed `--label`, radius 6 (or 8 for a page-width slot) |

The lamp is the existing lamp (`LampDot` or the Plaque's lamp). Do not build a second one.

Commit: `VB-00 Part 3: shared pieces for the vision pages`

### Part 4 · Checks

All the checks in the README. `npm run audit:design` must show the refined boards unchanged.

### What Miles needs to do

Merge, then Publish › Publish changes. Old links to `/gallery` and `/bounties` keep working.

---

## VB-01 Home

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

Home becomes three columns: the maker's own work on the left, a feed of build posts in the centre, the site's activity on the right. It must match `design/reference/vision/dusk/home.html`.

### Order

After VB-00.

### Source

- Board: `design/reference/vision/dusk/home.html` (1440 × 2340), picture `design/screens/vision/home.png`, sample data in `design/reference/vision/source/Main.dc.html`.
- Today: `src/pages/site/home/HomeView.tsx`, `HomePage.tsx`, `homeModel.ts`; `src/components/gallery/FeedPost.tsx` (the post, as the composer previews it); `src/lib/feed/getBuildFeed.ts`.

### Layout (exact values are in the board)

- Surface padding `24px clamp(16px, 2.2vw, 32px) 0`. Columns `280px minmax(0, 628px) 300px`, centred, no gap. The centre column has a 1px `--hairline` left and right. Left column padding `8px 28px 48px 4px`, sections 32 apart with a hairline between. Right column padding `8px 4px 48px 28px`, the same.
- Below 1100px the left column is hidden. Below 760px one column: a single row above the feed linking to Drafts ("3 drafts in progress · 8 sessions"), then the feed, then the right column's sections in order.

#### Left column, top to bottom

1. **Since you were last here**: section head, then a timeline: a 9px dot per line (`--evidence` worked, `--cat-breakage` didn't, `--text2` rebuild, `--text` answer), a 1px `--hairline` joining the dots, a 500 title, a 12 `--label` detail, the age on the right.
2. **Continue editing**: section head with chevron to Drafts; three rows (48 high): title (an untitled one in `--text2`), "n sessions · edited <age>" in Geist Mono 10.5.
3. **Your sessions**: section head with chevron to Drafts; two rows (52 high): model mark, title, "<tool> · <date> · In n drafts" in mono, a 28 `+` button named "Add to a new build".
4. **Your week**: seven day bars (6 high, today dashed), then three challenges, each a 12.5/500 title, "n / m" on the right, and a 4px bar.

#### Centre column

1. `UnderlineTabs` Following, Everyone; on the right a `Segmented` All, Builds, Rebuilds, Notes, Asks.
2. A pill "n new since you looked" (28 high, `--module`, 1px `--module-border`, radius 14), shown only when n > 0.
3. Feed items, separated by hairlines:
   - **build**: `FeedPost` as it is. The author row, the post (heading 28/500, body 16/1.55, post counter "1 / 4"), the picture grid, Show more, the build line (title, Plaque, pattern mark), the two classification lines, `EngagementRow`. The board draws post links as a `--row-highlight` fill with the part number; see Part 4.
   - **repro note**: 28 avatar, "@kit ran <build>, and it worked on <model>" (a failed run says "and it didn't work" in `--cat-breakage`), the note in 12 `--text2` (with the lamp before it when it worked), the age.
   - **rebuild**: author row "@dax rebuilt · 3h", the note at 16/1.55, a quote box (`--module`, radius 8, padding 10: an 88 × 58 cover, "Rebuilt from", the source title, "@handle"), the rebuild's build line, `EngagementRow`.
   - **bounty**: author row "@mira opened a step request · 6h", a box (`--module`, radius 8, padding 14): gap title 14/500 and the reward 20/500 on the right; "on <build> · n solution(s) · closes in n days"; Solve it (the page's primary) and "Me too · n".
4. End of feed: "You're up to date", "More builds", then two cards from Builds.

#### Right column

1. `PageFigure size="room"`: "14 runs", meta "Reproduced today", chevron to Activity. Two inner tiles side by side: lamp + "3" with "builds lit today", and "62" with "runs this week". Then three run rows: a state chip ("Worked" on `--evidence-fill` in `--evidence`; "Didn't" on `--cat-breakage-fill` in `--cat-breakage`), build and maker, age.
2. **Open requests**: section head with chevron to OpenBuilds, "Most needed first"; three rows: gap title, "<build> · n days left", reward right.
3. **Most run this week**: rank, 28 avatar, title and handle, count right.
4. **Where next**: a 56 × 40 cover, title, the reason in mono caps.

The footer carries the Noon, Dusk, System switch.

### Part 0 · Read and plan

Read the files above. Map every element in the board to the function that supplies it today, in a table: element → function → exists or not. Write `Assumptions` and `Plan`.

### Part 1 · The view

`HomeView` takes props for all three columns. Build every element in the board. Reuse `FeedPost`, `Plaque`, `EngagementRow`, `Avatar`, `MadeWithMarks` and the VB-00 pieces. The dev page `vision-home` renders it from `src/dev/fixtures/vision/home.ts`, copied from the board's sample data. Commit: `VB-01 Part 1: Home view`

### Part 2 · Wire what exists

| Element | Source |
| --- | --- |
| Tabs and kind filter | `getBuildFeed` (`onlyFollowing`), `matchesFilter` |
| New since you looked | rows newer than `readHomeSeen()`, counted from what is loaded |
| Build posts | `FeedPost` needs a `GalleryBuild` with `post_doc`. Read the page's builds by id in one request with `GALLERY_BUILD_COLUMNS`; if no function does this, add `getGalleryBuildsByIds(ids)` to `src/lib/build/gallery.ts` (named columns, `.limit()`) |
| Repro notes, rebuilds, bounties | the feed row's own fields; Me too through `toggleMeToo` |
| End of feed | `listGallery` |
| Continue editing | `listDraftsWithSessions`, three with something in them, latest first |
| Your sessions | the function Drafts uses for its Sessions list |
| Your week | `weeklyProgress`, `getStreakDays` |
| Runs today, lit today, this week | `countReproducedToday`, `countLitToday`, `countRunsThisWeek` |
| Latest runs | the feed's `repro_note` rows, or a new `listRecentReproductions(limit)` in `src/lib/build/signals.ts` if the feed cannot supply three |
| Open requests | `listOpenBounties({ home: "build" })`, sorted by `me_too_count` |
| Most run this week | new `listMostReproduced({ since, limit })` in `src/lib/build/signals.ts`: a count of `build_reproductions` in the window grouped by build. No schema change. Add an `EXPLAIN` note in the function's comment |
| Where next | `getWhereNextForViewer` |

**Not live yet:** Since you were last here (VB-09). The view renders it from props; the live page leaves the section out until VB-09. Commit: `VB-01 Part 2: Home data`

### Part 3 · Requests and performance

The page asks for no more than one round of parallel requests after the feed page arrives. Run `npm run audit:perf` before and after; LCP, CLS and the INP proxy must not regress. Report the request count.

### Part 4 · Post links in the feed

The board draws links in a post as `RefLinks` draws them on the build page. The feed has no `PostRefsProvider` today, so links show as plain words. Add the provider only if each build's link targets can be read for the whole page in one request; otherwise keep plain words and say so in the report. Commit: `VB-01 Part 4: post links in the feed` (or no commit, with the reason).

### Part 5 · Compare

`npm run audit:design -- --grep "vision/dusk/home"` within 4%. List every remaining difference.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-02 OpenBuilds

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

The Bounties page becomes OpenBuilds: published builds that take contributions. It must match `design/reference/vision/dusk/openbuilds.html`. This prompt builds the whole view and wires step requests (today's bounties on gaps). The other request types, claims, the model release check and groups arrive in VB-14 and VB-15.

### Order

After VB-01.

### Source

- Board: `design/reference/vision/dusk/openbuilds.html` (1440 × 1699), picture `design/screens/vision/openbuilds.png`, sample data in `design/reference/vision/source/OpenWork.dc.html`.
- Today: `src/pages/Bounties.tsx`, `src/pages/site/bounties/BountiesView.tsx`, `src/lib/bounty/*` (`listOpenBounties`, `listOpenBountyCards`, `listTopSolvers`, `toggleMeToo`, `myMeToo`), `src/lib/build/gaps.ts`.

### Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Columns `minmax(0, 1fr) 320px`, 72 apart, no rule between. Below 1000px one column, the side column after the main one.
- **Main column**, 48 between groups:
  1. **Model release check** (leads): `PageFigure` "94 of 120" with meta "Reproduced builds that work on <model> · released n days ago · <n fail> · <n not tested>", chevron. A row of one bar per reproduced build, 40 high, 2 apart (`--evidence` works, `--cat-breakage` fails, `--line` not tested). A legend, then "Run an untested build" (primary) on the right.
  2. **Requests**: `UnderlineTabs` All, Steps, Sessions, Parts, Briefs, Model tests, Reviews, and a Sort control on the right. Each request 28px top and bottom, hairline between:
     - head row: `TypeChip`, title 14/500, reward (or "No reward", "Any model") on the right;
     - meta 12 `--label`: "<build> · @maker · <origin> · <age>";
     - the problem in 13 `--text2` (step requests);
     - a body: for a step request, the build's top-level steps as tiles (`--tile`, 1px `--tile-border`, radius 6, padding `10px 12px`, "n · Type" in 11.5 `--label` over the step title), the open one a `DashedSlot` with "n · Type · open";
     - a facts line in 12 `--label` and one control on the right (Answer, Offer a session, Answer this brief, Reproduce on <model>, Reproduce to review).
- **Side column**, sections 28 apart with a hairline between, each with `SectionHead` and chevron: Your requests, Your claims, Your record (four `PlainRow`s), Groups, Top contributors (24 avatar, handle, count), then the one `InnerTile`: "This week · 60%", a two-part 6px bar, "18 of 30 requests closed".

### Part 0 · Read and plan

Read the files above. Table every element: element → function → exists or not. Write `Assumptions` and `Plan`.

### Part 1 · The view

`OpenBuildsView` in `src/pages/site/openbuilds/` with every element of the board, all request types included. The dev page `vision-openbuilds` renders the fixture. Commit: `VB-02 Part 1: OpenBuilds view`

### Part 2 · Wire step requests

| Element | Source |
| --- | --- |
| Step requests | `listOpenBounties({ home: "build" })` or `listOpenBountyCards`: gap title, `gap_problem`, reward, `closes_at`, `me_too_count`, solution count (`countSolutionsByBounty`) |
| The steps strip | the build's top-level steps around the gap, read for the page's builds in one request (named columns: `id, build_id, parent_id, type, title, position, is_gap`), numbered as `graph.ts` numbers them. If one request cannot serve the page, draw the gap tile alone and say so |
| Answer | the existing solve route |
| Me too | `toggleMeToo`, `myMeToo` |
| Sort | Most needed (`me_too_count`), Newest, Closing soon, Reward |
| Your requests | bounties whose build the reader made, with solutions not yet accepted |
| Your record: builds reproduced, answers accepted | a count of the reader's `build_reproductions` rows by others' builds; accepted `solutions` by the reader |
| Top contributors | `listTopSolvers`. If it has no 30-day window, use what it has and change the meta to match |

Only tabs with at least one live type are shown: All and Steps. **Not live yet:** the model release check, session, part, brief, model test and review requests, Your claims, and the weekly goal (VB-14); builds contributed to and maintained (VB-10); Groups (VB-15). Commit: `VB-02 Part 2: OpenBuilds data`

### Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/openbuilds"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-03 Builds: Table

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

The Gallery becomes Builds: one page with three views of the same filtered set (Table, Maps, Classification). This prompt builds the page frame, the filter panel and the Table. It must match `design/reference/vision/dusk/builds-table.html`.

### Order

After VB-02.

### Source

- Board: `design/reference/vision/dusk/builds-table.html` (1440 × 2144), picture `design/screens/vision/builds-table.png`, sample data in `design/reference/vision/source/Builds.dc.html`.
- Today: `src/pages/site/gallery/GalleryPage.tsx`, `GalleryDashboardView.tsx`, `GalleryDashboardPage.tsx`, `dashboardModel.ts`, `galleryModel.ts`; `src/lib/build/gallery.ts` (`listGallery`, `GalleryFilters`, `GALLERY_LENSES`, `GalleryFeedParams` with `patterns` and classification facet keys, `getGalleryStats`, `getGalleryFacets`, `getClassificationFacets`, `getBuildClassifications`); `src/lib/classify/taxonomy.ts` (`FACETS`, `FACET_LABEL`, `TAXONOMY`).

### Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Page head: `PageFigure` "18 builds" with meta "Of 120 published · <214 reproductions> this week · 78% confirmed in the last 120 days" (`--evidence` on the reproductions); on the right a `Segmented` Table, Maps, Classification (links; the view is in the address, `?view=`).
- 40 below: columns `256px minmax(0, 1fr)`, 56 apart. Below 1000px one column, filters first and collapsed to their heads.
- **Filter panel** (quiet): head "Filters", "n active · drag to reorder", an Add control. Then sections, each 20 top and bottom with a hairline above:
  - Saved filter sets (rows 36 high);
  - a word filter (Field, Works on model): a faint grip, the name 12.5/500, "A–Z · Count" as two text buttons (the chosen one `--text`), a checklist (14px box, label, count right, rows 30 high);
  - a number filter (Reproductions, Steps): the name and the current range on the right, a 32px histogram (in range `--label`, out of range `--line`), a two-handle slider, the end values;
  - a scale filter (Autonomy): four 6px segments in the taxonomy's order, end labels;
  - closed filters: one 44px row each, name, current value, chevron;
  - "Add a filter": the one `InnerTile` of the panel, listing every filter by group (Classification 15, Proof 6, Structure 8, OpenBuilds 3, Lineage 2, People 3).
- **Table** (leads, on the surface, no box): `UnderlineTabs` All, Reproduced, Rebuilt, Open requests (the four `GALLERY_LENSES`); Sort and Columns controls on the right. 16 below, the active `FilterChip`s and Clear all. 20 below, the table: header 11.5 `--label` 400 with the sorted column in `--text` and an arrow; rows 48 high with a hairline under each; columns Build (title 500, @maker 11.5), What was built, Field, Tools (marks), Steps, Sessions, Reproductions (number and lamp, right), Confirmed ("2d ago on Opus 5.5"), Runs 12 weeks (12 bars, 3 wide, 16 high, `--evidence`, zero weeks `--line`), Rebuilds, Open, Cost to run. The table is at least 1000 wide and scrolls inside its column. Footer row: count, most common values, median steps, total, "Add a calculation".

### Part 0 · Read and plan

Read the files above. Table every filter and column: name → source → exists or not. Decide what happens to the Gallery's feed view (Home now carries the feed): it is not a view of Builds; leave its code and list it in `Dead code seen`. Write `Assumptions` and `Plan`.

### Part 1 · The page frame and view switch

`BuildsPage` in `src/pages/site/builds/` reads the filters, sort, lens and view from the address, loads once, and passes the same builds to whichever view is chosen. VB-04 and VB-05 add the other two views; until then they render "Not built yet". Commit: `VB-03 Part 1: Builds page and view switch`

### Part 2 · Filter panel and table views

`BuildsFiltersView` and `BuildsTableView`, pure, with every element of the board. The dev page `vision-builds-table` renders the fixture. Commit: `VB-03 Part 2: filter panel and table views`

### Part 3 · Wire what exists

| Element | Source |
| --- | --- |
| Stats line | `getGalleryStats` |
| Lenses | `GALLERY_LENSES`, `countGalleryLenses` |
| Field, Task, Setting, What was built, Role of AI, Techniques, Modality, Build method, Autonomy, Data handled, Human oversight, Age suitability, Skill needed, Cost to run | classification facet keys (`facet:id`), OR within a facet, AND across; counts from `getClassificationFacets` |
| Tools and stack | `madeWith` and the stack facet |
| Shape, Patterns, Open requests | `shapes`, `patterns`, `openBounties` |
| A–Z and Count | sorts the values in the panel only; Autonomy, Age suitability, Skill needed and Cost to run keep the taxonomy's order and show "Scale order" |
| Sort | newest, reproduced, confirmed, rebuilt |
| Columns live now | Build, What was built, Field, Tools, Reproductions, Confirmed, Rebuilds, Open, Cost to run (from the build row, its open bounty, and `getBuildClassifications` for the page) |
| Footer | count, most common Field and Tools on the page |

**Not live yet (VB-15):** Steps and Sessions columns and filters, Runs 12 weeks, Reproductions as a range, Works on model, Last confirmed, Rebuilds and Likes as filters, Saved filter sets, dragging and resizing filters, the Columns chooser, Add a calculation. On the live page, Add a filter lists only filters that work. Commit: `VB-03 Part 3: Builds data`

### Part 4 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-table"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-04 Builds: Maps

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

The Maps view shows each filtered build's Map, read only: one box per session, one line wherever a tile in one session uses something from another, part labels. It must match `design/reference/vision/dusk/builds-maps.html`.

### Order

After VB-03.

### Source

- Board: `design/reference/vision/dusk/builds-maps.html` (1440 × 995), picture `design/screens/vision/builds-maps.png`, sample data in `design/reference/vision/source/BuildsMaps.dc.html`.
- Today: `src/lib/build/sessionMap.ts` and the composer's Map, `src/lib/build/graph.ts` (`sessionGroups`), `src/lib/build/sessionLayout.ts`.

### Layout (exact values are in the board)

- The same page head and view switch as the Table. Below it a row: a Filters control with the active count, the first four `FilterChip`s and "+ n more", a `Segmented` Horizontal, Vertical, and "18 builds · 14 with a Map".
- 32 below, a grid of three columns, 24 apart (two below 1100px, one below 760px). Each card is a module (padding 16): a 220px well with the dot grid holding the Map, then title 500 and "@maker · n parts · n sessions" on the left, "n reproduced" and the lamp on the right.
- In the Map: part labels in Geist Mono 10, `--label`; session boxes (`--tile`, 1px `--tile-border`, radius 6, padding `4px 7px`, 36 high) with the session name 11/500 and "MODEL · n" in mono 10; lines 1.2px in `--line`.
- A build with one session draws its one box and "One session. A Map needs two."

### Part 0 · Read and plan

Find the function the composer's Map uses to lay out sessions and find lines between them. Measure what it needs per build (rows and columns) and how many bytes that is for a page of 24 builds. Write `Assumptions` and `Plan`.

### Part 1 · The view

`BuildsMapsView`, pure, takes per build: parts, session boxes with positions, lines. Reuse the composer's layout function for positions; do not write a second layout. The dev page `vision-builds-maps` renders the fixture. Commit: `VB-04 Part 1: Maps view`

### Part 2 · Data

Build this only as far as a target needs:

1. **Read on demand.** One request for the page's builds' nodes (named columns only) and their session layout, then the composer's own functions. Target: under 300 KB and one request for 24 builds.
2. **Only if (1) misses the target:** a stored summary. Write `builds.map_summary jsonb` (parts, sessions, links) from the composer on save, as the classification facets are written 1.5 seconds after tiles stop changing. Write the migration file and give Miles the Lovable message.

Report which layer was built and the measured size. Commit: `VB-04 Part 2: Maps data`

### Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-maps"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. If Part 2 built the stored summary: apply its migration through Lovable with the message the report gives.

---

## VB-05 Builds: Classification

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

The Classification view shows each filtered build's classification as a card. Every value says where it came from, and every value links to the Table filtered by it. It must match `design/reference/vision/dusk/builds-classification.html`.

### Order

After VB-04.

### Source

- Board: `design/reference/vision/dusk/builds-classification.html` (1440 × 1451), picture `design/screens/vision/builds-classification.png`, sample data in `design/reference/vision/source/BuildsClassification.dc.html`.
- Today: `src/lib/classify/types.ts` (`declared`, `derived` with tile ids, `disputes`), `src/lib/classify/facets.ts` (`shownValues` returns the values and their `Provenance`, `regulatedArea`), `src/lib/classify/taxonomy.ts` (`FACET_LABEL`), `getBuildClassifications(ids)`.

### Layout (exact values are in the board)

- The same page head and view switch. Below it: a Filters control, a "Facets shown 8 of 15" control, and on the right the key "Under each facet: from n tiles, stated by the maker, or corrected by the maker".
- 32 below, a grid of three columns, 24 apart, aligned to the top. Each card is a module (padding 16): title 14/500, "@maker · Shape" (and " · Regulated area" when `regulatedArea` is true) in 12 `--label`, "n" and the lamp on the right. Then rows, 10 top and bottom with a hairline above: a 112px label column (facet name 12 `--text2`, under it the source in 11 `--label`) and the values as comma-separated links in 12.5 `--text`, underlined on hover.
- The default eight facets: Field, Task, What was built, Techniques, Autonomy, Tools and stack, Data handled, Cost to run.

### Part 0 · Read and plan

Confirm which facets `derive.ts` fills (the boards assume built, role, technique, modality, method, autonomy, oversight, skill, cost and stack) and which are only declared. Write `Assumptions` and `Plan`.

### Part 1 · The view and data

1. Failing tests first: a derived value with three source tiles reads "from 3 tiles"; a declared value reads "stated"; a facet in `disputes` reads "corrected"; selecting a value opens the Table with that facet key in the address.
2. `BuildsClassificationView`, pure. The live page reads `getBuildClassifications` for the page's builds, already loaded by VB-03.
3. Facets shown: a chooser of the 15 facets; the choice is kept per viewer in `localStorage` (wrapped in try/catch), default the eight above.
4. The dev page `vision-builds-classification` renders the fixture.
5. Commit: `VB-05: Classification view`

### Part 2 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-classification"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-06 Library

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

Library holds what the reader keeps from any build, says what changed in it, and hands it to the composer. It must match `design/reference/vision/dusk/library.html`. This prompt builds the whole view and wires saved builds and collections, which exist. Saving smaller things arrives in VB-11, edits in VB-12, the changes list in VB-09.

### Order

After VB-05.

### Source

- Board: `design/reference/vision/dusk/library.html` (1440 × 1119), picture `design/screens/vision/library.png`, sample data in `design/reference/vision/source/Library.dc.html`.
- Today: `src/pages/Library.tsx` (tabs Saved and Collections, `/library/:handle`), `src/lib/social/saves.ts` (`listMySavedBuilds`), `src/lib/library/builds.ts` (`listCollections`, `getCollection`, `listCollectionBuilds`, `addBuildToCollection`, `removeBuildFromCollection`, `startCollection`, `renameCollection`, `deleteBuildCollection`, `getLibraryOwner`).
- Known fault: Library › Saved shows "Something went wrong" on the live site.

### Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Columns `208px minmax(0, 1fr) 340px`, 48 apart. Below 1200px the right column moves under the others; below 800px one column.
- **Left:** "Library" 20/500, "64 saved · 5 collections"; 28 below, the kinds as rows 34 high (the selected one `--selected-fill`, radius 6): All saved, Builds, Parts, Sessions, Steps, Requests, Filter sets, each with its count. 32 below, "Collections" with New, then rows 40 high (name 12.5, "Public", "Private", "Filter set" or "Public · @handle" in 11.5 `--label`, count right), then "Ordered by your last use".
- **Main:** `PageFigure` "6 changes" with meta "Since your last visit · 3 edited · <1 removed> · <2 reproduced on Opus 5.5>", chevron. Change rows 40 high: a `TypeChip` whose text is toned (`EDITED` `--lit`, `REMOVED` `--cat-breakage`, `RUN` `--evidence`, `ANSWER` `--text`), the item 500, the detail in `--label`, the age right. 48 below: `UnderlineTabs` (the kind's own tabs; for Steps: Steps, Changed, Removed), Filters and Sort controls, `FilterChip`s and "Same filters as Builds", then a plain table: Step (title 500, "Step 7 · <build> · @maker" in 11.5), Type, State (Same `--text2`, Edited `--lit`, Removed `--cat-breakage`, Stale dimmed), Used in (right), Last used (right, sorted). The selected row has `--selected-fill`.
- **Right:** the selected item in a module (padding 16): `TypeChip`, state on the right; title 14/500; source line; a `Segmented` "Your saved version" and "Current version"; the content in a well (Geist Mono 11.5, line-height 18; a removed line struck through in `--cat-breakage`, an added line in `--evidence`); "1 line changed since you saved it on <date>"; `PlainRow`s Model, Source build (count and lamp), Used in, In collections; "Your note" textarea; Use in a build (primary), Copy, Open source. 32 below, a collection preview: `SectionHead` with chevron, three numbered rows, "Start a build from this collection".

### Part 0 · Read and plan

1. Reproduce the Saved fault locally against a faked backend (`page.route`) or report what it needs to reproduce. Find its cause.
2. Table every element: element → function → exists or not. Write `Assumptions` and `Plan`.

### Part 1 · Fix Saved

A failing test for the cause found in Part 0, then the fix. If the cause is outside this page's code, report it with a proposed patch and continue. Commit: `VB-06 Part 1: Library Saved loads`

### Part 2 · The view

`LibraryView` in `src/pages/site/library/` with every element of the board, for every kind (the selected panel adapts: a build shows its Plaque, Used in, In collections, Open; a step shows the version switch and content). The dev page `vision-library` renders the fixture. Commit: `VB-06 Part 2: Library view`

### Part 3 · Wire what exists

| Element | Source |
| --- | --- |
| Builds kind and its table | `listMySavedBuilds`: title, shape as Type, State (Same, or Stale from `isStale`), Last used from the save's time |
| Collections list, counts, public or private | `listCollections` (ordered by `updated_at`) |
| Collection preview | `listCollectionBuilds` |
| New, rename, delete, add, remove | the existing functions |
| Another reader's library | `/library/:handle`, their public collections, read only |
| Selected build: Open source, Copy | the build page link; `copyToClipboard` |

The address holds the kind, the tab and the selected item, so Back and a shared link land where the reader was. **Not live yet:** Parts, Sessions, Steps, Requests and Filter sets kinds, notes, Used in, saved-by counts and Start a build from a collection (VB-11); the version switch and Edited (VB-12); the changes list (VB-09); In collections (VB-16). The live page shows only kinds with a source. Commit: `VB-06 Part 3: Library data`

### Part 4 · Compare

`npm run audit:design -- --grep "vision/dusk/library"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-07 Composer: Add from Library

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

The composer's Add menu gains "From Library": a window that lists saved items that fit where the maker is adding, and inserts a copy that keeps its source. It must match `design/reference/vision/dusk/composer-add-from-library.html`. This prompt builds the window and its insert path. The window's entry in the Add menu is switched on by VB-11, when saved steps and sessions exist.

### Order

After VB-06.

### Source

- Board: `design/reference/vision/dusk/composer-add-from-library.html` (1440 × 900; the dev page draws the same still of the composer behind the window), picture `design/screens/vision/composer-add-from-library.png`, sample data in `design/reference/vision/source/LibraryInsert.dc.html`.
- Today: the Add menu in `src/pages/site/compose/SandboxView.tsx` and `SandboxPage.tsx`, the tile windows (`AddAgentDialog` and the rest), `src/lib/build/duplicate.ts` (`duplicateTiles`), `src/lib/build/buildHistory.ts`, `src/lib/build/forkRules.ts`, the List's ghost rows (where the composer decides what may be added inside an agent or a team), `source_ref` on `build_nodes`.

### Layout (exact values are in the board)

- The window: 640 wide, 80 from the top, `--window`, 1px `--window-border`, radius 12, `--window-shadow`, over `--scrim`. No blur.
- Head (padding `20px 20px 0`): "Add from Library" 14/500; "Inside <place> · <what> fit here" 12 `--label`; a 28 close button named "Close".
- `UnderlineTabs` Steps and Collections with counts; on the right, why a kind is missing ("Sessions do not fit inside an agent").
- A search field (32 high, `--well`).
- A radio group of saved items. Each: title 500, state on the right (`Edited since saved` in `--lit`, `Same`, `Stale`); "Step n · <build> · @maker · <model> · used in n builds" in 12 `--label`. The selected item has `--selected-fill`, 1px `--selected-edge`, radius 8, and a `Segmented` "Saved version · <date>" and "Current version · <date>".
- Footer (padding `16px 20px`, hairline above): "Copied as a new <type> with its source. @maker is credited on the tile, and their step will show used in n builds."; Cancel; Insert (primary).

### Part 0 · Read and plan

Find the function that decides what may be added at a place (inside an agent: prompts; inside a team: agents; top level: everything). Find how Duplicate writes rows and records one history step. Write `Assumptions` and `Plan`.

### Part 1 · The window

`AddFromLibraryWindow`, pure: props for the place, the items, the selection and the version. Arrow keys move the selection; Enter inserts; Escape closes; focus returns to the Add menu. The dev page `vision-composer-add-from-library` renders it over a still of the composer. Commit: `VB-07 Part 1: Add from Library window`

### Part 2 · Insert

1. Failing tests first: inserting a saved prompt inside an agent adds one prompt tile with the snapshot's method (as `forkRules` copies it), `source_ref` set to the source tile, and one undo step whose sentence names it; Undo removes it; an item that does not fit is not listed.
2. Insert goes through the same writer Duplicate uses. No second writer.
3. Credit on the tile is VB-10's; until then `source_ref` alone carries the source.
4. Commit: `VB-07 Part 2: insert from Library`

### Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/composer-add-from-library"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration. The window is not reachable until VB-11.

---

## VB-08 Drafts

Read `design/prompts/vision/README.md` first. Its rules, colour table, How to work and Report apply here.

### Intent

Drafts keeps what it does today and takes the site's layout. It must match `design/reference/vision/dusk/drafts.html`.

### Order

After VB-07.

### Source

- Board: `design/reference/vision/dusk/drafts.html` (1440 × 1179), picture `design/screens/vision/drafts.png`, sample data in `design/reference/vision/source/Drafts.dc.html`.
- Today: `src/pages/site/drafts/DraftsView.tsx`, `DraftsPage.tsx`, `draftsModel.ts`; `src/lib/build/drafts.ts` (`listDraftsWithSessions`); the Sessions list's source.

### Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Head: "Drafts" 20/500, "Pick up a build, or start one from a session." in `--text2`; Connect a tool (control) on the right.
- 48 below: columns `minmax(0, 1fr) 400px`, 72 apart; below 1100px one column.
- **Continue editing:** `SectionHead` "Continue editing", "28 drafts · latest first". 16 below, Start a new build: a page-width `DashedSlot` (radius 8, 52 high, padding `0 16px`) with a plus and "Start a new build", and "or drop a session here" on the right; it is the drop target it is today. Then rows 56 high: title 500 (an untitled draft in `--text2`), "n sessions" in 12 `--label`, "edited <age>" on the right, a chevron. Show more (control) below.
- **Sessions:** `SectionHead` "Sessions", "8 imported · drag one into a draft", "How they get here" as an underlined link on the right. Rows 56 high: grip, model mark, title, "<tool> · <date> · in n drafts" in 12 `--label`, a 28 `+` named "Start a build from this session". Dragging works as it does today.
- **Connected tools:** the page's one `InnerTile`: "Connected tools" and Manage, then one row per tool with its last import date.

### Part 0 · Read and plan

Confirm the import rows record the tool and the import time. If they do not, the Connected tools tile is left out and the report says so. Write `Assumptions` and `Plan`.

### Part 1 · View and data

1. Failing tests for every behaviour Drafts has today (open a draft, start a new build, drop a session on Start a new build, `+` on a session, drag a session into a draft, Show more), run against the new view.
2. Restyle `DraftsView` to the board. Behaviour, copy and data are unchanged.
3. The dev page `vision-drafts` renders the fixture.
4. Commit: `VB-08: Drafts in the site layout`

### Part 2 · Compare

`npm run audit:design -- --grep "vision/dusk/drafts"` within 4%.

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-09 Activity: one read for Home, Library and notifications

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

Home's "Since you were last here", Library's changes and (from VB-13) notifications show the same events. One function produces them, so the three places never disagree.

### Order

After VB-08.

### Part 0 · Read and plan

Read `build_reproductions` (`worked`, `model_used`, `note`, `confirmed_at`, `user_id`), `builds.parent_build_id` and `published_at` (rebuilds), `solutions` (`accepted_at`, `solver_id`, `bounty_id`), `isStale` and `STALE_AFTER_DAYS`, `readHomeSeen` and `writeHomeSeen`. Write `Assumptions` and `Plan`.

### Part 1 · The function

`listActivityFor({ userId, since, limit })` in `src/lib/feed/activity.ts`. It returns typed events, newest first:

| Kind | Rule | Seen by |
| --- | --- | --- |
| `run` | a reproduction by someone else of a build the reader made or saved, with worked or not, model, note | maker, savers |
| `rebuild` | a published build whose `parent_build_id` is one the reader made or saved | maker, savers |
| `answer` | a solution on a bounty the reader opened, or on a request the reader saved (VB-11) | maker, savers |
| `stale` | a build the reader made or saved that passed `STALE_AFTER_DAYS` since `since` | maker, savers |

Each event carries the ids it is about, so the view links to the canonical page. A query per kind, run in parallel, each with named columns and `.limit()`. No new table. Failing tests first, one per kind and one for the `since` boundary.

Commit: `VB-09 Part 1: listActivityFor`

### Part 2 · Home and Library

1. Home's left column renders "Since you were last here" from `listActivityFor` with `since = readHomeSeen()`. The meta reads "<age> ago · what others did with your builds". No events: the section is left out.
2. Library's changes list renders from the same function, limited to saved items, with the counts in its `PageFigure` meta. The kinds `edited` and `removed` are VB-12's.
3. Commit: `VB-09 Part 2: activity on Home and Library`

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.

---

## VB-10 Contributor credit on tiles and sessions

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

A build can hold work by more than one person. Each tile and each session records who made it, so credit is exact and travels with the method when the tile is copied.

### Order

After VB-09.

### Part 0 · Read and plan

Read `build_nodes`, `builds.making.sessions_meta`, `fork.ts`, `forkRules.ts`, `solutionRebuild.ts` (the filled tile's credit), `addSession.ts`, and `duplicate.ts`. Confirm against the live schema that `build_nodes` has no contributor column. Write `Assumptions` and `Plan`.

### Part 1 · Schema

A migration file: `build_nodes.contributor_id uuid null references profiles(id)`; null means the build's maker. Sessions record `contributor_id` in `sessions_meta[key]`. RLS is unchanged: only the build's maker writes rows. Index `(contributor_id)` with an `EXPLAIN` check in the header. Write the file and the Lovable message; do not apply it. Commit: `VB-10 Part 1: contributor column`

### Part 2 · Writers

1. Failing tests first: an accepted solution sets the filled tile's contributor to the solver; an insert from Library (VB-07) sets it to the source tile's contributor or maker; a fork keeps every tile's contributor (credit is method, not evidence); a tile the maker writes leaves it null.
2. Change only those writers.
3. Commit: `VB-10 Part 2: contributor set by its writers`

### Part 3 · Where it shows

1. The byline on the post, the card and the build page: "Maya Kent with @kit and @dax" (contributors other than the maker, by number of tiles, at most two named, then "and n more").
2. OpenBuilds "Your record": Builds contributed to (distinct builds by others with a tile of yours). Builds maintained is left out until ownership can be handed over; say so in the report.
3. Commit: `VB-10 Part 3: contributors shown`

### What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives. Publish › Publish changes.

---

## VB-11 Saved items below build size, and collection kinds

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

A reader can save a part, a session, a step, a request or a filter set, not only a build. Library lists them, collections hold them, and the composer inserts them.

### Order

After VB-10.

### Part 0 · Read and plan

Read `build_saves` and its trigger on `save_count`, `collection_items` and its `item_kind` check (the live check allows `blueprint|blog|bounty|stage|block` and `build`; confirm against the live schema), `src/lib/library/builds.ts`, `forkRules.ts`, `addSession.ts`. Write `Assumptions` and `Plan`.

### Part 1 · Schema

A migration file:

- `saved_items`: `id`, `user_id`, `kind` (`part | session | step | request | filter_set`), `build_id`, `ref` (node id, session key, part key, bounty id, or null for a filter set), `snapshot jsonb`, `source_version text null` (VB-12 fills it), `note text null`, `created_at`, `last_used_at`. Unique `(user_id, kind, build_id, ref)`. RLS: the owner reads and writes their rows; nobody else reads them.
- `collection_items`: `item_kind` also accepts `part | session | step | request | filter_set`; add `saved_item_id uuid null`, `position int null`, `note text null`.
- Builds stay in `build_saves`, so `save_count` keeps working.

Write the file and the Lovable message; do not apply it. Commit: `VB-11 Part 1: saved items schema`

### Part 2 · Save and snapshot

1. Failing tests first: saving a step stores its method as `forkRules` copies it (no `build_cost`, `run_cost`, `trace_url`); saving a session stores prompt text, model and source only (the `addSession` rule); a draft's content cannot be saved; saving twice is not an error.
2. `saveItem`, `unsaveItem`, `listSavedItems({ kind, sort, limit, after })` in `src/lib/library/savedItems.ts`. Sorts: last used, saved, changed, name.
3. Commit: `VB-11 Part 2: save, snapshot, list`

### Part 3 · Library and the composer

1. Library's Parts, Sessions, Steps, Requests and Filter sets kinds go live; notes save; "Start a build from this collection" makes a draft from the collection's items in order, each inserted as VB-07 inserts.
2. "Used in n builds": a count of tiles whose `source_ref` points at the source. Shown on the saved item and in the Add from Library window.
3. Switch on Add › From Library in the composer (VB-07's window), listing saved steps and sessions.
4. Saved-by count on a public collection: a count of readers who saved that collection (`kind = filter_set` is not this; add `collection` to `kind` if the count is built, or leave the line out and say so).
5. Commit: `VB-11 Part 3: saved items in Library and the composer`

### What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives. Publish › Publish changes.

---

## VB-12 Node versions: a saved step knows it was edited

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

Library shows `Edited` when a saved step's source changed and `Removed` when it is gone, and offers the saved and current versions. That needs a version on each node.

### Order

After VB-11.

### Part 0 · Read and plan

Confirm against the live schema whether `build_nodes` has an updated time. Read how the composer writes nodes (the save queue, `EditBuffer`, the restorer). Write `Assumptions` and `Plan`.

### Part 1 · Version

If there is no updated time: a migration adding `build_nodes.updated_at timestamptz not null default now()` and a trigger that sets it on update. A content hash is used instead only if updated times prove unreliable under the restorer (Undo writes rows back with their original ids; that is an update and moves the time, which is correct). Write the file and the Lovable message. `saveItem` stores the time in `source_version`. Commit: `VB-12 Part 1: node versions`

### Part 2 · States and versions

1. Failing tests first: a source edited after the save reads `Edited`; a source deleted or unpublished reads `Removed` and the snapshot stays usable, credited to its maker; the version switch shows the snapshot and the current content, with changed lines marked.
2. `listActivityFor` (VB-09) gains `edited` and `removed`.
3. Add from Library defaults to the saved version and offers the current one.
4. Commit: `VB-12 Part 2: edited and removed`

### What Miles needs to do

Merge. Apply the migration through Lovable if the report names one. Publish › Publish changes.

---

## VB-13 Notifications about builds

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

The events `listActivityFor` returns can also reach the bell. Today a notification cannot point at a build.

### Order

After VB-12.

### Part 0 · Read and plan

Read `src/lib/notifications/` (`insertNotification`, `createNotification`, `triggers.ts`, `resolveTarget.ts`) and the live `notifications.target_type` check (`blueprint|blog|bounty|stage|block|comment|message|thread|profile`). Write `Assumptions` and `Plan`.

### Part 1 · Schema

A migration file: `target_type` also accepts `build`, `node` and `collection`. Write the file and the Lovable message. Commit: `VB-13 Part 1: notification targets`

### Part 2 · Delivery

1. Notifications are written for `run`, `rebuild` and `answer` events on the reader's own builds, by a database trigger on the source table, not by the client (clients cannot be trusted to notify others). Saved items notify only if the reader turned it on for that collection.
2. `resolveTarget` opens the canonical page: a build, a tile on the build page, a collection.
3. Failing tests first for each event and for the off switch.
4. Commit: `VB-13 Part 2: notifications about builds`

### What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives. Publish › Publish changes.

---

## VB-14 OpenBuilds requests: sizes, claims, briefs, reviews, model release check

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

The OpenBuilds board's other request types and side panels go live. Each part below is one mechanism; build them in order and stop at any part whose premise is false on disk.

### Order

After VB-13.

### Part 0 · Read and plan

Read `src/lib/bounty/*`, `gaps.ts`, `solutionRebuild.ts`, `rebuild.ts`, `compare.ts`, `getReproductionsByModel`, `weeklyProgress`, and the live `bounties` schema. Write `Assumptions` and `Plan`.

### Part 1 · Request from a failed run

On a run with `worked = false`, the build's maker (and only the maker) sees "Open a request from this run". It opens the existing gap and bounty flow with the run's note as `gap_problem` and the run linked. Nothing is created automatically. Shown on the build page's runs list and on Home's failed run line. Commit: `VB-14 Part 1: request from a failed run`

### Part 2 · Claims

A migration: `request_claims (request_id, user_id, claimed_at, expires_at, fork_build_id null)`, one active claim per request, expiring after 3 days without a change to the fork. RLS: anyone reads; the claimer writes their own. OpenBuilds shows "Claimed by @kit · 2 days left · fork in progress", and Your claims. Commit: `VB-14 Part 2: claims`

### Part 3 · Session and part requests

A gap at session or part size: `sessions_meta[key].open` or `workstreams[key].open` with a problem. The composer's tile menu has Open as a request; the end of a part has an "Ask for the next session" ghost row. Answering is "Offer a session": the contributor picks one of their imports; it is copied by `addSession`'s rule into their fork, and the maker accepts it into the build. Commit: `VB-14 Part 3: session and part requests`

### Part 4 · Briefs

A build marked as a brief (`builds.is_brief`, migration) is a published build of `gap` type tiles. Its answers are its rebuilds (`listRebuilds`). "Compare answers" runs `compare.ts` over the brief's answers, two at a time if `compare.ts` takes two. Commit: `VB-14 Part 4: briefs`

### Part 5 · Model tests and the model release check

1. A model test is a request naming a model on a reproduced build. Its table is `getReproductionsByModel`.
2. The model release check: a list of models with release dates (`model_releases`, migration, edited by admins), and an aggregate over `build_reproductions` by `model_used` for builds with `reproduction_count > 0`: works, fails, not tested. One request. `EXPLAIN` in the header.
3. Commit: `VB-14 Part 5: model tests and release check`

### Part 6 · Reviews and the weekly goal

1. Review: `builds.in_review` (migration) holds a published build out of Builds until the maker ends the review. Runs and part comments are the review.
2. The weekly goal: a site-wide challenge row counting requests closed since Monday 00:00 UTC.
3. Commit: `VB-14 Part 6: reviews and the weekly goal`

### What Miles needs to do

Merge. Apply each migration the report names through Lovable, in the order given. Publish › Publish changes.

---

## VB-15 Builds: stored counts, Works on model, filter sets, filter layout, columns

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

The Builds board's remaining filters and columns go live. Each part is one mechanism.

### Order

After VB-14.

### Part 0 · Read and plan

Read `gallery.ts` (`listGallery`, the feed params, the `gallery_facets` and `classification_facets` RPCs), `graph.ts` (`buildSteps`, `sessionGroups`), and how classification facets are written back 1.5 seconds after tiles stop changing. Write `Assumptions` and `Plan`.

### Part 1 · Stored counts

A migration: `builds.step_count`, `session_count`, `part_count`, `agent_count` (int). The composer writes them with the facets, from `graph.ts`. Steps and Sessions columns and range filters go live. Commit: `VB-15 Part 1: stored counts`

### Part 2 · Proof filters

1. Reproductions as a range, Rebuilds, Likes, Last confirmed (within n days), Confirmed or stale: build columns that exist.
2. Works on model: builds with a worked run on a chosen `model_used`. One query; counts for the panel in the same request as the facets if the RPC can carry them, else one more.
3. Runs, 12 weeks: per build on the page, runs per week, one request for the page.
4. Commit: `VB-15 Part 2: proof filters and runs per week`

### Part 3 · Filter sets and Groups

1. `filter_sets (id, user_id, name, query jsonb, is_public, created_at)`, migration. Save current, open, rename, delete. Library's Filter sets kind lists them.
2. A Group on OpenBuilds is a public filter set with members (`filter_set_members`), or the unmounted `guilds` and `guild_members` tables if they fit; Part 0 decides and the report says which.
3. Commit: `VB-15 Part 3: filter sets and groups`

### Part 4 · Filter layout and columns

1. The panel's order, which filters are open, and each filter's height are dragged and resized, and kept per viewer (`filter_sets` for saved sets, `localStorage` otherwise).
2. The Columns chooser (12 of 24) and the footer's Add a calculation (sum, median, most common) per column.
3. Commit: `VB-15 Part 4: filter layout and columns`

### What Miles needs to do

Merge. Apply each migration the report names through Lovable. Publish › Publish changes.

---

## VB-16 Build page: the connections

Read `design/prompts/vision/README.md` first. Its rules, How to work and Report apply here.

### Intent

The build page is where most connections land. It has no vision board: it keeps its look. Each addition below uses the existing quiet controls (the part comment marker, the engagement row, the facts strip).

### Order

After VB-15.

### Part 0 · Read and plan

Read `src/pages/site/build/BuildPage.tsx`, `src/components/build/*`, `PartCommentMarker.tsx`, `EngagementRow.tsx`, `Plaque.tsx`. Write `Assumptions` and `Plan`.

### Part 1 · Save at every size

Each part, session and tile gets Save beside "Comment on this part", using `saveItem` (VB-11). Saved state shows as the filled glyph, as Like and Save do. Commit: `VB-16 Part 1: save parts, sessions and tiles`

### Part 2 · Counts that point back

1. A tile shows "Used in n builds" when n > 0 (tiles whose `source_ref` points at it). Public.
2. The facts strip shows "In n collections" (public collections only).
3. Commit: `VB-16 Part 2: used in and in collections`

### Part 3 · Links out

1. Each classification value is a link to Builds filtered by it.
2. The runs list: on a failed run, the maker sees "Open a request from this run" (VB-14 Part 1).
3. The byline shows contributors (VB-10).
4. Commit: `VB-16 Part 3: links out of the build page`

### What Miles needs to do

Merge, then Publish › Publish changes. No migration.
