# UI-P99 — Retire the current look

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
