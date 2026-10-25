# SV-02 · Foundation: boards in the repo, names and routes, compare harness, shared pieces

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-01 has merged, before SV-03. SV-03 builds its route table on the names and routes this prompt sets, and every page prompt (SV-08 to SV-14) compares against the boards it commits. Pull main first. Lovable commits straight to main. Branch `sv-02-foundation`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-02 foundation` at the end.

The series README and every prompt are in `design/prompts/sv-series/`. The boards come from `design/vision-kit.py`, a standard-library script on main (it writes each board's canvas source, the board rendered to standalone HTML, a picture of it, and `index.json`). If either isn't on main, stop and report that.

The facts here were checked on 25 October 2026, at `6b8fe91`. **The file on disk wins.**

## Intent

Every later prompt needs four things in place: the boards and the series rules in the repo, the new page names in the nav with routes for them, the compare harness reading the boards, and the shared drawing pieces the boards repeat. This prompt builds those and nothing else. No page changes its layout here.

## How to work

The series README's rules apply.

---

## Part 0 · Read and plan

1. Pull main. Read `src/components/shell/siteNav.ts` (`SITE_NAV`, `PRIMARY_LINKS`, `sectionForPath`), `src/components/shell/breadcrumbTrail.ts`, `src/App.tsx` (the `/gallery` and `/bounties` routes and their sub-routes), `src/components/shell/navBudget.test.tsx`, `src/components/shell/siteNav.test.ts`, `src/pages/dev/KitPages.tsx`, and `e2e/audit/design-compare.spec.ts`.
2. Run `python3 design/vision-kit.py`, then `python3 design/vision-kit.py --check` (26 of 26 files must match). Open every board in `design/reference/vision/dusk/` and check each is standalone: it renders in a browser from the file alone, with no script, with the repo's fonts from `design/reference/fonts/`, and with no `NEW ·` notes or legend. The kit was checked this way when it was made; if one fails now, say so, and skip it in Part 3.
3. **List where a board and its prompt disagree** (known: the Maps and Classification page heads differ from the Table's; the Add from Library window's border is `--control-border`; only Home and Builds draw a header search). The board wins for looks; write each in `plan.md` so the page prompt meets it already known.
4. List the primitives that already exist for each shared piece in Part 4 (search `src/components/brand/`, `src/pages/site/compose/refinedStyles.ts`, `src/pages/site/compose/composeControls.tsx`, `LampDot`, `Plaque`, `Avatar`, `Glyph`, `Icon`). A piece that exists is reused, not rebuilt.
5. Write `Assumptions` and `Plan` in `design/audits/sv-02/plan.md`.

Commit: `SV-02 P0: plan`.

## Part 1 · The boards and the series in the repo

1. The boards: what `design/vision-kit.py` wrote (`design/reference/vision/`, `design/screens/vision/`, `design/scripts/render-vision-board.mjs`). Don't hand-edit them; a change goes in the source and through the renderer, as the script's header says.
2. `design/reference/vision/index.json`: written by the kit, one entry per board (`kind: "vision"`, `page`, `theme: "dusk"`, `width: 1440`, `height`, `title`, `devPage`, `source`, `screen`). Check each height against the rendered board at 1440 wide.
3. The series is already in `design/prompts/sv-series/`. Leave it as it is, except for the facts a later prompt's report corrects.
4. Check that no secret, credential or private message is in any file before committing it. The boards' sample sessions quote real chat titles (on Drafts and Home, for example a question about a phone number and uploaded file names): report any that read as private. If Miles has said to replace them, change them in the source, re-render with `design/scripts/render-vision-board.mjs`, retake the picture, and say that `vision-kit.py --check` will now report those files as changed.

Commit: `SV-02 P1: boards and series in the repo`.

## Part 2 · Names and routes

The nav reads, in order: **Home, Builds, OpenBuilds, Library, Drafts**. "Builds" replaces "Gallery". "OpenBuilds" (one word, capital B) replaces "Bounties".

1. Failing tests first: `siteNav.test.ts` and `navBudget.test.tsx` expect the new labels; `/gallery?x=1#y` lands on `/builds?x=1#y` and `/bounties` on `/openbuilds`, with search and hash kept; `sectionForPath` returns the Builds section for `/builds`, `/gallery`, `/b2/*` and `/rebuild/*`, and the OpenBuilds section for `/openbuilds`, `/openbuilds/*` and `/bounties/*`.
2. `PRIMARY_LINKS`: labels `Builds` and `OpenBuilds`, hrefs `/builds` and `/openbuilds`. **Keep the `SITE_NAV` keys** (`gallery`, `bounties`) so no caller breaks; change their values. SV-03's route table is keyed by these keys.
3. Routes: `/builds` renders what `/gallery` renders today; `/openbuilds` renders what `/bounties` renders today. `/gallery` and `/bounties` redirect with `replace`, keeping search and hash. Sub-routes (`/bounties/:bountyId/solve`, `/bounties/solvers`) keep working at their old paths and gain `/openbuilds/...` equivalents.
4. Breadcrumbs, the phone bottom nav, the profile drawer's nav list and any page title that names the section use the new names. Copy on legacy pages is not touched.

Commit: `SV-02 P2: Builds and OpenBuilds names and routes`.

## Part 3 · The compare harness reads the boards

1. `design-compare.spec.ts` also reads `design/reference/vision/index.json`. A vision board's test title is `vision/<theme>/<page>`. Its dev page URL is `board.devPage` with `?theme=dusk&viewport=desktop`. The refined boards are unchanged.
2. The header is masked in every vision comparison: the live header is `SiteHeader`, not the boards' (README, The boards).
3. Register eight lazy dev pages in `KitPages.tsx`: `vision-home`, `vision-openbuilds`, `vision-builds-table`, `vision-builds-maps`, `vision-builds-classification`, `vision-library`, `vision-composer-add-from-library`, `vision-drafts`. Until its page prompt lands, each renders one line, "Not built yet", with `data-design-ready="false"`, so the harness skips it.
4. Verify: `npm run audit:design -- --grep "vision/"` lists 8 boards (fewer if Part 0 found one not standalone), all skipped, and the refined boards behave as before.

Commit: `SV-02 P3: compare harness reads the vision boards`.

## Part 4 · Shared pieces

Build only the pieces that do not already exist. Each takes props, styles through `t`, and has a unit test for its accessible name and its token use. The values are from the boards; the board HTML is exact.

| Piece | What it draws |
| --- | --- |
| `SectionHead` | title 14/500 line-height 1.3, meta 12 `--label` 2px below, optional chevron button (28 square, `--control`, 1px `--control-border`, radius 6, a 12px chevron in `--text`) with an accessible name "Open <section>", rendered as a `PageLink` (SV-04 makes it one; until then a `Link`) |
| `PageFigure` | the leading number (20/500, -0.015em, line-height 1.2; `size="room"` gives 32/500, -0.02em, 1.1) and a meta line of 13 `--text2` built from parts, each plain or toned `evidence`, `breakage` or `lit` |
| `PlainRow` | label left, value right, a hairline under every row but the last, `minHeight` 40 / 44 / 48 / 52 / 56 |
| `TypeChip` | Geist Mono 10.5, line-height 18, padding `0 6px`, radius 4, `--control` fill, `--text2` text (or a toned text), upper case |
| `FilterChip` | control recipe, height 26, radius 6, 12px: a `--label` key, the value in `--text`, an 18px remove button named "Remove filter <key>" |
| `UnderlineTabs` | text buttons 36 high, 20 apart, 500 weight, `--text2`; the selected one `--text` with a 1px `--text` underline over the row's hairline; `role="tablist"`, arrow keys move between tabs |
| `Segmented` | `--well` track, 1px `--well-border`, radius 6, padding 2, gap 2; the selected segment `--control`, 1px `--control-border`, radius 4; a radio group or links, as the caller says |
| `InnerTile` | the one boxed tile a page may have: `--module`, 1px `--module-border`, radius 8, padding `14px 16px` |
| `DashedSlot` | an open slot: transparent, 1px dashed `--label`, radius 6 (or 8 for a page-width slot) |

- The lamp is the existing lamp (`LampDot` or the Plaque's lamp). Do not build a second one.
- No piece animates. A selected tab or segment changes at once (Motion limits: no hover fades).
- Pieces are named exports from one folder, imported file by file, not through a new `index.ts` barrel.

Commit: `SV-02 P4: shared pieces`.

## Part 5 · Checks

All the README's checks. `npm run audit:design` must show the refined boards unchanged. Search the diff for the em dash character and for any secret value.

Commit: `SV-02 P5: checks`.

---

## Report

The README's report.

## What Miles needs to do

Before: make sure `design/vision-kit.py` and `design/prompts/sv-series/` are on main. After: merge, then Publish › Publish changes. Old links to `/gallery` and `/bounties` keep working. No migration.
