# UI-P80 — Geist and Geist Mono

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
