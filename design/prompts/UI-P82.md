# UI-P82 — The glyph set

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
