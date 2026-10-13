# UI-P84 — Controls under the refined look

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
