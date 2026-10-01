# UI-P13 — The page backdrop: horizon, arc and grain

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
