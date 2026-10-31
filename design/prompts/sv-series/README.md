# Series SV-01 to SV-26

One series that brings together two sets of prompts written in parallel: the CA prompts (security, speed, page changes, the composer's numbers, motion and adds, download size) and the vision prompts (the redrawn Home, Builds, OpenBuilds, Library and Drafts, and the features behind them). They are merged into one order so that each piece of work is done once, on the code it belongs on, and nothing built early is thrown away later.

This file is `design/prompts/sv-series/README.md`, with every prompt of the series beside it as `CA-nn-<name>.md`. To run a prompt, a session is told its file, for example "Run `design/prompts/sv-series/SV-01-security.md`". Every prompt from SV-02 on reads this file first; SV-01 carries its own rules.

## Order

Each prompt runs after the one before has merged, one at a time, in number order.

| Prompt | What it does | Came from (draft names from the planning chat) | Migration |
| --- | --- | --- | --- |
| SV-01 | Security fixes | draft CA-29 | yes |
| SV-02 | Foundation: boards in the repo, names and routes, compare harness, shared pieces | VB-00 | no |
| SV-03 | Fast data: signing in, drafts in one request, opening a draft, Saved, route table, cache, database | draft CA-30 | yes |
| SV-04 | Smooth page changes | draft CA-31 | no |
| SV-05 | Session numbers, counts and fixes | draft CA-32 | no |
| SV-06 | Motion rework: one animator | draft CA-33 | no |
| SV-07 | Steady adds, imports and parts | draft CA-34 | maybe |
| SV-08 | Drafts | VB-08 | no |
| SV-09 | Library | VB-06 | no |
| SV-10 | Home | VB-01 | no |
| SV-11 | Builds: the page and the Table | VB-03, and draft CA-30 Part 4 | no |
| SV-12 | Builds: Maps | VB-04 | maybe |
| SV-13 | Builds: Classification | VB-05 | no |
| SV-14 | OpenBuilds | VB-02 | no |
| SV-15 | Activity: one read for Home, Library and notifications | VB-09 | no |
| SV-16 | Contributor credit on tiles and sessions | VB-10 | yes |
| SV-17 | Saved items below build size, and collection kinds | VB-11 | yes |
| SV-18 | Composer: Add from Library | VB-07 | no |
| SV-19 | Node versions | VB-12 | maybe |
| SV-20 | Notifications about builds | VB-13 | yes |
| SV-21 | OpenBuilds requests: from runs, claims, sessions and parts | VB-14 Parts 1 to 3 | yes |
| SV-22 | OpenBuilds requests: briefs, model checks, reviews | VB-14 Parts 4 to 6 | yes |
| SV-23 | Builds data: stored counts, proof filters, runs per week | VB-15 Parts 1 and 2 | yes |
| SV-24 | Builds data: filter sets, groups, filter layout, columns | VB-15 Parts 3 and 4 | yes |
| SV-25 | Build page: the connections | VB-16 | no |
| SV-26 | Smaller downloads and cleanup | draft CA-35 | no |

### Why this order

1. **Security first** (SV-01): the open password function and the prompt-text hole are live now.
2. **Names and routes before the data layer** (SV-02): the route table (SV-03) and the page change tour (SV-04) are built once, on `/builds` and `/openbuilds`, not renamed later. SV-02 also puts the boards in the repo, which every page prompt compares against.
3. **The data layer and page changes before any page is redrawn** (SV-03, SV-04): each page prompt then registers its placeholder, prefetch and page-ready mark in a system that already exists, and is measured by audits that already exist.
4. **The composer's correctness before its new window** (SV-05 to SV-07): numbering, the one animator and saves that can't overwrite each other come before anything new is inserted into the List. SV-07 fixes a lost save, which is data loss.
5. **Pages in the order that fixes the worst things first** (SV-08 to SV-14): Drafts and Library first (they were the slowest and the one with a live error), then Home (which reads from both), then Builds, then OpenBuilds.
6. **Features in the order their data depends on** (SV-15 to SV-25): Activity, then credit, then saved items, then the window that inserts them (now reachable the day it ships), then versions, notifications, requests, Builds data and the build page.
7. **Cleanup last** (SV-26): it deletes and moves files every other prompt touches, and its size budgets cover the finished pages.

## Decisions made for this series

- **Session rows** in Drafts, Home and the composer's Your sessions are named by their first prompt (as the boards draw them), with `<tool> · <model> · <date> · in n drafts` in the detail line. A row whose first turn is a Claude Code summary is named by the first real prompt (SV-07's Summary tiles). Where the tool is unknown, the detail line starts `No harness chosen`. SV-05 Part 3 follows this.
- **The stagger total on imports** is fixed: up to 4 prompts keep 110 ms apart, more close the gap so the spread never passes 330 ms; list staggers never spread past 300 ms (SV-06 Part 5).
- **Heavier layers are built only when a target fails without them:** `compose_open` and the kept cache (SV-03), `go()` waiting (SV-04), the stored Map summary (SV-12). The report says which were built and the numbers that decided it.
- **VB-14 and VB-15 are each split in two** (SV-21 and SV-22, SV-23 and SV-24), so no session carries six mechanisms and four migrations.
- **Saved copies** of another maker's work stay usable when the source is edited or removed, credited to its maker (SV-19). If the maker deletes their account, SV-19 reports what happens to the copies and asks; it does not decide.
- **The Gallery feed view** is retired by SV-11, which deletes the code its change leaves unused. Home (SV-10) carries the feed.

## The boards

`design/vision-kit.py` writes all of these (`python3 design/vision-kit.py`; `--check` verifies them). SV-02 runs it.

- `design/reference/vision/dusk/<board>.html`: standalone HTML, 1440 wide, Dusk. **Values in these files are exact.** Sizes, padding, gaps, radii, type sizes and weights, letter-spacing, borders and shadows are ported as they are.
- `design/reference/vision/index.json`: the list of boards, their heights (measured in Chromium at 1440 wide when `design/vision-kit.py` was made) and their dev pages, read by `npm run audit:design`.
- `design/reference/vision/source/<Board>.dc.html`: the boards' sources. The sample data each board draws is in the `<script type="text/x-dc">` block at the end; the dev fixtures copy it from there.
- `design/screens/vision/<board>.png`: a render of each board, for looking at. When the HTML and the picture disagree, the HTML wins.

| Board | Source file | Page prompt |
| --- | --- | --- |
| `home` | `Main.dc.html` | SV-10 |
| `openbuilds` | `OpenWork.dc.html` | SV-14 |
| `builds-table` | `Builds.dc.html` | SV-11 |
| `builds-maps` | `BuildsMaps.dc.html` | SV-12 |
| `builds-classification` | `BuildsClassification.dc.html` | SV-13 |
| `library` | `Library.dc.html` | SV-09 |
| `composer-add-from-library` | `LibraryInsert.dc.html` | SV-18 |
| `drafts` | `Drafts.dc.html` | SV-08 |

Every name, handle, number, date and sentence in a board is sample content, used only by the dev pages. Live copy never infers a person's pronouns: where a board's sample says "her step", the live page says "their step".

What the boards draw that the live site does not take from them:

- **The notes.** Each board's blue `NEW ·` notes and Home's legend box sit behind a `notes` prop. The rendered boards `design/vision-kit.py` writes have them off; they are never built.
- **The header.** Home and Builds draw a header search and the other boards don't. The live header is the app's `SiteHeader` as it is (with `HeaderSearch` on every page). The compare harness masks the header.
- **Fonts.** The boards load Geist from Google Fonts. The app self-hosts Geist and Geist Mono and preloads them; never add a font link.
- **Drawn controls and removed focus rings.** The boards draw checkboxes, sliders and radios as styled elements and set `outline: none` on some inputs. The live page uses real controls and keeps focus rings (Accessibility, below).
- **Placeholder marks.** Model marks drawn as 9px letters become the real marks from `markFor`. There is no Noon board: build with tokens only, so Noon follows, and check it with `npm run audit:themes` and `npm run audit:contrast`. There is no phone board: each page prompt states the phone order.

## Visual grammar (from the boards)

These are the rules the boards follow. A choice the boards do not cover follows these.

1. **Frame and surface.** The header sits on `--frame` with no background or border. Below it, one surface: `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `40px clamp(16px, 5vw, 76px) 0` (Home: `24px clamp(16px, 2.2vw, 32px) 0`). The footer is inside it, with a hairline above. The frame is SV-04's one `SiteFrame`; the surface is inside its page area.
2. **Few boxes.** Sections sit on the surface with no box. A box (module: `--module`, 1px `--module-border`, radius 8, padding 16) is used only where a board draws one.
3. **Section head.** Title 14/500, line-height 1.3; meta line 12/400 `--label` under it, 2px apart; a 28px chevron button top right (`--control`, 1px `--control-border`, radius 6) that opens the section's page.
4. **Figure and meta.** A page's leading number is 20/500, -0.015em (Home's room: 32/500, -0.02em). Its meta line is 13 `--text2` with at most two clauses coloured by meaning: `--evidence` for worked or growth, `--cat-breakage` for failed, `--lit` for not tested or edited.
5. **Rows.** Hairline (`--hairline`) between rows, none after the last. Label left, value right. Min-height 40, 44, 48, 52 or 56 as the board draws it. Numbers right-aligned and tabular.
6. **Plain values.** Values are text. The only chips are the grey mono type chips (`STEP`, `PROMPT`: Geist Mono 10.5, line-height 18, padding `0 6px`, radius 4, `--control` fill, `--text2` text) and active filter chips. The Plaque's evidence pill is used where `Plaque` is used today, not in table cells.
7. **Space.** 48 between groups on a page, 28 between items in a list of requests, 24 between cards, 16 inside modules, 72 or 56 between columns. Columns are separated by whitespace; Home alone keeps its hairline column rules.
8. **Colour only on data.** Bars, lamps, the coloured meta clauses, and states (`Edited` in `--lit`, `Removed` in `--cat-breakage`). The lamp is the existing lamp. Never amber text except a state word the board colours.
9. **One primary per view.** `--action` fill, `--on-action` text 500, radius 6, height 32. Every other action is a control.
10. **Tabs** are text buttons 36 high with a 1px `--text` underline on the selected one, over a hairline. **Segmented controls** are a `--well` track with 2px padding and a raised `--control` segment.
11. **Numbers** on figures, rows, counts and tables are tabular (`font-variant-numeric: tabular-nums`, as every board sets on its root), so a changing number doesn't shift what sits beside it.
12. **Texture.** The dot grid (`radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px) only inside Maps and covers.
13. **Never.** Glass, blur, glow other than the lamp, gradients, icons inside labelled buttons, emoji, em dashes in shown copy, hover fades, scroll reveals.

## Colours: board value to token

The boards are written in raw Dusk values. Code uses `t.<token>` from `@/lib/theme/tokens`, never a hex. All of these tokens exist in `design/tokens/tokens.css` at `6b8fe91`.

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

## How to work (every prompt)

- **Pull main first.** Lovable commits straight to main. Check every name the prompt uses against the files: `grep` it, with every match, never the first one found. The file on disk wins. A name that is wrong or renamed is used as it is on disk and noted in the report. Never invent a table, a column or a policy.
- **Plan first.** Part 0 ends with written `Assumptions` (each fact the prompt states that you checked, and what you found) and a `Plan` (one line per part: `Part n: what changes -> verified by: which test or measure`).
- **Reproduce first.** Every fix and every behaviour a part adds starts as a failing test. Select by role and accessible name, or `data-testid`; never by class.
- **Measure, then build.** Where a part has a simple step and a heavier one, build the simple step, measure, and build the heavier one only if its target still fails. Say which, with the numbers.
- **A missing premise is reported, not fixed.** If a part's premise is false on disk, or a cause can't be found or reproduced, don't build a fix for it.
- **Check what exists before adding.** A piece, guard or function that exists is reused, not rebuilt.
- **Surgical.** Every changed line traces to a part of the prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes in `Dead code seen`, for SV-26.
- **Views apart from data.** `src/pages/site/<page>/<Name>View.tsx` is pure: typed props, no fetching, no `useAuth()`, no router hooks but `Link`. `<Name>Page.tsx` loads through `src/lib/<domain>/` functions only, with query keys `['<domain>', '<fn>', ...args]`, maps the results to props and renders the view. No Supabase call in a component.
- **Styling** is inline through `t` and the type roles in `@/lib/theme/type`. No new CSS classes. Keyframes only in `src/index.css`. Add every changed file to `src/lib/theme/lookRules.test.ts`.
- **Dev pages.** `src/dev/fixtures/vision/<board>.ts` maps the board's sample data to the view's props; the view renders at `/dev/kit/pages/vision-<board>` with `data-design-ready="true"` once fonts and data are in. Heavy routes and every `/dev/*` page are `React.lazy`.
- **States.** Populated, loading (the page's route `Placeholder`, see below), empty (one line and one action), error (one sentence and Retry, CA-28's wording, through `reportError`). The boards show populated only.
- **Sections without data yet.** A page prompt builds every section of its board in the view, each section its own component, rendered on the dev page from the fixture. A section whose data does not exist yet is not drawn on the live page until its data prompt lands; that prompt only wires it. Nothing on a live page is faked.
- **Accessibility.** Real `<a>` and `<button>`, an accessible name on every icon-only control, `aria-current="page"` on the current nav item, no text under 10px, inputs 16px on phone, reduced motion honoured. Also:
  - **Focus rings stay.** A board's `outline: none` is never ported; every input and control keeps the app's focus-visible ring.
  - **Real controls.** A checklist is checkboxes; a range filter is a slider with arrows, Page Up and Down, Home and End and `aria-valuetext`; a list you choose one from is a radio group with one tab stop and arrow keys.
  - **Touch targets.** A control drawn at 28px keeps its look; on phone its hit area reaches 44px through padding with a matching negative margin.
  - **Charts have words.** A row of bars (week bars, runs per week, the release check, a histogram) carries a text summary on its group, and the bars themselves are hidden from screen readers.
  - **Drag has a keyboard way.** Anything that can be dragged can also be moved from a menu or a button.
- **Questions go in the report.** Miles is not watching the session. Where you would ask, take the safer reading and carry on.
- **The domain isn't live yet.** Never fetch `https://buildgallery.ai`. The built bundle and the audit harness are the site.
- **Never** install a dependency (propose it and stop, unless the prompt names it), skip or disable a test, call `award_xp`, send repository files to an outside service or bot, or apply a migration.

## Pages and the systems SV-03 and SV-04 build

Every page prompt (SV-08 to SV-14) does all of these:

- **Route table.** The page's entry in `src/lib/routing/routeTable.ts` (SV-03) holds its `load()`, its `prefetch()` (the same keys and functions the page uses for its first screen) and its `Placeholder`. The page prompt updates all three for the new page.
- **Placeholder.** The route's `Placeholder` is the page's own loading state, the existing `LoadingBlocks` sized like the content. SV-04's test that the route placeholder and the page's loading state match within 2 px stays green. Placeholder and content sit in the same slot and fade together over `FAST`; the slot is never empty for a frame.
- **Page-ready mark.** `usePageReady("<page>", ready)` (SV-03) stays on the page and fires when its first screen shows real content.
- **Links** to other pages are `PageLink` or `go()` (SV-04), so they prefetch on intent and change page with the one fade.
- **Same page, new parameters** (tabs, filters, the Builds view switch, sort): the address changes, the old content stays until the new arrives (`keepPreviousData`), and nothing fades.
- **Request rounds.** Every read that does not depend on another starts at once. The page's first screen takes at most one round of parallel requests, plus one more only for reads that need the first's ids. `npm run audit:pages` gains the page with that target, and fails when it is missed.
- **Kept cache.** If SV-03 built the kept cache, the page adds its first-screen keys to the allow list, never anything private to a viewer that isn't scoped to their user, and never `making` or `post_doc`.
- **Counts** that show "about" a number use `count: "estimated"` or `"planned"`. Exact counts only where the number is shown in full and must be right.
- **Images** (feed pictures, covers): `loading="lazy"` and `decoding="async"`, except the largest image in the first screen; a box sized ahead so nothing shifts when it arrives; a transformed size where storage supports it.
- **Long lists and grids** (the Builds table, the Maps grid, the feed) use `content-visibility: auto` with a `contain-intrinsic-size` on off-screen rows or cards.

## Motion limits (every prompt that draws)

- Motion comes from `src/lib/theme/motion.ts` (`FAST`, `BASE`, `STANDARD`) and, in the composer, `src/lib/build/buildMotion.ts` and SV-06's animator (`listMotion.ts`, `motion.expect`). No new duration, curve or stagger.
- One curve for every entry, exit and move: `STANDARD`. No ease-in, no spring, no overshoot, no bounce.
- Transform and opacity only. No blur (`motion.test.ts` treats `filter` as a property that can't be composited), no `clip-path`, no layout property, never `transition: all`, never `box-shadow`.
- No scale on press, no new hover look, no hover fades, no scroll reveals, no shimmer or pulse added to a placeholder.
- Hover is a colour or underline change at once, and only under `HOVER_QUERY` (`(hover: hover) and (pointer: fine)`, from `motion.ts`), so it never sticks on touch.
- Selected tabs and segments change at once, the same both ways. The nav lamp moves to the new current item at once when the page changes; the header is outside SV-04's fade.
- Leaving is quicker than arriving, and nothing that leaves or closes gets a delay.
- A value is judged by what it does, never by being near another number.
- Everything is off under reduced motion. `motion.test.ts` must pass.
- Page changes belong to SV-04 and list motion in the composer to SV-06. No other prompt animates a page change or an element in the build list itself.
- After the measured checks pass, watch the after video or screenshots beside the before ones. If anything now draws the eye to itself, cut it back and say so in the report. Only the measured thresholds fail a script.

## Performance rules (every prompt)

- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow the rule files a prompt names. Read them for this app: TanStack Query where they say SWR, `React.lazy` where they say `next/dynamic`, and no package they name (`swr`, `better-all`). Ignore the `server-` and `rendering-hydration-` rules except where named.
- **No memo for speed** (`memo`, `useMemo`, `useCallback`) unless a React Profiler trace shows the render as the cost. React Compiler isn't installed.
- **Start early, await late.** Don't await one read before starting another that doesn't depend on it.
- **No component defined inside another component.** It remounts on every render.
- **Derived, not copied.** What a view shows is worked out from its data during render. No effect copies data into another state.
- **Budgets hold.** SV-03's request rounds, SV-04's page change checks, SV-06's motion checks and, after SV-26, the first download (200 KB signed out, 230 KB signed in) and the composer (120 KB) fail their scripts when missed. `npm run audit:perf` (LCP, CLS, the INP proxy) must not get worse than the last prompt's after numbers.

## Database rules (every prompt that writes SQL)

- Never apply a migration from Claude Code. Write the file (`YYYYMMDDHHMMSS_snake_case.sql`, after the newest one), correct whether or not a column already exists (`IF EXISTS`, catalogue lookups), and give Miles the Lovable message: `Apply supabase/migrations/<file> exactly as written. Change nothing else.`
- Named columns, `.limit()` on every list, never `select('*')`. `src/integrations/supabase/types.ts` is generated: cast at the call site, never edit it.
- Policies use `(select auth.uid())`, never a bare `auth.uid()`.
- Every new index, and every new read that may scan a large table, has the `EXPLAIN (ANALYZE, BUFFERS)` to run written in the migration's header, with what the plan should show. The Lovable message asks Miles to run it and paste the plan back.
- Every `SECURITY DEFINER` function (including trigger functions) sets `search_path`, checks the caller against the row's owner or is executable only by `service_role`, and has `EXECUTE` revoked from `anon` and `PUBLIC` where they shouldn't call it (SV-01 Part 6).
- Clients never write a row that notifies someone else, or any row on someone else's build. Notifications come from a database trigger on the source table. Credit (SV-16) is written only on the maker's own rows, by the maker's own writers, as the existing policies allow.

## What earlier prompts leave behind

Later prompts use these. They don't rebuild them.

| From | What | Where |
| --- | --- | --- |
| SV-01 | `reportError(error, context)`; the allowed origins and the CORS helper; input checks in edge functions | `src/lib/errors/report.ts`; `supabase/functions/_shared/origins.ts`, `cors.ts` |
| SV-02 | The boards and this README in the repo; the names Home, Builds, OpenBuilds, Library, Drafts and the routes `/builds`, `/openbuilds` (the `SITE_NAV` keys `gallery` and `bounties` stay); the compare harness for the vision boards; `SectionHead`, `PageFigure`, `PlainRow`, `TypeChip`, `FilterChip`, `UnderlineTabs`, `Segmented`, `InnerTile`, `DashedSlot` | `design/reference/vision/`; `siteNav.ts`; `e2e/audit/design-compare.spec.ts`; the shared pieces' folder |
| SV-03 | `usePageReady`; the route table (`load`, `prefetch`, `Placeholder`), keyed by `SITE_NAV` key; fetching on intent and at idle; the query key convention; cache times and `keepPreviousData`; `BUILD_LIST_COLUMNS`; `npm run audit:pages`; the drafts read in one request; Saved in one request | `src/lib/routing/`; `src/lib/build/builds.ts`, `drafts.ts`; `src/lib/social/saves.ts`; `e2e/audit/pages.spec.ts` |
| SV-04 | One `Suspense` boundary under the frame; one `SiteFrame` shared by the site and the composer; `go()` and `PageLink`; the page crossfade; scroll kept on Back; the frame tools | `src/lib/routing/go.ts`; `e2e/audit/support/frames.ts` |
| SV-05 | One function that numbers sessions and tiles from the List's order; counts that include every session | `src/lib/build/` (the name it was given) |
| SV-06 | One list animator, `motion.expect({ kind, keys })`, `staggerStep`, the scroll helper; `npm run audit:motion` | `src/pages/site/compose/listMotion.ts`; `src/lib/build/buildMotion.ts` |
| SV-07 | One model per draft from click to result; `making` read and written in one step of the `serial` queue, one path at a time; Summary tiles for Claude Code's summaries; publish refuses a build with no title | `src/lib/build/making.ts`, `staleWrites.ts` |
| SV-15 | `listActivityFor({ userId, since, limit })` | `src/lib/feed/activity.ts` |
| SV-16 | `build_nodes.contributor_id`, contributors in `sessions_meta` | migration, writers |
| SV-17 | `saveItem`, `unsaveItem`, `listSavedItems` | `src/lib/library/savedItems.ts` |

Each prompt checks the names in this table against the files on the day it runs. A prompt that renamed something says so in its report, and the next prompt uses the name on disk.

## Checks before every commit

`npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run lint`, `npm run build`, `npx playwright test e2e/tier1 --project=desktop --project=mobile`. Page prompts also run `npm run audit:design -- --grep "vision/dusk/<board>"` within the prompt's threshold, `npm run audit:pages`, `npm run audit:perf`, `npm run audit:themes` and `npm run audit:contrast`. Composer prompts also run `npm run audit:motion`. The theme guard tests (`src/lib/theme/*.test.ts`) must pass. Search the diff for the em dash character.

## Report (SV-02 and SV-08 to SV-25)

```
<prompt> · <title>
PASS / FAIL
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N
Compared boards: <board · diff %, or "not comparable: why">
Request rounds and requests for the page, before → after: (numbers)
Web Vitals against the last after numbers (LCP · CLS · INP proxy): no worse yes/no
Built but not live yet: <sections waiting on a data prompt, and which>
Layers built only because a target failed: (list, with the numbers, or "none")
Names that differed from this prompt: <prompt name → name on disk>
Raw values without a token: <value · where · token used>
Motion cut back after watching: (list, or "none")
Dead code seen: (list, or "none")
Lovable messages needed: (each in full, or "none")
Parts not done: (list, or "none")
Questions for Miles: (list)
```

Then `What Miles needs to do`: merge the pull request, press Publish › Publish changes, and send any Lovable message the report gives.
