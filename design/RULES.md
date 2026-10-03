# UI overhaul — standing rules for every `UI-Pnn` prompt

Every prompt in `design/prompts/` starts with "Follow `design/RULES.md`". This file and the `buildgallery-ui-overhaul` skill hold the same text, so the rules apply whether or not the file is read from disk. They are not repeated in each prompt. Where a prompt and this file disagree, the prompt wins for that one change.

## 1. What is the source of truth

In this order:

1. **`design/reference/**/*.html`** — standalone HTML for every board, rendered from the approved mockups. Open any file directly in a browser; it needs nothing else. Elements that correspond to a component carry `data-ui="<component>"` and, where there are states, `data-variant="<state>"`. **Values in these files are exact.** Sizes, radii, padding, gaps, font sizes, weights, letter-spacing, shadows, gradients: port them as they are.
2. **`design/reference/components/{noon,dusk}.html`** — the component catalogue: every primitive in every state, both themes.
3. **`design/screens/**/*.jpg`** — a render of each board, for looking at. When the HTML and the picture disagree, the HTML wins.
4. **`design/tokens/`** — `tokens.css` (drop-in custom properties for Noon and Dusk), `token-map.md` (raw value → token), `tokens.json` (the machine-readable source).
5. **`design/HANDOFF.md`** — how every page maps to the code, what exists, what is new, and the known gaps.
6. The `buildgallery-repo-map` skill — the verified map of this repository: where each module lives, which functions already exist, and the database facts migrations do not show. It decides **names**; the kit decides **looks** (see §8).
7. The `buildgallery-theme` skill and the comments in `src/lib/theme/*`. Where they disagree with 1–5 (Exhibition → Noon, Bodoni Moda → Sentient, the focus ring on Noon, new tokens), the kit wins and UI-P02 to UI-P05 update the skill text and the comments to match.

**Presentation only — never build these:** the browser strip across the top of every desktop board (a tab and an address bar; `data-ui="browser-frame-PRESENTATION-ONLY-do-not-build"`), and every piece of sample text, name, handle, number, date and quote. The sample content is in `design/fixtures/sample-data.json` and is used only by the dev compare pages.

## 2. "Verbatim" means

- The same box sizes, spacing, radii, type sizes and weights as the reference, at 1440px (desktop) and 390px (mobile).
- Every colour through a token from `design/tokens/tokens.css`. Find the raw value in `token-map.md`; never paste a hex or an rgba into a component. The one exception is listed at the end of `token-map.md`: values that are identical in both themes and sit on artwork (cover skies, avatar hues, the missing window, the orbs' neutral shadows) live as named constants in the component that owns them, exactly where a prompt spells them out.
- The same component structure and order as the reference (for example the build card's fixed order: cover with shape tag → title → credit + Δ → plaque → part chips → open ask).
- Checked with the compare harness from UI-P01 (`npm run audit:design -- --grep "<board>"`), which screenshots the reference and the app at the same size and diffs them. A prompt is not done until its boards compare within the threshold it states, or the prompt explains each remaining difference.

## 3. How code is written here (from the code review — these are automatic failures)

- **Inline styles** through `t` from `@/lib/theme/tokens` and the roles in `@/lib/theme/type`. No new CSS classes for styling; Tailwind's generated utilities override them. Keyframes are the only CSS that goes in `src/index.css`. The one exception is `.bg-glass` (UI-P09b), which needs two pseudo-elements that inline styles cannot express; its colours are still tokens.
- **Never change structural CSS** (`position`, `width`, `height`, `overflow`, `zIndex`, `display`, `flex`, `grid`, `gap`, `padding`, `margin`) **on an existing layout element.** The overhaul builds new components beside the old ones (`SiteFrame` beside `FlatShell`, a new card body beside the old one) and switches over behind the `site_frame` flag. Old components are deleted only in UI-P41.
- **Never install a dependency.** Propose it and stop. Icons come from `lucide-react` (already installed) using the icon table in §6. Charts are hand-written SVG; do not import `recharts` for anything new.
- **All data access lives in `src/lib/<domain>/`** as named, typed functions. No Supabase call in a component. Name columns (no `select('*')`), put `.limit()` on every list, prefer estimated counts, and use `(select auth.uid())` in any policy. A page that needs data no function returns gets that function in its own prompt first (UI-P21 to UI-P26).
- **Identity** comes from `useAuth()`.
- **Heavy routes are `React.lazy`**: compose, import, anything with a chart, every `/dev/*` page.
- **`data-testid`** may be added to existing components; their structure may not change.
- **The content path stays live** (`Upload.tsx`, `content_items`). Nothing here touches it.

### 3.4 The animated backdrop (UI-P13b)

The page backdrop (`PageBackdrop.tsx`) is two layers. Underneath is the static UI-P13 room (`--ambient` over `--backdrop`, the arc, Dusk's grain), `position: absolute` as the frame's first child; it is always painted, so it is the fallback. Over it is one WebGL canvas (`backdropCanvas.ts`) that continuously renders a drifting noise field with domain warping, creating silk folds that drift on their own. The canvas belongs to the document, not to a frame: it is created and compiled once and `PageBackdrop` only hosts it, so crossing into a route that brings its own `SiteFrame` moves the same canvas, and a theme switch changes uniforms, not shaders. It is `position: fixed; inset: 0` inside the room. The canvas renders at `min(devicePixelRatio, 1.5) × 0.85` of viewport size (× 0.72 above 2.2 megapixels, for performance), in whole pixels, resized only on `resize`. Its colours come from the room's tokens (`--bg`, `--arc-*`), read once per theme switch. Time is in seconds. It pauses when the tab is hidden via `visibilitychange`. Under `prefers-reduced-motion: reduce` it draws exactly one static frame and ignores pointer and keyboard input; the media query is watched, so changing the setting takes effect at once. Up to 8 interactive ripples can be triggered by pointer events or keyboard activation (Enter/Space on a focused control, not while typing in a field), heard in the capture phase; each is a round wavefront that pushes the folds outward, with a warm inner and cool outer edge. If `getContext("webgl")` returns null, the shader does not compile or the context is lost, there is no canvas and the static room is the backdrop; nothing throws. Do not add a second canvas or sample the backdrop in JavaScript for any purpose.

## 4. Every prompt, every time

- **Both themes** (Noon and Dusk) and **both viewports** (1440 desktop, 390 mobile; the app swaps chrome below 768px). If a board exists for it in `design/reference/`, compare against it.
- **Build views separately from data.** Each page is a pure `XView` that takes props, plus a thin `XPage` that loads data and renders the view. The dev compare page renders `XView` with `design/fixtures/sample-data.json`; the real route renders it with live data. This is what makes verbatim checking possible.
- **States:** populated, loading (a skeleton the same size as the content, in `--recess`), empty (one Sentient line and one action) and error (one sentence and a retry). The references show populated only; UI-P37 finishes the rest, but each page prompt must at least not crash on empty data.
- **Accessibility:** real `<a>` and `<button>`, an accessible name on every icon-only control, `aria-current="page"` on the current nav item and breadcrumb, no text under 10px (the reference's few 9px mono tags become 10px — one of the intentional deviations listed in `design/README.md`), inputs ≥16px on mobile, touch targets ≥44px, `prefers-reduced-motion` honoured.
- **Checks before commit:** `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`, `npx playwright test e2e/tier1 --project=desktop --project=mobile`, and `npm run audit:design -- --grep "<boards touched>"`. The theme guard tests (`src/lib/theme/*.test.ts`, including `css-parity`, `contrast`, `compliance`, `glass`, `radius`, `ns-classes`) must pass; when a prompt legitimately changes what they assert, update the assertion in the same commit and say why.
- **One commit**, message `UI-Pnn: <what changed>`.
- **Report back** in this shape:
  ```
  PASS / FAIL
  Automatic-fail violations: <list, or none>
  Compared boards: <board — diff %, or "not comparable yet: why">
  Verified by: <commands run>
  Not covered: <what this change does not do>
  ```

## 5. The lamp, in one rule

A build's picture lamp (and the lamp dot in its plaque) comes from data, nowhere else: **lit** when it has at least one reproduction and `isStale()` is false; **dimmed to 45%** when `isStale()` is true (last confirmation older than `STALE_AFTER_DAYS = 120`); **absent** when `reproduction_count = 0`. `plaqueState()` in `components/brand/Plaque.tsx` already returns `healthy | stale | unreproduced` — use it. Amber (`--lit`) is light, never text.

## 6. Icons (mockup name → `lucide-react`)

| Mockup | lucide | Mockup | lucide |
|---|---|---|---|
| home | `Home` | bell | `Bell` |
| gallery | `Image` | library | `Library` |
| bounty | `Target` | user | `User` |
| plus / New build | `Plus` | lineage (tree) | `Network` |
| search | `Search` | import | `ArrowDownToLine` |
| copy | `Copy` | x / close | `X` |
| download | `Download` | theme | `Sun` (Noon) / `Moon` (Dusk) |
| rebuild | `RefreshCw` | grip | `GripVertical` |
| check | `Check` | streak | `Flame` |
| arrow | `ArrowRight` | badge | `Trophy` |
| back | `ArrowLeft` | secret found | `ShieldAlert` |
| play | `Play` | message | `MessageSquare` |
| expand | `Maximize2` | me too | `Heart` |
| filters (mobile) | `SlidersHorizontal` | link | `Link` |

Stroke width 1.6 by default, 1.8 inside buttons and dock tiles, sizes as drawn in the reference (15–16px in controls, 17–20px in the header and dock).

## 7. The page pattern (UI-P27 to UI-P36)

Every page prompt builds the same five pieces. The prompts do not repeat this.

1. **`src/pages/site/<page>/<Page>View.tsx`** — pure. Typed props, no fetching, no `useAuth()`, no router hooks except `Link`. Takes `fit: "board" | "content"` (UI-P16). The viewport is not a prop: the view reads the 768px breakpoint itself (`useMediaQuery`, or the existing hook if there is one) so the live page and the compare page behave the same.
2. **`src/pages/site/<page>/<Page>Page.tsx`** — the container. Loads data with TanStack Query through `src/lib/<domain>/` functions only (query keys `['<domain>', '<fn>', …args]`), maps it to the view's props, handles loading / empty / error at least without crashing, calls `useCrumbTitle()` when the record has a title, and renders the view. Exported for `React.lazy`.
3. **`src/dev/fixtures/<page>.ts`** — maps `design/fixtures/sample-data.json` to the view's props (the mapping is where sample indices such as `"build": 1` become objects). Registered in `/dev/kit/pages/<page>`, which renders the view inside `SiteFrameView` with `fit="board"`.
4. **Route** — the route element becomes `<FrameRoute site={<Lazy<Page>Page />} legacy={<existing element />} />` (UI-P20) and the pattern goes into `SITE_FRAME_ROUTES`. The legacy page file is not edited.
5. **Compare** — `npm run audit:design -- --grep "<kind>/<theme>/<page>"` for the four boards (desktop and mobile, Noon and Dusk). Expected differences, which the report may list without fixing: sample text (the app shows fixture text, which is the same sample), 9px → 10px labels, `--lit-ink` where the reference draws amber text in `--lit`, the footer's Sign out, and any difference a prompt names.

Layout numbers in the page prompts are exact at 1440 (desktop, 1280 column) and 390 (mobile, 362 column after 14px gutters). Columns written as `minmax(0, 1fr) 420px` are CSS grid tracks with a 12px gap unless a prompt says otherwise. "Fills" means `flex-grow: 1; min-height: 0` in `board` fit and `min-height: <board height>` in `content` fit.

Copy in the prompts is the copy to ship. Where a reference board shows a designer's note in a subtitle (for example "rank by weight and fill, not colour"), the prompt gives the real subtitle instead.

## 7b. Where glass is allowed

Liquid glass (`.bg-glass`, UI-P09b) is for **page-level panels only** — a panel that is a direct child of the content column and sits on the backdrop. Anything that repeats inside one — build cards, vacant frames, feed and notification rows, wall-label cells, wells, chips, the part viewer — stays slightly translucent and flat: a fill, a 1px border, no `backdrop-filter`, no `filter`. Glass is never nested inside glass (a dev-only console warning in `Panel` says so), and compose and import stay flat. `Panel` takes `surface="glass" | "plain" | "flat"`; `plain` is the default, so a panel is liquid glass only when somebody chose it. The one `feDisplacementMap` in the app is the `#bg-glass-distortion` filter in `GlassFilter`, dropped below 768px, under `prefers-reduced-transparency` and without `backdrop-filter`. Its blur is 16px like every other blur in the app (`glass.test.ts` holds the codebase to one value); `src/index.css` is the one stylesheet allowed to declare it.

## 8. Names, and the live database

Every prompt names functions, components, columns and routes. Those names come from the handoff and the repo map, and a few of them may be wrong or renamed by the time you read them. **The file on disk wins, always.** Before using a name from a prompt:

- `grep` for it. If it exists, use it exactly as it is and do not rename it.
- If it does not exist and a differently named function does the same job, use that one and say so in the report's "Not covered" line.
- If nothing does that job, it is **new work**: add it in `src/lib/<domain>/` as the data prompts (UI-P21 to UI-P26) do — typed, named, limited — in its own commit, then continue. If adding it needs a schema or policy change, **stop and propose it** instead.

Two database facts govern every data prompt:

- **The live database has drifted from `supabase/migrations/`.** Never derive a column or policy from migration files alone; confirm it against the live schema. Write any migration so that it is correct in both worlds (`IF EXISTS`, catalogue lookups). New migration filenames continue the project's sequence (`YYYYMMDDHHMMSS_snake_case.sql`, stepping after the newest existing one).
- **`src/integrations/supabase/types.ts` is generated and partly stale.** Do not hand-edit it; cast at the call site the way `src/lib/feed/getBuildFeed.ts` does.

`award_xp()` is unsafe by design (a signed-in user can award themselves any amount). No prompt here may add a client path that calls it, directly or through `awardXp`.
