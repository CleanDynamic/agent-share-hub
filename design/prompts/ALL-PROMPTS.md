# buildgallery UI overhaul — every prompt, in order

One prompt per Claude Code session, in this order. Each is also a single file in this folder. Read `../RULES.md` first; every prompt assumes it.

## UI-D01 — What actually landed

Follow `design/RULES.md`.

**This prompt changes nothing.** It reads the repository and reports. Do not edit a file, do not commit, do not run a migration. If something is obviously broken, say so in the report rather than fixing it.

**Goal.** The deployed site still shows the old frame. Find out which of `UI-P00` to `UI-P41` actually landed on this branch, and which of three causes is responsible, so the next prompt is the right one.

**Do, in order, and quote the real output of each — never a summary.**

1. **Where am I.** `git branch --show-current`, `git log --oneline -40`, and `git log --oneline --grep='^UI-P' | wc -l`. List every `UI-Pnn` commit subject you find, in order. Name the ones between `UI-P00` and `UI-P41` that are **absent**.
2. **Is this what is deployed?** `git status -sb` and `git log --oneline origin/HEAD -5` (or the default branch's remote ref). State plainly whether this branch is merged into the default branch. Lovable deploys the default branch, so work sitting on an unmerged branch is invisible on the live site no matter what else is true.
3. **Does the kit exist?** `ls design/` and `python3 design/build-kit.py --check` if it is there.
4. **Does the new frame exist in the code?** For each path, say exists / missing, and for the ones that exist give the line count:
   - `src/components/shell/SiteFrame.tsx`, `SiteHeader.tsx`, `Breadcrumb.tsx`, `SiteFooter.tsx`, `MobileHeader.tsx` (or wherever UI-P19 put the dock), `FrameRoute.tsx`, `siteFrameRoutes.ts`
   - `src/lib/shell/flags.ts`
   - `src/components/brand/` — list it
   - `src/pages/site/` — list it, one line per page
5. **Is the frame wired in?** Print the part of `src/components/AppShell.tsx` that chooses between `SiteFrame` and `FlatShell`. Print the whole of `siteFrameRoutes.ts` (the actual contents of `SITE_FRAME_ROUTES`). Then `grep -rn "FrameRoute" src/App.tsx | head -40`. Say how many routes are on the new frame.
6. **What does the flag do when it cannot find a row?** Print `isSiteFrameOn()` in full. State what it returns when the `feature_flags` table has no `site_frame` row — that is the production case.
7. **What is not behind the flag?** These change the live site whether the flag is on or off, so they tell us whether the early waves landed:
   - `grep -rn "exhibition" src e2e index.html | head` — should be empty but for a migration line.
   - `grep -rn "Sentient" src/index.css src/lib/theme/* index.html | head` — did `UI-P05` land?
   - `grep -n "\-\-lit-ink\|--focus-ring\|--picture-lamp-glow" src/index.css | head` — did `UI-P03` land?
8. **Does it build and pass?** `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`. Report pass/fail and any failing test names. If `npm run audit:design` exists, run it and report the first ten lines.

**Report back exactly this, and nothing else:**

```
BRANCH: <name> · merged into <default>: yes / no
COMMITS: <n> UI-P commits · missing: <list, or none>
KIT: present / missing · build-kit --check: <result>

CODE PRESENT
  frame components : <list of exists / missing>
  page views       : <n> of 10
  data functions   : <n> of the UI-P21..P26 set

WIRING
  AppShell branches on the flag : yes / no
  SITE_FRAME_ROUTES             : <the actual array>
  routes using FrameRoute       : <n>
  isSiteFrameOn() with no row   : true / false

NOT BEHIND THE FLAG
  exhibition removed : yes / no
  Sentient installed : yes / no
  new tokens present : yes / no

CHECKS: tsc <r> · test <r> · build <r> · audit:design <r>

VERDICT: one of
  A — the work is not on the deployed branch
  B — the work is there and the flag is off
  C — the work is not in the repository at all
  D — something else: <say what>
```

**How to read the verdict** (state which one applies and why, in one sentence):

- **A** — `UI-Pnn` commits exist on a branch that is not merged into the default branch. Nothing is wrong with the code; it is not deployed. The fix is a pull request, not a prompt.
- **B** — the components exist, `AppShell` branches on the flag, routes are in `SITE_FRAME_ROUTES`, and `isSiteFrameOn()` returns false with no row. This is the expected state after `UI-P36` and the fix is `UI-P36b`.
- **C** — the frame components are missing and there are few or no `UI-P` commits. The sessions did not do the work. Say which prompts have no commit, and stop; re-running them is the fix, starting from the lowest missing number.
- **D** — anything else. Describe what you found; do not guess.

**Commit.** None. This prompt commits nothing.

---

## UI-P00 — Put the design kit in the repo and record a baseline

Follow `design/RULES.md`.

**Goal.** The `design/` folder (this kit) becomes part of the repository so every later prompt can open the references, tokens, fixtures and prompts from disk. Nothing in the running app changes.

**Before you start — get the kit on disk.** Everything after this prompt reads `design/`, so it has to exist in this checkout before anything else happens.

1. If `design/reference/` is missing and `design/build-kit.py` is present, run `python3 design/build-kit.py`. It writes the whole kit (101 files, ~2.4 MB) and is safe to re-run; `--check` verifies what is there without writing.
2. Confirm `design/` now holds `RULES.md`, `README.md`, `HANDOFF.md`, `prompts/`, `reference/` (`index.json`, `components/`, `desktop/`, `mobile/`, `brand/`, `fonts/`), `tokens/` and `fixtures/`.
3. If it is still incomplete, **stop and say exactly what is missing.** Do not continue, and do not reconstruct any part of the kit from this prompt or from the repository — a reconstructed board is not a reference, and every later comparison would be against a guess.

**Do.**
1. **Commit the kit in this commit**, not a later one: `git add design` (including `build-kit.py`, which keeps the kit reproducible). Everything from UI-P01 on assumes it is on the branch.
2. Make sure tooling ignores the folder where it should: add `design/` to the ESLint ignore list and exclude it from `tsconfig.app.json`'s `include`/`exclude` if the current globs would pick it up. It must never be bundled: it is not under `public/` and nothing imports it except the dev-only fixture loader added in UI-P01.
3. Add a short section to the repository's `CLAUDE.md` (create the section if the file exists; create the file only if there is none):
   - "UI overhaul: the source of truth is `design/`. Read `design/RULES.md` before any UI change. Prompts live in `design/prompts/` and run in order. Names of modules, functions and columns come from the `buildgallery-repo-map` skill and from the files themselves, never from a prompt alone."
4. Record a baseline in `design/BASELINE.md`: the result of `npx tsc --noEmit -p tsconfig.app.json`, `npm test` (pass/fail counts and any failing test names), `npm run build` (success, and the size of the largest JS chunks from the build output), and `npx playwright test e2e/tier1 --project=desktop --project=mobile`. If something already fails, record it; do not fix it here. Later prompts compare against this.

**Do not.** Change any source file under `src/`. Move or rename anything inside `design/`.

**Done when.** `python3 design/build-kit.py --check` reports every file matching; the four checks have been run and their results are in `design/BASELINE.md`; the build output contains nothing from `design/`; and `design/` is in this commit.

**Commit.** `UI-P00: add design kit and baseline`

---

## UI-P01 — The verbatim check: a compare harness and dev compare pages

Follow `design/RULES.md`.

**Goal.** A repeatable way to check "does the app look exactly like the mockup?": a Playwright audit that screenshots a reference board and the matching dev page at the same size and diffs them, plus the dev pages it points at.

**Read first.** `playwright.config.ts`, `playwright.audit.config.ts` and the existing audit specs it runs (`audit:contrast`, `audit:themes`, `audit:glass`), `src/App.tsx` (how `/dev/kit` is registered: `import.meta.env.DEV` + `lazy`), `src/pages/dev/Kit.tsx`, `src/contexts/ThemeContext.tsx`, `design/reference/index.json`, `design/fixtures/sample-data.json`.

**Build.**
1. **Fixture loader** `src/dev/designFixtures.ts` (dev-only): imports `design/fixtures/sample-data.json` (enable `resolveJsonModule` if needed; Vite serves files from the repo root in dev) and exports it typed. Export `FIXTURE_NOW = new Date(sample.now)` for relative times. Nothing outside `src/dev/` and `src/pages/dev/` may import it.
2. **Dev routes**, registered exactly like `/dev/kit` (DEV only, lazy, outside production bundles):
   - `/dev/kit/components?theme=noon|dusk` — the component catalogue, built up by UI-P06–UI-P15. Start it as an empty page at 1440px wide with the backdrop colour and a heading. Each section it will render carries `data-catalogue="<Section name>"`, using the same names as `design/reference/components/*.html` (Identity, Controls, Proof, Panels, Orbs, Tagline, Build cards, Charts, Frame).
   - `/dev/kit/pages/:page?theme=noon|dusk&viewport=desktop|mobile` — renders a page view (`HomeView`, `GalleryView`, …) with fixtures. Until a view exists, render `<div data-design-ready="false">Not built yet</div>`.
   - Both routes set `data-theme` on `<html>` from `?theme=` for the life of the page, without writing to the stored preference.
3. **Audit spec** beside the existing audit specs, named `design-compare.spec.ts`, plus a script in `package.json`: `"audit:design": "playwright test --config=playwright.audit.config.ts design-compare"`. For every entry in `design/reference/index.json`:
   - **Pages** (`kind` desktop or mobile): open the reference HTML with `file://`, wait for `document.fonts.ready`, and screenshot it at its `width`×`height` (`deviceScaleFactor: 1`). For desktop boards, clip off the top 84px (the browser strip). Then open `/dev/kit/pages/<page>?theme=<theme>&viewport=<kind>` at the same width and screenshot the same area. Skip the pair with a clear message if the page reports `data-design-ready="false"`.
   - **Components**: for each `[data-catalogue]` section present in both the reference catalogue and `/dev/kit/components`, take an element screenshot of each and compare.
   - Compare by writing the reference screenshot to `testInfo.snapshotPath(name)` and then `expect.soft(appShot).toMatchSnapshot(name, { maxDiffPixelRatio })`, where the ratio defaults to `0.04` and can be overridden with `DESIGN_MAX_DIFF`. Playwright's report then shows expected, actual and diff for every board. This needs no new dependency.
   - Filter with `--grep` (for example `npm run audit:design -- --grep "desktop/noon/home"`).
4. Document the three commands at the top of `design/README.md` under "Checking a change".

**Do not.** Add any dependency. Put fixtures or dev pages in the production bundle (verify with `npm run build` and a search of `dist/` for `sample-data`).

**Done when.** `npm run audit:design` runs, reports every page pair as skipped ("not built yet"), and the Components pair runs against the empty catalogue. Build output contains no fixture data.

**Commit.** `UI-P01: design compare harness and dev compare pages`

---

## UI-P02 — Rename the light theme: Exhibition → Noon

Follow `design/RULES.md`.

**Goal.** The two themes are **Noon** (light) and **Dusk** (dark). "Exhibition" disappears from the code, the UI and the docs. Values do not change yet (UI-P03 does that).

**Read first.** `src/lib/theme/semantics.ts` (`ThemeName = "exhibition" | "dusk"`), `src/contexts/ThemeContext.tsx` (`ThemeChoice = "exhibition" | "dusk" | "system"`, storage key `bg-theme`, the resolve step), the theme boot script in `index.html` (kept in sync with the context), `src/index.css` (`:root, :root[data-theme="exhibition"]` and `:root[data-theme="dusk"]`), `src/components/theme/ThemeToggle.tsx`, and every test that names a theme (`grep -rn "exhibition" src e2e index.html`).

**Do.**
1. `ThemeName` becomes `"noon" | "dusk"` and `ThemeChoice` becomes `"noon" | "dusk" | "system"`. Rename every object key, map entry and test fixture that uses `exhibition`.
2. `index.css`: `:root, :root[data-theme="exhibition"]` becomes `:root, :root[data-theme="noon"]`. Noon stays the default for a visitor with no stored preference.
3. **Migration, in both the boot script and `ThemeContext`:** a stored value of `"exhibition"` is read as `"noon"` and written back as `"noon"`. Add a unit test for it.
4. Every visible label reads **Noon · Dusk · System** (the ThemeToggle, any menu, aria-labels such as "Theme: Noon").
5. Update comments and docs that say Exhibition (`src/lib/theme/*`, any `docs/` or `README`), and note at the top of `semantics.ts` that Noon was called Exhibition before UI-P02.

**Do not.** Change any colour value. Change the storage key.

**Done when.** `grep -rni "exhibition" src e2e index.html` returns nothing except the migration line and its test. All theme tests, `css-parity` included, pass.

**Commit.** `UI-P02: rename the Exhibition theme to Noon`

---

## UI-P03 — Noon (Birch Mist) values and the new tokens

Follow `design/RULES.md`.

**Goal.** Every token in `design/tokens/tokens.css` exists in the code with exactly those values, in both themes, through the existing two-tier system (`primitives.ts` → `semantics.ts` → `index.css` → `tokens.ts`).

**Read first.** `design/tokens/tokens.css`, `design/tokens/token-map.md`, `src/lib/theme/primitives.ts`, `semantics.ts`, `tokens.ts`, the `:root` blocks in `src/index.css`, and the tests `css-parity.test.ts`, `contrast.test.ts`, `compliance.test.ts`, `glass.test.ts`.

**Do.**
1. For each row in `token-map.md`: if the token already exists (`--text`, `--text2`, `--line`, `--recess`, `--glass`, `--glass-2`, `--glass-border`, `--action`, `--on-action`, `--evidence`, `--evidence-fill`, `--lit`, `--on-lit`, `--cat-*`, `--bg`), set its Noon and Dusk values to the kit's. If it does not, add it: to `TOKEN_NAMES`, to both theme objects in `semantics.ts` (the `Record<TokenName, …>` type will force both), to every theme block in `index.css`, and to `t` in `tokens.ts` with the mechanical camel-case name (`--on-evidence-fill` → `t.onEvidenceFill`, `--arc-1` → `t.arc1`, `--shadow-card` → `t.shadowCard`).
2. Gradients (`--backdrop`, `--ambient`, `--orb-glass`, `--orb-solid`) and shadows (`--shadow-float`, `--shadow-card`, `--panel-highlight`, `--lamp-glow`, `--picture-lamp-glow`) are tokens too. Store them as strings in the same system.
3. Values without a hex primitive (rgba, gradients) may live directly in `semantics.ts`; hexes go through `primitives.ts` as the file's header requires. Add only the primitive steps a token consumes.
4. The `tokens.css` file includes a `[data-theme="system"]` block for completeness. `ThemeContext` already resolves `system` to `noon` or `dusk` before setting the attribute, so do not add that block.
5. Existing tokens the kit does not mention (`--porthole`, `--chrome-hi`, `--chrome-lo`, `--glass-hi`, `--card-frame`, `--card-thread`, …) keep their current values for now. UI-P14 and UI-P41 deal with them.
6. Update `contrast.test.ts` to the new measured pairs. Measured on the flattened glass surface (the kit's values): Noon text/glass 15.24, text2/glass 6.78, action/glass 7.12, on-action/action 7.07, evidence/glass 6.37, on-evidence-fill/evidence-fill 11.86, every category hue on glass ≥ 5.72; Dusk text/glass 14.26, text2/glass 7.69, label/glass 6.60, action/glass 6.37, on-action/action 6.35, evidence/glass 8.24, on-evidence-fill/evidence-fill 6.01, every category hue on glass ≥ 5.78. `--lit` on either ground is below 3:1 — it is light, never text or a state border; keep or add the test that asserts that.

**Do not.** Change any component. Rename existing tokens (only add and re-value).

**Done when.** `css-parity` passes with the new names in every block; contrast and compliance tests pass; `/dev/kit` shows the new colours on the existing controls in both themes.

**Commit.** `UI-P03: Noon (Birch Mist) values and overhaul tokens`

---

## UI-P04 — The focus ring on Noon

Follow `design/RULES.md`.

**Goal.** Keyboard focus is visible on both themes. Today the ring is 2px `--lit` with a 2px offset in both themes; lamp gold measures under 2:1 on Noon's ground, below the 3:1 floor for UI state.

**Read first.** `src/lib/theme/focus.ts` (and its comment, which claims the offset makes amber legal on the light ground — it does not on Noon).

**Do.**
1. `--focus-ring` already exists from UI-P03 (Noon `#1A2320`, the ink; Dusk `#D9A441`, the lamp). If UI-P03 skipped it, add it now through the same tiers.
2. `focus.ts` uses `--focus-ring` for the outline colour. Width 2px and offset 2px are unchanged; the outline stays an `outline`, not a `box-shadow`.
3. Rewrite the comment: the ring is ink on Noon (13:1 against the ground) and lamp gold on Dusk (7.5:1), because a focus ring is UI state (floor 3:1) and gold does not reach that on Noon.
4. Add a contrast assertion for `--focus-ring` against `--bg` in both themes (≥ 3:1).

**Done when.** Tabbing through `/dev/kit` shows an ink ring on Noon and a gold ring on Dusk; tests pass.

**Commit.** `UI-P04: focus ring uses ink on Noon`

---

## UI-P05 — Sentient as the display face

Follow `design/RULES.md`.

**Goal.** Every heading in the overhaul is set in **Sentient** (500). Figtree stays the UI and body face; DM Mono stays the data face. Bodoni Moda is retired.

**Read first.** `index.html` (the Google Fonts link currently loads Bodoni Moda, DM Mono and Figtree), `src/lib/theme/type.ts` (roles and the floors enforced there), `design/reference/fonts/`.

**Do.**
1. Copy `design/reference/fonts/Sentient-Medium.otf` and `Sentient-Bold.otf` to `public/fonts/`. Add two `@font-face` rules to `src/index.css` (`font-family: "Sentient"`, weights 500 and 700, `font-display: swap`) and a `<link rel="preload" as="font" type="font/otf" href="/fonts/Sentient-Medium.otf" crossorigin>` in `index.html`.
2. Remove Bodoni Moda from the Google Fonts URL; keep `DM Mono:wght@400;500` and `Figtree:wght@400..600`.
3. In `type.ts`, add `type.display(px)` returning a complete role for Sentient at that size, with letter-spacing and line-height by size band, exactly as the reference uses them:
   - 52px and up: letter-spacing −0.04em, line-height 0.95
   - 44–51px: −0.035em, line-height 1
   - 30–43px: −0.03em, line-height 1 (−0.035em for page headings on mobile at 30–36px)
   - 20–29px: −0.02em, line-height 1.05
   - 17–19px: −0.02em, line-height 1.05
   - the lockup wordmark: −0.03em, line-height 1, at its own size (16, 18, 19, 21, 34, 64, 70)
   Existing display roles move from Bodoni Moda to Sentient at their current sizes.
4. Replace the floor "Bodoni Moda never under 20px" with "Sentient never under 17px" (card titles on mobile are 17–18px in the reference). Keep "Figtree never under weight 400 below 18px".
5. Add `type.mono(px, { caps })` for DM Mono: eyebrows are uppercase with letter-spacing .09em (10–12px); data values have no extra tracking; large numbers (22px and up) get −0.02em. Add `fontVariantNumeric: "tabular-nums"` wherever digits align in columns.
6. Update the comments in `type.ts` and the theme skill text to say Sentient.

**Do not.** Change the size of any existing heading.

**Done when.** `/dev/kit` headings render in Sentient in both themes; the network panel shows no Bodoni Moda request; type tests pass.

**Commit.** `UI-P05: Sentient replaces Bodoni Moda as the display face`

---

## UI-P06 — Identity: mark, lockup and the cover fallback

Follow `design/RULES.md`.

**Goal.** Three identity primitives in `src/components/brand/`, shown in the **Identity** section of `/dev/kit/components`.

**Reference.** `design/reference/components/{noon,dusk}.html` → section `Identity`; `data-ui="mark"`, `data-ui="lockup"`, `data-ui="cover-fallback"`. Six skies: `design/tokens/tokens.json → _notes.coverFallbackSkies`.

**Build.**
1. **`Mark`** (`size`, optional `halo`). An inline SVG, `viewBox="0 0 40 40"`, `aria-hidden`, body in `currentColor`:
   - lamp: `<ellipse cx="20" cy="4.8" rx="5.5" ry="3.4">` filled `--lit` (the tagline passes `--tagline-lamp` instead);
   - frame: `<rect x="5.5" y="11.5" width="29" height="26" rx="5">`, no fill, stroke `currentColor`, stroke-width 3;
   - work: `<rect x="12" y="18" width="16" height="13" rx="2.5">` filled `currentColor`;
   - halo (Dusk only, when `halo`): `<ellipse cx="20" cy="9" rx="10" ry="4">` filled `--lit` at opacity .22, drawn first.
2. **`Lockup`** (`size`, optional `color`). A row: `Mark` at `Math.trunc(size * 1.1)`px (with halo on Dusk), gap `Math.trunc(size * 0.38)`px, then the word **buildgallery** (lower case) in `type.display(size)` — Sentient 500, letter-spacing −0.03em, line-height 1. Sizes used: 16 (footer), 19 (mobile header), 21 (site header), 34 (mobile sign-in), 64 and 70 (desktop sign-in). When it is a link home, the link's accessible name is "buildgallery home".
3. **`CoverFallback`** (`seed: string`, `radius`). The landscape drawn when a build has no cover (`resolveCover()` returns nothing). SVG `viewBox="0 0 300 180"`, `preserveAspectRatio="xMidYMid slice"`, filling its box:
   - sky: a vertical linear gradient with the palette's colours 0, 1 and 2 at offsets 0, .55 and 1;
   - sun: `<ellipse cx={[70,120,190,230,150,210][i]} cy="112" rx="24" ry="24">` in colour 3 at opacity .9;
   - hills, three paths, filled with colours 4, 5 and 6, exactly:
     `M0 118 C40 98 70 108 100 94 C130 80 160 102 200 96 C240 90 270 106 300 98 L300 180 L0 180Z`
     `M0 140 C50 126 90 138 140 128 C190 118 230 138 300 126 L300 180 L0 180Z`
     `M0 162 C60 152 120 164 180 156 C230 150 270 160 300 154 L300 180 L0 180Z`
   - the palette index `i` is a stable hash of `seed` (the build id) modulo 6. The dev fixtures pass `cover_sky` to force the mockup's choice. Gradient ids must be unique per instance (`useId`).
   The skies are artwork: the same in both themes, not tokens.

**Done when.** The Identity section of `/dev/kit/components` compares within 0.04 in both themes.

**Commit.** `UI-P06: mark, lockup and cover fallback`

---

## UI-P07 — Controls

Follow `design/RULES.md`.

**Goal.** The control set every page uses, in `src/components/brand/`, shown in the **Controls** section of `/dev/kit/components`. Existing controls in `src/lib/theme/controls.ts` are the starting point; extend or add, but keep existing call sites working.

**Reference.** Section `Controls`; `data-ui="button"` (with `data-variant`), `icon-button`, `segmented`, `tabs`, `filter-chip`, `category-chip`, `eyebrow`, `avatar`.

**Build.** All radii from the radius scale; all colours via `t`.
1. **`Button`** — `variant: "primary" | "secondary" | "ghost"`, `size` (height: 28 | 30 | 32 | 34 | 36 | 38 | 42 | 44 | 46 | 48), `fontSize` (11–15), optional `icon`, optional `fullWidth`. Padding 0 14px at every size; radius 12; gap 7px; icon 15px, stroke 1.8; no wrap. Weight 600 (primary) or 500. The reference states size and font size for every instance; the pairs used are 28/11, 30/12, 32/12, 34/12, 36/13, 38/13, 42/14, 44/13, 46/15, 48/14 and 48/15. Defaults: 36/13. `fullWidth` makes it `display: flex; width: 100%` (the mobile 48px buttons).
   - primary: background `--action`, text `--on-action`, 1px border `--action`;
   - secondary: background `--glass-2`, text `--text`, 1px border `--line`;
   - ghost: transparent, text `--text2`, transparent border.
   Only one primary per page body (the header's New build is chrome and does not count).
2. **`IconButton`** — `size: 30 | 34 | 38`, required `label` (becomes `aria-label`). Square, radius 12, background `--glass-2`, 1px border `--line`, icon colour `--text2`, icon 16px stroke 1.6.
3. **`Segmented`** — `items`, `value`, `onChange`, `size: 30 | 32 | 34 | 36 | 38`. Track: inline-flex, gap 2px, padding 4px, radius 12, background `--glass-2`, 1px border `--line`. Items: height = size − 8, padding 0 12px, radius 8, Figtree at `fontSize` 11 | 12 | 13 (default 12; each reference instance states its own — e.g. 30/11 for panel filters, 32/11 in the footer, 36/12 for the gallery lenses, 36/13 on mobile); current: background `--text`, text `--on-text`, weight 600; others transparent, `--text2`, weight 500. Buttons with `aria-pressed`; the group has an accessible name.
4. **`UnderlineTabs`** — font size 12 | 13 | 14 (default 14). Row: flex, gap 24px, aligned to the bottom, 1px bottom border `--line`. Current: Figtree 600 `--text`, padding-bottom 10px, 2px bottom border `--action`. Others: `--text2`, padding-bottom 12px. `role="tablist"` / `role="tab"` / `aria-selected`.
5. **`FilterChip`** (mobile sideways rows) — height 36, padding 0 12px, radius 10, Figtree 13px 500, optional count (DM Mono 10px, opacity .7, gap 7px). On: background `--text`, text `--on-text`, border `--text`. Off: background `--glass-2`, text `--text`, border `--line`.
6. **`CategoryChip`** — repaint `components/brand/CategoryChip.tsx` without changing its props: 1px border `--line`, text `--cat-<category>`, DM Mono 10px, padding 2px 6px, radius 8, no wrap, no fill.
7. **`Eyebrow`** — DM Mono 11px (10px inside wall labels and panels), uppercase, letter-spacing .09em, colour `--label`, no wrap.
8. **`Avatar`** — circle; sizes 18–110; background one of `#5C5480 #3F7A8C #9A5B4A #4B3F8C #3E6B55 #8C4A6A` chosen by a stable hash of the user id (fixtures pass `avatar_hue`); initials in Figtree 600 at `Math.trunc(size * .38)`px, colour `#F7F8F9`. A profile image, when there is one, fills the circle instead.

**Do not.** Change existing button call sites in live pages (they move when their page is rebuilt).

**Done when.** Controls section compares within 0.04 in both themes; every control is reachable and operable with the keyboard on `/dev/kit/components`.

**Commit.** `UI-P07: controls — button, icon button, segmented, tabs, chips, eyebrow, avatar`

---

## UI-P08 — The lamp and the plaque

Follow `design/RULES.md`.

**Goal.** The proof primitives: the lamp dot, the picture lamp above a card, and the plaque — driven by `plaqueState()` (`healthy | stale | unreproduced`) as `RULES.md §5` describes.

**Read first.** `components/brand/Plaque.tsx` (`Plaque`, `PlaqueLamp`, `plaqueState`, sizes `card | header | row`, `NEVER_CONFIRMED`), `lib/build/signals.ts` (`freshnessLabel`, `isStale`, `STALE_AFTER_DAYS`).

**Reference.** Section `Proof`; `data-ui="lamp-dot"` (`on`, `dim`), `picture-lamp` (`on`, `dim`, `off`), `plaque` (`fresh`, `stale`, `never`).

**Build.**
1. **`LampDot`** (`width` × `height`, default 10×7; also 12×8, 20×12, 22×14): an ellipse (`border-radius: 50%`) in `--lit`, opacity 1 when healthy and .45 when stale, `box-shadow: var(--lamp-glow)` when healthy (none on Noon by token). Repaint `PlaqueLamp` to this.
2. **`PictureLamp`** (`state`): an 18px-tall centred row.
   - lamp: a 30×8 ellipse in `--lit`, margin-top 3px, opacity 1 / .45, `box-shadow: var(--picture-lamp-glow)` when healthy;
   - wash: absolutely positioned at `left: 50%; top: 10px; width: 220px; height: 110px; margin-left: -110px`, `background: radial-gradient(ellipse 50% 60% at 50% 0%, var(--picture-lamp-wash) 0%, transparent 100%)`, opacity .45 when stale, `pointer-events: none`;
   - `unreproduced`: an empty 18px spacer, so cards in a row stay aligned.
3. **`Plaque`** — same props and states, repainted:
   - container: flex, wrap, align centre, gap 7px;
   - tag: background `--evidence-fill`, text `--on-evidence-fill`, DM Mono (10px at size `card`, 11px at `row`, 13px at `header`), padding 2px 6px, radius 8, no wrap — "**N reproduced**";
   - freshness: flex, gap 5px, Figtree (10px card, 11px row, 12px header), `--text` (healthy) or `--text2` (stale), a `LampDot`, then the text. Sizes `card` and `row` use the short form "3 days ago, on sonnet-4.5"; `header` uses `freshnessLabel()` in full ("last confirmed working 3 days ago, on sonnet-4.5"). The text may wrap;
   - unreproduced: Figtree at the same size in `--text2`: "not yet reproduced".

**Done when.** Proof section compares within 0.04; unit tests cover the three states for all three components.

**Commit.** `UI-P08: lamp dot, picture lamp and plaque`

---

## UI-P09 — Panels, wall labels, stats and striped bars

Follow `design/RULES.md`.

**Goal.** The containers and the density pieces borrowed from the dashboard reference.

**Read first.** `components/progress/LitBar.tsx` (`value`, `max`, `label`, `valueText`), `src/lib/theme/elevation.ts`, `glass.ts` and `glass.test.ts`.

**Reference.** Section `Panels`; `data-ui="panel"` (`glass`, `flat`), `panel-head`, `wall-label`, `stat`, `detail`, `striped-bar`.

**Build.**
1. **`Panel`** — `variant: "glass" | "flat"`, `padding` (default `16px 18px`; lists use `14px 16px`). Glass: background `--glass`, 1px border `--glass-border`, radius 16, `box-shadow: var(--shadow-card), var(--panel-highlight)`, `overflow: hidden`, **no backdrop-filter**. Flat (compose and import only): background `--flat`, 1px border `--glass-border`, radius 16, no shadow. Keep `glass.test.ts` passing: panels are not blurred surfaces.
2. **`PanelHead`** — title (Figtree 600, 16px default; 13–15px where the reference is smaller), optional subtitle (Figtree 12px `--text2`, 3px below), optional right slot (gap 6px). Title and subtitle stack; the right slot aligns to the top.
3. **`WallLabel`** — `columns` (2, 3 or 4) and cells. Grid with `repeat(n, minmax(0, 1fr))`, gap 1px on a `--hairline` background, radius 12, `overflow: hidden`. Each cell: background `--cell`, padding 12px 14px, column with gap 7px.
4. **`Detail`** — an `Eyebrow` (10px) over a DM Mono 14px value in `--text` (or a passed colour), no wrap, ellipsis.
5. **`Stat`** — an `Eyebrow` (10px), then a baseline row: the value in DM Mono 22px, letter-spacing −0.02em, `--text`; optionally "&nbsp;/ {of}" in DM Mono 12px `--text2`; optionally a `StripedBar` 10px tall.
6. **`StripedBar`** — `value` 0–100, `colour` (token), `height` (8–16, default 12), optional `ticks: {at, colour}[]`. A flex row of full width: the filled part `width: value%` with `background: repeating-linear-gradient(-60deg, <colour> 0 2.5px, transparent 2.5px 6px)`; the rest `flex-grow: 1` with the same pattern in `--bar-base`; each tick absolutely placed at `left: at%`, `top: -4px; bottom: -4px`, 1.5px wide. `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a label. Colours by meaning: `--lit` for progress, XP and goals; `--evidence` for proof and freshness; `--action` for money and bounties; `--cat-agents` for rebuilds. Make `LitBar` render a `StripedBar` in `--lit` so its call sites change look without changing code.

7. **`PageHeading`** (`eyebrow`, `title`, `sub?`, `size`) — the heading block that stands on the backdrop above a phone's panels (`data-ui="page-heading"` on every mobile board except Home and Sign in): a column, gap 8, padding 4px 2px: `Eyebrow`; an `h1` in `type.display(size)` (30 | 32 | 34 | 36 as each page states), −0.035em, line-height 1, `--text`; the sub in Figtree 14px, line-height 1.5, `--text2`. On desktop the same three parts sit inside the page's header panel at that page's sizes, so the component takes a `variant: "bare" | "in-panel"`.

**Done when.** Panels section compares within 0.04 in both themes; `glass.test.ts`, `elevation.test.ts` pass.

**Commit.** `UI-P09: panel, wall label, stat, detail and striped bar`

---

## UI-P09b — Liquid glass, on main panels only

Follow `design/RULES.md`.

**Goal.** The page-level panels become liquid glass: a refracted edge where the backdrop bends through them, over a fill solid enough to read body text on. Everything inside a panel — build cards, feed rows, wall labels, wells — stays as it is: slightly translucent and flat.

**Read first.** `components/brand/Panel.tsx` (UI-P09), `src/index.css`, `src/lib/theme/glass.ts` and `glass.test.ts` (the blur rules and the test that enforces them), `src/components/shell/SiteFrame.tsx`.

**This prompt amends three standing rules. Make each change deliberately, and say so in the report.**

1. `RULES.md` §3 says no new CSS classes for styling. Liquid glass needs two pseudo-elements, which inline styles cannot express. **One** class, `.bg-glass`, is added to `src/index.css` for this and nothing else. Every colour inside it is a custom property, so the tokens still govern it.
2. `glass.test.ts` asserts a small set of blurred surfaces. The budget becomes: the four chrome surfaces from `UI-P40` **plus** page-level panels. Update the assertion and its comment in this commit.
3. The performance guidance forbids `feDisplacementMap`. It is the whole effect here, so it is permitted on this one filter, under the guards in step 5. Nothing else in the app may use one.

**Build.**

1. **The filter, mounted once.** `src/components/brand/GlassFilter.tsx` renders a hidden `<svg width="0" height="0" aria-hidden="true" style="position:absolute">` holding one filter. `SiteFrame` renders it once, above everything. Values, as measured over the real backdrop at panel size:

   ```
   <filter id="bg-glass-distortion" x="0%" y="0%" width="100%" height="100%">
     <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="92" result="noise"/>
     <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
     <feDisplacementMap in="SourceGraphic" in2="blurred" scale="42"
                        xChannelSelector="R" yChannelSelector="G"/>
   </filter>
   ```

   The source this came from uses `baseFrequency 0.035` and `scale 180`, tuned for a 400×300 card. At 1280px those values tear the panel apart: the frequency drops to `0.012` so one wave spans the panel instead of twenty, and the scale to `42` so the edge bends without smearing. Keep `x/y/width/height` at `0%/100%` — it clips the displacement to the panel and stops the corners pulling in content from outside.

2. **The class**, in `src/index.css`, exactly these rules:

   ```css
   .bg-glass { position: relative; isolation: isolate; }
   .bg-glass > * { position: relative; z-index: 1; }
   .bg-glass::before {
     content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit;
     pointer-events: none; background: var(--glass-fill);
     border: 1px solid var(--glass-border);
     box-shadow: inset 0 1px 0 var(--panel-highlight-color),
                 inset 0 0 20px -12px var(--glass-rim);
   }
   .bg-glass::after {
     content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
     pointer-events: none; isolation: isolate;
     backdrop-filter: blur(7px) saturate(1.2);
     -webkit-backdrop-filter: blur(7px) saturate(1.2);
     filter: url(#bg-glass-distortion);
     -webkit-filter: url(#bg-glass-distortion);
   }
   ```

   **`.bg-glass > * { position: relative; z-index: 1 }` is not optional.** The tint layer is positioned, so without it the tint paints over the panel's own text and every word goes muddy. This is the single easiest way to get this wrong.

3. **Tokens** (UI-P03's system, both themes). `--glass-fill` is the one that matters: it is what body text sits on, so it is not the near-transparent fill the source uses.
   - `--glass-fill`: Noon `rgba(255,255,255,.58)`, Dusk `rgba(26,21,35,.74)` — **the two themes are not symmetric on purpose.** Noon's text is near-black on a light backdrop, so the fill can stay thin and let the horizon's salmon through; measured over the backdrop it still gives `--text` 13.2:1 and `--text2` 5.9:1. Dusk's text is near-white over a field that lifts into violet and salmon, so at `.58` the light areas eat the text; `.74` is where it holds. Do not "tidy" these to the same number.
   - `--glass-rim`: Noon `rgba(255,255,255,.55)`, Dusk `rgba(255,255,255,.55)`
   - `--panel-highlight-color`: Noon `rgba(255,255,255,1)`, Dusk `rgba(238,234,244,.12)`
   - `--glass-halo` (the outer edge light): Noon `0 0 21px -10px rgba(26,35,32,.18)`, Dusk `0 0 21px -8px rgba(255,255,255,.22)`
   `Panel` keeps `--shadow-card` and adds `--glass-halo` before it.

4. **Where it applies, and where it must not.** `Panel` gains `surface: "glass" | "flat" | "plain"`; only `glass` adds `.bg-glass`.
   - **Liquid glass:** a panel that is a direct child of the page column and sits on the backdrop — the Home hero, the visitors' book, the orbs panel, challenges, streak, where-next, the Gallery header and facet column, the Build proof panel, anatomy, timeline, the Bounties header and solve panel, the Profile level panel, works, activity, marks, the Activity list and its right column, and the sign-in card.
   - **Never:** anything that repeats inside a panel or a grid — build cards, vacant frames, feed rows, notification rows, wall-label cells, part viewer, `--recess` wells, chips, buttons, the inner preview on the import page. These keep what they have now: a slightly translucent fill, 1px border, no backdrop-filter, no filter.
   - **Never nested:** a `.bg-glass` inside another `.bg-glass` doubles the blur cost and reads as fog. Add a dev-only assertion that warns in the console if one is found.
   - Compose and import stay `flat` (§5.5 of the handoff) — a working surface does not refract.

5. **Guards**, all of them:
   - Below 768px, drop the `filter` and keep the blur and fill. Phone GPUs and mobile Safari pay for the displacement on every scroll frame, and at phone width the refraction is a few pixels wide and invisible anyway. Do this in CSS with a media query, not in JS.
   - `@media (prefers-reduced-transparency: reduce)` — drop both `filter` and `backdrop-filter`, and raise `--glass-fill` to `.96` in both themes.
   - `@supports not (backdrop-filter: blur(2px))` — fill only, no filter.
   - Safari applies the SVG filter to the element but not reliably to what is behind it, so it degrades to frosted glass without the refracted edge. That is acceptable; do not add a Safari-specific hack.

6. **Contrast.** Re-run `npm run audit:contrast` with panels composited over the *lightest* and *darkest* points of the backdrop, not over a flat colour. Every text token on `--glass-fill` must still pass 4.5:1 at both extremes. Measured at the values above, Noon's worst case is `--text2` at about 5.9:1 and Dusk's is tighter — check it rather than assuming. If a pair fails, raise that theme's `--glass-fill`; never lighten the text, and never raise both themes because one failed.

**Done when.** The listed panels refract the backdrop at their edges in both themes; no card, row or cell does; text contrast passes at both backdrop extremes; `glass.test.ts` passes with its updated assertion; scrolling the Gallery at 1440 holds 60fps with paint flashing on; and the phone build has no `feDisplacementMap` in its computed styles.

**Commit.** `UI-P09b: liquid glass on page panels`

---

## UI-P10 — Orbs

Follow `design/RULES.md`.

**Goal.** The three orbs. Each shows one real number; none is decoration.

**Read first.** `components/profile-game/LevelRing.tsx` and `AvatarLevelRing.tsx`, `lib/progress/index.ts` (`xpProgressInLevel`, `levelFromXp`).

**Reference.** Section `Orbs`; `data-ui="orb-glass"`, `orb-solid`, `orb-ring`.

**Build.** All circles (`border-radius: 50%`, the only use of `--r-full` besides avatars and dots). Sizes used: 162, 150, 140, 128, 118 (glass and solid); 150, 120, 118, 112 (ring).
1. **`OrbGlass`** (`size`, `label`, optional `sub`): background `--orb-glass`; `box-shadow: inset 0 0 0 1px var(--orb-glass-edge), inset 0 12px 40px rgba(255,255,255,.18), 0 20px 50px rgba(0,0,0,.25)`; a centred column with gap 5px and `padding-bottom: 16%` of the size (the text sits above the glowing ring inside); a static dotted circle 18px (`r=7.5`, stroke `--on-orb-glass` 1.6, `stroke-dasharray: 1.2 3.4`, round caps); the label in Figtree 13px 500 `--on-orb-glass`, centred; the sub-label in DM Mono 10px at opacity .8.
2. **`OrbSolid`** (`size`, `top`, `value`, `bottom`): background `--orb-solid`, `box-shadow: 0 20px 50px rgba(0,0,0,.25)`; a centred column with gap 3px: `top` in Figtree 11px `--on-orb-solid-2`; `value` in DM Mono at `Math.trunc(size * .17)`px, letter-spacing −0.03em, `--on-orb-solid`; `bottom` like `top`.
3. **`OrbRing`** (`size`, `percent`, `value`, `caption`): outer circle `background: conic-gradient(var(--lit) 0 {p}%, var(--ring-track) {p}% 100%)`, padding 9px, `box-shadow: var(--ring-glow)`; inside it a glass orb (as above, without the spinner) with `padding-bottom: 12%`; `value` in Sentient at `Math.trunc(size * .2)`px, −0.03em, line-height 1; `caption` in DM Mono 10px. Give it `role="img"` and a full label ("Level 7, 77% of the way to level 8"). Repaint `LevelRing` to use it.
4. Nothing animates. (A later change may add a slow turn to the dotted circle while a live value updates; not now.)

**Done when.** Orbs section compares within 0.04 in both themes.

**Commit.** `UI-P10: glass, solid and ring orbs`

---

## UI-P11 — Tagline, hero plate and part viewer

Follow `design/RULES.md`.

**Goal.** The three large composition pieces used by Home, Gallery, Build page, Profile and Sign in.

**Reference.** Section `Tagline` of the catalogue (`data-ui="tagline"`); the hero plate on `design/reference/desktop/*/build.html` and the featured build on `…/gallery.html`; the part viewer on `…/build.html` (the panel whose strip reads "PART 01").

**Build.**
1. **`Tagline`** (`lines: [string, string, string]`, `size`, `offsets: [number, number, number]`). A column of three chips aligned left. Each chip: background `--tagline-chip`, text `--on-tagline-chip`, `type.display(size)` (−0.03em, line-height 1), padding `trunc(size*.22)px trunc(size*.32)px trunc(size*.26)px`, `margin-left: offset`, no wrap. Radii: line 1 `14px 14px 0 14px`, line 2 `0 14px 14px 14px`, line 3 `14px`. Line 2 ends with a `Mark` at `trunc(size*.6)`px (body `--on-tagline-chip`, lamp `--tagline-lamp`) after a gap of `trunc(size*.25)`px. Sizes and offsets used: desktop Home 46 → 0 / 90 / 30; mobile Home 30 → 0 / 44 / 14; desktop Sign in 40 → 0 / 70 / 24; mobile Sign in 26 → 0 / 40 / 12. For screen readers the whole thing is one heading with the sentence as its text ("Every AI build, hung with its proof."); the chips are `aria-hidden`.
2. **`HeroPlate`** — two variants.
   - `featured` (Gallery): a `PictureLamp` above a row that fills the remaining height, radius 16, 1px border `--glass-border`, `--shadow-card`, `overflow: hidden`: the cover (flex 1.2) and an inverse panel (flex 1; background `--inverse`, text `--on-inverse`, padding 18px 20px, space-between column). Top line: "MOST REPRODUCED THIS MONTH" in DM Mono 10px, .08em, `--on-inverse-2`, with an 18px `Mark` on the right. Bottom: the title in `type.display(32)`; the outcome in Figtree 12px, line-height 1.45, `--on-inverse-2`; the plaque on the inverse ground: the tag in `--inverse-evidence-fill` / `--on-inverse-evidence-fill` (DM Mono 10px, padding 2px 6px, radius 8), the lamp dot 10×7, then "{when}, on {model}" in Figtree 11px `--on-inverse` — give `Plaque` a `tone="inverse"` prop for this. The rank square sits at `left: 20px; bottom: -14px`: 84×84, radius 14, `--inverse` with `--on-inverse`, `box-shadow: var(--shadow-square)`: "NO." (DM Mono 9px → 10px, .1em, opacity .7) over the rank in `type.display(40)` with −0.04em.
   - `build` (Build page): see UI-P29 for placement; this prompt builds the plate only — absolutely placed 16px from left, right and bottom; padding 18px 20px 18px 120px; radius 16; background `--plate`; 1px border `--header-border`; `backdrop-filter: blur(16px) saturate(1.15)`; h1 in `type.display(44)`; outcome Figtree 13px, line-height 1.45, `--text2`, max-width 560px, 8px above; credit row Figtree 12px `--text2`, 10px above, gap 14px, ending with the Δ line in DM Mono 11px. The 88×88 mark square (radius 14, `--inverse`, a 50px `Mark` in `--on-inverse`, `box-shadow: var(--shadow-square)`) sits at `left: 30px; bottom: 30px`. This plate is one of only three blurred surfaces on a page (with the header and, on phones, the dock).
3. **`PartViewer`** — radius 16, background `--solid`, 1px border `--glass-border`, `--shadow-card`, column:
   - a 46px strip: a 96px block in `--viewer-block` (radius `0 0 14px 0`) holding "PART 01" in DM Mono 11px, .08em, `--text2`, 16px from the left; then the raised tab (grow, margin `7px 0 0 7px`, background `--tab`, 1px `--header-border` border without the bottom edge, radius `12px 0 0 0`, padding-left 12px, gap 8px): a `CategoryChip`, then "01 · System prompt" in Figtree 12px 600;
   - the page's `UnderlineTabs` at 12px, padding `10px 14px 0`;
   - the body, padding 12px 16px, gap 10px: a row with `Segmented` Run / Understand (size 30) and a secondary 30px **Copy** button with the copy icon; the layer blurb in Figtree 11px `--text2`; the content in Figtree 14px, line-height 1.65, `--text`.
   No window dots, no close button: this is a frame for one part, not a browser.

**Done when.** Tagline section compares within 0.04; the plate and viewer are on `/dev/kit/components` in a new "Compositions" section and match the Build and Gallery boards by eye (they are compared as part of UI-P28 and UI-P29).

**Commit.** `UI-P11: tagline, hero plate and part viewer`

---

## UI-P12 — Charts, timeline, activity grid and rank rungs

Follow `design/RULES.md`.

**Goal.** The small data drawings, as hand-written SVG and styled elements. No chart library.

**Read first.** `components/progress/EngagementGrid.tsx`, `components/streaks/streak-calendar.tsx`, `components/build/eventDisplay.tsx`, `components/trophies/badge-tile.tsx`, `creator-mark-tile.tsx`.

**Reference.** Section `Charts`; `data-ui="chart-line"`, `chart-step`, `chart-histogram`, `sparkline`, `activity-grid`; the timeline on `desktop/*/build.html` ("Watch it get built"); rank rungs on `desktop/*/bounties.html` ("Top solvers") and creator marks on `desktop/*/profile.html`.

**Build.**
1. **`LineChart`** (`width`, `height`, `values`, `markerIndex`): five vertical gridlines at sixths in `--hairline`; 101 ticks along the bottom, every fifth 10px tall and the rest 6px, in `--line`; the series before the marker as a 1.5px polyline in `--label` at opacity .7; the series from the marker on as a 1.8px polyline in `--evidence` with an area under it (`--evidence` from opacity .28 to 0); a dashed vertical marker (`--text`, 1.4px, `3 3`) at the marker. Values map into `[14px from the bottom, 8px from the top]`.
2. **`StepChart`**: six gridlines at sevenths in `--hairline`; a step-after line in `--cat-agents` at 1.6px and the area under it (`--cat-agents` from opacity .4 to .03).
3. **`Sparkline`** (default 54–60 × 18–20): one 1.4px polyline in `--evidence`.
   **`Histogram`** (`width`, `height`, `values` 0–1, `fromIndex`): an SVG of `n` bars at `width / n` each, drawn `x = k·bw + 2`, `width = bw − 4`, height `max(4, v · (height − 6))`, sitting on the bottom edge; bars from `fromIndex` on are salmon `#E8A283`, the ones before are `--bar-base`; behind them a band from `x = fromIndex · bw` to the right edge in `rgba(140,120,196,.14)`. Both of those values are the same in both themes (see the end of `token-map.md`). Nothing uses it yet — it exists so the catalogue's Charts section compares, and so a distribution has a drawn form the day one is needed. Same file as the other charts.
4. **`ActivityGrid`** (`days`, 7 rows, as many columns as weeks): cells 12×12, radius 4, gap 3px, columns in a row with gap 3px (desktop and mobile Profile both show 22 columns: 22 × 15 − 3 = 327px). Empty day `--bar-base`; active days `--lit` at opacity .3, .55, .8 or 1 by volume quartile; a frozen day (`getStreakDays` kind `frozen`) is transparent with a 1.5px `--evidence` border. Repaint `EngagementGrid` / `streak-calendar` onto it.
5. **`Timeline`** (`events: {kind, at, text}[]`): a 1px `--line` rail 5px from the left, from 6px below the top to 16px above the bottom. Each item: a grid `16px 44px 1fr`, gap 10px, 14px below: an 11px dot coloured by `EventKind` (prompt `--cat-instruction`, milestone `--evidence`, breakage `--cat-breakage`, note `--label`, deploy `--lit`; on Dusk each dot glows `0 0 10px` in its own colour); the time in DM Mono 10px `--label`; the kind in DM Mono 10px, .08em, uppercase, in the same colour (deploy uses `--lit-ink`, because it is read), then the text in Figtree 12px `--text`, 2px below.
6. **`RankRung`** (`rank`, `tier: "highest" | "rare" | "common" | "none"`, `size: 28 | 32 | 40`): radius 9 (10 at 32, 12 at 40); highest: background `--lit`, text `--on-lit`; rare: background `--recess`, text `--text`; common: 1.5px border `--line`, text `--text`; none: text `--label`. The rank in Sentient (16 / 18 / 22px). Creator-mark tiles use the same ladder at 46×46 (radius 13) with a 20px trophy icon; the highest tile adds `box-shadow: var(--rank-glow)` (a glow on Dusk, none on Noon). Rarity is weight and fill, never a rainbow of hues.

**Done when.** Charts section compares within 0.04; the timeline, rungs and mark tiles are in the Compositions section.

**Commit.** `UI-P12: line, step and spark charts, activity grid, timeline, rank rungs`

---

## UI-P13 — The page backdrop: horizon, arc and grain

Follow `design/RULES.md`.

**Goal.** One `PageBackdrop` component that paints the room behind every page: `--ambient` over `--backdrop`, the glowing arc, and film grain on Dusk.

**Reference.** Any page board (`desktop/*/home.html`, `mobile/*/home.html`); `data-ui="arc"` and `data-ui="grain"`.

**Build.**
1. **Layer.** `PageBackdrop` renders as the first child of the page region: absolutely positioned to cover the whole document height (not `position: fixed` — the backdrop scrolls with the page and costs one paint), `background: var(--ambient), var(--backdrop)`, `pointer-events: none`, `z-index: 0`. Everything else sits above it.
2. **Arc.** An inline SVG in the top-right of the first screen. Draw it in the reference's coordinate space and scale with the viewport width: `viewBox="0 0 1440 1066"`, `preserveAspectRatio="xMaxYMin slice"`, circle centre (1780, −520), radius 1080 (mobile: `viewBox="0 0 390 640"`, centre (560, −300), radius 470). Filters: a Gaussian blur of 46 for the haze and 7 for the middle stroke. Gradient: `userSpaceOnUse`, from x = cx − r at the top to the bottom-right corner.
   - Dusk: haze stroke `--arc-haze`, width 170, opacity .5, blurred; middle stroke gradient (0 `--arc-1`, .4 `--arc-2`, 1 `--arc-3`), width 16, opacity .95, blurred 7; core stroke `#FFFFFF` (`--arc-1`), width 2.4; outer ring at r + 12, `--arc-outer`, width 1, opacity .5.
   - Noon: haze stroke `--arc-haze`, width 130, opacity .6, blurred; core stroke gradient (0 `--arc-1`, .55 `--arc-2`, 1 `--arc-3`), width 2.4; outer ring at r + 12, `--arc-outer`, width 1, opacity .35.
   The same component draws the smaller arcs inside the Build page hero (`viewBox 0 0 900 400`, centre (1100, −260), r 620), the Profile banner (`0 0 900 260`, (1150, −420), 760) and the mobile Build hero (`0 0 362 380`, (520, −240), 420).
3. **Grain** (Dusk only): an SVG covering the layer with `<feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch">`, opacity .15, `mix-blend-mode: overlay`.
4. Static: no animation, no `feDisplacementMap`, nothing reacting to scroll. Unique SVG ids per instance.

**Done when.** A throwaway `/dev/kit/pages/backdrop` shows the backdrop at 1440 and 390 in both themes and matches the empty areas of the reference boards by eye.

**Commit.** `UI-P13: page backdrop — horizon, arc and grain`

---

## UI-P13b — The living backdrop

Follow `design/RULES.md`. **This replaces what `UI-P13` built.** If `UI-P13` has not run, build it from here instead and skip its static arc.

**Goal.** The backdrop stops being a static SVG and becomes a slow, continuous gradient field: silk folds that drift on their own, bottoming out at the darkest purple on Dusk, with the arc region lifting into violet and salmon. A click sends a soft wavefront through the folds.

**Read first.** `UI-P13`'s `PageBackdrop`, `src/lib/theme/tokens.ts`, `design/tokens/tokens.json` (the `backdrop`, `ambient`, `arc*` and `haze` values per theme), `src/components/shell/SiteFrame.tsx`, and the reference boards for the colour it has to match.

**This prompt amends a standing rule.** `RULES.md` §3.4 and the performance guidance say the backdrop is static, one paint, no animation. It is now a continuously rendering WebGL canvas. Update that line in `RULES.md` and in `HANDOFF.md` §3.4 in this commit, with the budget in step 4.

**Build** `src/components/brand/PageBackdrop.tsx`.

1. **The canvas.** One `<canvas>`, `position: fixed; inset: 0; z-index: 0`, `aria-hidden`, behind everything in `SiteFrame`. One WebGL context, one fullscreen triangle, no library and no dependency. Buffer at `min(devicePixelRatio, 1.5) × 0.85` of the viewport (`× 0.72` above 2.2 megapixels) and upscaled — the field has no hard edges, so nobody can tell.

2. **The field.** A fragment shader. Value noise → 5-octave fbm → two rounds of domain warp (`q` from the fbm, then `r` from `p + 1.7q`, then the final `f` from `p + 1.9r`). That second warp is what makes folds instead of blobs; one round looks like smoke. Then:
   - start at `--bg` (Dusk `#1A1523`, the darkest purple — the whole field bottoms out here);
   - mix toward a fold shadow by `smoothstep(0.30, 0.95, f)`, at full strength on Dusk and `0.42` on Noon so the light theme stays light;
   - Noon only: a warm horizon band, `exp(-((uv.y - 0.52) / 0.09)²)`, in the arc's salmon;
   - lift the top-right toward the arc's violet by `pow(glow, 1.6)` and its salmon by `pow(glow, 1.9)`, where `glow = smoothstep(1.05, 0.05, distance(uv, vec2(0.92, 0.04)))` — this is where the old SVG arc crossed, so the composition does not move;
   - a pale sheen from the second warp's `r.x`, and ±0.016 of hash grain so the gradient never bands.
   Theme values come from uniforms read off the tokens — no hexes in the shader source.

3. **The click.** Up to 8 live ripples, each `{x, y, startTime}` in viewport coordinates. Each is a ring `exp(-((d - age·0.40) / 0.10)²) · exp(-age·1.05)`, faded by distance, gone after about 4 seconds. Where the ring is, offset the sampling point by `wave · 0.075` **and sample each colour channel a step apart** (`×1.22`, `×1.00`, `×0.74`) so the field separates into its components at the moving edge. Everywhere else, one sample. Attach the listener to `window` as `pointerdown`, and fire one from the centre of the focused element on Enter or Space so keyboard users get it too.

4. **Budget.** Pause via `visibilitychange` when the tab is hidden. Stop the loop when no ripple is live and `prefers-reduced-motion` is set — that case renders exactly one frame, at a fixed time, and ignores clicks. Never render more than one canvas: it is mounted once in `SiteFrame`, never per page. Measure a scroll of `/gallery` with paint flashing on and record the frame time in `design/BASELINE.md`.

5. **Fallback.** If `getContext("webgl")` returns null, hide the canvas and put the existing `--ambient, --backdrop` CSS gradients on the element instead. The page must look finished, not broken, with no WebGL at all.

6. **The boards.** The reference boards still show the static arc, so every page board will now differ in the backdrop region. Teach the compare harness to mask it: pass a mask rectangle covering everything outside the content column and panels, or compare only the panel bounding boxes. Say in `design/README.md` which it is, so the next person is not surprised by a 12% diff that is not a bug.

**Do not.** Animate the lamp, the arc colour or anything inside a panel. Add a second canvas. Sample the backdrop in JS for any purpose.

**Done when.** The backdrop drifts continuously at 60fps on a laptop in both themes, a click sends a visible wavefront through the folds, the reduced-motion case renders one static frame, the no-WebGL case renders the CSS gradient, and `npm run audit:design` passes with the backdrop masked.

**Commit.** `UI-P13b: living backdrop`

---

## UI-P14 — The build card

Follow `design/RULES.md`.

**Goal.** Repaint the build card so every card in the product is the reference card. It is shared by the gallery, the feed, profiles and rows, so it changes once.

**Read first.** `components/gallery/GalleryCard.tsx`, `CardThread.tsx`, `cardBodies.tsx`, `cardMedia`, the `GalleryBuild` type and `GALLERY_BUILD_COLUMNS` in `lib/build/gallery.ts`, the card-frame / card-thread comment in `lib/theme/semantics.ts`.

**Reference.** Section `Build cards`; `data-ui="build-card"` on every board that shows cards.

**Build.**
1. **Order is fixed**: `PictureLamp` → the card: cover (with the shape tag) → title → credit and Δ → plaque → part chips → open ask. Keep it impossible to render the plaque without the title above it.
2. **Card**: position relative; background `--glass`; 1px border `--glass-border`; radius 14; padding 7px; column with gap 7px; `box-shadow: var(--shadow-card)`. The whole card is one link to `/b2/:slug` whose accessible name is the title.
3. **Cover**: height per context (112 catalogue, 92 gallery wall, 86 profile works, 96 mobile two-column, 120–150 single column), radius 10, `overflow: hidden`. The build's cover from `resolveCover()` with `object-fit: cover`, else `CoverFallback` seeded with the build id. The shape tag at top 6px, left 6px: background `--media-tag`, text `--text`, DM Mono 10px, padding 2px 6px, radius 8.
4. **Body**: padding 0 5px 5px, column, gap 6px:
   - title: `h3`, `type.display(19)` (18 or 17 on mobile two-column), `--text`, one line with ellipsis;
   - credit block, gap 2px: "by {maker}" or "Rebuilt from *{source}* by {maker}" (the source title in italic `--text`) in Figtree 11px `--text2`, ellipsis; when rebuilt, "Δ {change summary}" in DM Mono 10px `--text2`, ellipsis;
   - `Plaque size="card"`;
   - part chips: `CategoryChip`s for the node categories present, gap 4px, wrapping. Categories come from the node types (`instruction, configuration, data, artefact, evidence, narrative`). `breakage` is never a chip; a gap keeps its own category;
   - open ask, when the build has an open bounty: "{n} part unsolved · £{reward}" in DM Mono 10px `--cat-breakage`.
5. **Gap**: when the build has an open gap, the border becomes `1.5px dashed var(--cat-breakage)`. Nothing else changes colour.
6. The card is now one surface. Update the card-frame / card-thread comment in `semantics.ts` to say so; keep the two tokens (UI-P41 removes them).

**Do not.** Change `GalleryCard`'s props or data dependencies. Change any grid that places cards (each page does that in its own prompt).

**Done when.** Build cards section compares within 0.04 (fresh, rebuilt, stale, never reproduced, gap), and the live `/gallery` renders the new card with real data in both themes.

**Commit.** `UI-P14: build card repaint`

---

## UI-P15 — The vacant frame (bounty card)

Follow `design/RULES.md`.

**Goal.** The bounty card: an empty frame on the wall where one part of a working build is missing, with a reward.

**Read first.** `components/bounty/MissingBlockOverlay.tsx`, `MissingStageBadge.tsx`, `lib/bounty/bounties.ts` (`listOpenBountyCards`, `OpenBountyCard`), `lib/build/gaps.ts` (`gapProblem`).

**Reference.** Section `Build cards` (`data-ui="vacant-frame"`, selected and not); `desktop/*/bounties.html`; `mobile/*/bounties.html`.

**Build.**
1. `PictureLamp` (always `stale`/dimmed on a vacant frame: it marks the missing part, not the build's freshness), then the card: 1.5px dashed `--cat-breakage` border, radius 14, padding 7px, background `--glass` (selected: `--row-highlight`), `--shadow-card`, column with gap 8px.
2. Cover (104px on desktop and mobile), radius 10, with the **missing window** centred on it: 110×58 (mobile 110×58), radius 10, 1.5px dashed `#F7F8F9` border, background `rgba(14,11,20,.55)`, a centred column in `#F7F8F9`: "MISSING" (DM Mono 10px, .1em) over the part name (Figtree 11px 600, centred). These two colours are fixed because the window sits on artwork, not on the theme. This is `MissingBlockOverlay` restyled.
3. Body, padding 0 5px 5px, gap 7px: a row with the build title (`type.display(18)`, one line, ellipsis) and the reward (DM Mono 18px, `--text`, "£400"); then a row with the gap's `CategoryChip` and "{closes in} · {n} solutions · {m} me too" in DM Mono 10px `--text2`.
4. The card is a link to the bounty's solve view (or selects it on the Bounties page on desktop; see UI-P33).

**Done when.** The two vacant frames in the Build cards section compare within 0.04.

**Commit.** `UI-P15: vacant frame bounty card`

---

## UI-P16 — The frame skeleton and the `site_frame` flag

Follow `design/RULES.md`.

**Goal.** A new page frame, `SiteFrame`, built beside `FlatShell` and switched on per route behind a `site_frame` flag. This prompt builds the skeleton (backdrop, column, slots) and the flag. UI-P17 to UI-P19 fill the slots; UI-P20 moves the first route.

**Read first.** `src/components/AppShell.tsx` (`allNavItems`, how it mounts `FlatShell`, the drawer and bottom-nav handlers), `src/components/shell/FlatShell.tsx` and `flat-shell.css` (read only — never edit), `wideRoutes.ts`, the existing feature-flag reader (the handoff points at `src/lib/reblog/flags.ts` as the pattern — read it, but note `src/lib/reblog` is legacy and is deleted later, so **copy the pattern, import nothing from it**), the `feature_flags` table, `src/App.tsx`, `design/HANDOFF.md` §3.

**Reference.** Every desktop board in `design/reference/desktop/` (the area under the browser strip) and every mobile board; `data-ui="site-header"`, `"breadcrumb"`, `"site-footer"`, `"mobile-header"`, `"dock"`.

**Build.**
1. **Flag** `src/lib/shell/flags.ts`: `isSiteFrameOn()` and a `useSiteFrameFlag()` hook, reading a `site_frame` row from `feature_flags` the same way the existing reader does (same table, same caching, missing row = off), with no import from `src/lib/reblog`. In development builds only, `?frame=site` or `?frame=flat` overrides it for the browser session (sessionStorage, wrapped in try/catch).
2. **Route list** `src/components/shell/siteFrameRoutes.ts`: `SITE_FRAME_ROUTES: string[]` (React Router patterns) and `usesSiteFrame(pathname)`. Starts empty. Each page prompt adds its own routes.
3. **`SiteFrameView`** (pure, props only) in `src/components/shell/SiteFrame.tsx`, `data-testid="site-frame"`:
   - a root `position: relative; min-height: 100dvh` with `PageBackdrop` (UI-P13) as its first child;
   - **desktop (≥768px):** a header slot (sticky, `top: 0`, `z-index: 20`), then `<main id="main">` — `max-width: 1280px`, `margin: 0 auto`, `padding: 8px 0 46px` at ≥1328px and `8px 24px 46px` below it — holding the breadcrumb slot and then the page; then the footer slot. The 46px bottom padding is the gap between the last panel and the footer on every board;
   - **phone (<768px):** the mobile header slot (sticky), `<main id="main">` with `padding: 14px 14px 110px` and a column gap of 12px, then the dock slot (fixed; UI-P19);
   - `variant: "site" | "bare"`. `bare` (sign in, join, reset, verify) renders only the backdrop and the page.
   - A "Skip to content" link as the first focusable element, visible on focus, targeting `#main`.
4. **Board fit.** Page views take `fit?: "board" | "content"` (default `content`). The dev compare page passes `board`: on desktop the page's grid is exactly **820px** tall (64 header + 8 + 40 breadcrumb + 820 + 46 + 88 footer = 1066, the board height under the browser strip), so panels that fill in the reference get the reference height. On live routes (`content`) the same panels take the reference height as `min-height` and grow with their content (the feed and the wall keep paging). Export a tiny helper `boardHeight(fit)` so every page does this the same way.
5. **`SiteFrame`** (container) wraps the view and supplies live chrome data (from UI-P17–UI-P19). The dev compare page renders `SiteFrameView` with `design/fixtures/sample-data.json → viewer`.
6. **Dev compare page**: `/dev/kit/pages/:page` now renders `SiteFrameView` around the page view, and at `viewport=mobile` renders at 390px wide with the phone chrome.

**Do not.** Touch `FlatShell`, `flat-shell.css`, `AppShell`'s existing layout, or any route yet. Use `position: fixed` for the backdrop.

**Done when.** `/dev/kit/pages/frame?theme=noon|dusk&viewport=desktop|mobile` shows the empty frame (backdrop, empty slots, 820px grid placeholder) at the reference sizes; the flag reads `false` from the live table and `?frame=site` flips it in dev only; tier1 e2e unchanged.

**Commit.** `UI-P16: SiteFrame skeleton and site_frame flag`

---

## UI-P17 — The site header (desktop)

Follow `design/RULES.md`.

**Goal.** The sticky glass header: lockup, four primary links with the lamp under the current one, search, New build, Activity, theme, account.

**Read first.** `AppShell.tsx` (`allNavItems`: take every href from it, do not invent routes), `components/shell/ShellHeader.tsx`, `NavSearch.tsx` (search behaviour to reuse), the current notification bell and `lib/notifications/` (`getUnreadCount()`, `realtime.ts`), `contexts/ThemeContext.tsx`, `useAuth()`.

**Reference.** `design/reference/components/{noon,dusk}.html` → section `Frame` (header with Gallery current); `data-ui="site-header"` on every desktop board (the current link changes per board).

**Build** `src/components/shell/SiteHeader.tsx` (+ a pure `SiteHeaderView`), `data-testid="site-header"`:
1. **Bar.** `<header>` full width, height 64, background `--header`, 1px bottom border `--header-border`, `backdrop-filter: blur(16px) saturate(1.15)` (the one full-width blurred surface on desktop). Inner row: the same column as `<main>` (max-width 1280, centred), height 64, flex, `align-items: center`, gap 28px.
2. **Lockup** size 21, a link to `/` named "buildgallery home".
3. **Primary links** in `<nav aria-label="Primary">`, flex, no gap: **Home · Gallery · Bounties · Library** (hrefs from `allNavItems`). Each link: height 64, padding 0 14px, Figtree 14px; current: weight 600, `--text`, `aria-current="page"`; others: weight 500, `--text2`. The current link has a lamp: an absolutely placed ellipse 26×6, `left: 50%`, `margin-left: -13px`, `bottom: -1px`, `--lit`, `box-shadow: var(--nav-lamp-glow)`. "Current" is decided by the route's section (a build page counts as Gallery, the rebuild page as Gallery, import and compose as none, Activity as none — the bell shows it instead).
4. A flexible spacer.
5. **Search** `HeaderSearch` (new; reuse `NavSearch`'s submit behaviour and destination): a `<label>` 280×38, padding 0 12px, radius 12, background `--field`, 1px border `--line`, gap 8px, colour `--text2`; `Search` icon 15px; `<input type="search">` named "Search builds", placeholder "Search builds, makers, tools", Figtree 13px, `--text`, transparent, no border; a key hint "/" in DM Mono 10px with a 1px `--line` border, radius 6, padding 0 5px. Pressing "/" anywhere outside a text field focuses the input.
6. **New build**: `Button` primary, size 38, `Plus` icon, "New build" → the existing create route (from `allNavItems` / the current bottom nav). This is chrome; it does not count as the page's primary.
7. **Activity**: a 38×38 link to `/notifications`, radius 12, 1px border `--line`, `Bell` 17px `--text`; background `--tab` when on `/notifications`, otherwise transparent. Unread badge when count > 0: absolute `top: -4px; right: -4px`, min-width 16, height 16, radius 8, background `--action`, text `--on-action`, DM Mono 10px (reference 9px; RULES minimum), "9+" above nine. Accessible name "Activity, N unread". Count from `getUnreadCount()`, kept live by the existing realtime channel.
8. **Theme**: `IconButton` size 38, `Sun` on Noon / `Moon` on Dusk, named "Theme: Noon" / "Theme: Dusk". Click switches between Noon and Dusk (an explicit choice). The three-way choice including System lives in the footer (UI-P18).
9. **Account**: signed in → `Avatar` 34 as a button named "Account" that opens a small menu (Profile `/profile/:handle`, Library, Settings if the route exists, Sign out) — use `@radix-ui/react-dropdown-menu` if it is already in `package.json`, otherwise a non-modal Radix Dialog anchored under the avatar; menu surface `--solid`, radius 14, `--shadow-float`. Signed out → `Button` secondary 38 "Sign in" → `/login?redirect=<current path>`.

**Do not.** Edit `ShellHeader`, `NavSearch` or the old bell (they stay for `FlatShell`). Blur anything inside the header.

**Done when.** The header in the Frame section compares within 0.04 in both themes; keyboard order is lockup → links → search → New build → Activity → theme → account; "/" focuses search; the badge updates when a notification arrives.

**Commit.** `UI-P17: site header`

---

## UI-P18 — Breadcrumb, footer and the theme control

Follow `design/RULES.md`.

**Goal.** The breadcrumb that mirrors the URL, the footer, and one theme control used in the footer, the sign-in page and the mobile account sheet.

**Read first.** `App.tsx` route table, `ThemeContext.tsx` (`ThemeChoice` is now `noon | dusk | system`), `components/theme/ThemeToggle.tsx`.

**Reference.** Section `Frame` (breadcrumb, footer); `data-ui="breadcrumb"` and `data-ui="site-footer"` on every desktop board.

**Build.**
1. **Breadcrumb** `src/components/shell/Breadcrumb.tsx`, `data-testid="breadcrumb"`: `<nav aria-label="Breadcrumb">`, flex, `align-items: center`, gap 8px, height 40. Ancestors: links, Figtree 13px `--text2`, no underline, each followed by "/" in DM Mono 12px `--label` (`aria-hidden`). Current: a `<span aria-current="page">`, Figtree 13px 600 `--text`, one line with ellipsis at 480px max.
2. **Trails** from `useBreadcrumb()` (route → trail) plus `useCrumbTitle(title)` which a page calls once its record loads (a small context; no global store, no fetching in the hook). Trails, as drawn:
   - `/` → **Home** · `/gallery` → Home / **Gallery** · `/b2/:slug` → Home / Gallery / **{build title}** · `/b2/:slug/lineage` and `/rebuild/:slug` → Home / Gallery / {build title} / **Rebuild** (lineage: **Lineage**) · `/import`, `/compose/*` → Home / New build / **Import** (compose: **Compose**) · `/bounties`, `/bounties/solvers` → Home / **Bounties** (/ **Solvers**) · `/profile/:handle` → Home / **{display name}** · `/notifications` → Home / **Activity** · `/library` → Home / **Library**.
   - While a title is loading, the current crumb is a 120×12 `--recess` skeleton, radius 4.
3. **`ThemeSegmented`** (`size`): `Segmented` with **Noon · Dusk · System**, bound to `ThemeContext`. Replaces what `ThemeToggle` does for SiteFrame surfaces; `ThemeToggle` itself stays for `FlatShell`.
4. **Footer** `src/components/shell/SiteFooter.tsx`, `data-testid="site-footer"`: `<footer>` full width, height 88, 1px top border `--header-border`, background `--header` (no blur). Inner row: the 1280 column, height 88, flex, `align-items: center`, gap 28px:
   - `Lockup` 16 (link home);
   - links, gap 22px, Figtree 13px `--text2`: About `/about`, API docs `/api-docs`, Solvers `/bounties/solvers`, Connect a tool `/connect`, then **Sign in** `/login` when signed out or **Sign out** (a button in the same style) when signed in — the reference shows the signed-out item; this difference is expected in the compare;
   - spacer; `ThemeSegmented` size 32 with its items at Figtree 11px, as drawn; "© buildgallery" in DM Mono 11px `--label`.
5. Mount both in `SiteFrameView` (breadcrumb at the top of `<main>`, footer after it).

**Done when.** Breadcrumb and footer in the Frame section compare within 0.04 in both themes; changing the footer control changes the theme, persists under `bg-theme`, and System follows the OS.

**Commit.** `UI-P18: breadcrumb, footer and theme segmented control`

---

## UI-P19 — The mobile frame: header, dock, sheets and sideways rows

Follow `design/RULES.md`.

**Goal.** The phone chrome (<768px): a sticky glass header, a floating five-tile dock, bottom sheets and sideways chip rows — built for a phone's browser, not as an app.

**Read first.** `components/shell/MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `RightRailDrawer.tsx` (read only; they stay for `FlatShell`), `index.html` (viewport meta), `@radix-ui/react-dialog` usage elsewhere in the repo, `design/HANDOFF.md` §5.10.

**Reference.** Section `Frame` (mobile header, dock with Home current, dock with Activity current); `data-ui="mobile-header"`, `"dock"`, `"scroll-row"`, `"filter-chip"` on `design/reference/mobile/*`; the solve sheet `mobile/*/solve.html`.

**Build** in `src/components/shell/`:
1. **Viewport.** Add `viewport-fit=cover` to the viewport meta in `index.html` (keep everything else in it).
2. **`MobileHeader`** (`data-testid="mobile-header"`): sticky `top: 0`, `z-index: 20`, height 58, flex, `space-between`, padding 0 14px, background `--header`, 1px bottom border `--header-border`, `backdrop-filter: blur(16px) saturate(1.15)`. Left: `Lockup` 19 (link home). Right, gap 8px: `IconButton` 38 "Search" (opens a full-width search sheet using `HeaderSearch`'s behaviour, input 16px) and the account control: `Avatar` 34 (opens the account sheet: Profile, Library, Settings, `ThemeSegmented` size 36, Sign out) or `Button` secondary 38 "Sign in".
3. **`Dock`** (`data-testid="dock"`): `<nav aria-label="Primary">`, `position: fixed`, `left: 50%`, `transform: translateX(-50%)`, `bottom: calc(16px + env(safe-area-inset-bottom))`, `z-index: 30`; flex, gap 4px, padding 7px, radius 22, background `--dock`, 1px border `--dock-border`, `box-shadow: var(--shadow-dock)`, `backdrop-filter: blur(16px) saturate(1.15)`. Five tiles (`data-testid="dock-tile-<name>"`), each a link 62×54, radius 15, a column with gap 3px, icon 20px stroke 1.8, label Figtree 10px 600:
   - **Home** `/` (`Home`), **Gallery** `/gallery` (`Image`), **New** (create route; `Plus`) — always background `--action`, text `--on-action`, **Bounties** `/bounties` (`Target`), **Activity** `/notifications` (`Bell`).
   - Current tile: background `--text`, text `--on-text`, `aria-current="page"`, and a lamp above it: ellipse 20×6, `top: -11px`, centred, `--lit`, `box-shadow: var(--nav-lamp-glow)`. Others: transparent, `--text`.
   - Activity badge when unread > 0: `top: 5px; right: 9px`, 15×15 (min-width 15), radius 8, `--action` / `--on-action`, DM Mono 10px.
   - Each tile's accessible name is its label; with unread, "Activity, N unread". Tiles are 62×54 (≥44 each way).
4. **Page padding.** `<main>` keeps `padding-bottom: 110px` (dock 68 + 16 gap + air) plus `env(safe-area-inset-bottom)`; the page root uses `min-height: 100dvh`, never `100vh`.
5. **`ScrollRow`** (`gap` 6 | 8): flex, `overflow-x: auto`, `margin: 0 -14px`, `padding: 0 14px`, `scrollbar-width: none` (and the WebKit equivalent via the element's own style where possible; if a scrollbar rule truly needs CSS, it is the one allowed addition to `index.css`, named `.bg-scroll-row::-webkit-scrollbar`). Children never shrink. Used for lenses, tabs, filters, tracks and step chips.
6. **`BottomSheet`** on `@radix-ui/react-dialog`: overlay `--sheet-dim`; content fixed to the bottom, full width, radius 22px 22px 0 0, background `--solid`, 1px top border `--glass-border`, `box-shadow: var(--shadow-sheet)`, padding 10px 16px calc(24px + env(safe-area-inset-bottom)), column gap 12px, max-height 88dvh with its own scroll; a grabber 40×5, radius 3, `--line`, centred at the top. Focus trapped, Escape closes, a downward drag of more than 80px on the grabber closes, a visible Close control for keyboard users (`IconButton` "Close", `X`). Title required (`Dialog.Title`, may be visually hidden).
7. `SiteFrameView` uses `MobileHeader` + `Dock` below 768px.

**Do not.** Edit `MobileTopBar`, `MobileBottomNav`, `ProfileDrawer` or `RightRailDrawer`. Blur anything other than the header and dock.

**Done when.** The mobile header and both dock states in the Frame section compare within 0.04 in both themes; on a 390×844 viewport the dock stays above the bottom edge while scrolling, the last element of a long page is fully visible above it, and the sheet opens, traps focus, closes on Escape.

**Commit.** `UI-P19: mobile header, dock, bottom sheet and scroll row`

---

## UI-P20 — Switch on the frame for the first route

Follow `design/RULES.md`.

**Goal.** Wire `SiteFrame` into the app behind the flag and move one route — `/notifications`, the simplest — into it with its **existing** content, to prove the frame end to end before any page is rebuilt.

**Read first.** `AppShell.tsx` (where `FlatShell` is mounted and how routes reach it), `App.tsx`, `siteFrameRoutes.ts`, `e2e/tier1/*` specs that visit `/notifications` or rely on the old nav's test ids.

**Build.**
1. In `AppShell`, read `useSiteFrameFlag()` once. When it is on **and** `usesSiteFrame(pathname)`, render `SiteFrame` around the outlet instead of `FlatShell`; otherwise render exactly what renders today. This is a new branch that returns a different tree; no existing element's structural styles change.
2. Add `/notifications` to `SITE_FRAME_ROUTES`. The page renders its current component inside `<main>` for now (UI-P35 rebuilds it).
3. Make sure the old right rail, drawers and mobile bottom nav are not mounted on SiteFrame routes, and are unchanged everywhere else.
4. **`FrameRoute`** `src/components/shell/FrameRoute.tsx`: `<FrameRoute site={<NewPage />} legacy={<OldPage />} />` renders `site` when the flag is on and the current path is in `SITE_FRAME_ROUTES`, else `legacy`. Every page prompt (UI-P27 to UI-P36) swaps its route element to this, so the legacy page file is never edited and stays one flag away.
5. Add a tier1 spec `e2e/tier1/site-frame.spec.ts` that runs with the dev override `?frame=site`: `/notifications` shows `site-frame`, `site-header` (desktop) or `mobile-header` + `dock` (mobile), `breadcrumb` reading "Home / Activity", and `site-footer` (desktop); the Activity link / tile has `aria-current="page"` and the header search takes focus on "/".
6. Document in `design/README.md` → "Checking a change" how to view any route in the new frame locally (`?frame=site`).

**Do not.** Turn the flag on in production data — that is `UI-P36b`, once all ten pages are rebuilt. Change `FlatShell` or any other route.

**Done when.** With the flag off, every tier1 spec passes unchanged; with `?frame=site`, `/notifications` renders in the new frame at 390, 768, 1280 and 1440 with no horizontal scroll and the new spec passes on both Playwright projects.

**Commit.** `UI-P20: site frame behind the flag, /notifications moved`

---

## UI-P21 — Data: the home signals

Follow `design/RULES.md`. This prompt makes **one commit per function** (UI-P21a, b, c); that overrides the one-commit rule for this prompt only.

**Goal.** Three counts the Home page (and the Gallery stats) need, which no function returns today. Mockup numbers ("702 builds lit today", "48 runs", "312 runs reported") are samples; these functions supply the real ones.

**Read first.** `src/lib/build/signals.ts` — the verified home of `recordReproduction`, `freshnessLabel`, `isStale`, `STALE_AFTER_DAYS = 120` and `computeCompleteness`; the new functions go beside them — `src/lib/progress/weekly.ts` (`weekStartUtc`), the Supabase types for `builds` and `build_reproductions`, the RLS policies on both tables in `supabase/migrations/`, and one existing test in `src/lib/build/*.test.ts` for the mocking pattern.

**Build.**
- **a) `countLitToday(): Promise<number>`** — builds whose `last_confirmed_at` (confirm the column name in the types) is within the last 24 hours, rolling. `select('id', { count: 'estimated', head: true })` with the filter.
- **b) `countReproducedToday(now = new Date()): Promise<number>`** — `build_reproductions` rows created since 00:00 UTC of `now`. Same count style.
- **c) `countRunsThisWeek(now = new Date()): Promise<number>`** — `build_reproductions` rows created since `weekStartUtc(now)`.

For each: typed, named, no `select('*')`, returns 0 on an empty result, throws a typed error on failure (match the module's existing error style), and a unit test with the client mocked (filter column, operator and boundary asserted; the UTC boundary tested at 23:59 and 00:01). If RLS does not let a signed-out visitor count these rows, **stop and propose** a `security invoker` SQL function returning only the number (policies written with `(select auth.uid())`), instead of widening a policy.

**Do not.** Add these to any component yet (UI-P27 does). Cache in module state.

**Done when.** Three commits, each green on `npx tsc --noEmit -p tsconfig.app.json` and `npm test`.

**Commit.** `UI-P21a: countLitToday` · `UI-P21b: countReproducedToday` · `UI-P21c: countRunsThisWeek`

---

## UI-P22 — Data: gallery lens counts, gallery stats and the shape facet

Follow `design/RULES.md`. **One commit per item** (UI-P22a, b, c).

**Goal.** The numbers on the Gallery header: per-lens counts, the stats row, and a Shape facet.

**Read first.** `src/lib/build/gallery.ts` — verified to hold `listGallery`, `getGalleryFacets`, `countOpenBountyBuilds`, `inGallery` and `GALLERY_BUILD_COLUMNS`; read it for the lens names, the page size and the threshold helper as they actually are (§8) — plus `signals.ts` from UI-P21 and `STALE_AFTER_DAYS`.

**Build.**
- **a) `countGalleryLenses(): Promise<Record<GalleryLens, number>>`** — for each lens the gallery already supports (drawn as `all | proven | rebuilt | unsolved`), an estimated head count using **the same filter `listGallery` applies for that lens** (extract the filter into a shared helper if it is inline, without changing behaviour; the existing gallery tests must still pass unchanged).
- **b) `getGalleryStats(): Promise<GalleryStats>`** with `{ inGallery: number; reproducedThisWeek: number; weeklyGoal: number | null; freshPct: number }`: `inGallery` = the `all` lens count; `reproducedThisWeek` = `countRunsThisWeek()`; `freshPct` = gallery builds confirmed within `STALE_AFTER_DAYS`, as a whole percentage of `inGallery` (0 when there are none); `weeklyGoal` from a new exported constant `WEEKLY_REPRODUCTION_GOAL` in `src/lib/progress/goals.ts`, set to `null`. When it is `null` the Gallery shows the number and a bar at the fraction of last week's count instead of "/ goal" (UI-P28). Leave a comment saying the goal is an editorial number for the product owner to set.
- **c) Shape facet** — add `shapes: { value: BuildShape; count: number }[]` to `GalleryFacets`, computed the same way as `roles` and `tools`, ordered by count. Shapes are the code's own union (`app, agent, workflow, prompt, dataset, study, media, technique, other`); do not invent new ones. Update the facet test.

**Done when.** Three commits, each with tests, all green.

**Commit.** `UI-P22a: countGalleryLenses` · `UI-P22b: getGalleryStats` · `UI-P22c: shape facet in getGalleryFacets`

---

## UI-P23 — Data: the featured build

Follow `design/RULES.md`.

**Goal.** "Most reproduced this month" — the build shown in the Gallery's hero composition.

**Read first.** `gallery.ts` (`GalleryBuild`, `GALLERY_BUILD_COLUMNS`, `inGallery`), `build_reproductions` in the types, how `BuildHeader` gets a build's one-line outcome.

**Build** `getFeaturedBuild(now = new Date()): Promise<FeaturedBuild | null>` in `gallery.ts`, `FeaturedBuild = { build: GalleryBuild; reproductions30d: number; outcome: string | null }`:
1. Read `build_id` from `build_reproductions` created in the 30 days before `now`, `.limit(5000)`, and count per build in code. If the cap is reached, log a warning once and still return the top result (add a `// TODO` naming the RPC that would replace this).
2. Take the highest count whose build is in the gallery (`inGallery`); ties go to the most recently confirmed.
3. Load that build with `GALLERY_BUILD_COLUMNS` and its outcome line (the same field the build header uses).
4. `null` when nothing was reproduced in 30 days — the Gallery then drops the featured slot and the wall fills the row.
Unit tests: ranking, tie-break, the gallery filter, the empty case.

**Commit.** `UI-P23: getFeaturedBuild`

---

## UI-P24 — Data: the open bounty pool

Follow `design/RULES.md`.

**Goal.** The money and counts shown on the Gallery stats ("£4,250 · 23 asks") and the Bounties orbs ("Open pool", "Being solved · 61 solutions").

**Read first.** `src/lib/bounty/bounties.ts` — verified: `listOpenBounties({ home: "build" })`, `listBuildBounties`, `createBountyForGap`, `closeBounty` — `solutions.ts` (`countSolutionsByBounty`, `listSolutions`, `listSolverHandles`), `types.ts` (`BountyStatus = open | solved | closed | expired`), `gallery.ts`'s `countOpenBountyBuilds`, and the live `bounties` table's reward and deadline columns (confirm their names against the live schema, not the migrations — §8).

**Build** `getOpenBountyPool(): Promise<{ poolGbp: number; open: number; solutions: number; withSolutions: number }>` in `bounties.ts`:
- `open` from `countOpenBountyBuilds()`;
- `poolGbp`: select only the reward column of bounties with `status = 'open'` (the same filter `listOpenBounties` uses), `.limit(1000)`, summed in code; if the cap is hit, log once and add a `// TODO` for an aggregate RPC;
- `solutions`: the sum of `countSolutionsByBounty()` over the open bounties; `withSolutions`: how many open bounties have at least one (the Gallery's "Open bounties" bar is `withSolutions / open`).
Money stays an integer number of pounds; formatting (`£4,250`) happens in the view with `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })`. Tests for the sum, the open filter and zero bounties.

**Commit.** `UI-P24: getOpenBountyPool`

---

## UI-P25 — Data: where next, for the viewer

Follow `design/RULES.md`.

**Goal.** The Home "Where next — from what you ran this week" list. `getWhereNext()` exists but is keyed on one build; this is keyed on the viewer.

**Read first.** whatever module holds the existing per-build "where next" logic (the handoff calls it `getWhereNext` in `src/lib/build/whereNext.ts`; if it is not there, `grep` for it and use the real one — §8), `build_reproductions` (`build_id`, `user_id`, `created_at`), `weekStartUtc`. If no per-build version exists, build this one from scratch in `src/lib/build/whereNext.ts` and say so.

**Build** `getWhereNextForViewer(userId: string, limit = 3): Promise<WhereNextItem[]>` in `whereNext.ts`:
1. The viewer's reproductions since `weekStartUtc()` (build ids, newest first, `.limit(20)`).
2. For up to three of those builds, reuse `getWhereNext`'s internals (factor them out without changing its behaviour or tests) to gather candidates with their reason.
3. Remove builds the viewer created or already reproduced; de-duplicate; keep the first `limit`.
4. Each item: `{ build: { id, slug, title, coverSky/ cover }, reason: 'same_tool' | 'rebuilt_from_one_you_ran' | 'more_from_maker', reasonDetail: string /* the tool name or @handle */, spark: number[] /* 14 daily reproduction counts, oldest first */ }`. Get all sparks in one query: `build_id, created_at` for the chosen ids over 14 days, `.limit(1000)`, bucketed by UTC day.
5. Returns `[]` for a viewer with no runs this week (the view shows its empty state).
The label is rendered by the view in DM Mono caps: "SAME TOOL · SONNET-4.5", "REBUILT FROM ONE YOU RAN", "MORE FROM @INES". Tests for each reason, the exclusions and the empty case.

**Commit.** `UI-P25: getWhereNextForViewer`

---

## UI-P26 — Data: maker figures, runs of my builds, people this week

Follow `design/RULES.md`. **One commit per function** (UI-P26a, b, c).

**Goal.** The Profile stats row and the Activity right column.

**Read first.** `components/profile/MakerFigures.tsx` and `EarnedNumbers` (the queries they already make — move them, do not duplicate them), `lib/build` `listBuildsByCreator`, the rebuild / fork tables used by `getRebuildTree`, accepted solutions in `lib/bounty`, `build_reproductions`.

**Build.**
- **a) `getMakerFigures(userId): Promise<MakerFigures>`** in `src/lib/profile/figures.ts`: `{ buildsHung, reproducedByOthers, rebuildsOfWork, bountiesSolved, bountyEarningsGbp }` — builds they published; reproductions of those builds by anyone other than them; published rebuilds whose source is one of their builds; bounties where their solution was accepted, and the sum of those rewards. Move the existing queries out of `MakerFigures` / `EarnedNumbers` into this function and make those components call it (their rendering unchanged). Estimated counts where a count is all that is needed.
- **b) `getRunsOfMyBuilds(userId, days = 90, now = new Date()): Promise<{ series: number[]; rebuildLiveIndex: number | null }>`** in `src/lib/build/runs.ts`: daily reproductions of the viewer's builds for `days` UTC days (oldest first; `.limit(5000)` with the same capped-warning pattern as UI-P23), and the day index of the most recent published rebuild of one of their builds inside the window (the chart's dashed marker), or `null`.
- **c) `countPeopleWhoRanMyBuildsThisWeek(userId, now = new Date()): Promise<number>`** in `runs.ts`: distinct reproducers (excluding the viewer) of the viewer's builds since `weekStartUtc(now)`, `.limit(2000)` on the rows fetched to de-duplicate.
Never call or reference `award_xp()` (see HANDOFF §5.7).

**Commit.** `UI-P26a: getMakerFigures` · `UI-P26b: getRunsOfMyBuilds` · `UI-P26c: countPeopleWhoRanMyBuildsThisWeek`

---

## UI-P27 — Page: Home

Follow `design/RULES.md` (the page pattern is §7).

**Goal.** `/` rebuilt as the reference Home: hero with the tagline, the visitors' book, two orbs, this week's challenges, the streak and where next.

**Read first.** `pages/Home.tsx`, `feed/FeedShell.tsx`, `BuildsTab.tsx`, `BuildFeedItems.tsx`, `src/lib/feed/getBuildFeed.ts` — verified: it calls the RPC `get_build_feed(before, page_size)` with keyset paging and item kinds `build | rebuild | repro_note | bounty`. **It takes no scope argument.** Read it, and read `FeedShell` / `BuildsTab` for whether a Following scope exists at all — `progress/ThisWeek.tsx`, `lib/progress/weekly.ts` (`WEEKLY_CHALLENGES`, `getMyWeekEvents`, `weeklyProgress`, `weekStartUtc`), `streaks/*` and `getStreakDays`, the UI-P21 and UI-P25 functions, `design/HANDOFF.md` §5.1.

**Reference.** `design/reference/desktop/{noon,dusk}/home.html`, `design/reference/mobile/{noon,dusk}/home.html`.

**Data → props.** Feed pages from `getBuildFeed()` with its real arguments; `countLitToday()`; `countReproducedToday()`; `countRunsThisWeek()`; challenges from `WEEKLY_CHALLENGES` + `weeklyProgress(getMyWeekEvents())`; the current week's days from `getStreakDays`; `getWhereNextForViewer(userId)`. Signed out: no challenges, streak or where-next panels' data — each shows its empty state (below).

**Desktop.** Grid `minmax(0, 1fr) 420px`, gap 12, filling the 820px board.
- **Left column** (gap 12):
  1. **Hero** — height 340. `Panel` glass, padding 22px 24px, `position: relative`. Behind the content, filling the panel: the hero art — `CoverFallback` with sky 0 (fixed brand artwork, not a build) — and a scrim `linear-gradient(90deg, var(--scrim) 0%, transparent 60%)`. Content: a full-height column, `space-between`:
     - a row, `space-between`, centred: `Segmented` (34/12) **Following · Everyone**, and the lit badge. The control binds to the feed scope **only if the feed already supports one**; the RPC takes none today, so unless `FeedShell` has a scope, render the control with Everyone selected and Following disabled (`aria-disabled`, title "Following is coming") and note it in the report rather than inventing a scope parameter or filtering client-side. Signed out, Following goes to `/login?redirect=/`. The lit badge: — padding 6px 10px, radius 12, background `--media-tag`, gap 8px, DM Mono 11px `--text`: `LampDot` + "{n} builds lit today";
     - `Tagline` 46, offsets 0 / 90 / 30: "Every AI build," / "hung with" / "its proof." The chips are `aria-hidden`; the page's `h1` is the same sentence, visually hidden;
     - a row, gap 8px: `Button` primary 36/13 "Enter the gallery" with `ArrowRight` → `/gallery`; `Button` secondary 36/13 "How proof works" → the existing page that explains reproduction (`/about` unless a more specific route exists).
  2. **The visitors' book** — fills. `Panel` padding 14px 16px. `PanelHead` "The visitors’ book" / "Builds, rebuilds, reproduction notes and asks — newest first", right: `Segmented` 30/11 **All · Builds · Rebuilds · Notes · Asks** (filters the loaded items on `kind`, client-side). Rows, 10px below, one per item:
     - grid `92px 30px minmax(0, 1fr) 84px 32px`, gap 12, centred, padding 9px 12px, radius 14, 1px bottom border `--hairline`;
     - kind label, DM Mono 10px, .07em, caps: BUILD `--lit-ink`, REBUILD `--cat-agents`, REPRO NOTE `--evidence`, BOUNTY `--cat-breakage`;
     - `Avatar` 28;
     - a column, gap 3px: the who-line (Figtree 12px `--text2`, one line, ellipsis) — "@maker hung", "@maker rebuilt {source title} →", "@maker ran {title} on {model} — “{note}”", "@maker opened an ask · {part} · £{reward}"; the build title in `type.display(20)`, −0.02em, line-height 1; `Plaque` at row size (tag 9 → 10px, text 10px);
     - cover thumbnail 84×54, radius 10 (`resolveCover` or `CoverFallback`);
     - relative time, DM Mono 10px `--label`, right-aligned.
     The first row gets background `--row-highlight` and a transparent bottom border when it is newer than the viewer's previous visit (a per-browser timestamp in `localStorage` under `bg-home-seen`, read and written in try/catch). Each row links to its build (bounty rows to the bounty). Live: keyset paging continues below with a secondary 34/12 "Show more" button.
- **Right column** (gap 12):
  1. **Orbs** — height 180. `Panel` padding 12px; a centred row, gap 12: `OrbGlass` 150 "Reproduced today" / "{n} runs"; `OrbSolid` 150 "This week" / {n} / "runs reported".
  2. **This week's challenges** — height 230. `Panel` padding 14px 16px. `PanelHead` "This week’s challenges" / "Resets Monday 00:00 UTC", right: `IconButton` 34 `Maximize2` "Open this week" linking to the full `ThisWeek` view if a route exists (omit the button otherwise). One row per challenge: column, gap 7px, padding 10px 0, 1px bottom `--hairline`; a row with the title (Figtree 13px `--text`) and "{done} / {target} · +{xp} xp" or "{done} / {target} · done" (DM Mono 11px `--text2`, no wrap); `StripedBar` height 9 at done/target — colour by meaning: running builds `--lit`, solving a gap `--action`, re-confirming `--evidence`.
  3. **Streak** — auto height. `Panel` padding 14px 16px. A row, `space-between`: `PanelHead` "{n}-day streak" / "one frozen day used" ("no frozen days used", "{k} frozen days used"), and `Flame` 22 in `--lit-ink`. 12px below, a row `space-between` of seven columns (Mon–Sun of the current UTC week), each a centred column with gap 6px: active day `LampDot` 20×12; frozen day a 20×12 ellipse with a 1.5px `--evidence` border; other days a 20×12 ellipse with a 1.5px dashed `--line` border; the day letter in DM Mono 10px `--label`.
  4. **Where next** — fills. `Panel` padding 14px 16px. `PanelHead` "Where next" / "From what you ran this week". Rows 6px below: flex, gap 10, padding 7px 0, 1px bottom `--hairline`: a 34×34 cover (radius 8); a column (title Figtree 13px `--text` ellipsis; reason DM Mono 10px `--label` caps — "SAME TOOL · SONNET-4.5", "REBUILT FROM ONE YOU RAN", "MORE FROM @INES"); `Sparkline` 54×18.

**Mobile** (board 390×1640), in this order, gap 12:
1. A row `space-between`: `Segmented` 36/13 Following · Everyone; the lit badge — padding 7px 10px, radius 12, background `--glass-2`, 1px `--line`, DM Mono 11px — `LampDot` + "{n} lit today".
2. Hero `Panel` padding 16, height 270: the same art; scrim `linear-gradient(180deg, transparent 30%, var(--scrim) 100%)`; a `space-between` column: `Tagline` 30 (0 / 44 / 14) and one `Button` primary 42/14 "Enter the gallery".
3. The two orbs, no panel: a centred row, gap 12, padding 4px 0: `OrbGlass` 162, `OrbSolid` 162.
4. Challenges `Panel` padding 14px 16px 6px: rows with padding 11px 0, title Figtree 14px, "{done}/{target}" DM Mono 11px, `StripedBar` 9.
5. The visitors' book `Panel` padding 14px 12px: `PanelHead` "The visitors’ book" / "Newest first"; a `ScrollRow` (gap 6, margin 10px −4px 0) of `FilterChip`s All · Builds · Rebuilds · Notes · Asks; rows 8px below: grid `minmax(0, 1fr) 72px`, gap 12, padding 12, radius 14, bottom `--hairline` (highlight as desktop); left column gap 5: a line with `Avatar` 22, the kind label (DM Mono 10px) and "· {time}" (DM Mono 10px `--label`), gap 8; the who-line (Figtree 12px `--text2`); the title `type.display(20)` line-height 1.05; `Plaque` row; right: a 72×72 cover, radius 10.
6. Streak `Panel` as desktop.
Phones do not show Where next (as drawn).

**Empty states.** Feed: "Nothing hung yet." + "Enter the gallery". Challenges signed out: "Sign in to take this week's challenges." + "Sign in". Streak with no days: "Run a build today to start a streak." Where next with no runs this week: "Run a build this week and suggestions appear here." + "Enter the gallery".

**Done when.** The four Home boards compare within 0.04 (differences limited to RULES §7's list); tier1 specs that visit `/` pass with the flag off and with `?frame=site`.

**Commit.** `UI-P27: Home in the site frame`

---

## UI-P28 — Page: Gallery

Follow `design/RULES.md` (§7).

**Goal.** `/gallery` as the reference: header with lenses and the stats wall label, the facet column, the featured build and the wall of cards.

**Read first.** `pages/Gallery.tsx`, `components/gallery/*` (verified: `GalleryCard`, `CardThread`, `FacetRail`, `cardMedia`; the lens row may be named differently — §8), `lib/build/gallery.ts` (`listGallery`, `getGalleryFacets`, `inGallery`, `GALLERY_BUILD_COLUMNS`, and the real lens list, page size and threshold helper), UI-P22, UI-P23 and UI-P24 functions, HANDOFF §5.2.

**Reference.** `desktop/{noon,dusk}/gallery.html`, `mobile/{noon,dusk}/gallery.html`.

**Data → props.** Wall pages from the existing gallery query with the current lens and facets (keep its URL parameters exactly); `countGalleryLenses()`; `getGalleryStats()`; `getOpenBountyPool()`; `getGalleryFacets()` (roles, tools, shapes); `getFeaturedBuild()`.

**Desktop.** A column, gap 12: the header panel (natural height), then a grid `230px minmax(0, 1fr)` that fills.
- **Header** `Panel` padding 18px 20px:
  - a row, `space-between`, `align-items: flex-end`, gap 20: left, a column with gap 8: `Eyebrow` "Gallery"; `h1` `type.display(50)`, −0.035em, line-height 1, "Builds worth running"; the intro, Figtree 13px `--text2`, line-height 1.5, max-width 560: "Written down completely enough to follow, ordered by how many people other than their maker have run them and said what happened." Right, a column with gap 10, aligned right: `Segmented` 36/12 with **All · Proven · Rebuilt · Unsolved**, each label followed by an en space and its count (`en-GB` grouping); under it "MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED" in DM Mono 11px `--label`.
  - 14px below, `WallLabel` with 4 columns of `Stat`: "In the gallery" {inGallery}; "Reproduced this week" {reproducedThisWeek} — with "/ {weeklyGoal}" and a `--lit` bar at value/goal when a goal is set, otherwise a `--lit` bar at this week / last week (cap 100); "Fresh · under 120 days" "{freshPct}%" with an `--evidence` bar; "Open bounties" "£{poolGbp}" / "{open} asks" with an `--action` bar at withSolutions/open.
- **Facet column** `Panel` padding 4px 16px, full height. Three groups — **Made for** (top 4 roles), **Made with** (top 4 tools), **Shape** (top 6 shapes) — each a column, gap 6, padding 10px 0, 1px bottom `--hairline`: `Eyebrow` 10px; rows 23px tall, flex, gap 8: the name (Figtree 12px `--text`, grows), a mini bar 44×4 (radius 2, `--bar-base`, filled in `--label` at count/max of the group), the count (DM Mono 10px `--label`, 30px wide, right). Each row is a toggle button (`aria-pressed`) that applies the same filter `FacetRail` applies today; an applied row's name is weight 600.
- **The wall** — grid `repeat(4, minmax(0, 1fr))`, gap 14, `padding: 0 4px`. In `board` fit, two rows of 250px: the featured build spans 2 columns (`HeroPlate featured` with `PictureLamp`, rank "01", its plaque via `tone="inverse"`), then six build cards (cover 92, title 19). In `content` fit rows are auto (≥250), the featured slot appears only on the first page and only when `getFeaturedBuild()` returns a build; the wall keeps the existing paging (24 per page) with a secondary "Show more" at the end.

**Mobile** (390×1860), gap 12:
1. Page heading: `Eyebrow` "Gallery", `h1` `type.display(36)` −0.035em "Builds worth running", Figtree 14px `--text2` line-height 1.5: "Written down completely enough to follow, ordered by how many people other than their maker have run them." (column gap 8, padding 4px 2px).
2. `ScrollRow` (gap 6) of `FilterChip`s for the four lenses with counts.
3. A row, gap 8: a search field (grows; height 44, padding 0 12px, radius 12, `--field`, 1px `--line`, `Search` 16, input **16px** — the reference's 15px is raised to the iOS minimum) that filters as the existing gallery search does; `Button` secondary 44/13 with `SlidersHorizontal`, "Filters · {n applied}" ("Filters" when none), opening a `BottomSheet` titled "Filters" with the three facet groups (rows 44px tall) and a primary "Show {n} builds".
4. `WallLabel` 2 columns: In the gallery · This week (`--lit` bar) · Fresh (`--evidence` bar) · Open asks "£{pool}" (`--action` bar).
5. Featured build, stacked: `PictureLamp`; a block radius 16, `overflow: hidden`, `--shadow-card`, 1px `--glass-border`: the cover 190 tall with the tag "MOST REPRODUCED THIS MONTH" (top 10, left 10, `--media-tag`, DM Mono 10px, padding 3px 8px, radius 8); the inverse panel (`--inverse`, padding 18px 18px 18px 104px, min-height 120, column gap 8): title `type.display(26)`, outcome Figtree 13px `--on-inverse-2`, the inverse plaque. The rank square overlaps both at left 14, top 160: 78×78, radius 14, `--inverse`, 2px border `--on-inverse`, `--shadow-square`; "NO." DM Mono 10px over "01" `type.display(36)`.
6. "MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED" (DM Mono 11px `--label`, padding 0 2px).
7. The wall: grid 2 columns, gap 6px 10px, cards with cover 96 and title 18.

**Empty states.** A lens with no builds: "Nothing here yet." + a secondary "See all builds". No featured build: the wall starts at the first card.

**Done when.** The four Gallery boards compare within 0.04; filters, lenses and paging behave exactly as before (existing gallery tests and tier1 specs pass).

**Commit.** `UI-P28: Gallery in the site frame`

---

## UI-P29 — Page: Build page — the first screen

Follow `design/RULES.md` (§7).

**Goal.** `/b2/:slug` above the fold as the reference: the hero with the title plate and the action dock, the proof panel, the anatomy list, the part viewer and the timeline. UI-P30 finishes the tab contents and the rest of the page.

**Read first.** `pages/BuildPage.tsx` and every `build/*` component named in HANDOFF §5.3 (`BuildHeader`, `BuildTabs`, `AnatomyTree`, `NodeCard`, `LayerView`, `ReproductionAction`, `PortableExport`, `ForkControl`, `CreatedViaLine`, `Replay`), `src/lib/build/` — verified: `signals.ts` holds `recordReproduction`, `freshnessLabel`, `isStale` and `computeCompleteness`; `gaps.ts` holds `collectGaps` and `gapProblem`; `rebuild.ts` holds `startRebuild`; `portable.ts`, `layers.ts`, `media.ts` (bucket `build-media`, private) and `nodes.ts` hold the rest. Read them for the real names of the cover resolver, the created-via helper, the publish and gallery thresholds and the layer constants (§8). `build_events` and its kinds.

**Reference.** `desktop/{noon,dusk}/build.html`, `mobile/{noon,dusk}/build.html`.

**Desktop.** Two grid rows, gap 12: `minmax(0, 1fr) 420px` at **402px** tall, then `300px minmax(0, 1fr) 280px` filling the rest.
- **Hero** (row 1, left): a `<section>` radius 16, `overflow: hidden`, 1px `--glass-border`, `--shadow-card`, `position: relative`:
  - the cover (`resolveCover()` as an `<img>` with `object-fit: cover`, else `CoverFallback` seeded with the build id) filling it;
  - the arc (`PageBackdrop`'s arc, hero variant: viewBox 900×400, centre (1100, −260), r 620);
  - the shape tag at top 14, left 14: "{shape}" plus " · via connector" when `getCreatedVia()` says so — `--media-tag`, DM Mono 10px, padding 3px 8px, radius 8;
  - the **action dock** at top 12, right 12: flex, gap 6, padding 6, radius 18, background `--dock`, 1px `--dock-border`, `backdrop-filter: blur(16px) saturate(1.15)`. Four buttons 72×58, radius 13, background `--dock-tile`, 1px `--glass-border`, `--text`, a column with gap 5, icon 18 stroke 1.8, Figtree 10px 600: **Copy for AI** (`Copy`; `toPortable()` → `toMarkdown()` → clipboard, then a polite live-region "Copied"), **Download** (`Download`; the portable file, as `PortableExport` does), **Rebuild** (`RefreshCw`; `startRebuild()` → `/rebuild/:slug`; signed out → `/login?redirect=…`), **Lineage** (`Network`; link to `/b2/:slug/lineage`);
  - `HeroPlate build` (UI-P11): `h1` title, the outcome, then "Rebuilt from *{source}* by @{maker} · made by @{creator}" and the Δ line when rebuilt, or "made by @{creator}" otherwise; the mark square.
- **Proof** (row 1, right): `Panel` padding 16px 18px, full height.
  - A row, gap 16, centred: `OrbGlass` 128 "{n} ran it" / "last {d MMM}" (no sub when never); a column, gap 9, `min-width: 0`: `Eyebrow` "Reproduction"; `Plaque` header size (tag 11px, text 12px); the one primary button 38/13 with `Check` — **"I ran this and it worked"** → `recordReproduction()`. **The `build_reproductions` insert policy refuses the build's own creator** (and the table is unique per build and user), so for the creator the button reads **"Re-confirm it still works"** and calls a self-confirmation function that updates the build's `last_confirmed_at` and `last_confirmed_model` without inserting a reproduction. If no such function exists, add `recordSelfConfirmation(buildId, model)` to `signals.ts` in its own commit first; if the update policy does not already let a creator set those columns, **stop and propose** the policy instead of widening one. Signed out → "Sign in to confirm" → login with redirect; under it Figtree 11px `--text2` "Your run relights the lamp and records the model you used."
  - 14px below, `WallLabel` 3 columns of `Detail`: Made for · Made with · Setup · Monthly · First result · Needs (`PortableCost` formatted in its currency, `time_to_first_result` as "{n} min" / "{n} h", Needs = the prerequisite node's title; "—" when missing).
  - 14px below, **creator only**, a column with gap 8: a row `Eyebrow` "Completeness" / DM Mono 12px "{score} / 100"; `StripedBar` `--lit`, height 11, ticks at `MINIMUM_PUBLISHABLE_SCORE` (`--text2`) and `galleryThreshold(shape)` (`--text`); a row `space-between` in DM Mono 10px `--label`: "PUBLISH 60" / "GALLERY {threshold}"; "Next: {missing[0].copy}" in Figtree 12px `--text2`.
- **Anatomy** (row 2, left): `Panel` padding 14px 12px. `PanelHead` "Anatomy" / "{n} parts · {g} left open" (no clause when there are no gaps), right `IconButton` 34 `Maximize2` "Show the full anatomy" (opens the existing `AnatomyTree` in a Radix Dialog). A list 8px below, gap 2: one **button** per node in record order, grid `28px minmax(0, 1fr) auto`, gap 8, height 40, padding 0 10px, radius 12: the number `type.display(20)` `--label` ("01"); a 7px dot in the node's category hue + the title (Figtree 13px `--text`, ellipsis), gap 7; a short meta in DM Mono 10px `--text2` (the same short meta `NodeCard` shows; a gap shows "£{reward} ask" in `--cat-breakage`). Selected: background `--row-highlight`, `aria-current="true"`. A gap part (`collectGaps()`): 1.5px dashed `--cat-breakage` border. Selecting a part shows it in the viewer.
- **Part viewer** (row 2, centre): `PartViewer` (UI-P11) for the selected part: "PART {nn}", the category chip and "{nn} · {title}"; the page tabs from `BuildTabs`, which has **six verified keys — `anatomy watch run understand broke rebuilds`. Keep all six.** The reference draws five labels because Run and Understand share one panel there: in code both tab keys stay, each renders the viewer with the layer switch preset to its own layer, and moving the switch moves the tab with it. The viewer body shows the `Segmented` Run / Understand, a secondary 30/12 Copy (copies the part's content), the layer's blurb line, and the part's content at Figtree 14px, line-height 1.65.
- **Timeline** (row 2, right): `Panel` padding 14px 16px. `PanelHead` "Watch it get built" / "{duration} · {n} events kept", right `IconButton` 34 `Play` "Play the build" (opens `Replay`). `Timeline` 12px below with the kept `build_events`.

**Mobile** (390×2140), gap 12:
1. Hero `<section>` 380 tall, radius 18, the same layers (arc viewBox 362×380, centre (520, −240), r 420), tag at 12/12, **no dock and no mark square**; the plate at left/right/bottom 10, padding 16, radius 14, `--plate`, 1px `--header-border`, blurred: `h1` `type.display(32)`, outcome Figtree 13px 8px below, credit Figtree 12px 8px below, Δ DM Mono 11px 2px below.
2. The action tiles as a row: grid 4 columns, gap 6, padding 6, radius 18, `--dock` / `--dock-border`, blurred; tiles 62 tall, radius 13, `--dock-tile`, icon 19, Figtree 11px 600.
3. Proof `Panel` padding 16: row gap 14 (`OrbGlass` 118; column gap 8 with `Eyebrow` and `Plaque` header); 14px below the primary as a full-width 48/15 button; the note centred, Figtree 12px, 8px below; `WallLabel` 2 columns of the six details, 14px below. For the creator, the completeness block follows (not drawn).
4. The page tabs as a `ScrollRow` of `FilterChip`s.
5. Anatomy `Panel` padding 14px 10px: rows grid `30px minmax(0, 1fr) auto`, min-height 46, number `type.display(20)`, 8px dot, title Figtree 14px, meta DM Mono 11px; the first six parts, then a text button "Show {n} more parts" (Figtree 13px `--action`, padding-left 10, 10px above).
6. The part viewer: strip 44 tall (block 78 wide, "PART 01" DM Mono 10px; the tab shows the chip and the title in Figtree 13px 600, no number); body padding 14px 16px: `Segmented` 34/12 and Copy 34/12; blurb Figtree 12px; content Figtree 15px, line-height 1.65. No tab row inside (item 4 is the tab row).
7. Timeline `Panel` padding 14px 16px; `IconButton` 38 Play; items grid `16px 48px minmax(0, 1fr)`; time DM Mono 11px; text Figtree 14px.

**Done when.** The four Build boards compare within 0.04; reproducing, re-confirming, copying, downloading, rebuilding and every existing tab still work (existing build tests and tier1 specs pass); only three surfaces on the page are blurred (header, plate, action dock).

**Commit.** `UI-P29: Build page first screen in the site frame`

---

## UI-P30 — Page: Build page — tab contents and the rest of the page

Follow `design/RULES.md` (§7).

**Goal.** Every other tab of the build page inside the part viewer, and everything the page shows below the first screen, in the same grammar. There is no board for these; they follow the primitives exactly.

**Read first.** `BuildTabs.tsx` (six keys: `anatomy watch run understand broke rebuilds`), `RebuildsTab.tsx` and `GapPanel.tsx` (both verified), the run / breakage / replay views under `components/build/` by their real names, and whatever else `BuildPage.tsx` renders under the header.

**Build.**
1. **Watch it get built** — the viewer body shows `Replay` with its controls restyled: play/pause `IconButton` 34, a scrubber drawn as a `StripedBar` in `--lit` (height 9) with a real `<input type="range">` over it for keyboard and pointer, the current event's kind label (colour as in `Timeline`) and text in Figtree 14px.
2. **Run it yourself** — `RunView` content in Figtree 14px, line-height 1.65; numbered steps with the number in `type.display(20)` `--label` (like the anatomy rows); code and prompts in a `--recess` well, radius 12, padding 12px 14px, DM Mono 12px, each with a secondary 30/12 Copy.
3. **Where it broke** — `BreakageView` items as rows with a 7px `--cat-breakage` dot, the part name in Figtree 13px 600, what happened in Figtree 13px `--text2`, and the fix in `--text`; an open gap shows as a dashed breakage card with its reward and a primary "Solve it" → the bounty.
4. **Result** — the result media or text inside a radius 10 frame, with `CategoryChip` "evidence" and the run log's date in DM Mono 10px `--label`.
5. **Rebuilds** (if the key exists) — the rebuild cards (build card, cover 86, title 17) in a 3-column grid inside the viewer body, then a link "See the family tree" → lineage.
6. **Below the first screen** (desktop and mobile): each remaining section `BuildPage` renders today becomes a glass `Panel` (padding 16px 18px, `PanelHead` title Figtree 16px 600) in the column, full width, gap 12, in its current order — `WhereNext` as a row of three build cards (desktop) / two-column wall (mobile), `GapPanel` as dashed breakage panels. No new sections.
7. Tabs keep their URL behaviour (hash or search parameter, as today).

**Done when.** Each tab renders real data for a build that has it, in both themes, at 390 and 1440; tier1 build specs pass; no new colours or radii outside the tokens and the radius scale.

**Commit.** `UI-P30: Build page tab contents and lower sections`

---

## UI-P31 — Page: Rebuild and lineage

Follow `design/RULES.md` (§7).

**Goal.** `/rebuild/:slug` as the reference (family tree, what changed, readiness), and `/b2/:slug/lineage` from the same pieces.

**Read first.** `pages/RebuildRoute.tsx` (`/rebuild/:slug`), `src/lib/build/rebuild.ts` — verified: `startRebuild`, `publishRebuild`, `listRebuilds`, `countRebuilds` — `fork.ts` (`forkBuild`, `getForkOrigin`), the `builds` columns `parent_build_id`, `root_build_id`, `rebuild_count`, `rebuild_note`, `forked_from_event_id`, `components/brand/RebuildCredit.tsx`, HANDOFF §5.4.

**Two warnings.** `src/pages/Lineage.tsx` and the RPC `get_post_lineage` belong to the **legacy** post system (`/b/:slug/lineage`) — do not read them for this and do not route to them. And the family tree, the change set and the readiness score may not exist as functions yet: `grep` for them, and where they do not exist add them first, each in its own commit, in `src/lib/build/rebuild.ts` — `getBuildFamily(rootId)` (from `root_build_id` / `parent_build_id`, capped at depth 20 and 200 rows, one query), `changeSet(draftId)` with a `serialiseChangeSet()` returning lines grouped by header with kinds `added | changed | removed`, and `rebuildReadiness(draftId)` reusing `computeCompleteness` — then build the view on them (§8).

**Reference.** `desktop/{noon,dusk}/rebuild.html`, `mobile/{noon,dusk}/rebuild.html`.

**Desktop (`/rebuild/:slug`).** Grid `minmax(0, 1fr) 470px`, filling. Right column: a column with gap 12 — What changed (fills) above Readiness (**290px**).
- **Family** `Panel` padding 16px 18px, full height. `PanelHead` "Family of {root title}" / "{n} builds · {g} generations · lamps show which still work", right `Segmented` 30/11 **Tree · List** (List is the default above 12 nodes).
  - **Tree**: a canvas 18px below, `position: relative`, 460px tall in `board` fit (grows with generations live; scrolls sideways inside the panel when wider). Generations are rows at y = 18 + 150·g. Nodes are 140px wide: padding 6, radius 12, `--glass`, 1px `--glass-border` (the viewer's draft: 1.5px dashed `--action`), `--shadow-card`; a lamp above each (24×7 at top −10, centred, `--lit`, opacity 1 or .45 by `plaqueState`, `--lamp-glow` when lit; none when never reproduced); a 50px cover (radius 8); the title in `type.display(14)`, −0.01em, one line, 5px below; a row `space-between` in DM Mono 10px `--text2`: the maker (or "you · draft") and the reproduction count ("—" for 0). Layout: each parent centred over its children, siblings in `created_at` order, at least 40px apart. Connectors: one SVG behind the nodes, a path `M x1 y1 C x1 y1+26, x2 y2−26, x2 y2` from the parent's bottom centre to each child's top centre, `--line`, 1.5px. Each node links to its build.
  - **List**: the indented list from the mobile board (below).
- **What changed** `Panel` padding 16px 18px. `PanelHead` "What changed" / "Computed from the source — you cannot edit this list", right `Eyebrow` "Δ {n} changes". For each group: a header (DM Mono 10px, .09em, caps, `--label`, padding 12px 0 4px); each line a grid `18px 130px minmax(0, 1fr)`, gap 8, height 30, 1px bottom `--hairline`, DM Mono 12px: the symbol (+ `--cat-configuration`, ~ `--lit-ink`, − `--cat-breakage`, with a visually hidden "added" / "changed" / "removed"), the name in `--text`, the value in `--text2` (ellipsis; "before → after" for changes).
- **Readiness** `Panel` padding 16px 18px. A row, gap 16, centred: `OrbRing` 120 at `rebuildReadiness()` with "{pct}%" / "ready"; a column, gap 8: `Eyebrow` "Rebuild readiness"; `type.display(22)`, −0.02em, line-height 1.1: "One thing before it can hang" / "{n} things before it can hang" / "Ready to hang"; the first missing item's copy in Figtree 12px `--text2`. 14px below, the credit box: padding 12px 14px, radius 12, background `--inset`, 1px `--line`: `Eyebrow` 10px "The credit it will carry"; "Rebuilt from *{source title}* by @{maker}" in Figtree 13px, 6px below; the Δ summary in DM Mono 11px `--text2`, 3px below (from `RebuildCredit`; structural, not removable). 14px below, gap 8: primary "Publish rebuild" with `Check` → `publishRebuild()` (disabled with its reason while readiness forbids it); ghost "Keep as draft".

**Desktop (the lineage route).** Use the build system's own lineage route if one exists; if the only lineage route is the legacy `/b/:slug/lineage`, add `/b2/:slug/lineage` pointing at this page and leave the legacy route alone. The same Family panel in the left track; the right column shows What changed for the node the viewer selects (its change set against its parent; before a selection: "Pick a build in the family to see what changed."). No Readiness panel.

**Mobile** (390×1340), gap 12:
1. Page heading: `Eyebrow` "Rebuild · draft", `h1` `type.display(32)` the draft title, Figtree 14px "Rebuilding {source title} by @{maker}."
2. Readiness first (the decision): `Panel` padding 16; `OrbRing` 112; `Eyebrow` "Readiness"; `type.display(20)`; Figtree 13px; the credit box (Figtree 14px); a full-width 48/15 primary "Publish rebuild".
3. What changed: `Panel` padding 14px 16px, subtitle "Computed from the source — not editable"; lines grid `16px 118px minmax(0, 1fr)`, min-height 36.
4. Family as an indented list: `Panel` padding 14px 16px, `PanelHead` "Family of {root}" / "Lamps show which still work"; rows min-height 52, `padding-left: 22px × depth`, an elbow for depth > 0 (at left 22·depth − 12: 10×26, 1.5px left and bottom borders `--line`, radius `0 0 0 8px`); a 40×40 cover (radius 9; the draft has a 1.5px dashed `--action` border); a column (title `type.display(16)` ellipsis; "{maker} · {n} reproduced" DM Mono 10px `--text2`); the lamp 18×6 on the right (lit / dimmed; the draft: a dashed `--action` outline).

**Done when.** The four Rebuild boards compare within 0.04; the change list equals `serialiseChangeSet()` output line for line; publishing still works end to end.

**Commit.** `UI-P31: Rebuild and lineage in the site frame`

---

## UI-P32 — Page: Import and compose (the workspace)

Follow `design/RULES.md` (§7).

**Goal.** `/import` as the reference — a working surface: **flat panels, no glass**, inside the normal header and footer. Compose routes adopt the same grammar.

**Read first.** `pages/ImportPage.tsx` (`/import`), `ComposeNew.tsx` (`/compose/new`), `Compose.tsx` (`/compose/:buildId`), `src/components/compose/*`, `src/lib/build/intake.ts` and `imports.ts` (the proposal type, the secret finding, keep-all, and the function that turns a proposal into a draft — use their real names, §8), the `import_sessions` table, HANDOFF §5.5.

**Reference.** `desktop/{noon,dusk}/import.html`, `mobile/{noon,dusk}/import.html`.

**Desktop.** Grid `360px minmax(0, 1fr) 330px`, filling. Every panel is `Panel variant="flat"`.
- **Transcript** (padding 14px 16px): `PanelHead` "Transcript" / "{source} · {n} turns · via connector" (drop "via connector" when not), right `Eyebrow` "Source". Turns 12px below, a column with gap 8: each bubble max-width 82%, padding 9px 12px, radius 12, 1px `--line`, Figtree 12px, line-height 1.45, `--text`; the viewer's turns aligned right on `--recess`, the assistant's aligned left on `--turn`. A `SecretFinding` is shown only in redacted form (never the secret) as an inline mark: `--secret-fill`, `--cat-breakage`, DM Mono 11px, padding 0 4px, radius 4.
- **What we found** (padding 14px 16px): `PanelHead` "What we found" / "Keep what belongs in the record", right a secondary 30/12 "Keep everything" → `keepEverything()`. When secrets were found, a banner 12px above and below: padding 12px 14px, radius 12, 1.5px dashed `--cat-breakage`, a row with gap 10: `ShieldAlert` 18 `--cat-breakage`; "A live API key was found in turn {n}" (Figtree 13px 600) over "It has been removed from every part. Nothing with it will be saved." (Figtree 12px `--text2`). Then `Eyebrow` "Parts · {kept} of {n} kept" and one `<label>` per `ProposedNode`: height 38, padding 0 10px, 1px bottom `--hairline`, gap 10: a checkbox (`accent-color: var(--action)`), its `CategoryChip`, the name (Figtree 13px; `--text` when kept, `--text2` when not). Then, 12px below, `Eyebrow` "Events · {kept} kept" and one row per `ProposedEvent`: height 34, checkbox, the kind (DM Mono 10px, 70px wide, colour by `EventKind` as in `Timeline`, caps), the text (Figtree 12px).
- **Right column**, gap 12:
  1. "How it will hang" (padding 14px 16px): `Eyebrow`; a `--recess` well 6px below (padding 10, radius 12) holding a live build card preview (cover 96, title 18) with the lamp spacer and no lamp — nothing is reproduced yet.
  2. Completeness (fills; padding 14px 16px): a row `Eyebrow` "Completeness" / DM Mono 20px score; `StripedBar` `--lit` 12 with the 60 and gallery ticks (margin 10px 0 4px); DM Mono 10px `--label` "PUBLISH 60 ✓" (✓ once ≥ 60) / "GALLERY {t}"; the `MissingItem.copy` checklist: rows 26px, gap 9, Figtree 12px (`--text` done, `--text2` not), each with a 16×16 box, radius 5 — done: `--evidence` fill with a `Check` 11px in `--on-evidence` (stroke 2.6); not done: 1.5px `--line` border; then 12px below the primary "Create the draft" with `ArrowRight` → `materialiseProposal()` / `claimImport()`.
- `/compose/new` and `/compose/:buildId` move into the site frame with the same flat grammar (flat panels, hairlines, `--recess` wells, the same completeness panel). They stay `React.lazy` and out of the initial bundle.

**Mobile** (390×1360), gap 12 — flat, no glass:
1. Step chips in a `ScrollRow` (gap 6): height 34, padding 0 12px, radius 10, Figtree 13px 500: done `--evidence` / `--on-evidence`; current `--text` / `--on-text`; later 1px `--line`, `--text2`. "1 · Source", "2 · Keep", "3 · Check", "4 · Hang".
2. Heading: `Eyebrow` "Import · from a chat", `h1` `type.display(32)` "What we found", Figtree 14px "{n} turns from {source}, via the connector."
3. The secret banner (when found): padding 14, radius 14, dashed breakage, background `--flat`, `ShieldAlert` 20, title Figtree 14px 600, text 13px.
4. Parts (flat, padding 14px): `PanelHead` "Parts · {kept} of {n} kept", right ghost 32/12 "Keep all"; rows min-height 48, padding 0 4px, gap 12: a 20×20 checkbox, the name (Figtree 15px, grows), the chip on the right.
5. Events (flat): rows min-height 46.
6. Completeness (flat, padding 14px 16px): score DM Mono 22px; the bar; labels 10px; checklist rows min-height 32, Figtree 14px, 18×18 boxes (radius 6, check 12).
7. A sticky action bar, `bottom: calc(92px + env(safe-area-inset-bottom))` (above the dock): padding 10, radius 16, `--solid`, 1px `--line`, `--shadow-card`, gap 8: ghost 48/14 "Discard" and a full-width 48/15 primary "Create the draft".
Phones do not show the transcript (as drawn).

**Done when.** The four Import boards compare within 0.04; an import can be reviewed and turned into a draft end to end on both viewports; no panel on these routes has `--glass` or a blur; compose and import stay out of the main bundle (check the build output).

**Commit.** `UI-P32: Import and compose in the site frame`

---

## UI-P33 — Page: Bounties, solve and solvers

Follow `design/RULES.md` (§7).

**Goal.** `/bounties` as the reference — vacant frames, the solve panel and top solvers — plus the solve route and `/bounties/solvers`, and the mobile solve sheet.

**Read first.** `pages/Bounties.tsx`, `BountySolvePage.tsx` (find its route in `App.tsx`), `Solvers.tsx`, `bounty/SolvePanel.tsx`, `MissingBlockOverlay`, `AcceptSolutionDialog`, `src/lib/bounty/*` — verified: `bounties.ts` (`listOpenBounties({ home: "build" })`, `listBuildBounties`, `createBountyForGap`, `closeBounty`), `solutions.ts` (`submitSolution`, `acceptSolution`, `listSolutions`, `countSolutionsByBounty`, `listSolverHandles`), `solutionRebuild.ts`, `meToo.ts`, `types.ts` (`BountyStatus = open | solved | closed | expired`) — plus `gapProblem` in `build/gaps.ts` and `getOpenBountyPool` (UI-P24). A made-with facet, a deadline extension and a ranked solver list may not exist; check, and where they do not, drop that piece from the view and say so rather than inventing a table (HANDOFF §5.6 lists them as gaps).

**Reference.** `desktop/{noon,dusk}/bounties.html`, `mobile/{noon,dusk}/bounties.html`, `mobile/{noon,dusk}/solve.html`.

**Desktop.** A column, gap 12: the header panel, then a grid `minmax(0, 1fr) 420px` that fills.
- **Header** `Panel` padding 16px 20px: a row `space-between`, `flex-end`, gap 20. Left, gap 8: `Eyebrow` "Bounties"; `h1` `type.display(44)` "Open asks on real builds"; Figtree 13px `--text2` "The build works. One part is left open on purpose, with a reward for whoever solves it." Right, gap 10: `Segmented` 34/12 **Newest · Reward · Closing soon** (sort) and `Segmented` 34/12 **Bounties · Solvers** (Solvers → `/bounties/solvers`).
- **Frames**: grid `repeat(3, minmax(0, 1fr))`, gap 6px 14px, `VacantFrame`s (UI-P15) from `listOpenBounties({ home: "build" })` in the chosen sort. Selecting a frame (click or Enter) shows it in the solve panel and sets `?bounty=<id>`; the selected frame uses `--row-highlight`. The first frame is selected by default. Paging as today.
- **Right column**, gap 12:
  1. **Solve** `Panel` padding 14px 16px (fills). A dashed box (1.5px `--cat-breakage`, radius 14, padding 14, column gap 10): a row with the gap's `CategoryChip` and, right, DM Mono 10px `--cat-breakage` "OPEN · DEADLINE EXTENDED ONCE" ("OPEN" when not extended); "{part} for {build title}" in `type.display(24)`, −0.02em, line-height 1.05; `gapProblem()` in Figtree 12px `--text2`, line-height 1.5; `WallLabel` 3 columns — Reward "£{n}" (value in `--lit-ink`), Closes "{d MMM}", Me too {n}; a row gap 8: primary "Submit a solution" `ArrowRight` (the existing submit flow) and secondary "Me too" `Heart` (`toggleMeToo()`, `aria-pressed` from `myMeToo()`). 14px below: `PanelHead` (13px) "Solutions over time" / "Opened {d MMM} by @{handle}"; `StepChart` 360×84, 8px below, from the solutions' `created_at`. 10px below: `Eyebrow` "Solutions · {n}" and rows: height 44, padding 0 10px, radius 12, gap 10 — `Avatar` 26, the handle (Figtree 13px, grows), "submitted {relative}" (DM Mono 10px `--text2`), and for the bounty's author a secondary 28/11 "Accept" with `Check` (opens `AcceptSolutionDialog`). The newest row has `--row-highlight`.
  2. **Top solvers** `Panel` padding 12px 16px: `PanelHead` (14px) "Top solvers" / "Solutions accepted"; the top three solvers (`listSolverHandles()` plus each one's accepted-solution count; with no ranked list, rank the handles it returns by that count in code): rows 38px, 1px bottom `--hairline`, gap 10 — `RankRung` 28 (1 highest, 2 rare, 3 common), `Avatar` 24, the handle (Figtree 12px, grows), "{n} solved" (DM Mono 11px `--text2`); then a link "All solvers" → the solvers route (`/bounties/solvers` if it exists; otherwise omit the link and say so).
- **Solve route** (`BountySolvePage`): the same solve panel, full width of the column, under the breadcrumb Home / Bounties / **{part}**.
- **`/bounties/solvers`**: the header panel with Solvers selected, then one glass panel with the full ladder (`RankRung` 32, `Avatar` 28, Figtree 14px rows 48px; ranks 4+ use tier `none`).

**Mobile** (390×1400), gap 12:
1. Heading: `Eyebrow` "Bounties", `h1` `type.display(34)` "Open asks on real builds", Figtree 14px "The build works. One part is left open on purpose, with a reward."
2. A row `space-between`: `Segmented` 36/13 Bounties · Solvers; a secondary 36/13 showing the current sort ("Newest") that opens a `BottomSheet` with the three sorts.
3. Two orbs, centred, gap 12: `OrbSolid` 150 "Open pool" / "£{pool}" / "{open} asks"; `OrbGlass` 150 "Being solved" / "{solutions} solutions".
4. The frames, one per row, gap 4.
5. Top solvers `Panel` padding 14px 16px: rows min-height 48, `RankRung` 32, `Avatar` 28, Figtree 14px, DM Mono 12px.
Tapping a frame opens the **solve sheet** (`BottomSheet`, titled "Solve this part"; reference `mobile/*/solve.html`, height 640 at 844): grabber; the dashed problem card (radius 16, padding 14; chip + "EXTENDED ONCE"; `type.display(24)`; Figtree 14px; `WallLabel` 3); a full-width 48/15 primary "Submit a solution"; a full-width 48/15 secondary "Me too"; `Eyebrow` "Solutions · {n}" with rows min-height 48 (`Avatar` 28, Figtree 14px, DM Mono 11px). The page behind keeps its scroll position; the URL gets `?bounty=<id>` so Back closes the sheet.

**Done when.** The six Bounties boards (desktop and mobile, plus the two solve sheets) compare within 0.04; submitting, me-too, accepting and deadline extension behave as before.

**Commit.** `UI-P33: Bounties, solve and solvers in the site frame`

---

## UI-P34 — Page: Profile

Follow `design/RULES.md` (§7).

**Goal.** `/profile/:handle` as the reference: the banner, the level ring with tracks, the stats wall label, works, the activity grid and creator marks.

**Read first.** `pages/Profile.tsx`, `profile/ProfileHeader.tsx`, `MakerFigures.tsx`, `profile-game/ProfileLevelHeader.tsx`, `LevelRing.tsx`, `ProfileStatsBar.tsx`, `trophies/*`, `streaks/streak-calendar.tsx`, `src/lib/progress/*` and the `user_progress` table (`xp_total`, `level`, `counters`, `streak_*`) — the level curve is `level = floor((xp / 75) ^ (1 / 1.7)) + 1`, so use the module's own helpers rather than recomputing it; the `badges` table (`is_creator_mark`, `tier`, `criteria`) and `src/components/trophies/*` (there is a second, client-side copy of the badge catalogue in `trophies/badge-data` — read from one source, do not add a third); `streak_days`; `listBuildsByCreator` (verified, `src/lib/build/builds.ts`); `getMakerFigures` (UI-P26); the library's collections module; the follow action; HANDOFF §5.7. Track switching (`architect | curator | mentor | explorer`) and a creator-marks getter may not exist — check, and where they do not, render the track chips read-only and the marks from `user_badges` directly (§8).

**Reference.** `desktop/{noon,dusk}/profile.html`, `mobile/{noon,dusk}/profile.html`.

**Desktop.** A column, gap 12: row 1 grid `minmax(0, 1fr) 440px` at **220px**; row 2 the stats (natural height); row 3 grid `minmax(0, 1fr) 360px` filling, its right track a column (gap 12) of Activity and Creator marks, each `flex-grow: 1`.
- **Banner** `<section>` radius 16, `overflow: hidden`, 1px `--glass-border`, `--shadow-card`: the cover of the maker's most-reproduced build (else `CoverFallback` seeded with the user id); the arc (viewBox 900×260, centre (1150, −420), r 760); a scrim `linear-gradient(0deg, var(--banner-scrim) 0%, transparent 70%)`. At the bottom (left 20, right 20, bottom 18) a row, `flex-end`, gap 18: a 104×104 square (radius 14, `--inverse`, `--shadow-square`) holding `Avatar` 78; a column, gap 6, grows: `Eyebrow` in `--text` "Maker · {place} · since {Mon YYYY}" (omit parts that are missing); `h1` `type.display(52)`, −0.04em, line-height .95, the display name; "@{handle} · {bio}" in Figtree 13px `--text`; then the actions, gap 8: primary "Follow" with `Plus` (following: secondary "Following" with `Check`), secondary "Message" with `MessageSquare` (only if messaging exists). On your own profile: secondary "Edit profile" instead.
- **Level** `Panel` padding 16px 18px: a row, gap 16, centred: `OrbRing` 150 at `xpProgressInLevel()` with the level number and "level"; a column, gap 8, grows: `Eyebrow` "Track"; `Segmented` 30/11 **Architect · Curator · Mentor · Explorer** (own profile: changes track through `setUserTrack` / `respecTrack` with the existing confirmation; others: the same control read-only with `aria-disabled`); "{xp} / {next} xp · {remaining} to {next level name}" in DM Mono 12px `--text2`; a row, gap 6, Figtree 12px `--text2`: `Flame` 15 `--lit-ink` "{n}-day streak · best {m}".
- **Stats** `WallLabel` 4 columns of `Stat`: "Builds hung"; "Reproduced by others" (`--evidence` bar); "Rebuilds of their work" (`--cat-agents` bar); "Bounties solved" with "/ £{earned}" (`--action` bar). Each bar shows progress to that figure's next creator-mark threshold when `getCreatorMarks()` defines thresholds; where it does not, the `Stat` has no bar (an expected compare difference — note it in the report).
- **Works** `Panel` padding 12px 16px 14px: `UnderlineTabs` 13 "Builds {n}" · "Rebuilds {n}" · "Reproduced {n}" · "Collections {n}" (4px below it) and a grid of 4 columns, gap 12, build cards (cover 86, title 17); in `board` fit one row; live, paging with "Show more". Collections shows collection tiles in the same card frame (cover mosaic of the first four builds, title, "{n} builds").
- **Activity** `Panel` padding 14px 16px: `PanelHead` (13px) "Activity" / "22 weeks · outlined days were frozen"; `ActivityGrid` of the last 22 weeks (`getStreakDays(userId, 154)`) 12px below.
- **Creator marks** `Panel` padding 14px 16px: `PanelHead` (13px) "Creator marks" / "Common · rare · highest"; 12px below, a row `space-between` of up to five tiles, 64 wide, column gap 6: the 46×46 tile (radius 13, `Trophy` 20; highest `--lit` / `--on-lit` with `--rank-glow`; rare `--recess`; common 1.5px `--line`) over the mark's name (Figtree 10px `--text2`, centred, line-height 1.2).

**Mobile** (390×1720), gap 12:
1. Banner `<section>` 290 tall: the cover 180 tall (radius 18, 1px `--glass-border`) with the arc (viewBox 362×180, centre (520, −300), r 440); the 92×92 square (radius 16, `Avatar` 70) at left 14, top 130; a text column at left 120, right 0, top 190, gap 4: `Eyebrow` "Maker · {place}", `h1` `type.display(30)`, "@{handle} · {bio}" Figtree 12px `--text2`.
2. Actions: grid 2 columns, gap 8, full-width 48/15 primary "Follow" and secondary "Message".
3. Level `Panel` padding 16: `OrbRing` 118; a column, gap 6: `Eyebrow` "{Track} track", "{xp} / {next} xp" DM Mono 13px `--text`, "{remaining} to {next}" Figtree 12px `--text2`, the streak row; 14px below a `ScrollRow` of `FilterChip`s for the four tracks (margin 14px −2px 0).
4. Stats `WallLabel` 2 columns.
5. Works tabs as a `ScrollRow` of `FilterChip`s; the works grid, 2 columns, gap 6px 10px, cover 90, title 17.
6. Activity `Panel` padding 14px 16px, subtitle "22 weeks · outlined days were frozen", the grid in an `overflow: hidden` box.
Creator marks sit after Activity on phones (not drawn): the same tiles in a `ScrollRow`.

**Done when.** The four Profile boards compare within 0.04 (bars as noted); following, track changes and the works tabs behave as before; nothing calls `award_xp()`.

**Commit.** `UI-P34: Profile in the site frame`

---

## UI-P35 — Page: Activity

Follow `design/RULES.md` (§7).

**Goal.** `/notifications` rebuilt as the reference (it has been in the frame with its old content since UI-P20).

**Read first.** `pages/Notifications.tsx`, `notifications/NotificationRow.tsx`, `NotificationCard.tsx`, `src/lib/notifications/` — verified: notifications are **inserted client-side** (`insertNotification`, `createNotification`, `triggers.ts`), with `resolveTarget.ts` and `types.ts`, and **nothing targets a build yet**, so the kinds this page can show are the ones `types.ts` declares and `notifications.target_type` allows (checked against `blueprint|blog|bounty|stage|block|comment|message|thread|profile`). Read them, use the kinds that exist, and list the drawn kinds that have no data yet under "Not covered" rather than inventing them. Also `getRunsOfMyBuilds` and `countPeopleWhoRanMyBuildsThisWeek` (UI-P26), HANDOFF §5.8.

**Reference.** `desktop/{noon,dusk}/activity.html`, `mobile/{noon,dusk}/activity.html`.

**Kinds.** icon and colour per kind — for the kinds that exist — used on the badge, the filter dot and nowhere else: reproduced `Check` `--evidence`; rebuilt `RefreshCw` `--cat-agents`; solution `Target` `--action`; solved `Trophy` `--lit-ink`; published `Image` `--lit-ink`; comment and reply `MessageSquare` `--text2`; like `Heart` `--text2`; follow `User` `--text2`.

**Desktop.** Grid `minmax(0, 1fr) 400px`, filling. Right track: a column, gap 12 — orbs (**180px**), chart (**190px**), filters (fills).
- **List** `Panel` padding 14px 16px: `PanelHead` "Activity" / "{n} unread · live" ("· live" only while the realtime channel is connected), right ghost 30/12 "Mark all read" with `Check`. Groups by the viewer's local day — Today, Yesterday, Earlier this week, Earlier — each headed by an `Eyebrow` (padding 14px 4px 6px). Rows: grid `14px 38px minmax(0, 1fr) 76px 40px`, gap 12, centred, min-height 64, padding 6px 12px, radius 14; unread rows `--row-highlight` with a `LampDot` 10×7 in the first track; the actor's `Avatar` 34 with the kind badge (absolute right −4, bottom −4, 20×20, radius 7, `--solid`, 1px `--glass-border`, the kind icon 12px stroke 2 in its colour); the text: the who-part in Figtree 13px `--text2` and the build title inline in `type.display(17)` `--text`, then the detail in DM Mono 11px `--label` 3px below; the build's cover 76×46 (radius 9; empty track when there is no build); the time in DM Mono 10px `--label`, right-aligned. A row links to its target and marks itself read.
- **Orbs** `Panel` padding 12: centred row, gap 12: `OrbSolid` 140 "This week" / {n} / "people ran your builds"; `OrbGlass` 140 "Listening" / "live" (while connected; "Reconnecting" / "offline" otherwise).
- **Chart** `Panel` padding 14px 16px: `PanelHead` (13px) "Runs of your builds" / "Last 90 days · dashed line: your rebuild went live" (no second clause when `rebuildLiveIndex` is null); `LineChart` 360×120 10px below.
- **Show me** `Panel` padding 14px 16px: `PanelHead` (14px) "Show me"; rows 32px, 1px bottom `--hairline`, gap 10: an 8px dot in the kind's colour, the kind (Figtree 13px, grows), the count among loaded notifications (DM Mono 11px `--label`). Rows are toggle buttons (`aria-pressed`) filtering the list; none pressed = all.

**Mobile** (390×880), gap 12:
1. Heading: `Eyebrow` "Activity", `h1` `type.display(34)` "{n} unread" ("All caught up" at 0).
2. A `ScrollRow` of `FilterChip`s with counts: All · Reproduced · Rebuilt · Solutions · Comments · Follows.
3. One glass `Panel` per group (padding 14px 8px): the `Eyebrow`, then rows: grid `38px minmax(0, 1fr) auto`, gap 12, padding 12px 10px, radius 14, bottom `--hairline`, unread `--row-highlight`: `Avatar` 36 with the badge; the who-line (Figtree 13px `--text2`), the title (`type.display(19)`, −0.01em, line-height 1.1), the detail (DM Mono 11px `--label`, 3px below); on the right a column, gap 6: the time (DM Mono 10px `--label`) and the unread `LampDot`.
Phones do not show the orbs, chart or filter panel (the chips replace the filter).

**Done when.** The four Activity boards compare within 0.04; new notifications appear live and update the header badge and dock badge; mark-read works per row and for all.

**Commit.** `UI-P35: Activity rebuilt`

---

## UI-P36 — Pages: Sign in, Join, reset and verify

Follow `design/RULES.md` (§7).

**Goal.** `/login` and `/signup` as the reference, `/reset-password` and `/verify-email` in the same layout. **A repaint of the forms, not a rewrite of auth**: every field name, handler, validation, OAuth provider and `?redirect=` behaviour stays exactly as it is.

**Read first.** `pages/Login.tsx`, `Signup.tsx`, the reset and verify pages, the OAuth buttons they use, `useAuth()`, HANDOFF §5.9.

**Reference.** `desktop/{noon,dusk}/signin.html` (the page is 1440×1000 under the browser strip), `mobile/{noon,dusk}/signin.html`.

**Layout.** `SiteFrameView variant="bare"`: no header, breadcrumb, footer or dock. The page background is `var(--ambient), var(--bg)` with `box-shadow: var(--signin-edge)` on the page root (the glowing inner edge from the brand tile), the arc (viewBox 1440×1000, centre (1800, −560), r 1060) and the Dusk grain — give `PageBackdrop` a `tone="signin"` for this.

**Desktop.** Content centred in the viewport (min-height 100dvh), a row with gap 110:
- **Left**, a column with gap 30: `Lockup` 70; `Tagline` 40 (0 / 70 / 24) with the sentence as real text for screen readers; a row, gap 12: `OrbGlass` 140 "Reproduced" / "{countReproducedToday()} today"; `OrbSolid` 140 "Hung" / {in-gallery count} / "builds".
- **Right**, a centred column, gap 16:
  - **The card**: 420 wide, padding 26, radius 20, background `--header`, 1px `--header-border`, `box-shadow: var(--shadow-float), var(--panel-highlight)`, `backdrop-filter: blur(16px) saturate(1.15)` (the only blurred surface on the page); a column, gap 12:
    1. a row `space-between`: a "Back" link (`ArrowLeft` 15, Figtree 13px `--text2`; history back, or `/`) and `Segmented` 32/12 **Sign in · Join free** (switches between `/login` and `/signup`, keeping `?redirect=`);
    2. one button per existing OAuth provider (Google, GitHub, X as today): height 44, radius 12, `--glass-2`, 1px `--line`, Figtree 14px 500, gap 10, the provider's existing 16px mark, "Continue with {provider}";
    3. a divider, margin 4px 0: two 1px `--line` rules either side of `Eyebrow` 10px "or with email";
    4. the fields, each a `<label>` column with gap 7: `Eyebrow` 10px label ("Email or username", "Password"); the field 44 tall, padding 0 14px, radius 12, `--field`, 1px `--line`, gap 10, `User` / `Lock` icon 16 `--text2`, the input Figtree 14px (16px below 768px);
    5. a row `space-between`, Figtree 13px `--text2`: the "Keep me signed in" checkbox (only if the form has it today) and "Forgot password?" in `--action` → `/reset-password`;
    6. the primary 46/15 "Sign in" (Join: "Create account").
    Errors: one sentence in `--cat-breakage` under the field it belongs to, announced with `aria-live="polite"`.
  - `ThemeSegmented` 34/12 under the card.
- **Join** shows the existing signup fields in the same field style. **Reset** and **verify** use the same page and card with their existing content.

**Mobile** (390×844): `<main>` padding 22px 14px 30px, a column with gap 14:
1. padding 10px 0 4px, a column with gap 18: `Lockup` 34; `Tagline` 26 (0 / 40 / 12).
2. The form in a glass `Panel` (padding 16, column gap 10): `Segmented` 38/13; OAuth buttons 48 tall, Figtree 15px; the divider (margin 2px 0); fields 48 tall with 16px inputs; the remember / "Forgot?" row; a full-width 48/15 primary "Sign in".
3. `ThemeSegmented` 36/12, centred.
No orbs on phones.

**Done when.** The four Sign-in boards compare within 0.04; every existing auth e2e spec passes unchanged; signing in with `?redirect=/gallery` lands on the gallery.

**Commit.** `UI-P36: Sign in, join, reset and verify repainted`

---

## UI-P36b — Turn the frame on

Follow `design/RULES.md`.

**Run this only after `UI-D01` reports verdict B.** If it reported A, merge the branch instead. If C, go back and run the missing prompts. Turning on a flag in front of pages that were never built shows visitors a broken site.

**Goal.** The ten rebuilt pages are what a visitor sees. Everything from `UI-P16` on was built behind the `site_frame` flag, which is off by default — so until this prompt runs, every route renders its `legacy` branch and the overhaul is invisible outside a dev session.

**Read first.** `src/lib/shell/flags.ts` (what `isSiteFrameOn()` reads, and what it returns when the row is absent), `src/components/shell/siteFrameRoutes.ts`, `src/components/AppShell.tsx`, the `feature_flags` table **as it exists in the live database** (its real column names — `RULES.md` §8: the live schema has drifted from `supabase/migrations/`, so confirm rather than trust a migration file), and the newest filename in `supabase/migrations/`.

**Do.**

1. **Check the routes first.** Every route inside the layout must be in `SITE_FRAME_ROUTES`. List any that are not and **stop** if there are any: a half-flagged app shows a visitor the new frame on one page and the old one on the next. Name the missing routes and which prompt owns each.
2. **Walk the app with the flag forced on**, before changing any data — `?frame=site` (the dev override from `UI-P16`), at 1440 and 390, in Noon and in Dusk, signed in and signed out: `/`, `/gallery`, a build page, `/rebuild/:slug`, the lineage route, `/import`, `/bounties`, a profile, `/notifications`, `/login`. For each: does it render, does the header show, does the breadcrumb read correctly, are there console errors. **Stop and report** if any page throws, renders the old frame, or loses data that the legacy page showed.
3. **Enable the flag** with a migration that inserts the row, named to continue the project's sequence (`YYYYMMDDHHMMSS_snake_case.sql`, after the newest existing one). Write it so it is correct whether or not the row is already there, and so re-running it is harmless:
   - insert `site_frame` enabled, `on conflict do update`;
   - use the table's real column names from the step above;
   - no `auth.uid()` bare in any policy you touch — `(select auth.uid())`.
   Do not change any other flag's row.
4. **Keep the way back.** In the migration file's header comment, write the one-line SQL that disables it again. The point of the flag is that a bad deploy is one `update` away from the old frame, and whoever needs that at 2am should not have to read this prompt.
5. **Verify with the flag genuinely on**, not overridden: the ten routes again, desktop and mobile, both themes. Then `npm run audit:design` across every board.
6. Update `design/README.md` — under "Checking a change", note that the frame is now on for everyone and `?frame=flat` shows the old one until `UI-P41` deletes it.

**Do not.** Delete `FlatShell`, the legacy branches or the flag — that is `UI-P41`, and only once this has been live long enough to trust. Turn on any other flag. Change a policy to make the flag readable; if a signed-out visitor cannot read `feature_flags`, **stop and propose** the policy rather than widening one.

**Done when.** A signed-out visitor in a clean browser gets the new frame on all ten routes at 1440 and 390 in both themes; `npm run audit:design` compares every board within its threshold; `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build` and `npx playwright test e2e/tier1 --project=desktop --project=mobile` all pass; and the migration's header carries the one-line rollback.

**Commit.** `UI-P36b: turn on the site frame`

---

## UI-P37 — Every state: loading, empty, error

Follow `design/RULES.md`.

**Goal.** The references show full pages. This gives every panel built in UI-P27 to UI-P36 its other three states, in the same grammar, so nothing ever shows a spinner, a blank box or a raw error.

**Read first.** Every `*View.tsx` and `*Page.tsx` from UI-P27 to UI-P36; how TanStack Query is configured in `src/main.tsx` or `App.tsx` (retries, `staleTime`); any existing skeleton or error component in the repo (reuse it if there is one).

**Build** three small primitives in `src/components/brand/`, then use them everywhere:
1. **`Skeleton`** (`width`, `height`, `radius = 8`) — background `--recess`, no animation under `prefers-reduced-motion`, otherwise a 1.4s opacity pulse between 1 and .55 (opacity only; the keyframe is the one thing that goes in `src/index.css`). A skeleton is **the same size as the content it replaces**, so a loading page has the reference's layout: card skeletons in the wall grid, row skeletons at the row height, an orb skeleton as a circle of the orb's diameter, a chart skeleton as a `--recess` block of the chart's box. Panels, their heads and their padding render normally while loading — only the content inside is skeletal. Each loading region carries `aria-busy="true"` and a visually hidden "Loading {what}".
2. **`EmptyState`** (`line`, `action?`) — a centred column, gap 12, padding 28px 20px: one sentence in `type.display(20)` `--text`, and at most one `Button` secondary 36/13. No illustration, no icon. The lines, per panel:
   - Feed: "Nothing hung yet." + "Enter the gallery" · Gallery wall: "Nothing here yet." + "See all builds" · Facets with no counts: hide the group · Challenges (signed out): "Sign in to take this week's challenges." + "Sign in" · Streak: "Run a build today to start a streak." · Where next: "Run a build this week and suggestions appear here." + "Enter the gallery" · Anatomy: "This build has no parts yet." · Timeline: "No events were kept for this build." · Solutions: "No solutions yet." · Top solvers: "Nobody has solved a bounty yet." + "See open bounties" (the live site's wording) · Bounty frames: "No open asks right now." + "Enter the gallery" · Works: "No builds hung yet." · Activity: "All caught up." · Family: "This build has no rebuilds yet." · Change list: "Nothing has changed yet." · Import parts: "Nothing to keep was found in this conversation."
3. **`ErrorState`** (`line`, `onRetry`) — a column, gap 10: one sentence in Figtree 14px `--text` ("That didn't load."), the panel's name in DM Mono 11px `--label`, and a `Button` secondary 34/12 "Try again" calling the query's `refetch`. Never show an exception message, a stack or an id; log the real error to the console once. A failed page shell (header, breadcrumb, footer) still renders — the error lives inside the panel that failed, and one failing panel never blanks the page.

**Also.** A signed-out visitor sees every public panel and, in place of a signed-in-only panel, one `EmptyState` with a "Sign in" action — never a disabled control with no explanation. Optimistic actions (reproduce, me too, mark read) show their new state immediately and roll back with an `ErrorState` line inside the panel if the write fails.

**Done when.** `/dev/kit/pages/:page?state=loading|empty|error` renders each state for every page (add the parameter to the dev compare page), with no layout shift between loading and populated at 1440 and 390 in both themes; the populated boards still compare within 0.04.

**Commit.** `UI-P37: loading, empty and error states`

---

## UI-P38 — The accessibility pass

Follow `design/RULES.md`.

**Goal.** One pass over everything built, fixing what the reference could not show: names, order, contrast, motion and touch.

**Read first.** `src/lib/theme/contrast.test.ts` and `compliance.test.ts`, every component from UI-P06 to UI-P36.

**Check and fix.**
1. **Names.** Every icon-only control has an `aria-label` that says what it does, not what it looks like ("Activity, 3 unread", "Play the build", "Show the full anatomy", "Theme: Noon"). Every link whose text is only a title has enough context. The lockup's link is "buildgallery home".
2. **Landmarks and order.** One `<h1>` per page (the tagline chips are `aria-hidden`; the sentence is the real `h1`). `<header>`, `<nav aria-label>`, `<main id="main">`, `<footer>` once each. Tab order follows the visual order on every board; nothing focusable is invisible; the skip link is first.
3. **State.** `aria-current="page"` on the current header link, dock tile and breadcrumb leaf. `aria-pressed` on toggles (filters, facets, me too). `role="tablist" / "tab" / "tabpanel"` with `aria-selected` on the build page's tabs and the works tabs, arrow keys moving between them. `aria-live="polite"` for "Copied", "Marked read" and each optimistic result.
4. **Colour and contrast.** Re-run `npm run audit:contrast` and `npm run audit:themes`. No text under 10px anywhere (the reference's 9px mono labels are 10px). Amber (`--lit`) is never text or the only marker of a state: the lamp always sits beside words ("41 reproduced", "last confirmed…"), and read-out amber uses `--lit-ink`. Category hues are never the only signal either — every dot has its name or chip beside it. The gap is dashed **and** labelled.
5. **Focus.** The UI-P04 ring is visible on every interactive element on both themes, including inside the dock, the part viewer's tab strip and over covers; it is never clipped by `overflow: hidden` (add padding or an inset ring where it is).
6. **Motion.** Under `prefers-reduced-motion: reduce`: no scroll-entry animation, no skeleton pulse, no sheet slide (it appears), no hover translation. The lamp, the arc and the grain never animate for anyone.
7. **Touch and input.** Every target ≥44×44 on phones (dock tiles 62×54; checkbox rows 48 tall; chips 36 tall with 8px gaps count as 44 with their padding — verify each one). Every mobile input ≥16px. The sheet's grabber is not the only way to close it.
8. **Screen-reader pass** over Home, Build page and Bounties: the page reads as a sentence, the plaque reads as "41 reproduced, last confirmed working 3 days ago, on sonnet-4.5", and a card reads title first.

**Done when.** `npm run audit:contrast`, `audit:themes` and `audit:glass` pass; an axe run (via `@axe-core/playwright` **only if it is already a dependency**; otherwise a manual pass over the checklist above) reports no serious or critical issues on the ten pages in both themes; every tier1 spec passes.

**Commit.** `UI-P38: accessibility pass`

---

## UI-P39 — Between the boards: 768 to 1279, and the tablet chrome switch

Follow `design/RULES.md`.

**Goal.** The kit draws 1440 and 390. This makes every width between them behave, with no new layout invented.

**Read first.** Every page view's grid, `SiteFrameView`, `ScrollRow`.

**Rules to apply.**
1. **The column.** `max-width: 1280px` with 24px side padding below 1328px. Nothing is ever wider than the viewport; no page scrolls sideways at any width from 320 to 2560.
2. **Chrome switch at 768px.** At 768 and above: the desktop header and footer. Below: the mobile header and dock. One breakpoint, one switch, in `SiteFrameView` only — no page decides its own chrome.
3. **Between 768 and 1279**, in this order:
   - a three-track row (Build page bottom row, Import) drops its narrowest side panel below the other two, full width, keeping its height;
   - a two-track row (Home, Gallery, Bounties, Profile, Activity) keeps both tracks to 1024, the right track narrowing to 340 minimum, then stacks below 1024 with the right track's panels in the order they appear on the phone;
   - the gallery wall goes 4 → 3 columns at 1279 and 2 at 1023; the works grid 4 → 3 → 2; the bounty frames 3 → 2 at 1023;
   - the featured build keeps its two-column span to 1024, then becomes the stacked mobile composition;
   - the desktop header's search shrinks to 200px at 1100 and becomes an `IconButton` that opens the search sheet below 900; the New build label becomes icon-only below 980 (keeping its accessible name).
4. **Above 1440** nothing grows except the backdrop: the column stays 1280 and stays centred.
5. **Zoom.** At 200% browser zoom on a 1280 viewport the page is usable and nothing overlaps (this is the same code path as 640px wide).

**Done when.** Screenshots at 360, 390, 414, 768, 834, 1024, 1280, 1440 and 1920 in both themes show no horizontal scrollbar, no overlap, no clipped text and no element narrower than its content; the 1440 and 390 boards still compare within 0.04; a tier1 spec checks the chrome switch at 767 and 768.

**Commit.** `UI-P39: widths between the boards`

---

## UI-P40 — The performance pass

Follow `design/RULES.md`.

**Goal.** The new frame must not cost what the old one did not. Blur budget, bundle, paint and queries.

**Read first.** `design/BASELINE.md` (UI-P00), the `neoscale-performance` skill if it is available, `vite.config.ts`, every `React.lazy` route in `App.tsx`.

**Do.**
1. **Blur budget — exactly four surfaces** may have `backdrop-filter`: the desktop header, the mobile header, the dock, and the build page's title plate and action dock (one page's pair). Nothing blurred is nested inside anything blurred. Grep for `backdrop-filter` and `blur(` and remove any other use.
2. **One paint for the room.** The backdrop is one element with a CSS background plus one arc SVG and (Dusk) one grain SVG per page — not per panel. No `position: fixed` full-screen layer, no animation, no `feDisplacementMap`. Check that a scroll of Home stays at 60fps in the Performance panel with paint flashing on.
3. **Lazy.** Every page from UI-P27 to UI-P36 is `React.lazy`, and so is anything with a chart (`LineChart`, `StepChart`, `ActivityGrid` where they are not above the fold), the `Replay` view, the compose and import routes and every `/dev/*` page. Check `dist/` after `npm run build`: the initial chunk must not contain fixtures, dev pages, chart code or the Replay view, and the largest chunk must not be bigger than the baseline's.
4. **Fonts.** Sentient (two weights) is preloaded with `font-display: swap` and subset to Latin if it is not already; no third display weight is added. Figtree and DM Mono are unchanged.
5. **Images.** Every cover has `loading="lazy"` except the first screen's hero, explicit `width`/`height` (or a fixed-height box) so nothing shifts, and `decoding="async"`. `CoverFallback` is inline SVG, never a network request.
6. **Queries.** One query per panel, never one per row. No query inside a `map`. Every list has a `.limit()`. Counts are estimated where an exact number is not shown. The header's unread count is read once and updated by the realtime channel, not polled. Check the network panel on Home: no duplicate requests for the same key, no request per feed row.
7. **Re-renders.** The header, breadcrumb, footer and dock do not re-render when a page's data changes (memo them and keep their props stable); typing in search does not re-render the page body.

**Done when.** `npm run build` output is recorded in `design/BASELINE.md` beside the UI-P00 numbers, with no chunk larger than before; the four blurred surfaces are the only ones; a Lighthouse run on Home and the Build page (desktop and mobile) is no worse than the baseline on LCP, CLS and TBT, and CLS is below 0.1.

**Commit.** `UI-P40: performance pass`

---

## UI-P41 — Retire the old frame

Follow `design/RULES.md`. **This is the only prompt that deletes anything.** Run it when every route is on the new frame and the flag has been on in production — switched on by `UI-P36b` — long enough to trust. If `UI-P36b` has not run, the overhaul is not live yet and this prompt would delete the way back.

**Read first.** `design/RULES.md` §3, `AppShell.tsx`, `FlatShell.tsx`, `flat-shell.css`, `wideRoutes.ts`, `RightRailExplore.tsx`, `right-rail-explore.css`, `RightRailDrawer.tsx`, `hooks/useRightRailData.ts`, `MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `src/lib/theme/semantics.ts`, and the tests `AppShell.test.tsx`, `FlatShell.wide.test.tsx`, `wideRoutes.test.ts`, `e2e/tier3/moved-routes-frame.spec.ts`, `src/lib/retiredSurfaces.test.tsx`, `docs/retired-surfaces.md`.

**Do, in this order, one commit each.**
1. **Confirm.** `SITE_FRAME_ROUTES` covers every route inside the layout, and `usesSiteFrame` returns true for each one. List any route that is not covered and stop if there is one.
2. **Make the frame unconditional.** `AppShell` renders `SiteFrame` always. Remove the flag branch, `useSiteFrameFlag`, `src/lib/shell/flags.ts`, `siteFrameRoutes.ts`, `FrameRoute` and the `?frame=` override, and the `site_frame` row from `feature_flags` (a migration that deletes the row, following the project's filename sequence).
3. **Delete the old frame:** `FlatShell.tsx`, `flat-shell.css`, `wideRoutes.ts`, `MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `RightRailDrawer.tsx`, and the legacy page components each page prompt left in place as its `legacy` branch. Delete their tests, or rewrite each one against the new frame where it was testing behaviour that still exists (the nav list, the theme control, the search). `FlatShell.wide.test.tsx` and `wideRoutes.test.ts` go.
4. **Delete the right rail:** `RightRailExplore.tsx`, `right-rail-explore.css`, `hooks/useRightRailData.ts` and the dev page `/dev/wide/rail`. Its content already lives in page panels (Home's right column).
5. **Retire the tokens the new card does not use** — `--card-frame`, `--card-thread`, and any `--porthole`, `--chrome-hi`, `--chrome-lo`, `--glass-hi` with no remaining reader. For each: grep for every use, remove it from `TOKEN_NAMES`, both theme objects, every `:root` block and `t`, and update `css-parity.test.ts` and `compliance.test.ts` in the same commit. A token still used by anything stays.
6. **Update the register:** add the deleted surfaces to `docs/retired-surfaces.md` and to `src/lib/retiredSurfaces.test.tsx` so they cannot come back.
7. **Update the docs:** `CLAUDE.md`'s UI section, the `buildgallery-theme` skill text (Noon, Sentient, the new tokens, the new frame) and `design/HANDOFF.md` §3 and §7 — replacing "what exists / what is new" with what now exists. Note in `design/README.md` that the kit is now a record of the built UI, and that the compare harness still guards it.

**Do not.** Delete anything in the legacy inventory that is not the frame or the rail (the content path, `Upload.tsx`, `content_items`, the legacy discovery and reading pages are a separate piece of work). Delete `design/` or the compare harness.

**Done when.** No file imports `FlatShell`, `flat-shell.css`, `wideRoutes` or the rail; `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build` and the full Playwright suite pass; `npm run audit:design` still compares every board within 0.04; the app looks the same after the deletions as before them.

**Commit.** `UI-P41a: frame unconditional` · `UI-P41b: delete FlatShell and phone chrome` · `UI-P41c: delete the right rail` · `UI-P41d: retire unused tokens` · `UI-P41e: registers and docs`

---

## UI-P77 — Put the refined boards in the repo

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The refined boards and fonts are in the repo, the series is indexed, and the compare harness can check a page against a refined board.

**Build.**
1. `python3 design/refined_prompts.py write` has run (it wrote this prompt). Check that the repo now has `design/reference/refined/{dusk,noon}/*.html` (24 boards), `design/reference/refined/index.json`, and `design/reference/fonts/Geist-Variable.woff2`, `GeistMono-Variable.woff2` and `Geist-OFL.txt`. If the fonts are missing, run `python3 design/refined_prompts.py fonts` (it fetches the `geist` package from the npm registry with `npm pack` and copies the two files out; nothing is installed). If that fails too, stop and say so.
2. Check that `design/prompts/00-INDEX.md` lists UI-P77 to UI-P99 and that `ALL-PROMPTS.md` ends with them; the script adds both.
3. Extend `e2e/audit/design-compare.spec.ts` to read `design/reference/refined/index.json` as well. For kind `refined`: no 84px browser strip; the app URL is the entry's `devPage` plus `?theme=<theme>&viewport=desktop&look=refined` and whatever query the dev page needs to show the same state (for `build-map` the Map lens; for `composer-map` the Map lens with prompt 3 selected; for `prompt-window` the full prompt window open on prompt 3; for `composer-card` the Card sheet open). Find those queries in `src/dev/` and the dev pages; where none exists, add it to the dev page (dev code only) and say so. Boards without `devPage` (foundations, components, model-marks) map to `/dev/kit/components?look=refined` sections, compared once UI-P84 to UI-P86 exist; until then they skip. A dev page asked for `look=refined` with no refined view yet says `data-design-ready="false"`, so the board is skipped, not failed.
4. Run `npm run audit:design -- --grep "refined/"` and record the result in `design/BASELINE.md` under a new heading "Refined look, before UI-P78": every refined board skipped.

**Do not.** Touch `src/` except dev pages and `e2e/audit/`.

**Done when.** The refined boards open in a browser with Geist loaded from `design/reference/fonts/`; the harness lists the 24 refined boards and skips them.

**Commit.** `UI-P77: the refined boards, fonts and compare harness`

---

## UI-P78 — The look switch

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** One switch, off, that can turn the whole site to the refined look, and a dev override so every refined board can be checked while it is off.

**Build.**
1. `src/lib/theme/look.ts`: `export const REFINED_LOOK_ENABLED = false as const;` with a header comment in the style of `src/lib/build/flags.ts` (what it switches, which prompt turns it on — UI-P98 — and that rollback is setting it back to `false`). `export type Look = "current" | "refined"`. `export function useLook(): Look` — on `/dev/*` routes the URL decides when it has `look=refined` or `look=current`; otherwise `"refined"` when the switch is on and `"current"` when it is off.
2. The theme provider (find it: it sets `data-theme` on `<html>`) also sets `data-look="refined"` on `<html>` when `useLook()` is refined, and removes it otherwise. It changes with the route on dev pages. No transition is added.
3. The dev kit chrome (the bar that offers `theme` and `viewport` on `/dev/kit/*`) gains a **Look** choice, `current | refined`, writing `look=` into the URL.
4. `src/lib/theme/look.test.ts`: switch off → `current`; dev route with `look=refined` → `refined`; dev route with `look=current` → `current`; non-dev route with `look=refined` → the switch's value.

**Do not.** Read `useLook()` anywhere else yet.

**Done when.** With the switch off, nothing on any page changes (run the full `npm run audit:design` and `e2e/tier1`; diffs equal the baseline). `/dev/kit/pages/home?look=refined` has `data-look="refined"` on `<html>`.

**Commit.** `UI-P78: the refined look switch, off, with a dev override`

---

## UI-P79 — Refined colour tokens

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Every colour, shadow and edge the refined look needs, in both themes, behind the switch.

**Build.**
1. Add the new token names below to `TOKEN_NAMES` in `src/lib/theme/semantics.ts` (so `t.surface`, `t.module`, `t.tile`, `t.well`, `t.control` … exist), with their current-look **aliases** inside the existing `:root[data-theme="noon"]`, `:root[data-theme="dusk"]` and bare `:root` blocks of `src/index.css`. With the switch off nothing changes, because every alias points at the token a primitive reads today.
2. Add `:root[data-theme="dusk"][data-look="refined"]` and `:root[data-theme="noon"][data-look="refined"]` blocks after the theme blocks with **every refined value below**, exactly as written. Mirror them in `design/tokens/tokens.css` and `tokens.json` under a `refined` key, and add the raw values to `design/tokens/token-map.md` in a "Refined" section.
3. Recompute the shadcn HSL variables (`--background`, `--card`, `--popover`, `--primary`, `--border`, `--input`, `--ring` …) for the refined blocks in `src/lib/theme/shadcn.ts` (or wherever the triplets are derived): background = frame, card and popover = module, primary = action, border and input = hairline, ring = focus-ring.
4. Tests. `css-parity` holds both refined blocks to the same set of names. `contrast` gains refined pairs, all ≥ 4.5:1: `text`, `text2`, `label` on `surface`, `module`, `tile`, `well`, `frame`; `evidence` on `evidence-fill`; `on-action` on `action`; `on-pill` on `pill`; `on-tag` on `tag-fill`; each `cat-*` on `module`. `glass` and `compliance` assert their current rules for `data-look` absent and assert, for refined, that `glass`, `glass-fill` and `module` are opaque and that `backdrop` is a flat colour.

**The values.**

New names, to add to `TOKEN_NAMES`: `frame`, `surface`, `surface-border`, `surface-shadow`, `module`, `module-border`, `module-shadow`, `tile`, `tile-border`, `well`, `well-border`, `well-shadow`, `hairline-module`, `control`, `control-border`, `control-shadow`, `control-on`, `seg-track`, `seg-border`, `action-shadow`, `tag-fill`, `on-tag`, `pill`, `on-pill`, `lit-mark`, `nav-mark`, `breakage`, `breakage-fill`, `info`, `frozen`, `selected-edge`, `selected-fill`, `selected-ring`, `window`, `window-border`, `window-shadow`, `sheet-shadow`, `dot-grid`, `avatar-fill`, `on-avatar`, `logo-ink`, `bar-mid`, `paper`, `dim-filter`.

Under the current look each new name is an alias, so a primitive can read it in either look: `--frame: var(--bg)`, `--surface: var(--flat)`, `--surface-border: var(--hairline)`, `--surface-shadow: var(--panel-highlight)`, `--module: var(--glass)`, `--module-border: var(--glass-border)`, `--module-shadow: var(--shadow-card)`, `--tile: var(--cell)`, `--tile-border: var(--hairline)`, `--well: var(--field)`, `--well-border: var(--line)`, `--well-shadow: none`, `--hairline-module: var(--hairline)`, `--control: var(--glass-2)`, `--control-border: var(--line)`, `--control-shadow: none`, `--control-on: var(--tab)`, `--seg-track: var(--glass-2)`, `--seg-border: var(--line)`, `--action-shadow: none`, `--tag-fill: var(--glass-2)`, `--on-tag: var(--text2)`, `--pill: var(--glass-2)`, `--on-pill: var(--text)`, `--lit-mark: var(--lit)`, `--nav-mark: var(--lit)`, `--breakage: var(--cat-breakage)`, `--breakage-fill: var(--secret-fill)`, `--info: var(--cat-data)`, `--frozen: var(--cat-data)`, `--selected-edge: var(--text)`, `--selected-fill: var(--glass)`, `--selected-ring: 0 0 0 1px var(--text)`, `--window: var(--solid)`, `--window-border: var(--glass-border)`, `--window-shadow: var(--shadow-float)`, `--sheet-shadow: var(--shadow-float)`, `--dot-grid: var(--hairline)`, `--avatar-fill: var(--recess)`, `--on-avatar: var(--text)`, `--logo-ink: var(--text)`, `--bar-mid: var(--line)`, `--paper: var(--porthole)`, `--dim-filter: opacity(.45)`.

Refined values, new and existing names alike:

| token | Dusk | Noon | role |
|---|---|---|---|
| `--frame` | `#0F0F10` | `#E9E9E9` | the page behind everything; the header sits on it |
| `--surface` | `#19191B` | `#F4F4F4` | the one panel inside the frame (inset 6px, radius 10) |
| `--surface-border` | `#232326` | `#DCDCDC` | its single hairline |
| `--surface-shadow` | `inset 0 1px 0 rgba(255,255,255,.035)` | `0 1px 2px rgba(0,0,0,.05)` |  |
| `--module` | `#1E1E21` | `#FAFAFA` | a card: one step from the surface |
| `--module-border` | `#29292D` | `#E1E1E1` |  |
| `--module-shadow` | `none` | `0 1px 2px rgba(0,0,0,.04)` |  |
| `--tile` | `#232327` | `#EFEFEF` | a tile inside a card (nested panel, selected table row, drafts box) |
| `--tile-border` | `#2E2E33` | `#E2E2E2` |  |
| `--well` | `#141416` | `#ECECEC` | below the surface: inputs, search, maps, media wells, code |
| `--well-border` | `#27272B` | `#D9D9D9` |  |
| `--well-shadow` | `inset 0 1px 1px rgba(0,0,0,.35)` | `inset 0 1px 2px rgba(0,0,0,.05)` |  |
| `--hairline` | `#26262A` | `#E0E0E0` | row and section separators on the surface |
| `--hairline-module` | `#2A2A2E` | `#E7E7E7` | separators inside a card |
| `--line` | `#34343A` | `#CFCFCF` | dashed drop zones, chart rules, dividers in the header |
| `--text` | `#EDEDEF` | `#1C1C1C` |  |
| `--text2` | `#A0A0A6` | `#575757` |  |
| `--label` | `#8E8E94` | `#666666` | third tier; 4.5:1 or better on every surface above |
| `--control` | `#27272B` | `#FFFFFF` | raised controls: secondary buttons, icon buttons, menus, chips, number tiles |
| `--control-border` | `#323237` | `#D9D9D9` |  |
| `--control-shadow` | `inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.35)` | `0 1px 2px rgba(0,0,0,.07), inset 0 -1px 0 rgba(0,0,0,.03)` |  |
| `--control-on` | `#2F2F34` | `#FFFFFF` | the chosen segment, the current nav row, a pressed toggle |
| `--seg-track` | `#141416` | `#E6E6E6` | the recessed track behind segmented choices |
| `--seg-border` | `#27272B` | `#D9D9D9` |  |
| `--action` | `#EDEDEF` | `#1C1C1C` | the one filled button per view (ink, not colour) |
| `--on-action` | `#121214` | `#FFFFFF` |  |
| `--action-shadow` | `inset 0 -1px 0 rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.45)` | `inset 0 1px 0 rgba(255,255,255,.1), 0 1px 2px rgba(0,0,0,.25)` |  |
| `--tag-fill` | `#26262A` | `#E9E9E9` | quiet tags: shape, model, date |
| `--on-tag` | `#A0A0A6` | `#575757` |  |
| `--pill` | `#303035` | `#E6E6E6` | mono pills: visitors' book kinds, ids, counts |
| `--on-pill` | `#CFCFD3` | `#333333` |  |
| `--lit` | `#F5CB4C` | `#E0A21A` | the lamp bar (3px high); light, never text |
| `--lit-mark` | `#F5CB4C` | `#F5CB4C` | the lamp in the logo and the unread count badge |
| `--lamp-glow` | `0 0 6px rgba(245,203,76,.7), 0 0 14px rgba(245,203,76,.25)` | `none` | Dusk only; Noon has no glow |
| `--nav-mark` | `#F5CB4C` | `#1C1C1C` | the 2px bar under the current nav item |
| `--nav-lamp-glow` | `0 0 8px rgba(245,203,76,.55)` | `none` |  |
| `--lit-ink` | `#E8C468` | `#8F5E00` | amber text (BUILD kind, chart marker) |
| `--evidence` | `#86D193` | `#166F31` | reproduced, worked, the result |
| `--evidence-fill` | `rgba(134,209,147,.12)` | `#E1F1E5` |  |
| `--breakage` | `#E5807F` | `#C42E1C` |  |
| `--breakage-fill` | `rgba(229,128,127,.12)` | `#F9E6E3` |  |
| `--info` | `#82A9E8` | `#2563EB` | links in charts, the focus ring |
| `--frozen` | `#8FB8D0` | `#3F86B5` | a frozen streak day |
| `--selected-edge` | `#8E8E95` | `#1C1C1C` | the edge of a selected card or map box; never a colour |
| `--selected-fill` | `#222226` | `#FFFFFF` |  |
| `--selected-ring` | `0 0 0 1px #8E8E95` | `0 0 0 1px #1C1C1C` |  |
| `--scrim` | `rgba(10,10,11,.72)` | `rgba(28,28,28,.32)` | behind dialogs and sheets; no blur |
| `--window` | `#1E1E21` | `#FAFAFA` | dialogs and sheets |
| `--window-border` | `#2E2E33` | `#DCDCDC` |  |
| `--window-shadow` | `inset 0 1px 0 rgba(255,255,255,.04), 0 2px 6px rgba(0,0,0,.4), 0 32px 64px -16px rgba(0,0,0,.75)` | `0 2px 6px rgba(0,0,0,.08), 0 32px 64px -16px rgba(0,0,0,.3)` |  |
| `--sheet-shadow` | `-24px 0 64px -16px rgba(0,0,0,.7)` | `-24px 0 64px -16px rgba(0,0,0,.25)` | side sheets |
| `--dot-grid` | `rgba(255,255,255,.055)` | `rgba(0,0,0,.08)` | the 1px dots, 16px apart, in media wells and maps |
| `--avatar-fill` | `#2C2C30` | `#E2E2E2` | initials avatars (photo avatars unchanged) |
| `--on-avatar` | `#CFCFD3` | `#333333` |  |
| `--logo-ink` | `#EDEDEF` | `#1C1C1C` | the frame and window of the mark |
| `--bar-base` | `#3A3A3F` | `#E0E0E0` | unfilled part of a progress bar |
| `--bar-mid` | `#55555B` | `#C4C4C4` | a sparkline with no activity |
| `--paper` | `#0C0C0D` | `#F1F1F1` | inside a framed work or result window |
| `--dim-filter` | `brightness(.48) saturate(.5)` | `contrast(.42) brightness(1.32)` | what a map does not touch; opaque, so wires never show through |
| `--focus-ring` | `#8EB4F0` | `#2563EB` | 2px outline, 2px offset |

Category colours under refined:

| token | Dusk | Noon |
|---|---|---|
| `--cat-instruction` | `#E39A78` | `#C0623A` |
| `--cat-instruction-fill` | `rgba(227,154,120,.12)` | `rgba(192,98,58,.10)` |
| `--cat-configuration` | `#C9C27A` | `#857A14` |
| `--cat-configuration-fill` | `rgba(201,194,122,.12)` | `rgba(133,122,20,.10)` |
| `--cat-data` | `#82A9E8` | `#2D6BE4` |
| `--cat-data-fill` | `rgba(130,169,232,.12)` | `rgba(45,107,228,.10)` |
| `--cat-artefact` | `#D9B36C` | `#A3741A` |
| `--cat-artefact-fill` | `rgba(217,179,108,.12)` | `rgba(163,116,26,.10)` |
| `--cat-evidence` | `#86D193` | `#23804F` |
| `--cat-evidence-fill` | `rgba(134,209,147,.12)` | `rgba(35,128,79,.10)` |
| `--cat-narrative` | `#A0A0A6` | `#5F5F5B` |
| `--cat-narrative-fill` | `rgba(160,160,166,.12)` | `rgba(95,95,91,.10)` |
| `--cat-agents` | `#A996E8` | `#6B52D6` |
| `--cat-agents-fill` | `rgba(169,150,232,.12)` | `rgba(107,82,214,.10)` |
| `--cat-breakage` | `#E5807F` | `#C93E32` |
| `--cat-breakage-fill` | `rgba(229,128,127,.12)` | `rgba(201,62,50,.10)` |
| `--cat-media` | `#E08FB4` | `#BE4C84` |
| `--cat-media-fill` | `rgba(224,143,180,.12)` | `rgba(190,76,132,.10)` |

Existing tokens repointed under refined (glows, arcs, orbs and glass resolve to flat values):

| token | Dusk | Noon |
|---|---|---|
| `--bg` | `var(--frame)` | `var(--frame)` |
| `--backdrop` | `var(--frame)` | `var(--frame)` |
| `--ambient` | `linear-gradient(transparent, transparent)` | `linear-gradient(transparent, transparent)` |
| `--recess` | `var(--well)` | `var(--well)` |
| `--glass` | `var(--module)` | `var(--module)` |
| `--glass-2` | `var(--control)` | `var(--control)` |
| `--glass-border` | `var(--module-border)` | `var(--module-border)` |
| `--glass-hi` | `rgba(255,255,255,.04)` | `rgba(255,255,255,.6)` |
| `--glass-fill` | `var(--module)` | `var(--module)` |
| `--glass-rim` | `transparent` | `transparent` |
| `--glass-halo` | `0 0 0 0 transparent` | `0 0 0 0 transparent` |
| `--panel-highlight` | `var(--surface-shadow)` | `var(--surface-shadow)` |
| `--panel-highlight-color` | `rgba(255,255,255,.035)` | `transparent` |
| `--card-frame` | `var(--module)` | `var(--module)` |
| `--card-thread` | `var(--tile)` | `var(--tile)` |
| `--on-evidence` | `#121214` | `#FFFFFF` |
| `--on-evidence-fill` | `var(--evidence)` | `var(--evidence)` |
| `--on-lit` | `#111112` | `#111112` |
| `--porthole` | `var(--paper)` | `var(--paper)` |
| `--chrome-hi` | `#45454C` | `#FFFFFF` |
| `--chrome-lo` | `#222225` | `#D6D6D6` |
| `--on-text` | `#121214` | `#FFFFFF` |
| `--header` | `transparent` | `transparent` |
| `--header-border` | `transparent` | `transparent` |
| `--cell` | `var(--tile)` | `var(--tile)` |
| `--row-highlight` | `var(--tile)` | `var(--tile)` |
| `--solid` | `var(--module)` | `var(--module)` |
| `--flat` | `var(--surface)` | `var(--surface)` |
| `--viewer-block` | `var(--well)` | `var(--well)` |
| `--tab` | `var(--control-on)` | `var(--control-on)` |
| `--field` | `var(--well)` | `var(--well)` |
| `--media-tag` | `rgba(15,15,16,.78)` | `rgba(255,255,255,.88)` |
| `--plate` | `rgba(15,15,16,.62)` | `rgba(250,250,250,.84)` |
| `--dock` | `var(--surface)` | `var(--surface)` |
| `--dock-border` | `var(--surface-border)` | `var(--surface-border)` |
| `--dock-tile` | `var(--control)` | `var(--control)` |
| `--inverse` | `var(--text)` | `var(--text)` |
| `--on-inverse` | `#121214` | `#FFFFFF` |
| `--on-inverse-2` | `#55555B` | `#BDBDBD` |
| `--inverse-evidence-fill` | `#DDF2E1` | `#1F3A27` |
| `--on-inverse-evidence-fill` | `#14301C` | `#DDF2E1` |
| `--ring-glow` | `0 0 0 0 transparent` | `0 0 0 0 transparent` |
| `--rank-glow` | `0 0 0 0 transparent` | `0 0 0 0 transparent` |
| `--tagline-chip` | `var(--control)` | `var(--control)` |
| `--on-tagline-chip` | `var(--text)` | `var(--text)` |
| `--tagline-lamp` | `var(--lit)` | `var(--lit)` |
| `--orb-glass` | `linear-gradient(var(--module), var(--module))` | `linear-gradient(var(--module), var(--module))` |
| `--orb-glass-edge` | `var(--module-border)` | `var(--module-border)` |
| `--on-orb-glass` | `var(--text)` | `var(--text)` |
| `--orb-solid` | `linear-gradient(var(--module), var(--module))` | `linear-gradient(var(--module), var(--module))` |
| `--on-orb-solid` | `var(--text)` | `var(--text)` |
| `--on-orb-solid-2` | `var(--text2)` | `var(--text2)` |
| `--arc-1` | `transparent` | `transparent` |
| `--arc-2` | `transparent` | `transparent` |
| `--arc-3` | `transparent` | `transparent` |
| `--arc-haze` | `transparent` | `transparent` |
| `--arc-outer` | `transparent` | `transparent` |
| `--shadow-float` | `var(--window-shadow)` | `var(--window-shadow)` |
| `--shadow-card` | `var(--module-shadow)` | `var(--module-shadow)` |
| `--shadow-square` | `0 1px 2px rgba(0,0,0,.45)` | `0 1px 2px rgba(0,0,0,.08)` |
| `--shadow-dock` | `inset 0 1px 0 rgba(255,255,255,.04), 0 12px 32px rgba(0,0,0,.5)` | `0 12px 32px rgba(0,0,0,.12)` |
| `--shadow-sheet` | `0 -16px 48px rgba(0,0,0,.5)` | `0 -16px 48px rgba(0,0,0,.14)` |
| `--ring-track` | `var(--hairline-module)` | `var(--hairline-module)` |
| `--picture-lamp-glow` | `var(--lamp-glow)` | `var(--lamp-glow)` |
| `--picture-lamp-wash` | `rgba(245,203,76,.10)` | `rgba(245,203,76,.16)` |
| `--banner-scrim` | `rgba(15,15,16,.75)` | `rgba(244,244,244,.85)` |
| `--inset` | `var(--tile)` | `var(--tile)` |
| `--turn` | `rgba(255,255,255,.03)` | `rgba(0,0,0,.025)` |
| `--secret-fill` | `var(--breakage-fill)` | `var(--breakage-fill)` |
| `--sheet-dim` | `rgba(10,10,11,.5)` | `rgba(28,28,28,.25)` |
| `--signin-edge` | `inset 0 0 0 1px var(--module-border)` | `inset 0 0 0 1px var(--module-border)` |
| `--elev-raised` | `var(--control-shadow)` | `var(--control-shadow)` |
| `--elev-overlay` | `var(--window-shadow)` | `var(--window-shadow)` |

**Do not.** Use any new token in a component yet.

**Done when.** `/dev/kit/components?look=refined` already shows the new colours wherever a primitive reads a repointed token; the switch-off audit is unchanged; theme guard tests pass.

**Commit.** `UI-P79: refined colour tokens for Dusk and Noon behind the look switch`

---

## UI-P80 — Geist and Geist Mono

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The refined type: two self-hosted faces and the roles in the table below.

**Build.**
1. Copy `design/reference/fonts/Geist-Variable.woff2` and `GeistMono-Variable.woff2` to `public/fonts/`, and `Geist-OFL.txt` beside them. `@font-face` for each in `src/index.css` (`font-weight: 100 900`, `font-display: swap`) next to the Sentient rules. Preload `Geist-Variable.woff2` in `index.html` only when the switch is on (UI-P98 flips it; until then, no preload). This amends `design/RULES.md` §3 "never install a dependency": no package is installed, two font files are added.
2. Font families become tokens: `--font-ui`, `--font-display`, `--font-data` (they exist in `design/tokens/tokens.css`; add them to `src/index.css` if missing). Current look: Figtree, Sentient, DM Mono, exactly as today. Refined look: Geist, Geist, Geist Mono.
3. In `src/lib/theme/type.ts`, `FIGTREE`, `SENTIENT` and `DM_MONO` become `var(--font-ui)`, `var(--font-display)` and `var(--font-data)` with the current stacks as fallbacks, so every role switches with the look. Role **sizes** that differ under refined (the table below: hero 44, page title 20, card title 13.5–14, body 13, step text 13.5/22, label 12.5, eyebrow 10.5 caps .06em in Geist not mono, mono 10.5) become per-look values the same way: a `--type-<role>-size` (and `-tracking`, `-weight`, `-leading` where they differ) custom property per role, defaulting to today's value. Add the two new roles `figure` (24/500, -0.02em, tnum) and `mono` (Geist Mono 10.5) to `type.ts`.
4. `type.test.ts`: roles resolve to today's values with the switch off and to the table below with `data-look="refined"`.

**The roles under refined.**

| role | face | size / weight | line height | tracking | notes |
|---|---|---|---|---|---|
| hero (statement) | Geist | 44 / 500 (mobile 32) | 1.04 | -0.04em | the tagline |
| page title | Geist | 20 / 500 | 1.2 | -0.015em | h1 on every page but Home |
| figure | Geist | 24 / 500 (large 32) | 1.1 | -0.02em | counts, tabular |
| section / card title | Geist | 13.5–14 / 500 | 1.3 | -0.005em | |
| body | Geist | 13 / 400 | 20px | 0 | |
| step text | Geist | 13.5 / 400 | 22px | 0 | prompts and steps |
| label | Geist | 12.5 / 500 | 1.3 | 0 | |
| meta | Geist | 11.5–12 / 400 | 1.4 | 0 | `--text2` or `--label` |
| eyebrow | Geist | 10.5 / 500 caps | 1.3 | .06em | `--label`; caps by CSS unless the code's string is already caps |
| mono | Geist Mono | 10.5 / 400 | 18px | 0 | pills, ids, the `/` key |

Inputs are 16px on mobile.

**Do not.** Change any role's value under the current look.

**Done when.** The switch-off audit is unchanged. On `/dev/kit/components?look=refined`, every label is Geist and nothing is serif.

**Commit.** `UI-P80: Geist and Geist Mono as the refined faces, roles per look`

---

## UI-P81 — Radius, space, elevation — and no glass, no backdrop, no reveal

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The refined shape and depth, and the removal of everything the refined look does not have.

**Build.**
1. **Radius.** In the refined blocks set `--r-chip: 4px; --r-media: 6px; --r-control: 6px; --r-thread: 6px; --r-card: 8px; --r-panel: 10px` and add `--r-window: 12px` (current look: `--r-window` aliases `--r-panel`). Add `window` to `RADIUS` in `src/lib/theme/radius.ts` and update `radius.test.ts`.
2. **Space.** Add `SPACE_REFINED` to `src/lib/theme/space.ts` — `2 4 6 8 12 16 20 24 32 40 48 64` — with `isRefinedStep()`, and the named layout values: `headerHeight: 48`, `gutter: "clamp(16px, 4.6vw, 64px)"`, `rowMin: 40`, `rowTwoLine: 48`, `rowAvatar: 56`, `modulePad: 16`, `tilePad: 12`. Tests.
3. **Elevation.** `elev-raised` → `--control-shadow`, `elev-overlay` → `--window-shadow`, `shadow-card` → `--module-shadow` under refined (UI-P79 set them; check `elevation.ts` reads them).
4. **No glass.** Under refined, `GlassFilter` renders nothing and the liquid-glass class from UI-P09b has no effect (scope its CSS to `:root:not([data-look="refined"])`). `Panel` with `surface="glass"` paints the module recipe. Update `glass-budget.spec.ts` and `glassFilter.test.tsx`: zero glass under refined.
5. **No backdrop.** Under refined, `PageBackdrop`, `Arc`, the grain and the living backdrop (UI-P13, UI-P13b) render nothing; the page is `--frame`. `backdrop.test.tsx` gains the refined case.
6. **No reveal.** `useReveal` returns "already revealed" under refined: nothing fades in on scroll. Hover styles that change `opacity` change background instead under refined (grep `onMouseEnter`/`useInteractive` in `src/components/brand/`).

**Do not.** Remove anything: the current look still uses all of it.

**Done when.** `/dev/kit/pages/home?look=refined` shows no gradient, no grain, no glass and nothing fading in; the switch-off audit is unchanged; theme guard tests pass.

**Commit.** `UI-P81: refined radius, space and elevation; glass, backdrop and reveal off under refined`

---

## UI-P82 — The glyph set

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The refined icons: 16px square-cap glyphs, and no icon inside a labelled button.

**Build.**
1. `src/components/brand/Glyph.tsx`: `name` (the keys in the table below), `size` (default 16), `color` (default `currentColor`), stroke 1.3 (`more` is 2), `strokeLinecap="square"`, `fill="none"`, `aria-hidden="true"`. Paths exactly as in the table below.
2. `src/components/brand/Icon.tsx`: `<Icon lucide={Search} glyph="search" />` renders the glyph under refined and the lucide icon under current. Lucide icons with no glyph render under refined at stroke 1.3 with square caps.
3. Add the glyphs to the Controls section of `/dev/kit/components`.
4. A unit test that every glyph name in the table renders one path.

**The glyphs.** Where no glyph fits, `lucide-react` stays, at stroke 1.3 with square caps.

| glyph | path (viewBox 0 0 16 16) |
|---|---|
| `chev` | `M6.5 4 10.5 8l-4 4` |
| `chevd` | `M4 6.5 8 10.5l4-4` |
| `chevl` | `M9.5 4 5.5 8l4 4` |
| `search` | `M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0z` |
| `bell` | `M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.25h-9zM6.75 14.25h2.5` |
| `moon` | `M12.75 9.75A5.25 5.25 0 0 1 6.25 3.25a5.25 5.25 0 1 0 6.5 6.5z` |
| `sun` | `M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5zM8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1` |
| `plus` | `M8 3.5v9M3.5 8h9` |
| `x` | `M4.5 4.5l7 7M11.5 4.5l-7 7` |
| `pencil` | `M10.5 3.5l2 2L6 12H4v-2z` |
| `file` | `M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12` |
| `layers` | `M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.5 8 11.5l5.5-3M2.5 11.25 8 14.25l5.5-3` |
| `panel` | `M2.5 3h11v10h-11zM6 3v10M8.5 6.5 10 8l-1.5 1.5` |
| `larr` | `M13 8H3.5M7 4.5 3.5 8 7 11.5` |
| `rarr` | `M3 8h9.5M9 4.5 12.5 8 9 11.5` |
| `check` | `M3.5 8.5 6.5 11.5 12.5 4.5` |
| `more` | `M3.5 8h.01M8 8h.01M12.5 8h.01` |
| `up` | `M8 13V3.5M4.5 7 8 3.5 11.5 7` |
| `image` | `M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10.5 6h.01` |
| `play` | `M5 3.5v9l7-4.5z` |
| `expand` | `M9.5 2.5h4v4M13.5 2.5l-5 5M6.5 13.5h-4v-4M2.5 13.5l5-5` |
| `grid` | `M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z` |
| `globe` | `M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM2.5 8h11M8 2.5c1.5 1.5 2.3 3.4 2.3 5.5S9.5 12 8 13.5M8 2.5C6.5 4 5.7 5.9 5.7 8s.8 4 2.3 5.5` |
| `mail` | `M2.5 4h11v8h-11zM2.5 4.5 8 9l5.5-4.5` |

**Do not.** Replace icons in pages; the page prompts do that in their refined views.

**Done when.** The components board's glyph row compares within 0.04 under refined.

**Commit.** `UI-P82: square-cap glyphs and the Icon switch`

---

## UI-P83 — Model marks with Lobe Icons, background-less

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Every model, lab and AI tool the site names gets its real logo beside the name: the logo alone, no tile, no background, no border.

**This prompt amends `design/RULES.md` §3: it installs one dependency,** `@lobehub/icons-static-svg@^1.95` (MIT; static SVG files, no runtime dependencies). Do **not** install `@lobehub/icons`: it needs React 19, antd 6 and `@lobehub/ui`, and this site is React 18.

**Build.**
1. `npm install @lobehub/icons-static-svg@^1.95`. Check that `package-lock.json` gains only that package.
2. `src/lib/models/marks.ts` (pure, tested) — `markFor({ tool, model, lab }): MarkKey | null`:
   - **tool first** (session tools, `CONNECTOR_TOOLS` in `src/lib/connect/connector.ts`, and any tool name in session data): Claude → `claude-color`, Claude Code → `claudecode-color`, ChatGPT → `openai`, Cursor → `cursor`, Gemini → `gemini-color`, Grok → `grok`, Vercel → `vercel`;
   - **then model**, through `normaliseModel()` in `src/lib/models/registry.ts` (so aliases resolve): lab Anthropic → `claude-color`, OpenAI → `openai`, Google → `gemini-color`, xAI → `grok`, DeepSeek → `deepseek-color`;
   - **then lab** (the Gallery's Labs list): Anthropic → `anthropic`, OpenAI → `openai`, Google → `google-color`, xAI → `xai`, DeepSeek → `deepseek-color`;
   - Gmail → the `mail` glyph; anything else → `null`.
   Tests cover each row, an alias (e.g. `claude-sonnet-4.5` style spellings already in `registry.test.ts`), case and whitespace, and the null case.
3. `src/components/brand/ModelMark.tsx` — props `tool?`, `model?`, `lab?`, `size: 14 | 16 | 18 | 20 | 24 | 28`. Import each of the 12 SVGs as a URL (`import claudeColor from "@lobehub/icons-static-svg/icons/claude-color.svg"`) so only those files ship. Rendering:
   - keys ending `-color` → `<img src alt="" width height aria-hidden="true" draggable={false}>`, unaltered;
   - mono keys → `<span aria-hidden="true">` sized `size`×`size`, `background-color: currentColor`, `mask-image` and `-webkit-mask-image: url(<file>)`, `mask-size: contain`, no repeat, centred, `color: t.text` unless the parent sets one;
   - `mail` → `<Glyph name="mail">`; `null` → render nothing (the name stands alone).
   - **No tile, no padding, no border, no background, no radius, no shadow.** `flex-shrink: 0`, `display: inline-block`, `vertical-align: middle`, `data-mark={key}`.
4. `ModelTag` (a quiet tag with a 14px mark, gap 6, padding `0 8px 0 6px`, height 22, `--tag-fill`, `--on-tag` 11.5) and `ModelChip` (a control, height 32, padding `0 12px 0 8px`, 20px mark, gap 8; pressed = selected recipe) in `src/components/brand/`.
5. `/dev/kit/components` gains a **Model marks** section built like the `model-marks` board: every lab at 14, 16, 20, 24 and 28 with the models it names, the tool rows, tags and chips. The board draws tiles with initials: build the marks alone, without the tile (expected difference).
6. `THIRD_PARTY_NOTICES.md` at the repo root (create it if there is none): Lobe Icons, MIT, with the copyright line from its licence, and the note "Logos are trademarks of their owners; shown to name the tool a build was made with." Add Geist (OFL 1.1) there too.

**Do not.** Recolour, crop, outline or redraw a mark; put one on a filled square; make one larger than 28px; place marks in pages (the page prompts do).

**Done when.** `markFor` tests pass; the Model marks section shows the real marks with no background in both themes; `npm run build` shows only the 12 files added to the bundle.

**Commit.** `UI-P83: model marks from Lobe Icons static SVGs, no background`

---

## UI-P84 — Controls under the refined look

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The control set from the `components` board, inside the existing primitives, so every call site gets it when the look is on.

**Reference.** `refined/<theme>/components.html` sections Buttons, Segmented and tabs, Fields, Tags and plaque; `model-marks.html` for chips.

**Build** (each under refined only; current look unchanged):
1. **`Button`** — radius 6; heights 26, 28, 30, 32, 36 (map existing sizes to the nearest: ≤30 → 28, 32–34 → 32, ≥36 → 36; 44 and 48 stay for mobile); padding `0 12px` (≤28) or `0 16px`; text 12.5 (≤28) or 13, weight 500. primary = the primary recipe; secondary = control recipe; ghost = transparent, `--text2`. **The `icon` prop renders nothing under refined when the button has a label.**
2. **`IconButton`** — 26, 28, 30; boxed (control recipe) by default, `boxed={false}` for ghost; glyph 16, `--text2`.
3. **`Segmented`** — track `--seg-track`, 1px `--seg-border`, radius 6, padding 2, gap 2; items height = size − 6, padding `0 12px`, radius 4, Geist 12/500; current item control recipe with `--control-on`, others transparent `--text2`.
4. **`UnderlineTabs`** — Geist 13/500, gap 24, height 40, current `--text` with a 2px `--text` bottom edge, others `--text2`; the 1px `--hairline` row border spans the column. Optional count in `--label` 11.5.
5. **`FilterChip`** (mobile) — control recipe, radius 6, height 36; on = selected recipe (not inverted).
6. **`CategoryChip`** — tag recipe: `--tag-fill`, radius 4, height 20, padding `0 6px`, Geist 11.5 `--on-tag`, a 6×6 radius-1 square in `--cat-<category>` before the word (dashed edge instead of fill where the chip marks a gap, as the board shows).
7. **`Eyebrow`** — Geist 10.5/500, caps by CSS, .06em, `--label`.
8. **`Avatar`** — initials on `--avatar-fill` in `--on-avatar`, Geist 500 at `size × .38`; photos unchanged.
9. New: **`Pill`** (Geist Mono 10.5, height 18, padding `0 6px`, radius 4, `--pill`/`--on-pill`, optional `tone: "evidence" | "breakage" | "lit-ink" | category`), **`MenuButton`** (control recipe, height 28, `label` in `--text2` + `value` in `--text` 500 + `chevd` glyph in `--label`, `aria-haspopup`), **`SearchField`** (well recipe, height 30, padding `0 6px 0 12px`, search glyph, input Geist 12.5, optional key hint in a 1px `--control-border` box, Geist Mono 10.5), **`Checkbox`** (16, radius 4; on = `--action` fill with a `check` glyph in `--on-action`).
10. Add each to the Controls section of `/dev/kit/components` in both looks.

**Done when.** The components board's Buttons, Segmented and tabs, Fields and Tags sections compare within 0.04 under refined in both themes; `controls.test.tsx` covers the refined branch; the switch-off audit is unchanged.

**Commit.** `UI-P84: refined controls in the existing primitives`

---

## UI-P85 — Surfaces, rows and data marks

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The layers and the small data pieces every page is built from.

**Reference.** `components.html` sections Progress, Rows, Timeline, Card; `foundations.html` Surfaces and Depth.

**Build** (under refined):
1. **`Panel`** → module recipe (`surface="glass"` and `surface="solid"` alike), padding 16 unless a call site sets one. New **`Tile`** and **`Well`** components with the tile and well recipes.
2. **`CardHead`** — title 13.5/500, optional subtitle 12 `--text2` (gap 4), optional action at the top right (an `IconButton` or a chevron link).
3. **`Row`** — hairline-separated row, `min-height` 40 | 48 | 56, gap 12, label left in `--text2` 12.5 and value right in `--text` 12.5/500 tnum; `inModule` uses `--hairline-module`.
4. **`Figure`** — the `figure` role with a unit in 12 `--text2`, gap 6, and an optional label above with an optional lamp bar.
5. **`StripedBar` / progress** — refined: a flat bar 4 or 6 high, radius 1, fill in the tone given (`--lit`, `--evidence`), then a 2px gap, then the rest in `--bar-base`. Ticks (completeness) are 1px `--label` lines 12 high with the eyebrow label centred under each.
6. **Charts** (`charts.tsx`) — sparkline stroke 1.2, no dots; mini bars 3 wide, gap 2, radius 1; line charts: line 1.4 in the tone, flat area at 7% (Dusk) / 8% (Noon), dashed `--hairline` grid, no gradient fills.
7. **Timeline** — dots 7px, ring 3px of `--surface`, 1px `--line` spine, time in `--label` tnum, kind as an eyebrow in its tone, title 12.5/500.
8. **`Plaque`** — `Pill` with tone evidence for the count, the lamp bar 8×3 (from `plaqueState()`, unchanged), then the freshness in 12 `--text2`; not yet reproduced = a neutral `Pill`.
9. **`LampDot` / `PictureLamp`** — the lamp recipe; a lit frame never takes an amber edge.
10. Update the Panels, Stats and Charts sections of `/dev/kit/components`.

**Done when.** Those sections compare within 0.04 under refined; `panels.test.tsx`, `charts.test.tsx` and `Plaque.test.tsx` cover refined; the switch-off audit is unchanged.

**Commit.** `UI-P85: refined module, tile, well, rows, figures, bars, charts, timeline and plaque`

---

## UI-P86 — Framed works, cover fallback and streak days

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The objects that carry the lamp.

**Reference.** `components.html` Framed work and Streak days; `home.html` wall and visitors' book thumbnails; `build-list.html` hero.

**Build** (under refined):
1. **Framed work** (`CoverFallback` and the build card's cover frame): a raised object — Dusk `linear-gradient(#2A2A2E, #1F1F22)`, 1px `#333338` with a `#3C3C42` top edge, `inset 0 1px 0 rgba(255,255,255,.04), 0 1px 1px rgba(0,0,0,.55), 0 6px 12px -4px rgba(0,0,0,.45)`; Noon `#FFFFFF`, 1px `#D9D9D9`, `0 1px 1px rgba(20,20,18,.06), 0 6px 12px -6px rgba(20,20,18,.18)` — radius 4, padding 4 (3 under 40px), the picture inside on `--paper`, radius 2. These are the "artwork constants" `design/RULES.md` §2 allows: put them as named constants in the component. **Lit** adds the lamp bar centred 8px above the frame (`max(12, width/4)` wide) and a 60%-high wash inside the picture (`rgba(245,203,76,.10)` Dusk, `.14` Noon, to transparent). **Never** an amber border.
2. **Picture light** over a hero picture: the 40×3 lamp bar and a cone below it, `clip-path: polygon(44.8% 0, 55.2% 0, 100% 100%, 0 100%)`, `linear-gradient(rgba(245,203,76,.10 Dusk / .18 Noon), transparent)`.
3. **Streak day** — 32 high, radius 6, flex 1 in a row with gap 6: lit = control recipe with a 14×3 lamp bar; frozen = control recipe with a 14×3 `--frozen` bar; not lit = transparent with a 1px dashed `--line` edge. Day letter under it, 11 `--label`. Each day keeps its accessible name.
4. **Result window** (build hero): the board's 304×176 window, raised as above, with a 20px chrome row (three 4px dots) and the picture on `--paper`.

**Done when.** Those sections compare within 0.04 under refined; the lamp still comes only from data (`design/RULES.md` §5); the switch-off audit is unchanged.

**Commit.** `UI-P86: refined framed works, picture light, streak days and the result window`

---

## UI-P87 — The frame

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Header, surface, breadcrumb and footer as every refined board draws them, desktop and mobile.

**Reference.** The top 48px and the footer of every page board; `components.html` header strip.

**Build** (under refined, in `SiteFrame`, `SiteHeader`, `Breadcrumb`, `SiteFooter`, `MobileHeader`, `Dock`, `BottomSheet`):
1. **Header** — on `--frame`, no background, no border, height 48, padding `0 20px`, gap 8. Lockup (18px mark, Geist 14/600 -0.02em) · a 1px × 16 `--line` divider · nav links Geist 13/500, padding `0 10px`, `--text2`; current `--text` with a 2px `--nav-mark` bar at the bottom, inset 10px, with `--nav-lamp-glow`; Drafts keeps its count (11/500 `--label`). Then a spacer, `SearchField` 240×30 with the `/` key, **New build as a secondary button (30)** — no icon —, the bell as a ghost 30×30 icon link with the unread count as a 12px badge (`--lit-mark`, Geist 9/600 `#111112`, radius 6) at top right; on `/notifications` the bell is `aria-current="page"` and takes the `--control-on` fill and `--control-border` edge, never a colour. Theme as a ghost 30 icon button (`moon` in Dusk, `sun` in Noon). Avatar 26.
2. **Surface** — the surface recipe wraps everything below the header; the footer sits inside it.
3. **Breadcrumb** — Geist 12.5, gap 8, links `--text2`, separator `/` in `--label`, current `--text` 500.
4. **Footer** — inside the surface under a 1px `--hairline`: padding `12px <gutter>`; lockup 15; links 12.5 `--text2`, gap `8px 20px`; spacer; Theme `Segmented` (26) Noon / Dusk / System; `© buildgallery` 12 `--label`.
5. **Mobile** (below 768): the header becomes `--frame`, 48 high, the lockup and icon buttons only; the surface keeps a 6px inset and radius 10; the dock is a surface-coloured bar with a `--surface-border` top edge and control-recipe tiles, no glass; sheets use the window recipe.

**Done when.** The header and footer rows of `refined/<theme>/home.html` compare within 0.03 (clip to the top 48px and the footer); `siteHeader.test.tsx`, `siteFrame.test.tsx`, `mobileChrome.test.tsx` and `breadcrumbFooter.test.tsx` cover refined; the switch-off audit is unchanged.

**Commit.** `UI-P87: the refined frame: header, surface, breadcrumb, footer, mobile chrome`

---

## UI-P88 — Page: Home

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Home drawn as `refined/<theme>/home.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/home/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
1. **Layout.** Breadcrumb, then a wrapping row, gap 48: main column `flex: 999 1 640px`, gap 40; aside `flex: 1 1 300px`, max 340, `padding-left: 32px`, 1px `--hairline` left edge, gap 24.
2. **Hero** (no card): a row with `Segmented` Whose builds (Following / Everyone) and, pushed right, the lit count line (`702 builds lit today` style, 12 `--text2`, a 10×3 lamp bar before it) — a plain line, not a badge. Below, a wrapping row (gap 32): the tagline as `hero` (44/500, -0.04em, lines indented 0 / 48 / 24, the 30px mark inline after "hung with") with **Enter the gallery** (primary, 32) and **How proof works** (secondary, 32) under it; and the **wall**: a 400×232 well with the dot grid, a 1px `--line` rail 16px from the top, the picture-light cone, and the six framed works at the board's positions (lit from data as today).
3. **The visitors' book** — `CardHead` (title, subtitle, `Segmented` Show at the right), then rows: grid `96px 24px minmax(0,1fr) 56px 32px`, gap 12, min-height 60, `--hairline` between. Kind as a `Pill` in its tone (BUILD `--lit-ink`, REBUILD `--cat-agents`, REPRO NOTE `--evidence`, BOUNTY `--breakage`); avatar 24; the who-line 12.5 `--text2` (one line, ellipsis); title 13/500 + `Plaque`; a 56×36 framed thumbnail (lit from data); time 11.5 `--label` tnum, right. The newest-since-last-visit row takes the tile fill (radius 6, `margin: 0 -12px; padding: 0 12px`) instead of a hairline.
4. **Aside.** The run counts as two `Figure`s side by side (Reproduced today with its lamp bar, This week) — **the orbs are not drawn under refined**; then This week's challenges (`CardHead` with the boxed chevron IconButton "Open this week", three rows with a 4px bar, `--lit` in progress, `--evidence` done); the streak (`CardHead`, seven streak days); Where next (rows 52 high: title 12.5/500, reason as written in the code in 10.5/500 `--label` .04em, a 56×16 sparkline in `--text2`).

**Compare.** `npm run audit:design -- --grep "refined/.*/home"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P88: Home in the refined look`

---

## UI-P89 — Page: Gallery

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Gallery drawn as `refined/<theme>/gallery-dashboard.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/gallery/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
1. **Layout.** Breadcrumb, then a wrapping row, gap 32: sidebar `flex: 1 1 208px`, max 224, `padding-right: 24px`, 1px `--hairline` right edge, gap 24; content `flex: 999 1 640px`, gap 16.
2. **Sidebar.** "Gallery" 14/500 with its subtitle 12 `--text2`; the dashboard nav (Builds / Models / Makers with counts in `--label`), rows 32 high, current = control recipe (radius 6); **Labs** eyebrow, rows 30 high with `<ModelMark lab size={18}>` — replacing the initial square the current view draws — name, count; **Reporting** eyebrow and its toggles; **Connect a tool** (secondary 28) and **Help**; the drafts box as a tile with an underlined **Open drafts** link.
3. **Content.** Title row: "Builds" page title, the active model filter as a tag, spacer, `SearchField` 240×28 without a key hint, `Segmented` Feed / Dashboard. `UnderlineTabs` Builds / Models / Makers. Filter row: the four `MenuButton`s, spacer, **Export** (secondary, no icon).
4. **Table.** Columns `minmax(0,2.6fr) minmax(0,1.7fr) 64px 64px 64px 80px 72px minmax(0,1.5fr) 28px`, gap 12; header 36 high in 11.5/500 `--label`; rows 48 high with `--hairline`; numbers right-aligned tnum 12.5; the selected row takes the tile fill and loses its hairline. Build cell: `Checkbox`, title 12.5/500 (ellipsis), "by @handle" 11.5 `--label`. AI models cell: the count 12/500 then up to two `ModelTag`s (`model` prop) and "+n". Activity: 56×16 sparkline in `--evidence` (`--bar-mid` when all zero). Last activity: date 12/500 tnum, what-line 11.5 `--label`. Actions: ghost 24 chevron IconButton with the existing accessible name.
5. **Summary bar** under a hairline: in-view and selected counts (numbers in `--text` 500), the calculation toggles (pressed = `--control-on` with control edge), "+ Add calculation" as disabled `--label` text.
6. **Feed view** (`GalleryFeedView`, no board): fork it the same way using the build card, `Segmented`, `UnderlineTabs` and filter controls from UI-P84 to UI-P86; no other change.

**Compare.** `npm run audit:design -- --grep "refined/.*/gallery-dashboard"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P89: Gallery dashboard and feed in the refined look`

---

## UI-P90 — Page: Build page — first screen and The build

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Build page — first screen and The build drawn as `refined/<theme>/build-list.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/build/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
The build page's view and its steps view (`BuildSteps.tsx`, `BeforeYouSend.tsx`, and the first-screen view that renders the hero) are forked; find the hero's view through `BuildPage`.
1. **Top.** Breadcrumb, then a wrapping row, gap 48: the hero module (`flex: 999 1 640px`, padding 0, overflow hidden) and the reproduction column (`flex: 1 1 300px`, max 340, gap 20).
2. **Hero module.** A 280-high media well with the dot grid and a module-border bottom edge; the picture light (40×3 bar 24px from the top, cone); the result window centred 64px from the top (UI-P86); the shape tag top-left (16, 16); the **action dock** top-right (16, 12): one control-recipe group, items 28 high, padding `0 12px`, 12.5/500, separated by 1px `--control-border`: Copy for AI, Download, Rebuild, Lineage (a link) — **text only, no icons**. Under the well, padding 16, gap 16: the 44×44 control-recipe tile with the 24px mark, the title as page title (20/500), the outcome 13/20 `--text2` (max 680), "made by @handle" 12 `--label`.
3. **Reproduction column.** Eyebrow, then a row: the count as large `Figure` (32) + "ran it" 13 `--text2`, last date 12 `--label` at the right; the `Plaque`; **I ran this and it worked** — the view's one primary, 36 high, full width, no icon — with its note 12/18 `--text2`; the details as a module of `Row`s (padding `4px 16px`); completeness as a module with the bar and ticks (UI-P85) and the next-step line under a `--hairline-module`.
4. **The build.** A wrapping row, gap 48: left `flex: 999 1 640px`, gap 16; right **What you need** (`flex: 1 1 300px`, max 340, `padding-left: 32px`, `--hairline` left edge). Left: `UnderlineTabs`; a toolbar row (`Segmented` List / Map, the summary 12 `--text2`, spacer, the hint 12 `--label`); session groups, each led by a group head — **`<ModelMark tool size={20}>`** in place of the dot, the "New chat in …" heading 13/500, its meta 12 `--label`, a hairline filling the rest — and its step modules: number tile 24 (control recipe, Geist Mono 11), title 14/500 (untitled steps in `--text2`), **Copy** (secondary 26, no icon) at the right; text 13.5/22 indented 36; long steps clamp to 4 lines with **Read all of it** (underlined text button) and the word count; **Paste in** as a tile indented 36 with an eyebrow and rows 32 high (what-line 12.5 `--text2` + a reference chip: 22 high, tile fill, 11.5) and the attach row with **Download** (secondary 26); same-chat notes 12 `--label`. The result: group head "Result", then a module with a 24px `--evidence-fill` square holding a `check` glyph in `--evidence`, the label, the host 14/500 link and "from step n".
5. **What you need.** Title 13.5/500 + subtitle; sections with an eyebrow over a hairline; rows 48 high with **`<ModelMark tool size={28}>`** leading each Tools and models row, name 13/500, meta 11.5 `--label`, **Download** (secondary 26) on files; the Copy for AI note 12/18 `--text2`.

**Compare.** `npm run audit:design -- --grep "refined/.*/build-list"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96, the hero picture (the app shows the build's own cover).

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P90: build page first screen and The build list in the refined look`

---

## UI-P91 — Page: Build page — the Map

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Build page — the Map drawn as `refined/<theme>/build-map.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/build/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
`ReaderMap.tsx` and `BuildMap.tsx` (reader mode) under refined. `BuildMap` is shared with the composer: branch on `useLook()` inside it for the look only; its layout maths (`src/lib/build/mapLayout.ts`) does not change.
1. Toolbar as in UI-P90 with Map selected and the reader hint ("click a box to read it · Esc clears").
2. **The map** sits in a well with the dot grid, padding 16. Lanes: radius 6, 1px `--hairline`, fill `rgba(255,255,255,.018)` Dusk / `rgba(20,20,18,.018)` Noon (artwork constants), the Files lane dashed `--line` and unfilled; lane name 12/500 with **`<ModelMark tool size={16}>`** before it, sub-line 11 `--label`. Date heads 10.5/500 `--label` .06em.
3. **Boxes** (buttons, as today): radius 6; Dusk `linear-gradient(#232327, #1E1E21)`, 1px `#303035`, `inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.45)`; Noon `#FFFFFF`, 1px `#D9D9D9`, `0 1px 2px rgba(20,20,18,.06)`; selected = `--selected-edge` 1px (+ `--selected-ring` in Noon, `0 8px 20px -6px rgba(0,0,0,.6)` in Dusk); dimmed = `filter: var(--dim-filter)` instead of opacity. Inputs 6×6 squares (radius 1) on the left edge, outputs on the right; on-path `--text`, off-path `--label`, suggested dashed. Head 28 (number in Geist Mono 10.5 `--label` + title 12/500), input rows 18, text 11 `--text2` one line, words 10.5 `--label`.
4. **Wires**: 1.2px; on-path `--text` at 70%, others `--label` at 45%, suggested dashed `4 4`.
5. **The open step** as a module (padding 20, width 380): eyebrow + close IconButton 26, title 18/500, tags (`ModelTag` for the chat's tool and the model), the text in a well (13/21, clamp 7), words + **Copy** (secondary 26), **Before you send it** and **Then** as hairline row lists with glyph leads (`larr`, `file`, `rarr`) and text links on the right.
6. Footer line: rows caption and the open-step line, 12 `--text2`. **What you need** as in UI-P90.

**Compare.** `npm run audit:design -- --grep "refined/.*/build-map"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P91: build page Map in the refined look`

---

## UI-P92 — Page: Activity

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Activity drawn as `refined/<theme>/activity.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/activity/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
1. **Layout.** Breadcrumb, then a wrapping row, gap 48: the list `flex: 999 1 560px`, gap 32; the aside `flex: 1 1 300px`, max 340, `padding-left: 32px`, `--hairline` left edge, gap 24. The header's bell is current (UI-P87).
2. **Head.** Page title "Activity", under it the unread line 12 `--text2` with the lamp bar after it; **Mark all read** (secondary 28, **no icon**) at the right.
3. **Groups.** Day as an eyebrow over a hairline; rows grid `8px 28px minmax(0,1fr) 48px 32px`, gap 12, min-height 56, `--hairline` between: an unread lamp bar 8×3 (empty space when read); avatar 28 with the kind badge (8×8, radius 2, its tone, a 2px `--surface` ring) at bottom-right; the line 13 (`--text` unread, `--text2` read) with the build title as a 500 `--text` link; the detail under it 12.5 `--text2`; a 48×32 framed thumbnail when the row names a build; time 11.5 `--label` tnum.
4. **Aside.** People this week (`Figure` 41 + its line) beside Listening (lamp bar + "live" 13/500); **Runs of your builds** with its subtitle and the chart (UI-P85): the line in `--evidence`, the flat area, three dashed `--hairline` grid lines, the rebuild marker as a dashed `--lit-ink` line with an 8px ring dot (1.5px `--lit-ink`, `--surface` fill). **Show me**: rows 32 high, an 8×8 radius-2 square in the kind's tone, the kind, the count in `--label` tnum.

**Compare.** `npm run audit:design -- --grep "refined/.*/activity"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P92: Activity in the refined look`

---

## UI-P93 — Page: Composer — List, Sources and Details

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Composer — List, Sources and Details drawn as `refined/<theme>/composer-list.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/compose/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
Fork `SandboxView.tsx` and, within it, `SourcesPanel.tsx`, `BuildList.tsx` and `DetailsPanel.tsx` (each as `Refined<X>.tsx` with the same props).
1. **Title row** under a hairline (padding-bottom 20): the draft's title (20/500), the status line 12.5 `--text2` with the missing-part link underlined; `Segmented` List / Map with the "Map is now available" line 11.5 `--label` under it; **Card**, **Preview** (secondary 30) and **Publish** (primary 30) — the view's one primary. Header New build is secondary (UI-P87).
2. **Columns**, gap 24: Sources (`flex: 1 1 216px`, max 232, `padding-right: 24px`, `--hairline` right edge, gap 20), Build (`flex: 999 1 480px`, gap 12), Details module (`flex: 1 1 280px`, max 300).
3. **Sources.** Title 13.5/500 + in-build count; three groups, each with a 6px square (hollow for Not in a build) + label 12/500 `--text2` + count; session rows (`chev` glyph, **`<ModelMark tool size={20}>`**, name 13/500, meta 11.5 `--label`) separated by `--hairline`; file rows with the `file` glyph; not-in-a-build rows with the 20px mark, name 13 `--text2`, meta, and the boxed 26 plus IconButton ("Add session"); the drop zone 56 high, 1px dashed `--line`, radius 6, 12.5 `--text2`.
4. **Build.** Head (13.5/500 + summary 12 `--text2` + **Add** `MenuButton`), the hint 12 `--label`; session group heads with the 20px mark (as UI-P90); prompt modules (padding 16, radius 8; selected = selected recipe): number tile 24, title 14/500 (`--text2` when untitled), ghost 26 `more` IconButton ("Prompt n options"), text 13.5/22 clamped to 2 lines and indented 36, then a row indented 36: "Uses" 11.5 `--label`, reference chips (22 high, tile fill and edge, 11.5), the suggestion chip (28 high, 1px dashed `--line`, radius 6, with **Accept** as a 20-high control and **Dismiss** as text), spacer, **Show full prompt** (underlined, 12/500), words 11.5 `--label`. The agent module: number tile, "Agent · " + a 14px mark + model name 11.5 `--label`, its title 14/500, the run rule as a tag; inside, indented 36 with a `--hairline-module` left edge: the instruction tile (Geist Mono 10.5 number, "Instructions" 13/500 `--text2`, text 13/21) and **Add a prompt to this agent** (32 high, dashed `--line`, radius 6, text only); "Goes into" + an evidence `Pill`. The result module (as UI-P90). The add field: a module with padding 12, a 2-row textarea in the well recipe, then two `MenuButton`s (tool, model) and the boxed 28 `up` IconButton ("Add the prompt").
5. **Details.** Module: "Details" 13.5/500; eyebrow "Prompt n"; the title 18/500 with the ghost `pencil` IconButton ("Rename"); a row with **`<ModelMark tool size={24}>`** and the two meta lines 12/18 `--text2`; the text in a well (13/21); **Read all of it** (secondary 26) + word count; **Uses** and **Goes into** as hairline lists (lead glyph `larr` / `rarr` in `--label`, title 12.5/500, meta 11.5 `--label`, ghost 24 `x` IconButton "Remove …"); **Add an input** as a 12.5/500 `--text2` text button with no icon.

**Compare.** `npm run audit:design -- --grep "refined/.*/composer-list"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P93: composer List, Sources and Details in the refined look`

---

## UI-P94 — Page: Composer — Map, full prompt window and Card

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Composer — Map, full prompt window and Card drawn as `refined/<theme>/composer-map.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.

**Pattern.** For each view this prompt names (in `src/pages/site/compose/`), a fork `Refined<Name>.tsx` beside it, typed with the existing view's props (import the type, do not copy it). The page container and the dev page render the fork when `useLook()` is refined. Same data, handlers, copy, order of parts and accessible names as the current view; only the look changes. Model marks (`ModelMark`, `ModelTag`) go wherever the board shows a tile with an initial, without the tile.

**Build.**
Continues UI-P93's fork. Boards: `composer-map`, `prompt-window`, `composer-card`.
1. **Sources rail** (Map view): a module 52 wide, padding `8px 0`, vertical toolbar as today (Show sources, Sessions with count, Files with count, Add a source), ghost 36–44-high buttons with glyphs (`panel`, `layers`, `file`, `plus`) and counts 10.5/500 tnum, `--hairline-module` dividers 28 wide.
2. **Build module** (Map view): head as UI-P93; the legend row (24px solid and dashed `--text2` samples with "goes into n" and "suggested n" 12 `--text2`, then the key hint 12 `--label`); the map well; the footer line. `BuildMap` in maker mode with UI-P91's lane, box, wire and dim recipes plus the maker parts: input rows 20, state line 18 (10.5 `--label`), body 36 (11 `--text2`, 2 lines), foot 20; output squares draggable as today; the **result box loses its evidence border** — its head shows "Result" in `--evidence` 10.5/500 before the title — update the "result with the evidence border" assertion in `BuildMap.test.tsx` to check the label instead, and say so. The agent box: head "Agent n" 10.5/500 `--label`, title 13.5/500, contents and run rule as today.
3. **Full prompt window** (`FullPromptWindow.tsx`, used by composer and build page): the window recipe, 760 wide, radius 12, padding `20px 24px`, gap 16, over `--scrim`. Eyebrow heading "Prompt n of m · full prompt" with the boxed 28 close; the title field (well, 44 high, input 16/500, a `pencil` glyph in `--label`) and its hint 12 `--label`; the model as a `ModelTag`; the text area (well, 320 high, padding 16, 14.5/25; focused edge `--selected-edge`); words + **Copy prompt** (secondary 28, no icon); Uses chips; a footer under `--hairline-module`: ghost **← previous** and **next →** buttons, the hint centred 12 `--label`, **Done** (primary 30).
4. **Card sheet** (`SandboxCard.tsx`): a side sheet 472 wide, inset 6 from the top, right and bottom, radius 12, window recipe with `--sheet-shadow`, over `--scrim`. Header 56 high under `--hairline-module`: "Card" 15/500 + boxed 30 close. Body padding 24, gap 24: Cover (title 13.5/500, subtitle 12 `--text2`, the drop zone 216 high, tile fill with the dot grid, 1px dashed `--line`, radius 8, an `image` glyph 20 `--text2`, the drop line 13/500 and the underlined browse link 12 `--text2`); the fields with labels 12.5/500, inputs in the well recipe 36 high (summary textarea 80 high, counter 11.5 `--label` tnum, hint 12 `--label`); **Made with**: `ModelTag`s with the tool and model; **More details (optional)** as a disclosure with a `chev` glyph, "(optional)" in `--text2` 400.

**Compare.** `npm run audit:design -- --grep "refined/.*/composer-map"` within 0.06 in both themes. Expected differences: sample text, model marks (real logo without tile vs the board's initial in a tile), em dashes until UI-P96; prompt-window and composer-card compare with `--grep "refined/.*/(prompt-window|composer-card)"` too.

**Done when.** Both themes compare as above; at 390 the page uses the refined tokens, rows and controls with no horizontal scroll; the switch-off audit is unchanged; the page's existing tests pass and a `Refined*.test.tsx` per fork renders it with the dev fixture.

**Commit.** `UI-P94: composer Map, full prompt window and Card sheet in the refined look`

---

## UI-P95 — Pages without a refined board

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Every other page reads as the same system under the refined look, without new layouts.

**Pages.** Bounties, solve and solvers; Profile; Rebuild and lineage; Library; Drafts; Import and Connect; Sign in, Join, reset and verify; any `/dev`-reachable page the frame renders.

**Build.** Do **not** fork these views. The tokens, type, radius and primitives already re-skin them; fix only what still breaks the series rules under refined, branching inline on `useLook()` where a value must differ:
1. Orbs, arcs, the sign-in edge glow, tagline chips and any glass that a page draws itself → module or tile recipe.
2. Serif headings → the page title or hero role.
3. Any second filled button in a view → secondary.
4. Icons inside labelled buttons → removed under refined.
5. Lists → hairline rows (UI-P85 `Row`); cards → module.
6. Every place a model, lab or tool is named in text (rebuild credits, profile "made with", import session lists, connector tool lists) → `ModelMark` before the name at the size UI-P83 gives for that context (14 in tags, 16 in map lanes, 18 in lists, 20 in rows and group heads, 24 in headers, 28 in tool lists).
7. Spacing on the series scale.

**Done when.** Each page renders at 1440 and 390 under refined in both themes with no layout break (screenshot each into the report); `e2e/tier1` passes with `look=refined` forced through the dev override where the test can set it; the switch-off audit is unchanged.

**Commit.** `UI-P95: the remaining pages under the refined look`

---

## UI-P96 — The trope sweep and the copy fixes

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Nothing on the trope list survives, and a test keeps it that way.

**The trope list.** None of these may appear under the refined look:
1. Purple-to-blue gradient. 2. Gradient text. 3. Emoji in headings. 4. Inter, or any font but Geist and Geist Mono. 5. Coloured-border cards (the only edges are hairlines, the neutral selected edge and dashed suggestions). 6. Glass, blur or translucency over content. 7. Low-contrast text (4.5:1 minimum). 8. Three icon boxes in a row. 9. A badge above the headline. 10. Lucide everywhere (glyphs, UI-P82). 11. Untouched shadcn defaults. 12. Fade-in on scroll. 13. Cursor-following light. 14. Buttons that fade on hover. 15. Spacing off the scale. 16. Em dashes in shown copy. 17. Buzzword copy. 18. Serif or italic accents. 19. Space Grotesk or Instrument Serif. 20. Grain over a gradient.

**Build.**
1. **Em dashes in shown copy.** These copy changes ship in **both** looks (they are copy, not look):
   - page titles `"X — buildgallery"` → `"X · buildgallery"` (every `SeoHead` and `document.title`);
   - joins inside a line → ` · ` — the visitors' book subtitle becomes "Builds, rebuilds, reproduction notes and asks · newest first" (`HomeView.tsx`), the repro-note line joins its quote with ` · ` (`homeModel.ts`), `composeModel.ts` "not saved · ";
   - sentences → a full stop, words unchanged otherwise: "Please verify your email before signing in. Check your inbox.", "That email is already registered. Try signing in instead.", `Taken. Try "${suggestion}"`;
   - a lone "—" meaning "no value" in a table cell → "–" (en dash) in `--label`;
   - find the rest with `rg "—" src --glob "*.tsx" --glob "*.ts"` outside comments and tests, and list every change in the report. Update tests that assert the old strings.
2. **`src/lib/theme/refinedTropes.test.ts`** reads every `Refined*.tsx` and the files UI-P84 to UI-P87 and UI-P95 changed, and fails on: `backdrop-filter`, `background-clip: text` / `WebkitBackgroundClip`, `fontStyle: "italic"`, a font name other than the `--font-*` tokens, `linear-gradient` outside the allowed list (framed work, map box, picture light, chart area), a hex or rgba outside the named artwork constants, `opacity` inside a hover handler, an em dash in a JSX text node or string literal, an emoji, a `gap`/`padding`/`margin` px value not on the series spacing scale.
3. **One primary per view**: a test renders each refined view with its dev fixture and counts elements styled with `--action` as background: at most one.
4. **No icon in a labelled button**: the same render asserts no `svg` inside a `button` or `a` that has text content, except `MenuButton`'s chevron and the disclosure chevron.
5. Run `e2e/audit/contrast-sweep.spec.ts` and `theme-completeness.spec.ts` with `look=refined` on every refined dev page and fix what they find.

**Done when.** The new tests pass; the contrast sweep is clean under refined; the report lists every copy change.

**Commit.** `UI-P96: em dashes out of shown copy; the refined trope tests`

---

## UI-P97 — Every state, accessibility and the in-between widths

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** The refined views are complete, not just populated.

**Build** (under refined):
1. **States** for every refined view: loading = skeletons in `--well` at the content's size, no shimmer gradient; empty = one 13 `--text` line and one action (secondary unless the view has no other primary); error = one sentence and **Try again** (secondary). Reuse `Skeleton`, `EmptyState`, `ErrorState` with refined branches.
2. **Focus.** Every focusable element shows a 2px `--focus-ring` outline at 2px offset under refined, including map boxes, rows that are links, segmented items and chips.
3. **Keyboard.** The maps, the full prompt window (← → between prompts, Esc), the card sheet (focus trapped, Esc) and the dock behave as today; check each by keyboard and note it.
4. **768–1279.** The refined surfaces wrap as their flex bases say; asides drop under the main column below 1024 and lose their left hairline (they take a top hairline instead); the gallery table scrolls inside its box; nothing scrolls the page sideways. Follow UI-P39's breakpoints.
5. **390.** Inputs 16px; touch targets 44 (rows and icon buttons grow their hit area, not their drawing); the hero tagline uses the mobile hero size (32).
6. **Reduced motion**: nothing in the refined look animates except the theme change, already guarded.

**Done when.** `e2e/tier1` and the RC critique specs pass with `look=refined`; states render on every refined dev page via the existing `state=` dev queries; the report lists the keyboard checks.

**Commit.** `UI-P97: refined states, focus, keyboard and in-between widths`

---

## UI-P98 — Turn on the refined look

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** Visitors see the refined look.

**Build.**
1. `REFINED_LOOK_ENABLED = true` in `src/lib/theme/look.ts`; update its header comment ("on since UI-P98; rollback is `false`").
2. Preload `/fonts/Geist-Variable.woff2` in `index.html` (`as="font" type="font/woff2" crossorigin`).
3. Run everything in `design/RULES.md` §4. In `npm run audit:design`, the current-look boards now open their dev pages with `look=current` (the dev override), so they still pass until UI-P99; the refined boards open with the switch's own value. Run `e2e/audit/performance.spec.ts`: Geist plus the 12 marks must not move LCP beyond the baseline by more than 5%.
4. Update `design/HANDOFF.md` and `design/README.md`: the refined boards are the source of truth from now on.

**Do not.** Delete anything; the current look stays one line away until UI-P99.

**Done when.** Production build shows the refined look in both themes; all checks pass; the report says how to roll back.

**Commit.** `UI-P98: turn on the refined look`

---

## UI-P99 — Retire the current look

Follow `design/RULES.md`.

**Series rules (UI-P77 to UI-P99).** These hold for every prompt in the series, after `design/RULES.md`.
- **A re-skin.** Routes, data, handlers, copy, accessible names and the order of every page's parts stay as they are. Only the look changes. The one copy change is UI-P96's em-dash sweep.
- **Source of truth.** `design/reference/refined/{dusk,noon}/<board>.html`, 1440 wide, values exact, no browser strip, no mobile boards: `foundations`, `components`, `model-marks`, `home`, `gallery-dashboard`, `build-list`, `build-map`, `activity`, `composer-list`, `composer-map`, `prompt-window`, `composer-card`. Sample text is presentation only. Two things on the boards are placeholders: model marks drawn as a tile with an initial (the site shows the real logo with no tile, UI-P83), and em dashes already shown as "·" (they ship in UI-P96).
- **The switch.** Everything is behind `REFINED_LOOK_ENABLED` in `src/lib/theme/look.ts` (UI-P78), off until UI-P98. `useLook()` returns `"refined" | "current"`; on `/dev/*`, `?look=refined` or `?look=current` decides. Refined token values live in `:root[data-theme="…"][data-look="refined"]`.
- **Forks.** A page is forked, not edited: `Refined<Name>.tsx` beside the view, typed with the view's own props (imported, not copied); the page container and the dev page choose with `useLook()`. Current views go only in UI-P99. Primitives keep their props and branch inside. Under the refined look only, this series amends `design/RULES.md` §3: primitives and the frame may change padding, gap, height and radius to the values given here.
- **Recipes.** *frame*: `--frame`, the header on it with no background or border. *surface*: one panel per page, `calc(100% - 12px)` wide, max 1428, margin `0 auto 6px`, `--surface`, 1px `--surface-border`, radius 10, `--surface-shadow`, padding `24px clamp(16px, 4.6vw, 64px) 48px`, the footer inside it. *module*: `--module`, 1px `--module-border`, radius 8, `--module-shadow`, padding 16. *tile*: `--tile`, 1px `--tile-border`, radius 6, padding 12. *well*: `--well`, 1px `--well-border`, `--well-shadow`, radius 6; maps and media add the dot grid `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px. *control*: `--control`, 1px `--control-border`, `--control-shadow`, radius 6; hover `--control-on`, never opacity; pressed sinks to the well. *primary*: `--action`, `--action-shadow`, `--on-action` 500; one per view, and the header's New build is secondary. *rows*: hairline-separated, min-height 40, 48 or 56. *selected*: `--selected-fill`, 1px `--selected-edge`, plus `--selected-ring` in Noon or `0 8px 20px -10px rgba(0,0,0,.6)` in Dusk; never a colour. *window*: `--window`, 1px `--window-border`, radius 12, `--window-shadow` (dialogs) or `--sheet-shadow` (side sheets), over `--scrim`, no blur. *lamp*: a bar 3px high, radius 1, `--lit`, `--lamp-glow`; never an edge colour. *dimmed*: `filter: var(--dim-filter)`, never opacity.
- **Type and space.** Geist; Geist Mono only for ids, keys and mono pills; tabular numbers. Space 2 4 6 8 12 16 20 24 32 40 48 64 (2 for segmented tracks, 6 for tight inline pairs). Radius 4 tag, 6 control and media, 8 card, 10 surface, 12 window.
- **Never under refined.** Gradients other than the picture light, the shading inside raised objects in Dusk and flat chart areas; glass, blur or grain; any glow but the lamp's; serif or italic; coloured card edges; icons inside labelled buttons; fade-in on scroll; hover fades; em dashes in shown copy; emoji.

**Goal.** One look in the code. Run this only after the refined look has been live long enough that nobody wants it back.

**This is the only prompt in the series that deletes.**

**Build.**
1. Delete every `<X>View.tsx` that has a `Refined<X>View.tsx`, rename the refined file to `<X>View.tsx`, and remove the `useLook()` choice from each `<X>Page`.
2. Remove the current-look branches from the primitives, `useLook()`, `look.ts`, the `data-look` attribute, and the dev override. The refined token values become the only values in the `noon` and `dusk` blocks; delete the tokens nothing reads any more (orbs, arcs, glass, backdrop, tagline chip, porthole, chrome) and their tests.
3. Delete `GlassFilter`, `PageBackdrop`, `Arc`, the orbs, `OrbRing`, `backdropCanvas.ts`, `useReveal` if nothing uses it, the liquid-glass CSS class, and the Sentient, Figtree and DM Mono font files and `@font-face` rules. If Figtree or DM Mono come from an npm package, **propose** removing the package and stop for that part.
4. The current-look reference boards move to `design/reference/archive/`; `index.json` lists only refined boards; the harness drops the `look` handling.
5. Update `design/RULES.md` with a section on the refined system (the series rules at the top of each prompt in this series, and the values from UI-P79 to UI-P83), `design/HANDOFF.md`, and note in the report which skills (`buildgallery-theme`, `buildgallery-ui-overhaul`) now describe the old look and need rewriting.

**Done when.** `rg "Sentient|Figtree|DM Mono|glass|Orb|useLook" src` finds nothing but comments explaining the history; everything in `design/RULES.md` §4 passes; bundle size is smaller than before UI-P98.

**Commit.** `UI-P99: retire the current look`

---
