# UI-P85 — Surfaces, rows and data marks

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
