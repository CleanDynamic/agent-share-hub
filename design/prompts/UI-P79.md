# UI-P79 — Refined colour tokens

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
