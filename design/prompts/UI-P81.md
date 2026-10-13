# UI-P81 — Radius, space, elevation — and no glass, no backdrop, no reveal

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
