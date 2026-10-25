# Vision series (VB-00 to VB-16)

The vision board redraws Home, Gallery (now Builds), Bounties (now OpenBuilds), Library and Drafts, and adds the composer's Add from Library window. These prompts build it. Each prompt names the board it must match and states what exists, what is new, and what stays out.

## Order

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

## The boards

- `design/reference/vision/dusk/<board>.html`: standalone HTML, 1440 wide, Dusk. **Values in these files are exact.** Sizes, padding, gaps, radii, type sizes and weights, letter-spacing, borders and shadows are ported as they are. Open a file directly in a browser.
- `design/reference/vision/index.json`: the list of boards, their heights and their dev pages, read by `npm run audit:design`.
- `design/reference/vision/source/<Board>.dc.html`: the boards' sources. The sample data each board draws is in the `<script type="text/x-dc">` block at the end; the dev fixtures copy it from there.
- `design/screens/vision/<board>.png`: a render of each board, for looking at. When the HTML and the picture disagree, the HTML wins.

Every name, handle, number, date and sentence in a board is sample content. It is used only by the dev pages. The live page shows live data.

There is no Noon board. Build with tokens only, so Noon follows; check it with `npm run audit:themes` and `npm run audit:contrast`. There is no phone board; each prompt states the phone order.

## Visual grammar (from the boards and the reference screenshot)

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

## Colours: board value to token

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

## How to work (every prompt)

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

## Report (every prompt)

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
