#!/usr/bin/env python3
"""The refined look: prompt series UI-P77 to UI-P99, and its reference boards.

Twenty-three Claude Code prompts that re-skin buildgallery.ai in the look drawn
on the "buildgallery UI vision board" canvas (pages Dusk and Noon): one seamless
surface layered by tone, depth inside components, Geist, an even spacing rhythm,
and the labs' real logos (Lobe Icons) beside every model and tool, with no tile
behind them. Routes, data, handlers and copy stay as they are. Run the prompts
one per Claude Code session, in order. Each starts by pointing at
design/RULES.md, carries the series rules itself, ends with the RULES.md
section 4 report, and is done only on PASS.

This file also draws the twelve reference boards, in both themes, as standalone
HTML: the exact values every page prompt compares against. Nothing to unzip.

Usage (Python 3.9 or later, standard library only; run from the repo root):

    python3 design/refined_prompts.py list               the order, and what each prompt needs first
    python3 design/refined_prompts.py show UI-P83        print one prompt, ready to paste (83 or p83 also work)
    python3 design/refined_prompts.py next               print the first prompt with no commit in git log yet
    python3 design/refined_prompts.py write              write the prompts, the boards and the fonts into the repo
    python3 design/refined_prompts.py write --dry-run    say what write would change, change nothing
    python3 design/refined_prompts.py boards [FOLDER]    draw only the boards (default design/reference/refined)
    python3 design/refined_prompts.py fonts              fetch Geist and Geist Mono into design/reference/fonts

`write` adds UI-P77.md to UI-P99.md to design/prompts/, a section for them in
00-INDEX.md and the prompts at the end of ALL-PROMPTS.md; draws the 24 boards
into design/reference/refined/{dusk,noon}/ with an index.json for the compare
harness; and, if they are not there yet, fetches the two Geist font files
(SIL Open Font License 1.1) from the npm registry with `npm pack geist@1.7.2`
into design/reference/fonts/. Nothing is installed. It never overwrites a file
that differs from the one here unless you pass --force, and it does not commit.

Nothing changes for visitors until UI-P98, which turns on REFINED_LOOK_ENABLED
in src/lib/theme/look.ts. UI-P83 adds one package, @lobehub/icons-static-svg
(MIT); say yes before you run it. UI-P99 is the only prompt that deletes; run
it only once the refined look has been live long enough.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Prompt:
    id: str
    title: str
    wave: int
    needs: str
    lead: str
    body: str

    @property
    def number(self) -> int:
        return int(self.id[len("UI-P"):])

    @property
    def filename(self) -> str:
        return f"{self.id}.md"


WAVES = {
    1: 'foundation',
    2: 'primitives',
    3: 'the frame',
    4: 'pages',
    5: 'finish',
}


PROMPTS: tuple[Prompt, ...] = (
    Prompt(
        id='UI-P77',
        title='Put the refined boards in the repo',
        wave=1,
        needs='`python3 design/refined_prompts.py write` run once in the repo',
        lead='The refined boards and fonts are in the repo, the series is indexed, and the compare harness can check a page against a refined board.',
        body=r'''# UI-P77 — Put the refined boards in the repo

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
''',
    ),
    Prompt(
        id='UI-P78',
        title='The look switch',
        wave=1,
        needs='UI-P77 ended on PASS',
        lead='One switch, off, that can turn the whole site to the refined look, and a dev override so every refined board can be checked while it is off.',
        body=r'''# UI-P78 — The look switch

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
''',
    ),
    Prompt(
        id='UI-P79',
        title='Refined colour tokens',
        wave=1,
        needs='UI-P78 ended on PASS',
        lead='Every colour, shadow and edge the refined look needs, in both themes, behind the switch.',
        body=r'''# UI-P79 — Refined colour tokens

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
''',
    ),
    Prompt(
        id='UI-P80',
        title='Geist and Geist Mono',
        wave=1,
        needs='UI-P79 ended on PASS',
        lead='The refined type: two self-hosted faces and the roles in the table below.',
        body=r'''# UI-P80 — Geist and Geist Mono

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
''',
    ),
    Prompt(
        id='UI-P81',
        title='Radius, space, elevation — and no glass, no backdrop, no reveal',
        wave=1,
        needs='UI-P80 ended on PASS',
        lead='The refined shape and depth, and the removal of everything the refined look does not have.',
        body=r'''# UI-P81 — Radius, space, elevation — and no glass, no backdrop, no reveal

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
''',
    ),
    Prompt(
        id='UI-P82',
        title='The glyph set',
        wave=1,
        needs='UI-P81 ended on PASS',
        lead='The refined icons: 16px square-cap glyphs, and no icon inside a labelled button.',
        body=r'''# UI-P82 — The glyph set

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
''',
    ),
    Prompt(
        id='UI-P83',
        title='Model marks with Lobe Icons, background-less',
        wave=1,
        needs='UI-P82, and your yes to one new package: @lobehub/icons-static-svg',
        lead='Every model, lab and AI tool the site names gets its real logo beside the name: the logo alone, no tile, no background, no border.',
        body=r'''# UI-P83 — Model marks with Lobe Icons, background-less

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
''',
    ),
    Prompt(
        id='UI-P84',
        title='Controls under the refined look',
        wave=2,
        needs='UI-P83 ended on PASS',
        lead='The control set from the `components` board, inside the existing primitives, so every call site gets it when the look is on.',
        body=r'''# UI-P84 — Controls under the refined look

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
''',
    ),
    Prompt(
        id='UI-P85',
        title='Surfaces, rows and data marks',
        wave=2,
        needs='UI-P84 ended on PASS',
        lead='The layers and the small data pieces every page is built from.',
        body=r'''# UI-P85 — Surfaces, rows and data marks

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
''',
    ),
    Prompt(
        id='UI-P86',
        title='Framed works, cover fallback and streak days',
        wave=2,
        needs='UI-P85 ended on PASS',
        lead='The objects that carry the lamp.',
        body=r'''# UI-P86 — Framed works, cover fallback and streak days

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
''',
    ),
    Prompt(
        id='UI-P87',
        title='The frame',
        wave=3,
        needs='UI-P86 ended on PASS',
        lead='Header, surface, breadcrumb and footer as every refined board draws them, desktop and mobile.',
        body=r'''# UI-P87 — The frame

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
''',
    ),
    Prompt(
        id='UI-P88',
        title='Page: Home',
        wave=4,
        needs='UI-P87 ended on PASS',
        lead="Home drawn as `refined/<theme>/home.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P88 — Page: Home

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
''',
    ),
    Prompt(
        id='UI-P89',
        title='Page: Gallery',
        wave=4,
        needs='UI-P88 ended on PASS',
        lead="Gallery drawn as `refined/<theme>/gallery-dashboard.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P89 — Page: Gallery

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
''',
    ),
    Prompt(
        id='UI-P90',
        title='Page: Build page — first screen and The build',
        wave=4,
        needs='UI-P89 ended on PASS',
        lead="Build page — first screen and The build drawn as `refined/<theme>/build-list.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P90 — Page: Build page — first screen and The build

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
''',
    ),
    Prompt(
        id='UI-P91',
        title='Page: Build page — the Map',
        wave=4,
        needs='UI-P90 ended on PASS',
        lead="Build page — the Map drawn as `refined/<theme>/build-map.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P91 — Page: Build page — the Map

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
''',
    ),
    Prompt(
        id='UI-P92',
        title='Page: Activity',
        wave=4,
        needs='UI-P91 ended on PASS',
        lead="Activity drawn as `refined/<theme>/activity.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P92 — Page: Activity

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
''',
    ),
    Prompt(
        id='UI-P93',
        title='Page: Composer — List, Sources and Details',
        wave=4,
        needs='UI-P92 ended on PASS',
        lead="Composer — List, Sources and Details drawn as `refined/<theme>/composer-list.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P93 — Page: Composer — List, Sources and Details

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
''',
    ),
    Prompt(
        id='UI-P94',
        title='Page: Composer — Map, full prompt window and Card',
        wave=4,
        needs='UI-P93 ended on PASS',
        lead="Composer — Map, full prompt window and Card drawn as `refined/<theme>/composer-map.html`, both themes, desktop; mobile keeps today's stacking order in the refined look.",
        body=r'''# UI-P94 — Page: Composer — Map, full prompt window and Card

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
''',
    ),
    Prompt(
        id='UI-P95',
        title='Pages without a refined board',
        wave=4,
        needs='UI-P94 ended on PASS',
        lead='Every other page reads as the same system under the refined look, without new layouts.',
        body=r'''# UI-P95 — Pages without a refined board

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
''',
    ),
    Prompt(
        id='UI-P96',
        title='The trope sweep and the copy fixes',
        wave=5,
        needs='UI-P95 ended on PASS',
        lead='Nothing on the trope list survives, and a test keeps it that way.',
        body=r'''# UI-P96 — The trope sweep and the copy fixes

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
''',
    ),
    Prompt(
        id='UI-P97',
        title='Every state, accessibility and the in-between widths',
        wave=5,
        needs='UI-P96 ended on PASS',
        lead='The refined views are complete, not just populated.',
        body=r'''# UI-P97 — Every state, accessibility and the in-between widths

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
''',
    ),
    Prompt(
        id='UI-P98',
        title='Turn on the refined look',
        wave=5,
        needs='UI-P77 to UI-P97, each ended on PASS',
        lead='Visitors see the refined look.',
        body=r'''# UI-P98 — Turn on the refined look

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
''',
    ),
    Prompt(
        id='UI-P99',
        title='Retire the current look',
        wave=5,
        needs='the refined look live long enough that nobody wants the old one back',
        lead='One look in the code. Run this only after the refined look has been live long enough that nobody wants it back.',
        body=r'''# UI-P99 — Retire the current look

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
''',
    ),
)


# =============================================================================
# The boards
#
# Everything below draws the twelve reference boards in both themes. The values
# here are the values the prompts cite: change a value here and the boards
# change with it. Each board is first drawn for the design canvas, then made
# standalone (`standalone_board`), which is what the repo keeps.
# =============================================================================


# --- Tokens, recipes and atoms -------------------------------------------------

# v2 system: one generator, two themes (Dusk = dark, Noon = light).
# Everything is emitted as static markup with literal values.

SANS = "Geist, 'Helvetica Neue', Arial, sans-serif"
MONO = "'Geist Mono', ui-monospace, monospace"

DARK = dict(
    key='dark', theme='Dusk',
    frame='#0F0F10', surface='#19191B', surface_border='#232326', surface_shadow='inset 0 1px 0 rgba(255,255,255,.035)',
    card='#1E1E21', card_border='#29292D', card_shadow='none',
    inset='#232327', inset_border='#2E2E33',
    well='#141416', well_border='#27272B', well_shadow='inset 0 1px 1px rgba(0,0,0,.35)',
    hair='#26262A', hair_card='#2A2A2E', line='#34343A',
    text='#EDEDEF', text2='#A0A0A6', text3='#8E8E94',
    ctrl='#27272B', ctrl_border='#323237', ctrl_shadow='inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.35)',
    ctrl_on='#2F2F34',
    seg_track='#141416', seg_border='#27272B',
    primary='#EDEDEF', primary_text='#121214', primary_shadow='inset 0 -1px 0 rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.45)',
    tag='#26262A', tag_text='#A0A0A6', pill='#303035', pill_text='#CFCFD3',
    lamp='#F5CB4C', lamp_glow='0 0 6px rgba(245,203,76,.7), 0 0 14px rgba(245,203,76,.25)', lamp_bar='#F5CB4C',
    nav_mark='#F5CB4C', nav_mark_glow='0 0 8px rgba(245,203,76,.55)',
    sel_border='#8E8E95', sel_bg='#222226', sel_ring='0 0 0 1px #8E8E95',
    green='#86D193', green_bg='rgba(134,209,147,.12)', red='#E5807F', red_bg='rgba(229,128,127,.12)',
    amber='#E8C468', amber_bg='rgba(232,196,104,.12)', orange='#E0864F', blue='#82A9E8', blue_bg='rgba(130,169,232,.12)',
    frozen='#8FB8D0',
    scrim='rgba(10,10,11,.72)',
    window='#1E1E21', window_border='#2E2E33', window_shadow='inset 0 1px 0 rgba(255,255,255,.04), 0 2px 6px rgba(0,0,0,.4), 0 32px 64px -16px rgba(0,0,0,.75)',
    sheet_shadow='-24px 0 64px -16px rgba(0,0,0,.7)',
    dot='rgba(255,255,255,.055)', avatar='#2C2C30', avatar_text='#CFCFD3',
    logo='#EDEDEF', bar_lo='#3A3A3F', bar_mid='#55555B',
    paper='#0C0C0D', paper_ink='rgba(255,255,255,.2)', paper_ink2='rgba(255,255,255,.08)',
    cats=dict(instruction='#E39A78', configuration='#C9C27A', data='#82A9E8', artefact='#D9B36C', evidence='#86D193',
              narrative='#A0A0A6', agents='#A996E8', breakage='#E5807F', media='#E08FB4'),
    dim='filter: brightness(.48) saturate(.5);',
)

LIGHT = dict(
    key='light', theme='Noon',
    frame='#E9E9E9', surface='#F4F4F4', surface_border='#DCDCDC', surface_shadow='0 1px 2px rgba(0,0,0,.05)',
    card='#FAFAFA', card_border='#E1E1E1', card_shadow='0 1px 2px rgba(0,0,0,.04)',
    inset='#EFEFEF', inset_border='#E2E2E2',
    well='#ECECEC', well_border='#D9D9D9', well_shadow='inset 0 1px 2px rgba(0,0,0,.05)',
    hair='#E0E0E0', hair_card='#E7E7E7', line='#CFCFCF',
    text='#1C1C1C', text2='#575757', text3='#666666',
    ctrl='#FFFFFF', ctrl_border='#D9D9D9', ctrl_shadow='0 1px 2px rgba(0,0,0,.07), inset 0 -1px 0 rgba(0,0,0,.03)',
    ctrl_on='#FFFFFF',
    seg_track='#E6E6E6', seg_border='#D9D9D9',
    primary='#1C1C1C', primary_text='#FFFFFF', primary_shadow='inset 0 1px 0 rgba(255,255,255,.1), 0 1px 2px rgba(0,0,0,.25)',
    tag='#E9E9E9', tag_text='#575757', pill='#E6E6E6', pill_text='#333333',
    lamp='#F5CB4C', lamp_glow='none', lamp_bar='#E0A21A',
    nav_mark='#1C1C1C', nav_mark_glow='none',
    sel_border='#1C1C1C', sel_bg='#FFFFFF', sel_ring='0 0 0 1px #1C1C1C',
    green='#166F31', green_bg='#E1F1E5', red='#C42E1C', red_bg='#F9E6E3',
    amber='#8F5E00', amber_bg='#F6ECD4', orange='#E0911E', blue='#2563EB', blue_bg='#E4ECFC',
    frozen='#3F86B5',
    scrim='rgba(28,28,28,.32)',
    window='#FAFAFA', window_border='#DCDCDC', window_shadow='0 2px 6px rgba(0,0,0,.08), 0 32px 64px -16px rgba(0,0,0,.3)',
    sheet_shadow='-24px 0 64px -16px rgba(0,0,0,.25)',
    dot='rgba(0,0,0,.08)', avatar='#E2E2E2', avatar_text='#333333',
    logo='#1C1C1C', bar_lo='#E0E0E0', bar_mid='#C4C4C4',
    paper='#F1F1F1', paper_ink='rgba(0,0,0,.22)', paper_ink2='rgba(0,0,0,.08)',
    cats=dict(instruction='#C0623A', configuration='#857A14', data='#2D6BE4', artefact='#A3741A', evidence='#23804F',
              narrative='#5F5F5B', agents='#6B52D6', breakage='#C93E32', media='#BE4C84'),
    dim='filter: contrast(.42) brightness(1.32);',
)

THEMES = [DARK, LIGHT]

def fname(t, stem):
    return stem + '.dc.html' if t['key'] == 'dark' else 'Noon' + stem + '.dc.html'

def dcname(t, stem):
    return stem if t['key'] == 'dark' else 'Noon' + stem

# ---------- contrast ----------
def _lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def contrast(a, b):
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# ---------- glyphs (16px, stroke 1.3, square caps) ----------
G = dict(
    chev='M6.5 4 10.5 8l-4 4', chevd='M4 6.5 8 10.5l4-4', chevl='M9.5 4 5.5 8l4 4',
    search='M10.25 10.25 13.5 13.5M11.25 7a4.25 4.25 0 1 1-8.5 0 4.25 4.25 0 0 1 8.5 0z',
    bell='M4.5 11V7.5a3.5 3.5 0 0 1 7 0V11l1 1.25h-9zM6.75 14.25h2.5',
    moon='M12.75 9.75A5.25 5.25 0 0 1 6.25 3.25a5.25 5.25 0 1 0 6.5 6.5z',
    sun='M8 5.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5zM8 1.75v1.5M8 12.75v1.5M1.75 8h1.5M12.75 8h1.5M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1',
    plus='M8 3.5v9M3.5 8h9', x='M4.5 4.5l7 7M11.5 4.5l-7 7', pencil='M10.5 3.5l2 2L6 12H4v-2z',
    file='M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12', layers='M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.5 8 11.5l5.5-3M2.5 11.25 8 14.25l5.5-3',
    panel='M2.5 3h11v10h-11zM6 3v10M8.5 6.5 10 8l-1.5 1.5', larr='M13 8H3.5M7 4.5 3.5 8 7 11.5', rarr='M3 8h9.5M9 4.5 12.5 8 9 11.5',
    check='M3.5 8.5 6.5 11.5 12.5 4.5', more='M3.5 8h.01M8 8h.01M12.5 8h.01', up='M8 13V3.5M4.5 7 8 3.5 11.5 7',
    image='M2.5 3.5h11v9h-11zM2.5 10.5l3-3 3 3 2-2 3 3M10.5 6h.01', play='M5 3.5v9l7-4.5z', expand='M9.5 2.5h4v4M13.5 2.5l-5 5M6.5 13.5h-4v-4M2.5 13.5l5-5',
    grid='M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
    globe='M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM2.5 8h11M8 2.5c1.5 1.5 2.3 3.4 2.3 5.5S9.5 12 8 13.5M8 2.5C6.5 4 5.7 5.9 5.7 8s.8 4 2.3 5.5',
    mail='M2.5 4h11v8h-11zM2.5 4.5 8 9l5.5-4.5',
)

def glyph(name, color='currentColor', size=16, sw=1.3):
    w = 2 if name == 'more' else sw
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 16 16" fill="none" stroke="{color}" stroke-width="{w}" '
            f'stroke-linecap="square" aria-hidden="true"><path d="{G[name]}"></path></svg>')

def logo(t, size=18):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="4.8" rx="5.5" ry="3.4" fill="{t["lamp"]}"></ellipse>'
            f'<rect x="5.5" y="11.5" width="29" height="26" rx="5" fill="none" stroke="{t["logo"]}" stroke-width="3"></rect>'
            f'<rect x="12" y="18" width="16" height="13" rx="2.5" fill="{t["logo"]}"></rect></svg>')

# ---------- style recipes ----------
def s_card(t, pad='16px', extra=''):
    sh = '' if t['card_shadow'] == 'none' else f' box-shadow: {t["card_shadow"]};'
    return f'background: {t["card"]}; border: 1px solid {t["card_border"]}; border-radius: 8px;{sh} padding: {pad}; box-sizing: border-box; {extra}'

def s_inset(t, pad='12px', extra=''):
    return f'background: {t["inset"]}; border: 1px solid {t["inset_border"]}; border-radius: 6px; padding: {pad}; box-sizing: border-box; {extra}'

def s_well(t, extra=''):
    return f'background: {t["well"]}; border: 1px solid {t["well_border"]}; box-shadow: {t["well_shadow"]}; border-radius: 6px; box-sizing: border-box; {extra}'

def s_ctrl(t):
    return f'background: {t["ctrl"]}; border: 1px solid {t["ctrl_border"]}; box-shadow: {t["ctrl_shadow"]};'

def mono(size=11, color=None, t=None, extra=''):
    c = f' color: {color};' if color else ''
    return f"font-family: {MONO}; font-size: {size}px;{c} {extra}".strip()

def sans(size=13, weight=400, color=None, extra=''):
    c = f' color: {color};' if color else ''
    return f"font-family: {SANS}; font-size: {size}px; font-weight: {weight};{c} {extra}".strip()

TNUM = "font-variant-numeric: tabular-nums;"

# ---------- atoms ----------
def btn(t, label, kind='secondary', h=28, extra='', attrs='', tag='button'):
    pad = '0 12px' if h <= 28 else '0 16px'
    fs = 12.5 if h <= 28 else 13
    if kind == 'primary':
        look = f'background: {t["primary"]}; border: 1px solid {t["primary"]}; box-shadow: {t["primary_shadow"]}; color: {t["primary_text"]}; font-weight: 500;'
    elif kind == 'ghost':
        look = f'background: transparent; border: 1px solid transparent; color: {t["text2"]}; font-weight: 500;'
    else:
        look = s_ctrl(t) + f' color: {t["text"]}; font-weight: 500;'
    st = f'height: {h}px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: {pad}; border-radius: 6px; {look} font-family: {SANS}; font-size: {fs}px; white-space: nowrap; text-decoration: none; {extra}'
    if tag == 'a':
        return f'<a href="#" {attrs} style="{st}">{label}</a>'
    return f'<button type="button" {attrs} style="{st}">{label}</button>'

def icon_btn(t, name, label, boxed=True, size=28, color=None, extra='', attrs=''):
    c = color or t['text2']
    look = s_ctrl(t) if boxed else 'background: transparent; border: 1px solid transparent;'
    return (f'<button type="button" aria-label="{label}" {attrs} style="width: {size}px; height: {size}px; padding: 0; box-sizing: border-box; display: inline-flex; '
            f'align-items: center; justify-content: center; border-radius: 6px; {look} color: {c}; flex-shrink: 0; {extra}">{glyph(name)}</button>')

def icon_link(t, name, label, boxed=True, size=28, extra=''):
    look = s_ctrl(t) if boxed else 'background: transparent; border: 1px solid transparent;'
    return (f'<a href="#" aria-label="{label}" style="width: {size}px; height: {size}px; box-sizing: border-box; display: inline-flex; align-items: center; '
            f'justify-content: center; border-radius: 6px; {look} color: {t["text2"]}; flex-shrink: 0; {extra}">{glyph(name)}</a>')

def tag(t, text, color=None, extra=''):
    return (f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 4px; '
            f'background: {t["tag"]}; {sans(11.5, 400, color or t["tag_text"])} white-space: nowrap; {extra}">{text}</span>')

def pill(t, text, color=None, bg=None, extra=''):
    return (f'<span style="display: inline-flex; align-items: center; height: 18px; padding: 0 6px; box-sizing: border-box; border-radius: 4px; '
            f'background: {bg or t["pill"]}; {mono(10.5, color or t["pill_text"])} white-space: nowrap; {extra}">{text}</span>')

def cat_tag(t, cat, label=None, dashed=False):
    c = t['cats'][cat]
    sq = (f'<span aria-hidden="true" style="width: 6px; height: 6px; box-sizing: border-box; border-radius: 1px; border: 1px dashed {c};"></span>' if dashed
          else f'<span aria-hidden="true" style="width: 6px; height: 6px; border-radius: 1px; background: {c};"></span>')
    return tag(t, sq + (label or cat))

def chip_ref(t, text, suggested=False):
    """A reference to another prompt or file: Uses chips."""
    border = f'1px dashed {t["line"]}' if suggested else f'1px solid {t["inset_border"]}'
    bg = 'transparent' if suggested else t['inset']
    return (f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; box-sizing: border-box; border-radius: 4px; '
            f'background: {bg}; border: {border}; {sans(11.5, 400, t["text"] if not suggested else t["text2"])} white-space: nowrap;">{text}</span>')

def lamp(t, w=8, h=3):
    return f'<span aria-hidden="true" style="width: {w}px; height: {h}px; flex-shrink: 0; border-radius: 1px; background: {t["lamp_bar"]}; box-shadow: {t["lamp_glow"]};"></span>'

def avatar(t, ini, size=24, extra=''):
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; '
            f'background: {t["avatar"]}; {sans(max(9, size * 0.38), 500, t["avatar_text"])} {extra}">{ini}</span>')

def eyebrow(t, text, extra='', tagname='span', attrs=''):
    return f'<{tagname} {attrs} style="margin: 0; {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase; {extra}">{text}</{tagname}>'

def seg(t, items, on, label, h=28, extra=''):
    inner = []
    for i, it in enumerate(items):
        sel = i == on
        look = (f'background: {t["ctrl_on"]}; border: 1px solid {t["ctrl_border"]}; box-shadow: {t["ctrl_shadow"]}; color: {t["text"]};' if sel
                else f'background: transparent; border: 1px solid transparent; color: {t["text2"]};')
        inner.append(f'<button type="button" role="radio" aria-checked="{"true" if sel else "false"}" style="height: {h - 6}px; padding: 0 12px; box-sizing: border-box; border-radius: 4px; {look} {sans(12, 500)}">{it}</button>')
    bg, bd = t['seg_track'], t['seg_border']
    return (f'<div role="radiogroup" aria-label="{label}" style="display: inline-flex; gap: 2px; padding: 2px; box-sizing: border-box; height: {h}px; '
            f'background: {bg}; border: 1px solid {bd}; border-radius: 6px; {extra}">' + ''.join(inner) + '</div>')

def tabs(t, items, on, label, extra='', counts=None):
    out = []
    for i, it in enumerate(items):
        sel = i == on
        c = f' <span style="{sans(11.5, 400, t["text3"])} {TNUM}">{counts[i]}</span>' if counts else ''
        out.append(f'<button type="button" role="tab" aria-selected="{"true" if sel else "false"}" style="height: 40px; padding: 0; margin-bottom: -1px; background: none; border: 0; '
                   f'border-bottom: 2px solid {t["text"] if sel else "transparent"}; {sans(13, 500, t["text"] if sel else t["text2"])} white-space: nowrap;">{it}{c}</button>')
    return f'<div role="tablist" aria-label="{label}" style="display: flex; gap: 24px; border-bottom: 1px solid {t["hair"]}; {extra}">' + ''.join(out) + '</div>'

def search(t, placeholder, label, w='240px', kbd='/', h=30):
    k = f'<span style="{mono(10.5, t["text3"])} padding: 0 4px; border-radius: 4px; border: 1px solid {t["ctrl_border"]}; line-height: 16px;">{kbd}</span>' if kbd else ''
    return (f'<label style="width: {w}; max-width: 100%; height: {h}px; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 12px; {s_well(t)} color: {t["text3"]};">'
            f'{glyph("search")}<input aria-label="{label}" placeholder="{placeholder}" style="flex-grow: 1; min-width: 0; background: transparent; border: 0; outline: none; '
            f'{sans(12.5, 400, t["text"])}">{k}</label>')

def hrow(t, label, value, last=False, size=12.5, extra=''):
    b = '' if last else f'border-bottom: 1px solid {t["hair_card"]};'
    return (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 40px; {b} {extra}"><span style="flex-grow: 1; {sans(size, 400, t["text2"])}">{label}</span>'
            f'<span style="{sans(size, 500, t["text"])} {TNUM}">{value}</span></div>')

def card_head(t, title, sub=None, action=None, hid=None, level=2, size=13.5):
    idattr = f' id="{hid}"' if hid else ''
    s = f'<p style="margin: 0; {sans(12, 400, t["text2"])}">{sub}</p>' if sub else ''
    a = action or ''
    return (f'<div style="display: flex; align-items: flex-start; gap: 12px;"><div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">'
            f'<h{level}{idattr} style="margin: 0; {sans(size, 500, t["text"])} letter-spacing: -0.005em;">{title}</h{level}>{s}</div>{a}</div>')

def progress(t, pct, color=None, h=6, gap=2):
    color = color or t['green']
    if pct <= 0:
        return f'<span aria-hidden="true" style="display: flex; height: {h}px;"><span style="flex-grow: 1; border-radius: 1px; background: {t["bar_lo"]};"></span></span>'
    if pct >= 100:
        return f'<span aria-hidden="true" style="display: flex; height: {h}px;"><span style="flex-grow: 1; border-radius: 1px; background: {color};"></span></span>'
    return (f'<span aria-hidden="true" style="display: flex; gap: {gap}px; height: {h}px;"><span style="width: {pct}%; border-radius: 1px; background: {color};"></span>'
            f'<span style="flex-grow: 1; border-radius: 1px; background: {t["bar_lo"]};"></span></span>')

def minibars(t, values, hi=None, lo=None, split=None, w=3, gap=2, h=24, label=None, colors=None):
    mx = max(values) or 1
    out = []
    for i, v in enumerate(values):
        hh = max(2, round(v / mx * h))
        if colors:
            c = colors[i]
        else:
            c = (hi or t['green']) if (split is None or i < split) else (lo or t['bar_mid'])
        out.append(f'<span style="width: {w}px; height: {hh}px; border-radius: 1px; background: {c};"></span>')
    lab = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<div {lab} style="display: flex; align-items: flex-end; gap: {gap}px; height: {h}px;">' + ''.join(out) + '</div>'

def sparkline(t, values, w=64, h=18, color=None, label=None):
    mx = max(values) or 1
    n = len(values)
    pts = ' '.join(f'{i * w / (n - 1):.1f},{h - 1 - v / mx * (h - 2):.1f}' for i, v in enumerate(values))
    lab = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return (f'<svg {lab} width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display: block; overflow: visible;"><polyline points="{pts}" fill="none" '
            f'stroke="{color or t["text2"]}" stroke-width="1.2" stroke-linejoin="round"></polyline></svg>')

# ---------- shell ----------
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&amp;family=Geist+Mono:wght@400;500&amp;display=swap" rel="stylesheet">')

def page(t, title, body, w=1440, h=1000, fluid=True):
    if fluid:
        root = (f'<div style="width: 100%; min-height: 100vh; box-sizing: border-box; background: {t["frame"]}; font-family: {SANS}; color: {t["text"]}; '
                f'display: flex; flex-direction: column; -webkit-font-smoothing: antialiased;">')
    else:
        root = (f'<div style="position: relative; width: {w}px; height: {h}px; overflow: hidden; box-sizing: border-box; background: {t["frame"]}; font-family: {SANS}; '
                f'color: {t["text"]}; -webkit-font-smoothing: antialiased;">')
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0;background:{t["frame"]}}}
a{{color:{t["text"]}}}a:hover{{color:{t["text"]}}}
input::placeholder,textarea::placeholder{{color:{t["text3"]}}}
</style>
</helmet>
{root}
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''

PAD_X = 'clamp(16px, 4.6vw, 64px)'

def header(t, current=None, bell_current=False):
    items = [('Home', None), ('Gallery', None), ('Bounties', None), ('Library', None), ('Drafts', '2')]
    nav = []
    for name, count in items:
        on = name == current
        cnt = f'<span style="{sans(11, 500, t["text3"])} {TNUM}">{count}</span>' if count else ''
        mark = (f'<span aria-hidden="true" style="position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px; border-radius: 1px; background: {t["nav_mark"]}; box-shadow: {t["nav_mark_glow"]};"></span>' if on else '')
        cur = ' aria-current="page"' if on else ''
        nav.append(f'<a href="#"{cur} style="position: relative; display: flex; align-items: center; gap: 6px; padding: 0 12px; {sans(13, 500, t["text"] if on else t["text2"])} text-decoration: none;">{name}{cnt}{mark}</a>')
    bell_look = (f'background: {t["ctrl_on"]}; border: 1px solid {t["ctrl_border"]};' if bell_current else 'background: transparent; border: 1px solid transparent;')
    bcur = ' aria-current="page"' if bell_current else ''
    theme_icon = 'moon' if t['key'] == 'dark' else 'sun'
    return f'''<header style="width: 100%; max-width: 1440px; margin: 0 auto; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 20px; box-sizing: border-box;">
    <a href="#" style="display: flex; align-items: center; gap: 8px; text-decoration: none; padding-right: 8px;">{logo(t)}<span style="{sans(14, 600, t["text"])} letter-spacing: -0.02em;">buildgallery</span></a>
    <span aria-hidden="true" style="width: 1px; height: 16px; background: {t["line"]};"></span>
    <nav aria-label="Primary" style="display: flex; align-items: stretch; height: 48px; padding-left: 4px;">{"".join(nav)}</nav>
    <span style="flex-grow: 1;"></span>
    {search(t, "Search builds, makers, tools", "Search builds", w="240px")}
    {btn(t, "New build", "secondary", 30)}
    <a href="#" aria-label="Activity, 3 unread"{bcur} style="position: relative; width: 30px; height: 30px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; {bell_look} color: {t["text2"]};">{glyph("bell")}<span aria-hidden="true" style="position: absolute; top: 3px; right: 3px; min-width: 12px; height: 12px; padding: 0 3px; box-sizing: border-box; border-radius: 6px; background: {t["lamp"]}; {sans(9, 600, "#111112")} line-height: 12px; text-align: center;">3</span></a>
    {icon_btn(t, theme_icon, "Theme: " + t["theme"], boxed=False, size=30)}
    <button type="button" aria-label="Account" style="width: 26px; height: 26px; padding: 0; border-radius: 50%; background: {t["avatar"]}; border: 0; {sans(10, 500, t["avatar_text"])}">MA</button>
  </header>'''

def surface_open(t, extra=''):
    return (f'<div style="width: calc(100% - 12px); max-width: 1428px; margin: 0 auto 6px; flex-grow: 1; box-sizing: border-box; background: {t["surface"]}; '
            f'border: 1px solid {t["surface_border"]}; border-radius: 10px; box-shadow: {t["surface_shadow"]}; display: flex; flex-direction: column; {extra}">')

def footer(t):
    on = 0 if t['key'] == 'light' else 1
    links = ''.join(f'<a href="#" style="color: {t["text2"]}; text-decoration: none;">{x}</a>' for x in ['About', 'API docs', 'Solvers', 'Connect a tool', 'Sign out'])
    return f'''<footer style="margin-top: auto; border-top: 1px solid {t["hair"]}; padding: 12px {PAD_X}; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px;">
      <a href="#" style="display: flex; align-items: center; gap: 8px; text-decoration: none;">{logo(t, 15)}<span style="{sans(13, 600, t["text"])} letter-spacing: -0.02em;">buildgallery</span></a>
      <nav aria-label="Footer" style="display: flex; flex-wrap: wrap; gap: 8px 20px; {sans(12.5, 400)}">{links}</nav>
      <span style="flex-grow: 1;"></span>
      {seg(t, ["Noon", "Dusk", "System"], on, "Theme", h=26)}
      <span style="{sans(12, 400, t["text3"])}">© buildgallery</span>
    </footer>'''

def crumb(t, parts):
    out = []
    for i, p in enumerate(parts):
        if i:
            out.append(f'<span aria-hidden="true" style="color: {t["text3"]};">/</span>')
        if i == len(parts) - 1:
            out.append(f'<span style="color: {t["text"]}; font-weight: 500;">{p}</span>')
        else:
            out.append(f'<a href="#" style="color: {t["text2"]}; text-decoration: none;">{p}</a>')
    return f'<nav aria-label="Breadcrumb" style="display: flex; gap: 8px; {sans(12.5, 400)}">' + ''.join(out) + '</nav>'

def sr(text):
    return f'<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;">{text}</span>'


# ---------- model marks ----------
# One tile per lab or tool. The site already marks labs with their initial (GalleryDashboardView: name.charAt(0));
# the boards extend that to every place a build names a model or a tool. In code, the provider's official mark
# goes inside the same tile; nothing here draws one.
LABS = dict(anthropic=('A', 'Anthropic'), openai=('O', 'OpenAI'), google=('G', 'Google'), xai=('X', 'xAI'), deepseek=('D', 'DeepSeek'), cursor=('C', 'Cursor'))
TOOL_GLYPH = dict(vercel='globe', gmail='mail')
LAB_OF = {
    'Claude': 'anthropic', 'Claude Code': 'anthropic', 'Opus 5.5': 'anthropic', 'Opus 5': 'anthropic', 'Sonnet 5.5': 'anthropic', 'Haiku 5.5': 'anthropic',
    'Anthropic': 'anthropic', 'ChatGPT': 'openai', 'OpenAI': 'openai', 'GPT-6 Astra': 'openai', 'GPT-6.1 Sol': 'openai', 'GPT-5.6': 'openai', 'GPT-6 Luna': 'openai',
    'Gemini': 'google', 'Google': 'google', 'Gemini 4 Argon': 'google', 'Gemini 3.8 Flash': 'google', 'Grok 4.7': 'xai', 'xAI': 'xai',
    'DeepSeek': 'deepseek', 'DeepSeek V4 Pro': 'deepseek', 'Cursor': 'cursor', 'Vercel': 'vercel', 'Gmail': 'gmail',
}

def mark(t, name, size=20, extra=''):
    key = LAB_OF.get(name, name)
    r = 4 if size <= 18 else 5 if size <= 24 else 6
    if t['key'] == 'dark':
        look = 'background: linear-gradient(#2E2E33, #222225); border: 1px solid #38383E; border-top-color: #45454C; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 1px 1px rgba(0,0,0,.5);'
    else:
        look = 'background: #FFFFFF; border: 1px solid #D6D6D6; box-shadow: 0 1px 2px rgba(0,0,0,.08);'
    if key in TOOL_GLYPH:
        inner = glyph(TOOL_GLYPH[key], t['text2'], max(10, round(size * .6)))
    else:
        letter = LABS.get(key, (name[:1].upper(), name))[0]
        fs = max(8, round(size * .5))
        inner = f'<span style="font-family: {SANS}; font-size: {fs}px; font-weight: 600; line-height: 1; letter-spacing: -0.02em; color: {t["text"]};">{letter}</span>'
    return (f'<span aria-hidden="true" data-mark="{key}" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; '
            f'align-items: center; justify-content: center; border-radius: {r}px; {look} {extra}">{inner}</span>')

def model_tag(t, text, name=None, color=None):
    m = mark(t, name or text, 14)
    return (f'<span style="display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px 0 4px; box-sizing: border-box; border-radius: 4px; '
            f'background: {t["tag"]}; {sans(11.5, 400, color or t["tag_text"])} white-space: nowrap;">{m}{text}</span>')

def model_chip(t, text, name=None, selected=False, attrs=''):
    look = (f'background: {t["ctrl_on"]}; border: 1px solid {t["sel_border"]}; box-shadow: {t["sel_ring"]};' if selected else s_ctrl(t))
    return (f'<button type="button" aria-pressed="{"true" if selected else "false"}" {attrs} style="height: 32px; display: inline-flex; align-items: center; gap: 8px; '
            f'padding: 0 12px 0 6px; box-sizing: border-box; border-radius: 6px; {look} {sans(12.5, 500, t["text"] if selected else t["text2"])} white-space: nowrap;">{mark(t, name or text, 20)}{text}</button>')

# --- Foundations and components ------------------------------------------------

def board_shell(t, inner, h=1180):
    """A fixed 1440 board: frame with one surface inset by 6px."""
    body = (f'<div style="position: absolute; left: 6px; right: 6px; top: 6px; bottom: 6px; box-sizing: border-box; background: {t["surface"]}; '
            f'border: 1px solid {t["surface_border"]}; border-radius: 10px; box-shadow: {t["surface_shadow"]}; padding: 48px 64px; overflow: hidden;">{inner}</div>')
    return body

def sec_title(t, title, sub=None):
    s = f'<p style="margin: 0; {sans(12.5, 400, t["text2"])} max-width: 520px;">{sub}</p>' if sub else ''
    return f'<div style="display: flex; flex-direction: column; gap: 4px;"><h2 style="margin: 0; {sans(14, 500, t["text"])}">{title}</h2>{s}</div>'

def framed(t, w, h, lit=False, pad=4, extra=''):
    """A framed work: a small object with a picture inside. Lit = the lamp above it, never a coloured border."""
    if t['key'] == 'dark':
        fr = 'background: linear-gradient(#2A2A2E, #1F1F22); border: 1px solid #333338; border-top-color: #3C3C42; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 1px 1px rgba(0,0,0,.55), 0 6px 12px -4px rgba(0,0,0,.45);'
        paper = '#0E0E0F' if not lit else '#131314'
        ink, ink2 = ('rgba(255,255,255,.26)', 'rgba(255,255,255,.1)') if lit else ('rgba(255,255,255,.14)', 'rgba(255,255,255,.06)')
    else:
        fr = 'background: #FFFFFF; border: 1px solid #D9D9D9; box-shadow: 0 1px 1px rgba(20,20,18,.06), 0 6px 12px -6px rgba(20,20,18,.18);'
        paper = '#F1F1F1' if not lit else '#FAF5E6'
        ink, ink2 = ('rgba(20,20,18,.32)', 'rgba(20,20,18,.12)') if lit else ('rgba(20,20,18,.16)', 'rgba(20,20,18,.07)')
    lampbar = (f'<span aria-hidden="true" style="position: absolute; left: 50%; top: -8px; width: {max(12, w // 4)}px; height: 3px; transform: translateX(-50%); border-radius: 1px; '
               f'background: {t["lamp_bar"]}; box-shadow: {t["lamp_glow"]};"></span>') if lit else ''
    glow = (f'<span aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 0; height: 60%; background: linear-gradient(rgba(245,203,76,{.10 if t["key"] == "dark" else .14}), rgba(245,203,76,0));"></span>') if lit else ''
    return (f'<span style="position: relative; display: block; width: {w}px; height: {h}px; box-sizing: border-box; border-radius: 4px; padding: {pad}px; {fr} {extra}">{lampbar}'
            f'<span style="position: relative; display: flex; flex-direction: column; gap: 4px; height: 100%; box-sizing: border-box; padding: {4 if h < 60 else 8}px; border-radius: 2px; background: {paper}; overflow: hidden;">{glow}'
            f'<span style="position: relative; width: 45%; height: 3px; background: {ink};"></span><span style="position: relative; width: 70%; height: 2px; background: {ink2};"></span>'
            f'<span style="position: relative; width: 55%; height: 2px; background: {ink2};"></span></span></span>')

def foundations(t):
    dark = t['key'] == 'dark'
    title = 'Dusk, refined' if dark else 'Noon'
    sub = ('One surface, layered by tone. Depth lives inside components, never between sections.' if dark
           else 'The same system in daylight: three neutral greys, white only for raised controls, ink for the one filled button.')
    # surfaces stack
    def layer(name, hexv, token, bg, border, inner='', pad='12px 12px 12px', extra=''):
        return (f'<div style="display: flex; flex-direction: column; gap: 12px; padding: {pad}; box-sizing: border-box; border-radius: 8px; background: {bg}; '
                f'border: 1px solid {border}; {extra}"><div style="display: flex; gap: 8px; align-items: baseline;"><span style="{sans(12, 500, t["text"])}">{name}</span>'
                f'<span style="{mono(10.5, t["text3"])}">{hexv}</span><span style="flex-grow: 1;"></span><span style="{mono(10.5, t["text3"])}">{token}</span></div>{inner}</div>')
    well = (f'<div style="height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 12px; {s_well(t)}"><span style="{sans(12, 500, t["text"])}">Well</span>'
            f'<span style="{mono(10.5, t["text3"])}">{t["well"]}</span><span style="flex-grow: 1;"></span><span style="{mono(10.5, t["text3"])}">--field</span></div>')
    inset = layer('Inset', t['inset'], '--tab', t['inset'], t['inset_border'], '', extra='')
    card = layer('Card', t['card'], '--cell', t['card'], t['card_border'], inset + well)
    surf = layer('Surface', t['surface'], '--bg', t['surface'], t['surface_border'], card, pad='12px')
    frame = layer('Frame', t['frame'], '--frame', t['frame'], t['hair'], surf, pad='12px')
    surfaces = (f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "Surfaces", "Each level is one step from the one it sits on. Cards carry one hairline and no shadow.")}'
                f'{frame}</section>')

    # signal
    sig = [('Lamp', t['lamp_bar'], '--lit', 'The only light. Lit builds, the current page, unread.'),
           ('Evidence', t['green'], '--evidence', 'Reproduced, worked, the result.'),
           ('Amber ink', t['amber'], '--lit-ink', 'Builds in the visitors’ book, a forecast.'),
           ('Breakage', t['red'], '--cat-breakage', 'Where it broke, failed runs.')]
    sig_rows = ''.join(
        f'<div style="display: flex; align-items: center; gap: 12px; min-height: 40px; border-bottom: 1px solid {t["hair"]};">'
        f'<span aria-hidden="true" style="width: 12px; height: 12px; border-radius: 2px; background: {c};{" box-shadow: " + t["lamp_glow"] + ";" if n == "Lamp" and dark else ""}"></span>'
        f'<span style="width: 88px; {sans(12.5, 500, t["text"])}">{n}</span><span style="flex-grow: 1; {sans(12, 400, t["text2"])}">{d}</span>'
        f'<span style="{mono(10.5, t["text3"])}">{c} {tok}</span></div>' for n, c, tok, d in sig)
    tiers = ''.join(
        f'<div style="display: flex; flex-direction: column; gap: 4px; padding: 12px 0;"><span style="{sans(20, 500, t[k])} {TNUM}">{contrast(t[k], t["surface"]):.1f} : 1</span>'
        f'<span style="{sans(12, 400, t["text2"])}">{n} <span style="{mono(10.5, t["text3"])}">{t[k]}</span></span></div>'
        for k, n in [('text', 'Text'), ('text2', 'Text 2'), ('text3', 'Label')])
    cats = ''.join(cat_tag(t, c) for c in ['instruction', 'configuration', 'data', 'artefact', 'evidence', 'narrative', 'agents', 'breakage', 'media'])
    signal = (f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "Light and signal", "Colour carries meaning, never decoration.")}'
              f'<div style="border-top: 1px solid {t["hair"]};">{sig_rows}</div>'
              f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; border-bottom: 1px solid {t["hair"]};">{tiers}</div>'
              f'<div style="display: flex; flex-direction: column; gap: 8px;">{eyebrow(t, "Part categories")}<div style="display: flex; flex-wrap: wrap; gap: 8px;">{cats}</div></div></section>')

    # type
    def spec(label, sample):
        return (f'<div style="display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 16px; align-items: baseline; padding: 12px 0; border-bottom: 1px solid {t["hair"]};">'
                f'<span style="{mono(10.5, t["text3"])}">{label}</span>{sample}</div>')
    typ = (f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "Type", "Geist for everything you read. Geist Mono only for ids and keys.")}<div>'
           + spec('Statement 40/500', f'<span style="{sans(40, 500, t["text"])} letter-spacing: -0.035em; line-height: 1.05;">Every AI build, hung with its proof.</span>')
           + spec('Title 20/500', f'<span style="{sans(20, 500, t["text"])} letter-spacing: -0.015em;">Invoice triage agent</span>')
           + spec('Heading 13.5/500', f'<span style="display: flex; flex-direction: column; gap: 4px;"><span style="{sans(13.5, 500, t["text"])}">The visitors’ book</span><span style="{sans(12, 400, t["text2"])}">Builds, rebuilds, reproduction notes and asks · newest first</span></span>')
           + spec('Body 13/400', f'<span style="{sans(13, 400, t["text"])} line-height: 20px; max-width: 520px;">Reads every supplier invoice in a shared inbox, checks it against the purchase order and routes mismatches to a person with the reason attached.</span>')
           + spec('Figures 13/500', f'<span style="display: flex; gap: 24px; {sans(13, 500, t["text"])} {TNUM}"><span>41 reproduced</span><span>1,240 tok</span><span>86 / 100</span></span>')
           + spec('Mono 10.5', f'<span style="display: flex; gap: 8px;">{pill(t, "sonnet-4.5")}{pill(t, "/")}</span>')
           + spec('Eyebrow 10.5 caps', eyebrow(t, 'Reproduction · Made for · Completeness'))
           + '</div></section>')

    # depth
    def depth(name, desc, sample):
        return (f'<div style="display: flex; flex-direction: column; gap: 12px;"><div style="height: 72px; display: flex; align-items: center; justify-content: center; border-radius: 8px; '
                f'background: {t["surface"]}; border: 1px dashed {t["hair"]};">{sample}</div><div style="display: flex; flex-direction: column; gap: 4px;">'
                f'<span style="{sans(12.5, 500, t["text"])}">{name}</span><span style="{sans(11.5, 400, t["text2"])} line-height: 16px;">{desc}</span></div></div>')
    depth_row = (f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">'
                 + depth('Card', 'One step lighter, one hairline. No shadow in Dusk.' if dark else 'One step lighter than the grey surface, one hairline, a 2px shadow.', f'<span style="width: 96px; height: 44px; {s_card(t, "0")}"></span>')
                 + depth('Control', 'Fill, hairline and a 1px top light. Presses in.', btn(t, 'How proof works'))
                 + depth('Well', 'Below the surface. Fields, tracks, maps.', f'<span style="width: 96px; height: 32px; {s_well(t)}"></span>')
                 + depth('Lamp', 'A 3px bar with its own glow.' if dark else 'A 3px amber bar. No glow in daylight.', lamp(t, 32))
                 + '</div>')
    radius = ''.join(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;"><span style="width: 40px; height: 40px; box-sizing: border-box; '
                     f'border: 1px solid {t["line"]}; border-top-left-radius: {r}px; border-right: 0; border-bottom: 0;"></span><span style="{sans(11.5, 400, t["text2"])}">{r} {n}</span></div>'
                     for r, n in [(4, 'tag'), (6, 'control'), (8, 'card'), (10, 'surface'), (12, 'window')])
    glyph_names = ['search', 'bell', 'moon', 'sun', 'plus', 'x', 'pencil', 'file', 'layers', 'panel', 'larr', 'rarr', 'check', 'chev', 'image', 'play']
    glyphs = ''.join(f'<span style="color: {t["text"]};">{glyph(g)}</span>' for g in glyph_names)
    spacing = ''.join(f'<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;"><span style="width: {s}px; height: 8px; border-radius: 1px; background: {t["line"]};"></span>'
                      f'<span style="{sans(11.5, 400, t["text2"])} {TNUM}">{s}</span></div>' for s in [4, 8, 12, 16, 24, 32, 48, 64])
    depth_sec = (f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "Depth", "Layouts stay flat. Depth lives inside components.")}{depth_row}'
                 f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; padding-top: 16px; border-top: 1px solid {t["hair"]};">'
                 f'<div style="display: flex; flex-direction: column; gap: 12px;">{eyebrow(t, "Radius")}<div style="display: flex; gap: 20px;">{radius}</div></div>'
                 f'<div style="display: flex; flex-direction: column; gap: 12px;">{eyebrow(t, "Spacing")}<div style="display: flex; gap: 16px; align-items: flex-end;">{spacing}</div></div></div>'
                 f'<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 16px; border-top: 1px solid {t["hair"]};">{eyebrow(t, "Glyphs · 16 px · square caps")}'
                 f'<div style="display: flex; gap: 24px; flex-wrap: wrap;">{glyphs}</div></div></section>')

    head = (f'<div style="display: flex; align-items: flex-end; gap: 24px; padding-bottom: 32px; margin-bottom: 40px; border-bottom: 1px solid {t["hair"]};">'
            f'<div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1;"><span style="display: flex; align-items: center; gap: 8px;">{logo(t, 16)}'
            f'<span style="{sans(12.5, 500, t["text2"])}">buildgallery · UI vision board</span></span>'
            f'<h1 style="margin: 0; {sans(28, 500, t["text"])} letter-spacing: -0.03em;">{title}</h1><p style="margin: 0; {sans(13, 400, t["text2"])}">{sub}</p></div>'
            f'{seg(t, ["Noon", "Dusk"], 1 if dark else 0, "Theme")}</div>')
    grid = (f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 64px; row-gap: 48px;">'
            f'{surfaces}{signal}{typ}{depth_sec}</div>')
    return page(t, 'Foundations' if dark else 'Foundations, Noon', board_shell(t, head + grid), 1440, 1180, fluid=False)


def components(t):
    dark = t['key'] == 'dark'
    def block(title, inner, span=1):
        return (f'<section style="grid-column: span {span}; display: flex; flex-direction: column; gap: 16px; padding-top: 16px; border-top: 1px solid {t["hair"]};">'
                f'{eyebrow(t, title, tagname="h2")}{inner}</section>')
    dock = (f'<div style="display: inline-flex; border-radius: 6px; {s_ctrl(t)} overflow: hidden;">'
            + ''.join(f'<button type="button" style="height: 28px; padding: 0 12px; background: transparent; border: 0; {"border-left: 1px solid " + t["ctrl_border"] + ";" if i else ""} {sans(12.5, 500, t["text"])}">{x}</button>'
                      for i, x in enumerate(['Copy for AI', 'Download', 'Rebuild']))
            + f'<a href="#" style="height: 28px; display: inline-flex; align-items: center; padding: 0 12px; border-left: 1px solid {t["ctrl_border"]}; {sans(12.5, 500, t["text"])} text-decoration: none;">Lineage</a></div>')
    hover = s_ctrl(t).replace(t['ctrl'], '#2E2E33' if dark else '#FAFAF9', 1)
    pressed = (f'background: {t["well"]}; border: 1px solid {t["well_border"]}; box-shadow: {t["well_shadow"]};')
    states = ''.join(f'<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;"><button type="button" style="height: 28px; padding: 0 12px; border-radius: 6px; {st} {sans(12.5, 500, t["text"])}">Export</button>'
                     f'<span style="{sans(11.5, 400, t["text3"])}">{n}</span></div>' for n, st in [('rest', s_ctrl(t)), ('hover', hover), ('pressed', pressed)])
    buttons = block('Buttons', f'''<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">{btn(t, "Enter the gallery", "primary", 32)}{btn(t, "How proof works", "secondary", 32)}{btn(t, "Mark all read", "ghost", 32)}</div>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px;">{dock}{icon_link(t, "chev", "Open this week")}</div>
        <div style="display: flex; gap: 24px;">{states}</div>
        <p style="margin: 0; {sans(12, 400, t["text2"])}">One filled button per view. Labels carry no icons.</p>''')

    segs = ''.join(f'<div style="display: flex; align-items: center; gap: 12px;"><span style="width: 96px; {sans(12, 400, t["text2"])}">{lab}</span>{seg(t, items, on, lab)}</div>'
                   for lab, items, on in [('Whose builds', ['Following', 'Everyone'], 1), ('Gallery view', ['Feed', 'Dashboard'], 1), ('Mode', ['Run', 'Understand'], 1), ('Theme', ['Noon', 'Dusk', 'System'], 1 if dark else 0)])
    segments = block('Segmented and tabs', f'<div style="display: flex; flex-direction: column; gap: 8px;">{segs}</div>{tabs(t, ["Builds", "Models", "Makers"], 0, "Dashboard tabs", counts=["10", "12", "10"])}')

    menu = (f'<button type="button" aria-haspopup="menu" style="height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; border-radius: 6px; {s_ctrl(t)} {sans(12.5, 400, t["text2"])}">'
            f'Sort by <span style="color: {t["text"]}; font-weight: 500;">Engagement</span>{glyph("chevd", t["text3"])}</button>')
    field = (f'<label style="display: flex; flex-direction: column; gap: 8px;"><span style="{sans(12.5, 500, t["text"])}">Title</span><input value="Bakery homepage" style="height: 36px; padding: 0 12px; '
             f'{s_well(t)} outline: none; {sans(13.5, 400, t["text"])}"></label>')
    fields = block('Fields', f'<div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">{search(t, "Search builds, makers, tools", "Search builds", "260px")}{menu}</div>{field}')

    plaque = (f'<div style="display: flex; align-items: center; gap: 8px;">{pill(t, "41 reproduced", t["green"], t["green_bg"])}{lamp(t)}<span style="{sans(12, 400, t["text2"])}">3 days ago, on sonnet-4.5</span></div>'
              f'<div style="display: flex; align-items: center; gap: 8px;">{pill(t, "12 reproduced", t["green"], t["green_bg"])}<span style="{sans(12, 400, t["text3"])}">4 months ago, on gpt-5</span></div>'
              f'<div style="display: flex; align-items: center; gap: 8px;">{pill(t, "not yet reproduced")}</div>')
    tagsb = block('Tags and plaque', f'<div style="display: flex; flex-wrap: wrap; gap: 8px;">{tag(t, "agent · via connector")}{cat_tag(t, "instruction")}{cat_tag(t, "configuration")}{cat_tag(t, "breakage", "configuration", dashed=True)}</div>{plaque}')

    frames = (f'<div style="display: flex; gap: 32px; align-items: flex-end; padding-top: 8px;"><div style="display: flex; flex-direction: column; gap: 12px;">{framed(t, 120, 72)}'
              f'<span style="{sans(11.5, 400, t["text3"])}">unlit</span></div><div style="display: flex; flex-direction: column; gap: 12px;">{framed(t, 120, 72, lit=True)}'
              f'<span style="{sans(11.5, 400, t["text3"])}">lit: newest since your last visit</span></div></div>')
    framedb = block('Framed work', frames)

    chal = (f'<div style="display: flex; flex-direction: column; gap: 8px;"><div style="display: flex; align-items: baseline; gap: 8px;"><span style="flex-grow: 1; {sans(12.5, 500, t["text"])}">Run three builds you haven’t run before</span>'
            f'<span style="{sans(11.5, 400, t["text3"])} {TNUM}">1 / 3 · +90 xp</span></div>{progress(t, 33, t["lamp_bar"])}</div>')
    comp = (f'<div style="{s_inset(t)} display: flex; flex-direction: column; gap: 12px;"><div style="display: flex; align-items: baseline;"><span style="flex-grow: 1; {sans(12.5, 500, t["text"])}">Completeness</span>'
            f'<span style="{sans(12.5, 500, t["text"])} {TNUM}">86 <span style="color: {t["text3"]}; font-weight: 400;">/ 100</span></span></div>'
            f'<div style="position: relative;">{progress(t, 86)}<span style="position: absolute; left: 60%; top: -3px; width: 1px; height: 12px; background: {t["text3"]};"></span><span style="position: absolute; left: 80%; top: -3px; width: 1px; height: 12px; background: {t["text3"]};"></span></div>'
            f'<div style="position: relative; height: 14px;">'
            f'<span style="position: absolute; left: 60%; transform: translateX(-50%); {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase;">Publish 60</span>'
            f'<span style="position: absolute; left: 80%; transform: translateX(-50%); {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase;">Gallery 80</span></div></div>')
    progressb = block('Progress', chal + comp)

    def day(letter, state, name):
        bar = (lamp(t, 14) if state == 'lit' else f'<span aria-hidden="true" style="width: 14px; height: 3px; border-radius: 1px; background: {t["frozen"]};"></span>' if state == 'frozen' else '')
        look = (s_ctrl(t) if state != 'none' else f'background: transparent; border: 1px dashed {t["line"]};')
        return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 8px;"><span role="img" aria-label="{name}: {state if state != "none" else "not lit"}" style="width: 36px; height: 32px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; {look}">{bar}</span>'
                f'<span style="{sans(11, 400, t["text3"])}">{letter}</span></div>')
    streak = block('Streak days', f'<div style="display: flex; gap: 8px;">{day("M", "lit", "Monday")}{day("T", "lit", "Tuesday")}{day("W", "frozen", "Wednesday")}{day("T", "lit", "Thursday")}{day("F", "lit", "Friday")}{day("S", "none", "Saturday")}{day("S", "none", "Sunday")}</div>'
                   f'<div style="display: flex; gap: 16px; {sans(11.5, 400, t["text3"])}"><span>lit</span><span>frozen</span><span>not lit</span></div>')

    vrow = (f'<div style="display: grid; grid-template-columns: 96px 28px minmax(0, 1fr) 40px; align-items: center; gap: 12px; min-height: 56px; border-bottom: 1px solid {t["hair"]};">'
            f'<span>{pill(t, "REBUILD", t["cats"]["agents"])}</span>{avatar(t, "KO")}<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">'
            f'<span style="{sans(12.5, 400, t["text2"])}">@kofi rebuilt <a href="#" style="color: {t["text"]}; font-weight: 500; text-decoration: none;">Call notes</a> →</span>'
            f'<span style="display: flex; align-items: center; gap: 8px;"><span style="{sans(12.5, 500, t["text"])}">Sales call summariser</span>{pill(t, "28 reproduced", t["green"], t["green_bg"])}<span style="{sans(11.5, 400, t["text3"])}">5 days ago, on haiku-4.5</span></span></div>'
            f'<span style="text-align: right; {sans(11.5, 400, t["text3"])} {TNUM}">18m</span></div>')
    cols = ['Build', 'AI models', 'Sessions', 'Prompts', 'AI turns', 'Engagement']
    th = ''.join(f'<span role="columnheader" style="{sans(11.5, 500, t["text3"])} {"text-align: right;" if i > 1 else ""}">{c}</span>' for i, c in enumerate(cols))
    trow = (f'<div role="table" aria-label="Builds" style="display: flex; flex-direction: column;"><div role="row" style="display: grid; grid-template-columns: minmax(0, 2.4fr) 1.4fr .7fr .7fr .7fr 1fr; gap: 12px; padding: 8px 0; border-bottom: 1px solid {t["hair"]};">{th}</div>'
            f'<div role="row" style="display: grid; grid-template-columns: minmax(0, 2.4fr) 1.4fr .7fr .7fr .7fr 1fr; gap: 12px; align-items: center; min-height: 48px; border-bottom: 1px solid {t["hair"]};">'
            f'<span role="cell" style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"><span style="{sans(12.5, 500, t["text"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Pull request reviewer for small teams</span><span style="{sans(11.5, 400, t["text3"])}">by @kofi</span></span>'
            f'<span role="cell" style="display: flex; gap: 4px; align-items: center;">{tag(t, "Opus 5.5")}<span style="{sans(11.5, 400, t["text3"])}">+2</span></span>'
            + ''.join(f'<span role="cell" style="text-align: right; {sans(12.5, 400, t["text"])} {TNUM}">{v}</span>' for v in ['4', '24', '102'])
            + f'<span role="cell" style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">{sparkline(t, [1,0,2,1,3,2,2,4,3,5,4,6,5,7], 48, 16, t["green"])}<span style="{sans(12.5, 400, t["text"])} {TNUM}">52</span></span></div></div>')
    rows = block('Rows · visitors’ book and dashboard table', vrow + trow, span=2)

    def ev(time, kind, text, color, last=False):
        line = '' if last else f'<span aria-hidden="true" style="position: absolute; left: 3px; top: 16px; bottom: -8px; width: 1px; background: {t["line"]};"></span>'
        return (f'<div style="position: relative; display: grid; grid-template-columns: 8px 48px minmax(0, 1fr); gap: 12px; align-items: baseline; padding-bottom: 16px;">{line}'
                f'<span aria-hidden="true" style="width: 7px; height: 7px; box-sizing: border-box; border-radius: 50%; background: {color}; box-shadow: 0 0 0 3px {t["surface"]}; position: relative; top: 1px;"></span>'
                f'<span style="{sans(12, 400, t["text3"])} {TNUM}">{time}</span><span style="display: flex; flex-direction: column; gap: 4px;"><span style="{sans(10.5, 500, color)} letter-spacing: .06em; text-transform: uppercase;">{kind}</span>'
                f'<span style="{sans(12.5, 500, t["text"])}">{text}</span></span></div>')
    timeline = block('Timeline', ev('11:40', 'breakage', 'Failed on euro totals', t['red']) + ev('26:30', 'deploy', 'Running on the shared inbox', t['green'], True))

    statcard = (f'<div style="{s_card(t)} display: flex; flex-direction: column; gap: 12px;">{card_head(t, "This week’s challenges", "Resets Monday 00:00 UTC", icon_link(t, "chev", "Open this week", boxed=False, size=24), level=3)}'
                f'{chal}</div>')
    cardb = block('Card', statcard)

    grid = (f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 48px; row-gap: 32px;">'
            f'{buttons}{segments}{fields}{tagsb}{framedb}{progressb}{rows}{streak}{timeline}{cardb}</div>')
    head = (f'<div style="display: flex; align-items: flex-end; gap: 24px; padding-bottom: 24px; margin-bottom: 8px;"><div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1;">'
            f'<h1 style="margin: 0; {sans(28, 500, t["text"])} letter-spacing: -0.03em;">Components</h1><p style="margin: 0; {sans(13, 400, t["text2"])}">Every label and state below is the site’s own.</p></div></div>')
    hdr = f'<div style="margin: -48px -64px 32px; border-bottom: 1px solid {t["hair"]}; background: {t["frame"]}; border-radius: 10px 10px 0 0;">{header(t, "Home")}</div>'
    return page(t, 'Components' if dark else 'Components, Noon', board_shell(t, hdr + head + grid), 1440, 1180, fluid=False)

# --- Home, Gallery and Activity ------------------------------------------------

def main_open(extra=''):
    return f'<main style="padding: 24px {PAD_X} 48px; display: flex; flex-direction: column; gap: 24px; {extra}">'

def wall(t, w=400, h=232):
    """The hero wall: a well with a dot grid, a picture rail and six framed works. One is lit."""
    frames = [(24, 56, 92, 60, 0), (140, 40, 118, 80, 1), (278, 60, 92, 58, 0), (52, 144, 70, 54, 0), (156, 148, 100, 56, 0), (282, 140, 68, 66, 0)]
    out = []
    for x, y, fw, fh, lit in frames:
        out.append(f'<span style="position: absolute; left: {x}px; top: {y}px;">{framed(t, fw, fh, lit=bool(lit))}</span>')
    cone = ('rgba(245,203,76,.10)' if t['key'] == 'dark' else 'rgba(245,203,76,.16)')
    return (f'<div aria-hidden="true" style="position: relative; width: {w}px; max-width: 100%; height: {h}px; flex-shrink: 0; overflow: hidden; {s_well(t)} '
            f'background-image: radial-gradient({t["dot"]} 1px, transparent 1px); background-size: 16px 16px;">'
            f'<span style="position: absolute; left: 12px; right: 12px; top: 16px; height: 1px; background: {t["line"]};"></span>'
            f'<span style="position: absolute; left: 132px; top: 32px; width: 134px; height: 110px; clip-path: polygon(40% 0, 60% 0, 100% 100%, 0 100%); background: linear-gradient({cone}, rgba(245,203,76,0));"></span>'
            + ''.join(out) + '</div>')

def home(t):
    dark = t['key'] == 'dark'
    hero = f'''<section aria-label="Home" style="display: flex; flex-direction: column; gap: 24px;">
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 12px;">
            {seg(t, ["Following", "Everyone"], 1, "Whose builds")}
            <span style="flex-grow: 1;"></span>
            <span style="display: inline-flex; align-items: center; gap: 8px; {sans(12, 400, t["text2"])} {TNUM}">{lamp(t, 10)}702 builds lit today</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 32px;">
            <div style="flex: 1 1 320px; display: flex; flex-direction: column; gap: 24px;">
              <h1 style="margin: 0; display: flex; flex-direction: column; {sans(44, 500, t["text"])} letter-spacing: -0.04em; line-height: 1.04;">
                <span>Every AI build,</span>
                <span style="padding-left: 48px; display: inline-flex; align-items: center; gap: 12px;">hung with {logo(t, 30)}</span>
                <span style="padding-left: 24px;">its proof.</span>
              </h1>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">{btn(t, "Enter the gallery", "primary", 32, tag="a")}{btn(t, "How proof works", "secondary", 32, tag="a")}</div>
            </div>
            {wall(t)}
          </div>
        </section>'''

    kinds = {'build': ('BUILD', t['amber']), 'rebuild': ('REBUILD', t['cats']['agents']), 'note': ('REPRO NOTE', t['green']), 'bounty': ('BOUNTY', t['red'])}
    rows = [
        ('build', 'MA', '@maya hung', 'Invoice triage agent', '41 reproduced', '3 days ago, on sonnet-4.5', '2m', 0),
        ('rebuild', 'KO', '@kofi rebuilt Call notes →', 'Sales call summariser', '28 reproduced', '5 days ago, on haiku-4.5', '18m', 1),
        ('note', 'AD', '@ada ran Research digest on haiku-4.5 · “worked first try, slow on long PDFs”', 'Research digest', '9 reproduced', '2 weeks ago, on sonnet-4.5', '41m', 0),
        ('bounty', 'RE', '@ren opened an ask · currency tolerance · £150', 'Meeting notes to tasks', '17 reproduced', '9 days ago, on opus-4.1', '1h', 0),
        ('build', 'IN', '@ines hung', 'Bug report triage', '34 reproduced', '2 days ago, on sonnet-4.5', '2h', 0),
    ]
    rr = []
    for k, ini, who, title, count, fresh, when, hi in rows:
        lab, ink = kinds[k]
        bg = f'background: {t["inset"]}; margin: 0 -12px; padding: 0 12px; border-radius: 6px; border-bottom-color: transparent;' if hi else ''
        rr.append(f'''<div style="display: grid; grid-template-columns: 96px 24px minmax(0, 1fr) 56px 32px; align-items: center; gap: 12px; min-height: 60px; border-bottom: 1px solid {t["hair"]}; {bg}">
              <span>{pill(t, lab, ink)}</span>{avatar(t, ini)}
              <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                <span style="{sans(12.5, 400, t["text2"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{who}</span>
                <span style="display: flex; align-items: center; gap: 8px; min-width: 0;"><a href="#" style="{sans(13, 500, t["text"])} text-decoration: none; white-space: nowrap;">{title}</a>{pill(t, count, t["green"], t["green_bg"])}{lamp(t)}<span style="{sans(11.5, 400, t["text3"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{fresh}</span></span>
              </div>
              {framed(t, 56, 36, lit=bool(hi), pad=3)}
              <span style="text-align: right; {sans(11.5, 400, t["text3"])} {TNUM}">{when}</span>
            </div>''')
    book = f'''<section aria-labelledby="book-h" style="display: flex; flex-direction: column; gap: 8px;">
          {card_head(t, "The visitors’ book", "Builds, rebuilds, reproduction notes and asks · newest first", seg(t, ["All", "Builds", "Rebuilds", "Notes", "Asks"], 0, "Show"), hid="book-h")}
          <div style="display: flex; flex-direction: column; margin-top: 8px; border-top: 1px solid {t["hair"]};">{"".join(rr)}</div>
        </section>'''

    def stat(label, n, unit, lit=False):
        return (f'<div style="display: flex; flex-direction: column; gap: 8px;"><span style="display: inline-flex; align-items: center; gap: 8px; {sans(12, 400, t["text2"])}">{lamp(t) if lit else ""}{label}</span>'
                f'<span style="display: flex; align-items: baseline; gap: 6px;"><span style="{sans(24, 500, t["text"])} letter-spacing: -0.02em; {TNUM}">{n}</span><span style="{sans(12, 400, t["text2"])}">{unit}</span></span></div>')
    counts = (f'<section aria-label="Run counts" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-bottom: 24px; border-bottom: 1px solid {t["hair"]};">'
              f'{stat("Reproduced today", "48", "runs", True)}{stat("This week", "312", "runs reported")}</section>')
    ch = [('Run three builds you haven’t run before', '1 / 3 · +90 xp', 33, t['lamp_bar']), ('Solve a gap', '0 / 1 · +150 xp', 0, t['lamp_bar']), ('Re-confirm one of your stale builds', '1 / 1 · done', 100, t['green'])]
    chal = ''.join(f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 0; {"border-top: 1px solid " + t["hair"] + ";" if i else ""}"><div style="display: flex; align-items: baseline; gap: 8px;">'
                   f'<span style="flex-grow: 1; {sans(12.5, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])} {TNUM} white-space: nowrap;">{m}</span></div>{progress(t, p, c, 4)}</div>'
                   for i, (a, m, p, c) in enumerate(ch))
    challenges = (f'<section style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid {t["hair"]};">'
                  f'{card_head(t, "This week’s challenges", "Resets Monday 00:00 UTC", icon_link(t, "chev", "Open this week"))}<div>{chal}</div></section>')

    def day(letter, state, name):
        bar = (lamp(t, 14) if state == 'lit' else f'<span style="width: 14px; height: 3px; border-radius: 1px; background: {t["frozen"]};"></span>' if state == 'frozen' else '')
        look = (s_ctrl(t) if state != 'none' else f'background: transparent; border: 1px dashed {t["line"]};')
        lab = {'lit': 'lit', 'frozen': 'frozen', 'none': 'not lit'}[state]
        return (f'<div style="flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 8px;"><span role="img" aria-label="{name}: {lab}" style="width: 100%; height: 32px; box-sizing: border-box; display: inline-flex; '
                f'align-items: center; justify-content: center; border-radius: 6px; {look}">{bar}</span><span style="{sans(11, 400, t["text3"])}">{letter}</span></div>')
    week = [('M', 'lit', 'Monday'), ('T', 'lit', 'Tuesday'), ('W', 'frozen', 'Wednesday'), ('T', 'lit', 'Thursday'), ('F', 'lit', 'Friday'), ('S', 'none', 'Saturday'), ('S', 'none', 'Sunday')]
    streak = (f'<section style="display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid {t["hair"]};">{card_head(t, "12-day streak", "one frozen day used")}'
              f'<div style="display: flex; gap: 6px;">{"".join(day(*d) for d in week)}</div></section>')
    nx = [('Support reply drafter', 'SAME TOOL · SONNET-4.5', [2,3,2,4,3,5,4,6,5,7]), ('Sales call summariser', 'REBUILT FROM ONE YOU RAN', [1,2,2,1,3,2,4,3,3,5]), ('Bug report triage', 'MORE FROM @INES', [3,2,4,3,3,5,4,4,6,5])]
    nrows = ''.join(f'<a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 52px; text-decoration: none; {"border-top: 1px solid " + t["hair"] + ";" if i else ""}">'
                    f'<span style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0;"><span style="{sans(12.5, 500, t["text"])}">{a}</span><span style="{sans(10.5, 500, t["text3"])} letter-spacing: .04em;">{why}</span></span>'
                    f'{sparkline(t, v, 56, 16, t["text2"])}</a>' for i, (a, why, v) in enumerate(nx))
    where = f'<section style="display: flex; flex-direction: column; gap: 8px;">{card_head(t, "Where next", "From what you ran this week")}<div>{nrows}</div></section>'

    body = f'''{header(t, "Home")}
  {surface_open(t)}
    {main_open()}
      {crumb(t, ["Home"])}
      <div style="display: flex; flex-wrap: wrap; gap: 48px; align-items: flex-start;">
        <div style="flex: 999 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 40px;">
          {hero}
          {book}
        </div>
        <aside style="flex: 1 1 300px; max-width: 340px; min-width: 0; display: flex; flex-direction: column; gap: 24px; padding-left: 32px; border-left: 1px solid {t["hair"]};">
          {counts}{challenges}{streak}{where}
        </aside>
      </div>
    </main>
    {footer(t)}
  </div>'''
    return page(t, 'Home' if dark else 'Home, Noon', body, 1440, 1040)


def gallery(t):
    dark = t['key'] == 'dark'
    def navitem(label, count, on=False):
        look = s_ctrl(t) if on else 'background: transparent; border: 1px solid transparent;'
        cur = ' aria-current="true"' if on else ''
        return (f'<button type="button"{cur} style="height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border-radius: 6px; {look} {sans(13, 500, t["text"] if on else t["text2"])} text-align: left;">'
                f'<span style="flex-grow: 1;">{label}</span><span style="{sans(11.5, 400, t["text3"])} {TNUM}">{count}</span></button>')
    labs = ''.join(f'<button type="button" style="height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border-radius: 6px; background: transparent; border: 0; {sans(12.5, 400, t["text2"])} text-align: left;">'
                   f'{mark(t, n, 18)}'
                   f'<span style="flex-grow: 1;">{n}</span><span style="{sans(11.5, 400, t["text3"])} {TNUM}">{c}</span></button>'
                   for l, n, c in [('A', 'Anthropic', 7), ('O', 'OpenAI', 4), ('G', 'Google', 3), ('X', 'xAI', 1), ('D', 'DeepSeek', 1)])
    rep = ''.join(f'<button type="button" aria-pressed="false" style="height: 30px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border-radius: 6px; background: transparent; border: 0; {sans(12.5, 400, t["text2"])} text-align: left;">'
                  f'<span style="flex-grow: 1;">{n}</span><span style="{sans(11.5, 400, t["text3"])} {TNUM}">{c}</span></button>' for n, c in [('Active this month', 6), ('Built over 3+ sessions', 4)])
    side = f'''<aside style="flex: 1 1 208px; max-width: 224px; min-width: 0; box-sizing: border-box; padding-right: 24px; border-right: 1px solid {t["hair"]}; display: flex; flex-direction: column; gap: 24px;">
          <div style="display: flex; flex-direction: column; gap: 4px;"><span style="{sans(14, 500, t["text"])}">Gallery</span><span style="{sans(12, 400, t["text2"])}">How builds were made</span></div>
          <nav aria-label="Dashboard" style="display: flex; flex-direction: column; gap: 2px;">{navitem("Builds", 10, True)}{navitem("Models", 12)}{navitem("Makers", 10)}</nav>
          <div role="group" aria-label="Labs" style="display: flex; flex-direction: column; gap: 2px;">{eyebrow(t, "Labs", "padding: 0 8px 6px;")}{labs}</div>
          <div role="group" aria-label="Reporting" style="display: flex; flex-direction: column; gap: 2px;">{eyebrow(t, "Reporting", "padding: 0 8px 6px;")}{rep}</div>
          <div style="display: flex; align-items: center; gap: 12px;">{btn(t, "Connect a tool")}<a href="#" style="{sans(12.5, 500, t["text2"])} text-decoration: none;">Help</a></div>
          <div style="{s_inset(t)} display: flex; flex-direction: column; gap: 12px;"><div style="display: flex; flex-direction: column; gap: 4px;"><span style="{sans(12.5, 500, t["text"])}">2 drafts</span><span style="{sans(12, 400, t["text2"])}">Waiting to be finished</span></div>
            <a href="#" style="{sans(12.5, 500, t["text"])} text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">Open drafts</a></div>
        </aside>'''

    menus = ''.join(f'<button type="button" aria-haspopup="menu" style="height: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0 8px 0 12px; border-radius: 6px; {s_ctrl(t)} {sans(12.5, 400, t["text2"])} white-space: nowrap;">'
                    f'{lab} <span style="color: {t["text"]}; font-weight: 500;">{val}</span>{glyph("chevd", t["text3"])}</button>'
                    for lab, val in [('Sort by', 'Engagement'), ('AI model', 'All models'), ('Made for', 'Any'), ('Last activity', 'Any time')])
    data = [
      ['CV tailored to a job ad','dana',['GPT-6 Astra'],1,4,10,74,[0,1,2,2,3,4,3,5,6,4,7,8,9,11],'Oct 5','Reproduced on GPT-6 Astra'],
      ['Pull request reviewer for small teams','kofi',['Opus 5.5','Sonnet 5.5','DeepSeek V4 Pro'],4,24,102,52,[1,0,2,1,3,2,2,4,3,5,4,6,5,7],'Oct 4','Reproduced on Opus 5.5'],
      ['Photo renamer by date taken','maria',['Sonnet 5.5','Opus 5.5'],2,14,50,44,[0,0,1,0,1,1,0,2,1,0,2,1,3,2],'Oct 4','Reproduced on Sonnet 5.5'],
      ['Monthly budget from a bank export','tomas',['Gemini 4 Argon'],2,9,26,25,[0,1,0,2,1,1,2,0,1,3,1,0,2,1],'Sep 21','Reproduced on Gemini 4 Argon'],
      ['Receipt photos to an expenses sheet','sam',['GPT-6.1 Sol'],1,6,15,15,[0,0,0,1,0,2,1,0,0,1,0,1,0,0],'Sep 12','Published'],
      ['Inbox triage for a small shop','priya',['Sonnet 5.5','Gemini 3.8 Flash','GPT-5.6'],5,31,140,11,[2,1,1,2,0,1,1,0,2,1,0,1,1,1],'Sep 28','Reproduced on Sonnet 5.5'],
      ['Lesson plan from a curriculum objective','ines',['Haiku 5.5'],2,12,33,8,[1,0,0,1,0,0,1,0,0,0,1,0,0,0],'Aug 30','Reproduced on Haiku 5.5'],
      ['Meeting notes to actions','leo',['Grok 4.7','Opus 5'],3,15,49,7,[0,1,0,0,1,0,0,0,1,0,0,0,0,0],'Aug 14','Rebuilt by @kofi'],
      ['Recipe scaler with shopping list','amara',['Gemini 3.8 Flash','Sonnet 5.5'],2,8,21,4,[0,0,0,0,0,0,0,0,1,0,0,0,0,0],'Jul 19','Published'],
      ['Tenancy agreement checker','ruth',['Opus 5.5','GPT-6 Luna'],6,38,171,3,[0,0,0,0,0,0,0,0,0,0,0,0,0,0],'Jun 30','Reproduced on Opus 5.5'],
    ]
    COLS = 'grid-template-columns: minmax(0, 2.6fr) minmax(0, 1.7fr) 64px 64px 64px 80px 72px minmax(0, 1.5fr) 28px;'
    def checkbox(on, label):
        look = (f'background: {t["primary"]}; border: 1px solid {t["primary"]};' if on else f'background: {t["well"]}; border: 1px solid {t["ctrl_border"]};')
        mark = glyph('check', t['primary_text'], 12, 1.8) if on else ''
        return (f'<label style="position: relative; width: 16px; height: 16px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; {look}">'
                f'<input type="checkbox" aria-label="{label}" {"checked" if on else ""} style="position: absolute; inset: 0; margin: 0; opacity: 0;">{mark}</label>')
    hd = ['Build', 'AI models', 'Sessions', 'Prompts', 'AI turns', 'Engagement', 'Activity', 'Last activity']
    head = (f'<div role="row" style="display: grid; {COLS} gap: 12px; align-items: center; height: 36px; border-bottom: 1px solid {t["hair"]};">'
            f'<span role="columnheader" style="display: flex; align-items: center; gap: 12px; {sans(11.5, 500, t["text3"])}">{checkbox(False, "Select all builds")}Build</span>'
            + ''.join(f'<span role="columnheader" style="{sans(11.5, 500, t["text3"])} {"text-align: right;" if 2 <= i <= 5 else ""}">{c}</span>' for i, c in enumerate(hd) if i)
            + '<span role="columnheader" aria-label="Actions"></span></div>')
    body_rows = []
    for i, (title, handle, models, s, p, tt, e, series, date, what) in enumerate(data):
        sel = i == 1
        bg = f'background: {t["inset"]};' if sel else ''
        mt = ''.join(model_tag(t, m) for m in models[:2]) + (f'<span style="{sans(11.5, 400, t["text3"])}">+{len(models) - 2}</span>' if len(models) > 2 else '')
        total = sum(series)
        body_rows.append(
            f'<div role="row" style="display: grid; {COLS} gap: 12px; align-items: center; height: 48px; padding: 0 8px; margin: 0 -8px; border-radius: 6px; border-bottom: 1px solid {t["hair"] if not sel else "transparent"}; {bg}">'
            f'<span role="cell" style="display: flex; align-items: center; gap: 12px; min-width: 0;">{checkbox(sel, "Select " + title)}<span style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">'
            f'<span style="{sans(12.5, 500, t["text"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{title}</span><span style="{sans(11.5, 400, t["text3"])}">by @{handle}</span></span></span>'
            f'<span role="cell" style="display: flex; align-items: center; gap: 4px; min-width: 0; overflow: hidden;"><span style="{sans(12, 500, t["text"])} {TNUM} padding-right: 4px;">{len(models)}</span>{mt}</span>'
            + ''.join(f'<span role="cell" style="text-align: right; {sans(12.5, 400, t["text"])} {TNUM}">{v}</span>' for v in [s, p, tt, e])
            + f'<span role="cell" style="display: flex; justify-content: flex-end;">{sparkline(t, series, 56, 16, t["green"] if total else t["bar_mid"], f"{total} engagements over 14 weeks")}</span>'
            f'<span role="cell" style="display: flex; flex-direction: column; gap: 2px; min-width: 0;"><span style="{sans(12, 500, t["text"])} {TNUM}">{date}</span><span style="{sans(11.5, 400, t["text3"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{what}</span></span>'
            f'<span role="cell">{icon_btn(t, "chev", "Open details for " + title, boxed=False, size=24)}</span></div>')
    table = f'<div style="overflow-x: auto;"><div role="table" aria-label="Builds" style="min-width: 880px; display: flex; flex-direction: column;">{head}{"".join(body_rows)}</div></div>'
    tog_on = f'background: {t["ctrl_on"]}; border: 1px solid {t["ctrl_border"]}; box-shadow: {t["ctrl_shadow"]}; color: {t["text"]};'
    foot = (f'<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 16px; border-top: 1px solid {t["hair"]};">'
            f'<span style="flex-grow: 1; {sans(12, 400, t["text2"])} {TNUM}"><span style="color: {t["text"]}; font-weight: 500;">10</span> builds in view · <span style="color: {t["text"]}; font-weight: 500;">1</span> selected</span>'
            f'<button type="button" aria-pressed="true" style="height: 28px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 6px; {tog_on} {sans(12, 400)}">Sum of prompts <span style="font-weight: 500; {TNUM}">161</span></button>'
            f'<button type="button" aria-pressed="false" style="height: 28px; padding: 0 12px; border-radius: 6px; background: transparent; border: 1px solid transparent; {sans(12, 400, t["text2"])}">Avg sessions per build</button>'
            f'<span aria-disabled="true" style="padding: 0 12px; {sans(12, 400, t["text3"])}">+ Add calculation</span></div>')
    content = f'''<section aria-labelledby="dash-h" style="flex: 999 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
            <h1 id="dash-h" style="margin: 0; {sans(20, 500, t["text"])} letter-spacing: -0.015em;">Builds</h1>{tag(t, "All models")}
            <span style="flex-grow: 1;"></span>{search(t, "Search builds, makers, models", "Search the gallery", "240px", kbd=None, h=28)}{seg(t, ["Feed", "Dashboard"], 1, "Gallery view")}
          </div>
          {tabs(t, ["Builds", "Models", "Makers"], 0, "Dashboard tabs")}
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">{menus}<span style="flex-grow: 1;"></span>{btn(t, "Export")}</div>
          {table}
          {foot}
        </section>'''
    body = f'''{header(t, "Gallery")}
  {surface_open(t)}
    {main_open()}
      {crumb(t, ["Home", "Gallery"])}
      <div style="display: flex; flex-wrap: wrap; gap: 32px; align-items: flex-start;">{side}{content}</div>
    </main>
    {footer(t)}
  </div>'''
    return page(t, 'Gallery dashboard' if dark else 'Gallery dashboard, Noon', body, 1440, 900)


def activity(t):
    dark = t['key'] == 'dark'
    INK = dict(reproduced=t['green'], rebuilt=t['cats']['agents'], solution=t['text'], solved=t['amber'], published=t['amber'], comment=t['text2'], reply=t['text2'], like=t['text2'], follow=t['text2'])
    def row(kind, ini, who, title, detail, when, unread):
        dot = lamp(t, 8) if unread else '<span style="width: 8px;"></span>'
        badge = f'<span aria-hidden="true" style="position: absolute; right: -2px; bottom: -2px; width: 8px; height: 8px; border-radius: 2px; background: {INK[kind]}; box-shadow: 0 0 0 2px {t["surface"]};"></span>'
        tl = f' <a href="#" style="color: {t["text"]}; font-weight: 500; text-decoration: none;">{title}</a>' if title else ''
        det = f'<span style="{sans(12.5, 400, t["text2"])}">{detail}</span>' if detail else ''
        thumb = framed(t, 48, 32, pad=3) if title else '<span></span>'
        return (f'<div style="display: grid; grid-template-columns: 8px 28px minmax(0, 1fr) 48px 32px; align-items: center; gap: 12px; min-height: 56px; border-bottom: 1px solid {t["hair"]};">'
                f'{dot}<span style="position: relative; display: inline-flex;">{avatar(t, ini, 28)}{badge}</span>'
                f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;"><span style="{sans(13, 400, t["text2"] if not unread else t["text"])}">{who}{tl}</span>{det}</div>'
                f'{thumb}<span style="text-align: right; {sans(11.5, 400, t["text3"])} {TNUM}">{when}</span></div>')
    groups = [
        ('Today', [('reproduced', 'AD', '@ada ran', 'Invoice triage agent', 'it worked', '12m', True), ('rebuilt', 'KO', '@kofi rebuilt', 'Invoice triage agent', '', '1h', True),
                   ('solution', 'TO', '@tomo posted a solution to your bounty on', 'Meeting notes to tasks', '', '3h', True)]),
        ('Yesterday', [('solved', 'IN', '@ines accepted your solution on', 'Bug report triage', '', '1d', False), ('comment', 'LE', '@lee commented on', 'Support reply drafter', 'does it handle attachments?', '1d', False),
                       ('follow', 'SA', '@sam started following you', '', '', '1d', False), ('like', 'RE', '@ren liked', 'Invoice triage agent', '', '1d', False)]),
    ]
    gl = ''.join(f'<section style="display: flex; flex-direction: column;"><h2 style="margin: 0; padding-bottom: 8px; border-bottom: 1px solid {t["hair"]}; {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase;">{d}</h2>'
                 + ''.join(row(*r) for r in rows) + '</section>' for d, rows in groups)
    left = f'''<section aria-labelledby="act-h" style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 32px;">
          <div style="display: flex; align-items: flex-end; gap: 16px;">
            <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;"><h1 id="act-h" style="margin: 0; {sans(20, 500, t["text"])} letter-spacing: -0.015em;">Activity</h1>
              <p style="margin: 0; display: flex; align-items: center; gap: 8px; {sans(12, 400, t["text2"])}">3 unread · live {lamp(t)}</p></div>
            {btn(t, "Mark all read")}
          </div>
          {gl}
        </section>'''
    # chart
    import math
    n, W, H, mark = 90, 300, 120, 46
    vals = [max(4, (30 + 10 * math.sin(i / 4) + 6 * math.sin(i / 1.7)) if i < mark else (58 + 9 * math.sin(i / 5) + 5 * math.sin(i / 1.9))) for i in range(n)]
    pts = [(i * W / (n - 1), H - v / 80 * (H - 12)) for i, v in enumerate(vals)]
    line = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    area = line + f' {W},{H} 0,{H}'
    mx, my = pts[mark]
    grid = ''.join(f'<line x1="0" x2="{W}" y1="{y}" y2="{y}" stroke="{t["hair"]}" stroke-width="1" stroke-dasharray="2 3"></line>' for y in (24, 60, 96))
    chart = f'''<svg role="img" aria-label="Runs of your builds, last 90 days" width="100%" height="{H}" viewBox="0 0 {W} {H}" preserveAspectRatio="none" style="display: block; overflow: visible;">
              {grid}
              <polygon points="{area}" fill="{t["green"]}" fill-opacity="{.07 if dark else .08}"></polygon>
              <polyline points="{line}" fill="none" stroke="{t["green"]}" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"></polyline>
              <line x1="{mx:.1f}" x2="{mx:.1f}" y1="0" y2="{H}" stroke="{t["amber"]}" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"></line>
            </svg>'''
    dotpos = f'left: calc({mx / W * 100:.2f}% - 4px); top: {my - 4:.1f}px;'
    kinds = [('reproduced', 18), ('rebuilt', 6), ('solution', 4), ('solved', 2), ('comment', 11), ('reply', 5), ('like', 23), ('follow', 7), ('published', 3)]
    kl = ''.join(f'<button type="button" aria-pressed="false" style="height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 8px; margin: 0 -8px; border-radius: 6px; background: transparent; border: 0; {sans(12.5, 400, t["text2"])} text-align: left;">'
                 f'<span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 2px; background: {INK[k]};"></span><span style="flex-grow: 1;">{k}</span><span style="{sans(12, 400, t["text3"])} {TNUM}">{c}</span></button>' for k, c in kinds)
    aside = f'''<aside style="flex: 1 1 300px; max-width: 340px; min-width: 0; display: flex; flex-direction: column; gap: 24px; padding-left: 32px; border-left: 1px solid {t["hair"]};">
          <section aria-label="People this week" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-bottom: 24px; border-bottom: 1px solid {t["hair"]};">
            <div style="display: flex; flex-direction: column; gap: 8px;"><span style="{sans(12, 400, t["text2"])}">This week</span><span style="display: flex; align-items: baseline; gap: 6px;"><span style="{sans(24, 500, t["text"])} letter-spacing: -0.02em; {TNUM}">41</span></span><span style="{sans(12, 400, t["text2"])}">people ran your builds</span></div>
            <div style="display: flex; flex-direction: column; gap: 8px;"><span style="display: inline-flex; align-items: center; gap: 8px; {sans(12, 400, t["text2"])}">{lamp(t)}Listening</span><span style="{sans(13, 500, t["text"])}">live</span></div>
          </section>
          <section style="display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid {t["hair"]};">
            {card_head(t, "Runs of your builds", "Last 90 days · dashed line: your rebuild went live")}
            <div style="position: relative;">{chart}<span aria-hidden="true" style="position: absolute; {dotpos} width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; background: {t["surface"]}; border: 1.5px solid {t["amber"]};"></span></div>
          </section>
          <section style="display: flex; flex-direction: column; gap: 8px;"><h2 style="margin: 0; {sans(13.5, 500, t["text"])}">Show me</h2><div role="group" aria-label="Show me" style="display: flex; flex-direction: column;">{kl}</div></section>
        </aside>'''
    body = f'''{header(t, None, bell_current=True)}
  {surface_open(t)}
    {main_open()}
      {crumb(t, ["Home", "Activity"])}
      <div style="display: flex; flex-wrap: wrap; gap: 48px; align-items: flex-start;">{left}{aside}</div>
    </main>
    {footer(t)}
  </div>'''
    return page(t, 'Activity' if dark else 'Activity, Noon', body, 1440, 1000)

# --- The build page, List and Map ----------------------------------------------

STEP4 = ('Build the homepage from this copy and this palette. Follow CLAUDE.md. Stack: Next.js with the App Router and Tailwind, no other UI libraries. '
         'One page, app/page.tsx, with its parts in components/home/. Hero: the full first screen. The hero line from the copy, set large in the display font. '
         'The opening hours under it in a smaller line. One button, "See today’s bakes", that scrolls to the first section.')

def num_tile(t, n, size=24):
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; '
            f'border-radius: 6px; {s_ctrl(t)} {mono(11, t["text"])} {TNUM}">{n}</span>')

def group_head(t, head, meta, level=3, mk=None):
    lead = mark(t, mk, 20) if mk else f'<span aria-hidden="true" style="width: 6px; height: 6px; border-radius: 1px; background: {t["text3"]};"></span>'
    return (f'<div style="display: flex; align-items: center; gap: 8px; padding-top: 8px;">{lead}'
            f'<h{level} style="margin: 0; {sans(13, 500, t["text"])} white-space: nowrap;">{head}</h{level}><span style="{sans(12, 400, t["text3"])} white-space: nowrap;">{meta}</span>'
            f'<span style="flex-grow: 1; height: 1px; background: {t["hair"]};"></span></div>')

def result_window(t, w=304, h=176):
    dark = t['key'] == 'dark'
    fr = ('background: linear-gradient(#2A2A2E, #1F1F22); border: 1px solid #333338; border-top-color: #3C3C42; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 1px 1px rgba(0,0,0,.55), 0 16px 32px -12px rgba(0,0,0,.7);'
          if dark else 'background: #FFFFFF; border: 1px solid #D9D9D9; box-shadow: 0 1px 2px rgba(20,20,18,.06), 0 16px 32px -14px rgba(20,20,18,.22);')
    i1, i2, i3 = (('rgba(255,255,255,.3)', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.05)') if dark else ('rgba(20,20,18,.55)', 'rgba(20,20,18,.18)', 'rgba(20,20,18,.05)'))
    chrome = 'rgba(255,255,255,.16)' if dark else 'rgba(20,20,18,.14)'
    return (f'<div role="img" aria-label="Bakery homepage · Result" style="position: absolute; left: calc(50% - {w // 2}px); top: 64px; width: {w}px; height: {h}px; box-sizing: border-box; border-radius: 6px; {fr} overflow: hidden;">'
            f'<div style="height: 20px; display: flex; gap: 4px; align-items: center; padding: 0 8px;"><span style="width: 4px; height: 4px; border-radius: 50%; background: {chrome};"></span><span style="width: 4px; height: 4px; border-radius: 50%; background: {chrome};"></span><span style="width: 4px; height: 4px; border-radius: 50%; background: {chrome};"></span><span style="margin-left: 8px; width: 96px; height: 8px; border-radius: 2px; background: {i3};"></span></div>'
            f'<div style="position: absolute; left: 6px; right: 6px; top: 22px; bottom: 6px; border-radius: 3px; background: {t["paper"]}; padding: 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;">'
            f'<div style="display: flex; justify-content: space-between; align-items: center;"><span style="width: 40px; height: 4px; background: {i1};"></span><span style="display: flex; gap: 8px;"><span style="width: 16px; height: 2px; background: {i2};"></span><span style="width: 16px; height: 2px; background: {i2};"></span><span style="width: 16px; height: 2px; background: {i2};"></span></span></div>'
            f'<span style="margin-top: 8px; width: 152px; height: 6px; background: {i1};"></span><span style="width: 112px; height: 2px; background: {i2};"></span>'
            f'<span style="width: 48px; height: 12px; border-radius: 2px; background: {t["lamp"]};"></span>'
            f'<div style="margin-top: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;"><span style="height: 24px; border-radius: 2px; background: {i3};"></span><span style="height: 24px; border-radius: 2px; background: {i3};"></span><span style="height: 24px; border-radius: 2px; background: {i3};"></span></div></div></div>')

def dock(t, items=('Copy for AI', 'Download', 'Rebuild'), link='Lineage', extra=''):
    return (f'<div style="display: inline-flex; border-radius: 6px; {s_ctrl(t)} overflow: hidden; {extra}">'
            + ''.join(f'<button type="button" style="height: 28px; padding: 0 12px; background: transparent; border: 0; {"border-left: 1px solid " + t["ctrl_border"] + ";" if i else ""} {sans(12.5, 500, t["text"])}">{x}</button>' for i, x in enumerate(items))
            + (f'<a href="#" style="height: 28px; display: inline-flex; align-items: center; padding: 0 12px; border-left: 1px solid {t["ctrl_border"]}; {sans(12.5, 500, t["text"])} text-decoration: none;">{link}</a>' if link else '')
            + '</div>')

def needs(t, title_size=13.5):
    rows = [('Tools and models', [('ChatGPT', 'GPT-6 Astra · step 1', 0), ('Claude', 'Opus 5.5 · step 2', 0), ('Gemini', 'Gemini 4 Argon · step 3', 0), ('Claude Code', 'Sonnet 5.5 · steps 4–5', 0), ('Vercel', 'an account · step 5', 0)]),
            ('Files', [('CLAUDE.md', 'step 4 · 1.2 KB', 1)]), ('Time', [('4 sessions over 3 days', '3–6 Oct', 0)])]
    out = []
    for label, rs in rows:
        rr = ''.join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-bottom: 1px solid {t["hair"]};">{mark(t, a, 28) if label == "Tools and models" else ""}<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
                     f'<span style="{sans(13, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></div>{btn(t, "Download", tag="a", h=26) if dl else ""}</div>' for a, b, dl in rs)
        out.append(f'<div style="display: flex; flex-direction: column;"><h3 style="margin: 0; padding-bottom: 8px; border-bottom: 1px solid {t["hair"]}; {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase;">{label}</h3>{rr}</div>')
    return (f'<div style="display: flex; flex-direction: column; gap: 4px;"><h2 id="need-h" style="margin: 0; {sans(title_size, 500, t["text"])}">What you need</h2><p style="margin: 0; {sans(12, 400, t["text2"])}">to repeat this build</p></div>'
            + ''.join(out) + f'<p style="margin: 0; {sans(12, 400, t["text2"])} line-height: 18px;">Copy for AI copies all 5 steps in order, with each new chat and paste-in written out.</p>')


def build_list(t):
    dark = t['key'] == 'dark'
    cone = 'rgba(245,203,76,.10)' if dark else 'rgba(245,203,76,.18)'
    hero = f'''<section aria-labelledby="build-title" style="flex: 999 1 640px; min-width: 0; {s_card(t, "0")} overflow: hidden;">
          <div style="position: relative; height: 280px; background-color: {t["well"]}; background-image: radial-gradient({t["dot"]} 1px, transparent 1px); background-size: 16px 16px; border-bottom: 1px solid {t["card_border"]};">
            <span aria-hidden="true" style="position: absolute; left: calc(50% - 20px); top: 24px; width: 40px; height: 3px; border-radius: 1px; background: {t["lamp_bar"]}; box-shadow: {t["lamp_glow"]};"></span>
            <div aria-hidden="true" style="position: absolute; left: calc(50% - 192px); top: 27px; width: 384px; height: 240px; clip-path: polygon(44.8% 0, 55.2% 0, 100% 100%, 0 100%); background: linear-gradient({cone}, rgba(245,203,76,0));"></div>
            {result_window(t)}
            <span style="position: absolute; left: 16px; top: 16px;">{tag(t, "workflow")}</span>
            {dock(t, extra="position: absolute; right: 16px; top: 12px;")}
          </div>
          <div style="display: flex; align-items: center; gap: 16px; padding: 16px;">
            <span aria-hidden="true" style="width: 44px; height: 44px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; {s_ctrl(t)}">{logo(t, 24)}</span>
            <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
              <h1 id="build-title" style="margin: 0; {sans(20, 500, t["text"])} letter-spacing: -0.015em;">Bakery homepage</h1>
              <p style="margin: 0; max-width: 680px; {sans(13, 400, t["text2"])} line-height: 20px;">A homepage for a neighbourhood bakery, from brand brief to live site, made across four AI tools.</p>
              <p style="margin: 0; {sans(12, 400, t["text3"])}">made by <a href="#" style="color: {t["text2"]}; text-decoration: none;">@maya</a></p>
            </div>
          </div>
        </section>'''
    details = ''.join(hrow(t, k, v, last=(i == 5)) for i, (k, v) in enumerate([('Made for', 'small shops'), ('Made with', '4 tools'), ('Setup', '£0'), ('Monthly', '£0'), ('First result', '1 hr'), ('Needs', 'Vercel')]))
    repro = f'''<section aria-labelledby="repro-h" style="flex: 1 1 300px; max-width: 340px; min-width: 0; display: flex; flex-direction: column; gap: 20px;">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            {eyebrow(t, "Reproduction", tagname="h2", attrs='id="repro-h"')}
            <div style="display: flex; align-items: baseline; gap: 8px;"><span style="{sans(32, 500, t["text"])} letter-spacing: -0.03em; {TNUM}">12</span><span style="{sans(13, 400, t["text2"])}">ran it</span><span style="flex-grow: 1;"></span><span style="{sans(12, 400, t["text3"])}">last 9 Oct</span></div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">{pill(t, "12 reproduced", t["green"], t["green_bg"])}{lamp(t)}<span style="{sans(12, 400, t["text2"])}">last confirmed working 3 days ago, on sonnet-4.5</span></div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">{btn(t, "I ran this and it worked", "primary", 36, extra="width: 100%;")}
            <p style="margin: 0; {sans(12, 400, t["text2"])} line-height: 18px;">Your run relights the lamp and records the model you used.</p></div>
          <div style="{s_card(t, "4px 16px")}">{details}</div>
          <div style="{s_card(t)} display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: baseline;"><span style="flex-grow: 1; {sans(13, 500, t["text"])}">Completeness</span><span style="{sans(13, 500, t["text"])} {TNUM}">92 <span style="color: {t["text3"]}; font-weight: 400;">/ 100</span></span></div>
            <div role="img" aria-label="Completeness" style="position: relative;">{progress(t, 92)}<span style="position: absolute; left: 60%; top: -3px; width: 1px; height: 12px; background: {t["text3"]};"></span><span style="position: absolute; left: 80%; top: -3px; width: 1px; height: 12px; background: {t["text3"]};"></span></div>
            <div aria-hidden="true" style="position: relative; height: 14px;"><span style="position: absolute; left: 60%; transform: translateX(-50%); {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;">Publish 60</span><span style="position: absolute; left: 80%; transform: translateX(-50%); {sans(10.5, 500, t["text3"])} letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;">Gallery 80</span></div>
            <p style="margin: 0; padding-top: 12px; border-top: 1px solid {t["hair_card"]}; {sans(12, 400, t["text2"])}">Next: add a screenshot of the order form.</p>
          </div>
        </section>'''

    def step(n, title, text, untitled=False, clamp=False, words='', paste=None, attach=False, same=''):
        tc = t['text2'] if untitled else t['text']
        clamp_css = 'display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;' if clamp else ''
        more = (f'<div style="display: flex; align-items: center; gap: 12px; padding-left: 36px;"><button type="button" style="height: 24px; padding: 0; background: none; border: 0; {sans(12.5, 500, t["text"])} text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">Read all of it</button>'
                f'<span style="{sans(11.5, 400, t["text3"])} {TNUM}">{words}</span></div>') if clamp else ''
        pz = ''
        if paste or attach:
            rows = ''.join(f'<div style="display: flex; align-items: center; gap: 8px; min-height: 32px;"><span style="{sans(12.5, 400, t["text2"])}">{w}</span>{chip_ref(t, ti)}</div>' for w, ti in (paste or []))
            if attach:
                rows += (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 32px;"><span style="{sans(12.5, 400, t["text2"])}">attach</span>{chip_ref(t, "CLAUDE.md")}<span style="flex-grow: 1;"></span>{btn(t, "Download", tag="a", h=26)}</div>')
            pz = f'<div style="margin-left: 36px; {s_inset(t, "8px 12px")} display: flex; flex-direction: column;">{eyebrow(t, "Paste in", "padding: 4px 0;")}{rows}</div>'
        sm = f'<p style="margin: 0; padding-left: 36px; {sans(12, 400, t["text3"])}">{same}</p>' if same else ''
        return (f'<article style="{s_card(t)} display: flex; flex-direction: column; gap: 12px;">'
                f'<div style="display: flex; align-items: center; gap: 12px;">{num_tile(t, n)}<h4 style="margin: 0; flex-grow: 1; {sans(14, 500, tc)} letter-spacing: -0.005em;">{title}</h4>{btn(t, "Copy", h=26)}</div>'
                f'<p style="margin: 0; padding-left: 36px; {sans(13.5, 400, t["text"])} line-height: 22px; {clamp_css}">{text}</p>{more}{pz}{sm}</article>')
    groups = [
        ('New chat in ChatGPT', 'GPT-6 Astra · session 1 · 3 Oct', [step('1', 'Brand brief', 'Write a one-page brand brief for a neighbourhood bakery called Crumb. Warm, plain, no clichés. Cover who comes in, what they buy, and how the shop should sound.')]),
        ('New chat in Claude', 'Opus 5.5 · session 2 · 4 Oct', [step('2', 'Homepage copy', 'Write homepage copy from this brief: a hero line, three sections and opening hours. Keep every section under 80 words.', paste=[('what step 1 gave you', 'Brand brief')])]),
        ('New chat in Gemini', 'Gemini 4 Argon · session 3 · 4 Oct', [step('3', 'Palette', 'Suggest a five-colour palette for a warm bakery brand. Give hex values and say what each one is for.')]),
        ('New chat in Claude Code', 'Sonnet 5.5 · session 4 · 6 Oct', [step('4', 'Build the homepage', STEP4, clamp=True, words='99 words', paste=[('what step 2 gave you', 'Homepage copy'), ('what step 3 gave you', 'Palette')], attach=True),
                                                                      step('5', 'Prompt 5', 'Deploy it to Vercel and give me the link.', untitled=True, same='Send in the same chat as step 4')]),
    ]
    gl = ''.join(f'<div style="display: flex; flex-direction: column; gap: 8px;">{group_head(t, h, m, mk=h.replace("New chat in ", ""))}{"".join(s)}</div>' for h, m, s in groups)
    result = (f'<div style="display: flex; flex-direction: column; gap: 8px;">{group_head(t, "Result", "")}<div style="{s_card(t)} display: flex; align-items: center; gap: 12px;">'
              f'<span aria-hidden="true" style="width: 24px; height: 24px; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: {t["green_bg"]}; color: {t["green"]};">{glyph("check", t["green"], 14, 1.6)}</span>'
              f'<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><span style="{sans(11.5, 400, t["text3"])}">Result</span><a href="#" style="{sans(14, 500, t["text"])} text-decoration: none;">crumb-bakery.vercel.app</a></div>'
              f'<span style="{sans(12, 400, t["text3"])}">from step 5</span></div></div>')
    lower = f'''<div style="display: flex; flex-wrap: wrap; gap: 48px; align-items: flex-start;">
        <section aria-label="The build" style="flex: 999 1 640px; min-width: 0; display: flex; flex-direction: column; gap: 16px;">
          {tabs(t, ["The build", "Watch it get built", "Understand it", "Where it broke"], 0, "Build")}
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">{seg(t, ["List", "Map"], 0, "View")}<span style="{sans(12, 400, t["text2"])} {TNUM}">4 sessions · 5 prompts · 1 file · 3–6 Oct</span><span style="flex-grow: 1;"></span><span style="{sans(12, 400, t["text3"])}">copy each step into the chat it names</span></div>
          {gl}
          {result}
        </section>
        <aside aria-labelledby="need-h" style="flex: 1 1 300px; max-width: 340px; min-width: 0; display: flex; flex-direction: column; gap: 16px; padding-left: 32px; border-left: 1px solid {t["hair"]};">{needs(t)}</aside>
      </div>'''
    body = f'''{header(t, "Gallery")}
  {surface_open(t)}
    {main_open("gap: 32px;")}
      {crumb(t, ["Home", "Gallery", "Bakery homepage"])}
      <div style="display: flex; flex-wrap: wrap; gap: 48px; align-items: flex-start;">{hero}{repro}</div>
      {lower}
    </main>
    {footer(t)}
  </div>'''
    return page(t, 'Build page' if dark else 'Build page, Noon', body, 1440, 1780)


def map_box_style(t, x, y, w, h=None, sel=False, dim=False):
    if t['key'] == 'dark':
        look = 'background: linear-gradient(#232327, #1E1E21); border: 1px solid #303035; box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.45);'
        if sel:
            look = f'background: linear-gradient(#29292D, #222226); border: 1px solid {t["sel_border"]}; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 20px -6px rgba(0,0,0,.6);'
    else:
        look = 'background: #FFFFFF; border: 1px solid #D9D9D9; box-shadow: 0 1px 2px rgba(20,20,18,.06);'
        if sel:
            look = f'background: #FFFFFF; border: 1px solid {t["sel_border"]}; box-shadow: 0 0 0 1px {t["sel_border"]}, 0 8px 20px -8px rgba(20,20,18,.25);'
    hh = f' height: {h}px;' if h else ''
    return (f'position: absolute; left: {x}px; top: {y}px; width: {w}px;{hh} box-sizing: border-box; padding: 0; text-align: left; display: flex; flex-direction: column; border-radius: 6px; '
            f'{look} font-family: {SANS}; color: {t["text"]};' + (' ' + t['dim'] if dim else ''))

def in_dot(t, kind='on'):
    if kind == 'sug':
        return f'<span aria-hidden="true" style="position: absolute; left: -4px; top: 7px; width: 6px; height: 6px; box-sizing: border-box; border-radius: 1px; background: {t["well"]}; border: 1px dashed {t["text2"]};"></span>'
    c = t['text'] if kind == 'on' else t['text3']
    return f'<span aria-hidden="true" style="position: absolute; left: -4px; top: 7px; width: 6px; height: 6px; border-radius: 1px; background: {c};"></span>'

def out_dot(t, on=True, top=11):
    if on:
        return f'<span aria-hidden="true" style="position: absolute; right: -4px; top: {top}px; width: 6px; height: 6px; border-radius: 1px; background: {t["text"]};"></span>'
    return f'<span aria-hidden="true" style="position: absolute; right: -4px; top: {top}px; width: 6px; height: 6px; box-sizing: border-box; border-radius: 1px; background: {t["well"]}; border: 1px solid {t["text3"]};"></span>'

def lane(t, name, sub, top, h, w, dashed=False, mk=None):
    bd = f'1px dashed {t["line"]}' if dashed else f'1px solid {t["hair"]}'
    bg = 'transparent' if dashed else ('rgba(255,255,255,.018)' if t['key'] == 'dark' else 'rgba(20,20,18,.018)')
    return (f'<div style="position: absolute; left: 0; top: {top}px; width: {w}px; height: {h}px; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; gap: 2px; border-radius: 6px; background: {bg}; border: {bd};">'
            f'<span style="display: flex; align-items: center; gap: 6px; {sans(12, 500, t["text"])}">{mark(t, mk, 16) if mk else ""}{name}</span><span style="{sans(11, 400, t["text3"])} max-width: 100px; line-height: 14px;">{sub}</span></div>')

def wires_svg(t, w, h, paths):
    strong = f'stroke="{t["text"]}" stroke-opacity=".7"'
    dim = f'stroke="{t["text3"]}" stroke-opacity=".45"'
    out = ''.join(f'<path d="{d}" fill="none" {strong if k == "on" else dim} stroke-width="1.2"{" stroke-dasharray=\"4 4\"" if k == "sug" else ""}></path>' for d, k in paths)
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true" style="position: absolute; left: 0; top: 0;">{out}</svg>'

def map_well(t, w, h, inner):
    return (f'<div role="group" aria-label="Map" style="overflow: auto; padding: 16px; {s_well(t)} background-image: radial-gradient({t["dot"]} 1px, transparent 1px); background-size: 16px 16px;">'
            f'<div style="position: relative; width: {w}px; height: {h}px;">{inner}</div></div>')

def build_map(t):
    dark = t['key'] == 'dark'
    W, H = 516, 744
    lanes = (lane(t, 'Session 1', 'ChatGPT', 24, 104, W, mk='ChatGPT') + lane(t, 'Session 2', 'Claude', 136, 136, W, mk='Claude') + lane(t, 'Session 3', 'Gemini', 280, 100, W, mk='Gemini')
             + lane(t, 'Session 4', 'Claude Code', 388, 256, W, mk='Claude Code') + lane(t, 'Files', '', 652, 88, W, dashed=True))
    dates = ''.join(f'<span style="position: absolute; left: {x}px; top: 0; {sans(10.5, 500, t["text3"])} letter-spacing: .06em;">{d}</span>' for x, d in [(104, '3 OCT'), (240, '4 OCT'), (376, '6 OCT')])
    def box(n, title, inputs, text, words, x, y, w, sel=False, dim=False, out=True, untitled=False):
        ins = ''.join(f'<span style="position: relative; height: 18px; display: flex; align-items: center; padding: 0 12px; {sans(11, 400, t["text"])}">{in_dot(t, "on" if not dim else "off")}{i}</span>' for i in inputs)
        tc = t['text2'] if untitled else t['text']
        num = '' if untitled else f'<span style="{mono(10.5, t["text3"])}">{n}</span>'
        txt = f'<span style="padding: 0 12px; {sans(11, 400, t["text2"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{text}</span>' if text else ''
        wd = f'<span style="padding: 0 12px 8px; {sans(10.5, 400, t["text3"])} {TNUM}">{words}</span>' if words else '<span style="height: 8px;"></span>'
        cnt = len(inputs)
        lab = (f'Prompt {n}, ' + ('' if untitled else title + ', ') + f'{cnt} input' + ('' if cnt == 1 else 's'))
        return (f'<button type="button" aria-pressed="{"true" if sel else "false"}" aria-label="{lab}" style="{map_box_style(t, x, y, w, sel=sel, dim=dim)} gap: 4px;">'
                f'<span style="display: flex; align-items: center; gap: 8px; height: 28px; padding: 0 12px; min-width: 0;">{num}<span style="{sans(12, 500, tc)} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{title}</span></span>'
                f'{ins}{txt}{wd}{out_dot(t, not dim) if out else ""}</button>')
    boxes = (box('1', 'Brand brief', [], 'Write a one-page brand brief for a…', '28 words', 96, 36, 128, dim=True)
             + box('2', 'Homepage copy', ['Output of 1'], 'Write homepage copy from this bri…', '20 words', 232, 148, 128)
             + box('3', 'Palette', [], 'Suggest a five-colour palette for…', '19 words', 232, 292, 128)
             + box('4', 'Build the homepage', ['Output of 2', 'Output of 3', 'CLAUDE.md'], 'Build the homepage from this copy and thi…', '99 words', 372, 400, 136, sel=True)
             + box('5', 'Prompt 5', [], 'Deploy it to Vercel an…', '9 words', 372, 564, 136, dim=True, untitled=True)
             + f'<button type="button" aria-pressed="false" aria-label="File, CLAUDE.md" style="{map_box_style(t, 232, 664, 128)} padding: 8px 12px; gap: 2px;"><span style="{sans(10.5, 400, t["text3"])}">File</span><span style="{sans(12, 500, t["text"])}">CLAUDE.md</span>{out_dot(t, True)}</button>')
    paths = [('M224 50 C 236 50, 220 190, 232 190', 'off'), ('M360 162 C 374 162, 358 442, 372 442', 'on'), ('M360 306 C 374 306, 358 464, 372 464', 'on'),
             ('M360 678 C 374 678, 358 486, 372 486', 'on'), ('M440 541 L 440 564', 'off')]
    mapw = map_well(t, W, H, dates + lanes + wires_svg(t, W, H, paths) + boxes)

    before = [('larr', 'Paste what step 2 gave you', 'Homepage copy · Claude', 'Step 2'), ('larr', 'Paste what step 3 gave you', 'Palette', 'Step 3'), ('file', 'Attach CLAUDE.md', 'File · 1.2 KB', 'Download')]
    brows = ''.join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-bottom: 1px solid {t["hair_card"]};">{glyph(g, t["text3"])}<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
                    f'<span style="{sans(12.5, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></div><a href="#" style="{sans(12.5, 500, t["text"])} text-decoration: none;">{c}</a></div>' for g, a, b, c in before)
    drawer = f'''<aside aria-labelledby="open-h" style="width: 380px; flex-shrink: 0; {s_card(t, "20px")} display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; align-items: center;">{eyebrow(t, "Step 4 of 5", "flex-grow: 1;")}{icon_btn(t, "x", "Close", size=26)}</div>
        <h2 id="open-h" style="margin: 0; {sans(18, 500, t["text"])} letter-spacing: -0.015em;">Build the homepage</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">{model_tag(t, "New chat in Claude Code", "Claude Code")}{model_tag(t, "Sonnet 5.5")}{tag(t, "6 Oct")}</div>
        <div style="padding: 12px 16px; {s_well(t)}"><p style="margin: 0; {sans(13, 400, t["text"])} line-height: 21px; display: -webkit-box; -webkit-line-clamp: 7; -webkit-box-orient: vertical; overflow: hidden;">{STEP4}</p></div>
        <div style="display: flex; align-items: center;"><span style="flex-grow: 1; {sans(11.5, 400, t["text3"])}">99 words</span>{btn(t, "Copy", h=26)}</div>
        <div style="display: flex; flex-direction: column;"><h3 style="margin: 0; padding-bottom: 8px; border-bottom: 1px solid {t["hair_card"]}; {sans(13, 500, t["text"])}">Before you send it</h3>{brows}</div>
        <div style="display: flex; flex-direction: column;"><h3 style="margin: 0; padding-bottom: 8px; border-bottom: 1px solid {t["hair_card"]}; {sans(13, 500, t["text"])}">Then</h3>
          <div style="display: flex; align-items: center; gap: 12px; min-height: 48px;">{glyph("rarr", t["text3"])}<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><span style="{sans(12.5, 500, t["text"])}">Step 5 · Prompt 5</span><span style="{sans(11.5, 400, t["text3"])}">same chat</span></div><a href="#" style="{sans(12.5, 500, t["text"])} text-decoration: none;">Next</a></div></div>
      </aside>'''
    left = f'''<section aria-label="The build" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px;">
      {tabs(t, ["The build", "Watch it get built", "Understand it", "Where it broke"], 0, "Build")}
      <div style="display: flex; align-items: center; gap: 12px;">{seg(t, ["List", "Map"], 1, "View")}<span style="{sans(12, 400, t["text2"])} {TNUM}">4 sessions · 5 prompts · 1 file · 3–6 Oct</span><span style="flex-grow: 1;"></span><span style="{sans(12, 400, t["text3"])}">click a box to read it · Esc clears</span></div>
      <div style="display: flex; gap: 16px; align-items: flex-start;">
        <div style="width: 550px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px;">{mapw}
          <div style="display: flex; {sans(12, 400, t["text2"])}"><span style="flex-grow: 1;">Rows by session, left to right by date</span><span>Step 4 open · what it doesn't touch is dimmed</span></div></div>
        {drawer}
      </div>
    </section>'''
    right = f'<aside aria-labelledby="need-h" style="width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; padding-left: 32px; border-left: 1px solid {t["hair"]};">{needs(t)}</aside>'
    inner = f'<div style="display: flex; gap: 32px; height: 100%;">{left}{right}</div>'
    body = board_shell(t, inner).replace('padding: 48px 64px;', 'padding: 32px 48px;')
    return page(t, 'Build page map' if dark else 'Build page map, Noon', body, 1440, 1000, fluid=False)

# --- The composer: List, Map, full prompt window, Card -------------------------

def title_row(t, view):
    return f'''<div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid {t["hair"]};">
        <div style="display: flex; flex-direction: column; gap: 6px; flex-grow: 1;">
          <h1 style="margin: 0; {sans(20, 500, t["text"])} letter-spacing: -0.015em;">Bakery homepage</h1>
          <p style="margin: 0; {sans(12.5, 400, t["text2"])}">Draft · saved just now · Missing: <a href="#" style="color: {t["text"]}; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">a cover picture or video</a></p>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">{seg(t, ["List", "Map"], 0 if view == "list" else 1, "View")}<span style="{sans(11.5, 400, t["text3"])}">Map is now available</span></div>
        <div style="display: flex; gap: 8px; align-self: flex-start; padding-top: 2px;">{btn(t, "Card", h=30)}{btn(t, "Preview", h=30)}{btn(t, "Publish", "primary", 30)}</div>
      </div>'''

def details(t):
    ins = ''.join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-bottom: 1px solid {t["hair_card"]};">{glyph("larr", t["text3"])}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
                  f'<span style="{sans(12.5, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></span>{icon_btn(t, "x", "Remove " + a, boxed=False, size=24, color=t["text3"])}</div>'
                  for a, b in [('Output of 2', 'Prompt 2 · Session 1'), ('menu.pdf', 'File · opened in session 1')])
    return f'''<aside aria-labelledby="det-h" style="flex: 1 1 280px; max-width: 300px; min-width: 0; {s_card(t)} display: flex; flex-direction: column; gap: 16px;">
          <h2 id="det-h" style="margin: 0; {sans(13.5, 500, t["text"])}">Details</h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            {eyebrow(t, "Prompt 3")}
            <div style="display: flex; align-items: center; gap: 4px;"><h3 style="margin: 0; {sans(18, 500, t["text"])} letter-spacing: -0.015em;">Fix the mobile layout</h3>{icon_btn(t, "pencil", "Rename", boxed=False, size=26)}</div>
            <div style="display: flex; align-items: center; gap: 8px;">{mark(t, "Claude Code", 24)}<span style="{sans(12, 400, t["text2"])} line-height: 18px;">Session 2 · Claude Code<br>Sonnet 5.5 · 4 Mar · prompt 3 of 4</span></div>
          </div>
          <div style="padding: 12px; {s_well(t)} {sans(13, 400, t["text"])} line-height: 21px;">The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.</div>
          <div style="display: flex; align-items: center;">{btn(t, "Read all of it", h=26)}<span style="flex-grow: 1;"></span><span style="{sans(11.5, 400, t["text3"])}">19 words</span></div>
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: baseline; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid {t["hair_card"]};"><h4 style="margin: 0; {sans(12.5, 500, t["text"])}">Uses</h4><span style="{sans(11.5, 400, t["text3"])}">2</span></div>
            {ins}
            <button type="button" style="height: 36px; padding: 0; text-align: left; background: transparent; border: 0; {sans(12.5, 500, t["text2"])}">Add an input</button>
          </div>
          <div style="display: flex; flex-direction: column;">
            <div style="display: flex; align-items: baseline; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid {t["hair_card"]};"><h4 style="margin: 0; {sans(12.5, 500, t["text"])}">Goes into</h4><span style="{sans(11.5, 400, t["text3"])}">1</span></div>
            <a href="#" style="display: flex; align-items: center; gap: 12px; min-height: 44px; {sans(12.5, 500, t["text"])} text-decoration: none;">{glyph("rarr", t["text3"])}4 · Prompt 4</a>
          </div>
        </aside>'''

def menu_btn(t, label, h=28):
    return (f'<button type="button" aria-haspopup="listbox" style="height: {h}px; display: inline-flex; align-items: center; gap: 4px; padding: 0 6px 0 12px; border-radius: 6px; {s_ctrl(t)} {sans(12, 400, t["text2"])}">'
            f'{label}{glyph("chevd", t["text3"])}</button>')

def shell(t, inner):
    return f'''{header(t, "Drafts")}
  {surface_open(t)}
    {main_open()}
      {crumb(t, ["Home", "Drafts", "Bakery homepage"])}
      {inner}
    </main>
    {footer(t)}
  </div>'''


def composer(t):
    dark = t['key'] == 'dark'
    def src_group(label, count, rows, hollow=False):
        sq = (f'<span aria-hidden="true" style="width: 6px; height: 6px; box-sizing: border-box; border-radius: 1px; border: 1px solid {t["text2"]};"></span>' if hollow
              else f'<span aria-hidden="true" style="width: 6px; height: 6px; border-radius: 1px; background: {t["text2"]};"></span>')
        return (f'<div style="display: flex; flex-direction: column;"><div style="display: flex; align-items: center; gap: 8px; padding-bottom: 8px;">{sq}'
                f'<span style="flex-grow: 1; {sans(12, 500, t["text2"])}">{label}</span><span style="{sans(11.5, 400, t["text3"])}">{count}</span></div>{rows}</div>')
    sess = ''.join(f'<button type="button" aria-expanded="false" aria-label="Open session {i + 1}" style="display: flex; align-items: flex-start; gap: 8px; padding: 12px 0; background: transparent; border: 0; border-top: 1px solid {t["hair"]}; text-align: left; font-family: {SANS};">'
                   f'{glyph("chev", t["text3"])}{mark(t, a.split(" · ")[1], 20)}<span style="display: flex; flex-direction: column; gap: 2px;"><span style="{sans(13, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></span></button>'
                   for i, (a, b) in enumerate([('Session 1 · Claude', 'Opus 5.5 · 3 Mar'), ('Session 2 · Claude Code', 'Sonnet 5.5 · 4 Mar'), ('Session 3 · ChatGPT', 'typed here')]))
    files = ''.join(f'<div style="display: flex; align-items: flex-start; gap: 8px; padding: 12px 0; border-top: 1px solid {t["hair"]};">{glyph("file", t["text3"])}<span style="display: flex; flex-direction: column; gap: 2px;">'
                    f'<span style="{sans(13, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></span></div>' for a, b in [('menu.pdf', 'opened in session 1'), ('logo.png', 'added by you')])
    loose = ''.join(f'<div style="display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid {t["hair"]};">{mark(t, a, 20)}<span style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
                    f'<span style="{sans(13, 400, t["text2"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></span>{icon_btn(t, "plus", "Add session", size=26)}</div>'
                    for a, b in [('Claude', '1 Mar · 4 prompts'), ('Cursor', '28 Feb · 2 prompts')])
    sources = f'''<aside aria-labelledby="src-h" style="flex: 1 1 216px; max-width: 232px; min-width: 0; box-sizing: border-box; padding-right: 24px; border-right: 1px solid {t["hair"]}; display: flex; flex-direction: column; gap: 20px;">
          <div style="display: flex; align-items: baseline;"><h2 id="src-h" style="margin: 0; flex-grow: 1; {sans(13.5, 500, t["text"])}">Sources</h2><span style="{sans(11.5, 400, t["text3"])}">5 in build</span></div>
          {src_group("Sessions in this build", "3", sess)}
          {src_group("Files in this build", "2", files)}
          {src_group("Not in a build", "2", loose, hollow=True)}
          <div style="height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: transparent; border: 1px dashed {t["line"]}; {sans(12.5, 400, t["text2"])}">Drop sessions or files</div>
        </aside>'''

    def step(n, title, text, words, sel=False, untitled=False, uses=(), suggest=False, full=False):
        look = (f'background: {t["sel_bg"]}; border: 1px solid {t["sel_border"]}; box-shadow: {t["sel_ring"] if t["key"] == "light" else "0 8px 20px -10px rgba(0,0,0,.6)"};' if sel
                else f'background: {t["card"]}; border: 1px solid {t["card_border"]};' + (f' box-shadow: {t["card_shadow"]};' if t["card_shadow"] != 'none' else ''))
        tc = t['text2'] if untitled else t['text']
        u = ''
        if uses or suggest:
            chips = ''.join(chip_ref(t, x) for x in uses)
            sg = (f'<span style="display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 4px 0 8px; box-sizing: border-box; border-radius: 6px; border: 1px dashed {t["line"]}; {sans(11.5, 400, t["text2"])}">'
                  f'Output of 1 · Homepage copy · 38 words match<button type="button" style="height: 20px; padding: 0 8px; border-radius: 4px; {s_ctrl(t)} {sans(11.5, 500, t["text"])}">Accept</button>'
                  f'<button type="button" style="height: 20px; padding: 0 4px; background: transparent; border: 0; {sans(11.5, 400, t["text2"])}">Dismiss</button></span>') if suggest else ''
            u = f'<span style="{sans(11.5, 400, t["text3"])}">Uses</span>{chips}{sg}'
        fl = f'<a href="#" style="{sans(12, 500, t["text"])} text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">Show full prompt</a>' if full else ''
        return (f'<article style="display: flex; flex-direction: column; gap: 8px; padding: 16px; border-radius: 8px; {look}">'
                f'<div style="display: flex; align-items: center; gap: 12px;">{num_tile(t, n)}<h4 style="margin: 0; flex-grow: 1; {sans(14, 500, tc)} letter-spacing: -0.005em;">{title}</h4>'
                f'{icon_btn(t, "more", "Prompt " + n + " options", boxed=False, size=26)}</div>'
                f'<p style="margin: 0; padding-left: 36px; {sans(13.5, 400, t["text"])} line-height: 22px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{text}</p>'
                f'<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-left: 36px; min-height: 22px;">{u}<span style="flex-grow: 1;"></span>{fl}<span style="{sans(11.5, 400, t["text3"])}">{words}</span></div></article>')
    g = (f'<div style="display: flex; flex-direction: column; gap: 8px;">{group_head(t, "Session 1 · Claude", "Opus 5.5 · 3 Mar", mk="Claude")}'
         + step('1', 'Homepage copy', 'Write the homepage copy for a neighbourhood bakery called Plum &amp; Rye: warm, short sentences, opening hours, a menu of six items, and a line about the sourdough that has been on the counter since the shop opened.', '48 words', full=True)
         + step('2', 'Prompt 2', 'Turn that copy into a single HTML page with a sticky header and a menu grid.', '16 words', untitled=True, uses=['Output of 1 · Homepage copy']) + '</div>'
         + f'<div style="display: flex; flex-direction: column; gap: 8px;">{group_head(t, "Session 2 · Claude Code", "Sonnet 5.5 · 4 Mar", mk="Claude Code")}'
         + step('3', 'Fix the mobile layout', 'The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.', '19 words', sel=True, uses=['Output of 2 · Prompt 2', 'menu.pdf']) + '</div>'
         + f'<div style="display: flex; flex-direction: column; gap: 8px;">{group_head(t, "Session 3 · ChatGPT", "typed here", mk="ChatGPT")}'
         + step('4', 'Prompt 4', 'Add the opening hours as a small table under the hero.', '11 words', untitled=True, uses=['Output of 3 · Fix the mobile layout'], suggest=True) + '</div>')
    agent = f'''<article style="{s_card(t)} display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">{num_tile(t, "5")}
              <div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><span style="display: flex; align-items: center; gap: 6px; {sans(11.5, 400, t["text3"])}">Agent · {mark(t, "Opus 5.5", 14)}Opus 5.5</span><h4 style="margin: 0; {sans(14, 500, t["text"])}">Order checker</h4></div>
              {tag(t, "Repeats until a condition is met · every item has a price")}
            </div>
            <div style="margin-left: 36px; padding-left: 16px; border-left: 1px solid {t["hair_card"]}; display: flex; flex-direction: column; gap: 8px;">
              <div style="{s_inset(t)} display: flex; flex-direction: column; gap: 6px;"><div style="display: flex; align-items: center; gap: 12px;"><span style="{mono(10.5, t["text3"])}">5.1</span><span style="{sans(13, 500, t["text2"])}">Instructions</span></div>
                <p style="margin: 0; {sans(13, 400, t["text"])} line-height: 21px;">Check the menu and reply with any item that has no price.</p></div>
              <button type="button" style="height: 32px; padding: 0 12px; border-radius: 6px; background: transparent; border: 1px dashed {t["line"]}; {sans(12.5, 400, t["text2"])} text-align: left;">Add a prompt to this agent</button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding-left: 36px;"><span style="{sans(11.5, 400, t["text3"])}">Goes into</span>{pill(t, "Result", t["green"], t["green_bg"])}</div>
          </article>'''
    result = f'''<article style="{s_card(t)} display: flex; align-items: center; gap: 12px;">
            <span aria-hidden="true" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: {t["green_bg"]};">{glyph("check", t["green"], 14, 1.6)}</span>
            <div style="display: flex; flex-direction: column; gap: 2px;"><span style="{sans(11.5, 400, t["text3"])}">Result</span><span style="{sans(14, 500, t["text"])}">plumandrye.example</span><span style="{sans(11.5, 400, t["text3"])}">a link · from prompt 5</span></div>
          </article>'''
    add = f'''<div style="{s_card(t, "12px")} display: flex; flex-direction: column; gap: 12px;">
            <label style="display: block;">{sr("Add a prompt")}<textarea rows="2" placeholder="Paste or type a prompt…" style="width: 100%; box-sizing: border-box; resize: none; padding: 12px; {s_well(t)} outline: none; {sans(13.5, 400, t["text"])}"></textarea></label>
            <div style="display: flex; align-items: center; gap: 8px;">{menu_btn(t, "Typed here · pick a tool")}{menu_btn(t, "model")}<span style="flex-grow: 1;"></span>{icon_btn(t, "up", "Add the prompt", size=28)}</div>
          </div>'''
    build = f'''<section aria-labelledby="build-h" style="flex: 999 1 480px; min-width: 0; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;"><h2 id="build-h" style="margin: 0; {sans(13.5, 500, t["text"])}">Build</h2><span style="flex-grow: 1; {sans(12, 400, t["text2"])} {TNUM}">3 sessions · 5 prompts · 2 files</span>{menu_btn(t, "Add")}</div>
          <p style="margin: 0; {sans(12, 400, t["text3"])}">Click a prompt to see its details · double-click to read all of it</p>
          {g}
          {agent}
          {result}
          {add}
        </section>'''
    inner = f'''{title_row(t, "list")}
      <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">{sources}{build}{details(t)}</div>'''
    return page(t, 'Composer' if dark else 'Composer, Noon', shell(t, inner), 1440, 1480)


def composer_map(t):
    dark = t['key'] == 'dark'
    RB = f'width: 40px; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border-radius: 6px; background: transparent; border: 0; color: {t["text2"]}; {sans(10.5, 500)} {TNUM}'
    HAIR = f'<span aria-hidden="true" style="width: 28px; height: 1px; margin: 4px 0; background: {t["hair_card"]};"></span>'
    rail = f'''<div role="toolbar" aria-label="Sources" aria-orientation="vertical" style="flex: 0 0 52px; {s_card(t, "8px 0")} display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <button type="button" aria-label="Show sources" style="height: 36px; {RB}">{glyph("panel")}</button>{HAIR}
          <button type="button" aria-label="Sessions" style="height: 44px; {RB}">{glyph("layers")}3</button>
          <button type="button" aria-label="Files" style="height: 44px; {RB}">{glyph("file")}2</button>{HAIR}
          <button type="button" aria-label="Add a source" style="height: 36px; {RB}">{glyph("plus")}</button>
        </div>'''
    W, H = 796, 740
    lanes = ''.join(lane(t, n, s, y, h, W, dashed=(n == 'Files and tools'), mk=mk) for n, s, y, h, mk in
                    [('Session 1', 'Claude · Opus 5.5', 24, 148, 'Claude'), ('Session 2', 'Claude Code · Sonnet 5.5', 180, 164, 'Claude Code'), ('Typed here', 'ChatGPT', 352, 164, 'ChatGPT'), ('Agent 5', 'runs by itself', 524, 136, 'Opus 5.5'), ('Files and tools', '', 668, 64, None)])
    dates = ''.join(f'<span style="position: absolute; left: {x}px; top: 0; {sans(10.5, 500, t["text3"])} letter-spacing: .06em;">{d}</span>' for x, d in [(132, '3 MAR'), (300, '3 MAR'), (468, '4 MAR')])
    def box(num, title, label, inputs, state, text, words, x, y, sel=False, dim=False, out='off', default=False, result=False, h=None):
        rows = ''.join(f'<span style="position: relative; height: 20px; flex-shrink: 0; display: flex; align-items: center; padding: 0 12px; {sans(11, 400, t["text"] if k != "sug" else t["text2"])}">{in_dot(t, k)}{lab}</span>' for lab, k in inputs)
        st = f'<span style="height: 18px; flex-shrink: 0; display: flex; align-items: center; padding: 0 12px; {sans(10.5, 400, t["text3"])}">{state}</span>' if state else ''
        nm = (f'<span style="{sans(10.5, 500, t["green"])}">Result</span>' if result else '' if default else f'<span style="{mono(10.5, t["text3"])}">{num}</span>')
        od = '' if out is None else out_dot(t, out == 'on')
        return (f'<button type="button" aria-pressed="{"true" if sel else "false"}" aria-label="{label}" style="{map_box_style(t, x, y, 144, h=h, sel=sel, dim=dim)}">'
                f'<span style="height: 28px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 12px; min-width: 0;">{nm}<span style="{sans(12, 500, t["text2"] if default else t["text"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{title}</span></span>'
                f'{rows}{st}<span style="height: 36px; flex-shrink: 0; padding: 0 12px; {sans(11, 400, t["text2"])} line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">{text}</span>'
                f'<span style="height: 20px; flex-shrink: 0; display: flex; align-items: center; padding: 0 12px; {sans(10.5, 400, t["text3"])} {TNUM}">{words}</span>{od}</button>')
    boxes = (box('1', 'Homepage copy', 'Prompt 1, Homepage copy, 0 inputs', [], '', 'Write the homepage copy for a neighbourhood bakery called Plum &amp; Rye: warm, short sentences, opening hours, a menu of six items, and a line about the sourdough that has been on the counter since the shop opened.', '48 words', 132, 36, dim=True)
             + box('', 'Prompt 2', 'Prompt 2, 1 input', [('Output of 1', 'off')], '1 of 1 inputs accepted', 'Turn that copy into a single HTML page with a sticky header and a menu grid.', '16 words', 300, 36, out='on', default=True)
             + box('3', 'Fix the mobile layout', 'Prompt 3, Fix the mobile layout, 2 inputs', [('Output of 2', 'on'), ('menu.pdf', 'on')], '2 of 2 inputs accepted', 'The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.', '19 words', 468, 192, sel=True, out='on')
             + box('', 'Prompt 4', 'Prompt 4, 2 inputs', [('Output of 3', 'on'), ('Output of 1', 'sug')], '1 suggested', 'Add the opening hours as a small table under the hero.', '11 words', 636, 364, default=True)
             + box('', 'plumandrye.example', 'Result, plumandrye.example, 1 input', [('Output of 5', 'off')], '1 of 1 inputs accepted', '', '', 636, 536, dim=True, out=None, result=True, h=112))
    agent = (f'<button type="button" aria-pressed="false" aria-label="Agent 5, Order checker, 0 inputs" style="{map_box_style(t, 300, 536, 312, h=112, dim=True)}">'
             f'<span style="height: 28px; flex-shrink: 0; display: flex; align-items: center; padding: 0 12px; {sans(10.5, 500, t["text3"])}">Agent 5</span>'
             f'<span style="flex-grow: 1; display: flex; min-height: 0;"><span style="width: 46%; flex-shrink: 0;"></span><span style="flex-grow: 1; min-width: 0; padding: 4px 12px 8px 4px; display: flex; flex-direction: column; justify-content: center; gap: 4px;">'
             f'<span style="{sans(13.5, 500, t["text"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Order checker</span><span style="{sans(11, 400, t["text2"])}">nothing inside yet</span>'
             f'<span style="{sans(11.5, 400, t["text2"])} white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Repeats until a condition is met · every item has a price</span></span></span>{out_dot(t, False)}</button>')
    pieces = (f'<button type="button" aria-pressed="false" aria-label="Tool, Gmail" style="{map_box_style(t, 132, 676, 144, h=48, dim=True)} padding: 8px 12px; gap: 2px;"><span style="{sans(10.5, 400, t["text3"])}">Tool</span><span style="{sans(12, 500, t["text"])}">Gmail</span>{out_dot(t, False)}</button>'
              f'<button type="button" aria-pressed="false" aria-label="File, menu.pdf" style="{map_box_style(t, 300, 676, 144, h=48)} padding: 8px 12px; gap: 2px;"><span style="{sans(10.5, 400, t["text3"])}">File</span><span style="{sans(12, 500, t["text"])}">menu.pdf</span>{out_dot(t, True)}</button>')
    paths = [('M276 50 C 288 50, 288 74, 300 74', 'off'), ('M276 50 C 290 50, 286 422, 316 422 L 636 422', 'sug'), ('M444 50 C 458 50, 454 230, 468 230', 'on'),
             ('M444 690 C 458 690, 454 250, 468 250', 'on'), ('M612 206 C 626 206, 622 402, 636 402', 'on'), ('M612 550 C 624 550, 624 574, 636 574', 'off')]
    sample = f'display: inline-block; width: 24px; border-top: 1px solid {t["text2"]};'
    build = f'''<section aria-labelledby="build-h" style="flex: 999 1 560px; min-width: 0; {s_card(t)} display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;"><h2 id="build-h" style="margin: 0; {sans(13.5, 500, t["text"])}">Build</h2><span style="flex-grow: 1; {sans(12, 400, t["text2"])} {TNUM}">3 sessions · 5 prompts · 2 files</span>{menu_btn(t, "Add")}</div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; {sans(12, 400, t["text2"])}">
            <span style="display: inline-flex; align-items: center; gap: 8px;"><span aria-hidden="true" style="{sample}"></span>goes into <span style="{TNUM}">5</span></span>
            <span style="display: inline-flex; align-items: center; gap: 8px;"><span aria-hidden="true" style="{sample} border-top-style: dashed;"></span>suggested <span style="{TNUM}">1</span></span>
            <span style="flex-grow: 1;"></span><span style="{sans(12, 400, t["text3"])}">click to select · double-click to read all of it · drag from a dot to connect</span>
          </div>
          {map_well(t, W, H, dates + lanes + wires_svg(t, W, H, paths) + boxes + agent + pieces)}
          <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; {sans(12, 400, t["text2"])}"><span style="flex-grow: 1;">Rows by session, left to right by date</span><span>Prompt 3 selected · what it doesn't touch is dimmed · Esc clears</span></div>
        </section>'''
    inner = f'''{title_row(t, "map")}
      <div style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">{rail}{build}{details(t)}</div>'''
    return page(t, 'Composer map' if dark else 'Composer map, Noon', shell(t, inner), 1440, 1220)


def overlay_page(t, title, inner):
    body = (f'<div aria-hidden="true" style="position: absolute; left: 0; top: 0; width: 1440px; height: 1000px; overflow: hidden; pointer-events: none;">'
            f'<dc-import name="{dcname(t, "Composer")}" hint-size="1440px,1000px"></dc-import></div>'
            f'<div aria-hidden="true" style="position: absolute; inset: 0; background: {t["scrim"]};"></div>{inner}')
    return page(t, title, body, 1440, 1000, fluid=False)

def prompt_window(t):
    dark = t['key'] == 'dark'
    win = f'''<div role="dialog" aria-modal="true" aria-labelledby="pw-h" style="position: absolute; left: 340px; top: 96px; width: 760px; box-sizing: border-box; padding: 20px 24px 20px; display: flex; flex-direction: column; gap: 16px; border-radius: 12px; background: {t["window"]}; border: 1px solid {t["window_border"]}; box-shadow: {t["window_shadow"]};">
    <div style="display: flex; align-items: center; gap: 12px;">{eyebrow(t, "Prompt 3 of 5 · full prompt", "flex-grow: 1;", tagname="h2", attrs='id="pw-h"')}{icon_btn(t, "x", "Close", size=28)}</div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <label style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 16px; {s_well(t)}">{sr("Title")}<input value="Fix the mobile layout" style="flex-grow: 1; min-width: 0; background: transparent; border: 0; outline: none; {sans(16, 500, t["text"])} letter-spacing: -0.01em;"><span style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; color: {t["text3"]};">{glyph("pencil")}</span></label>
      <p style="margin: 0; {sans(12, 400, t["text3"])}">Title · starts as "Prompt 3" · only you can change it</p>
    </div>
    <div style="display: flex; gap: 8px;">{model_tag(t, "Sonnet 5.5")}</div>
    <label style="display: block;">{sr("Full prompt text")}<textarea style="display: block; width: 100%; height: 320px; box-sizing: border-box; resize: none; padding: 16px; {s_well(t)} border-color: {t["sel_border"] if not dark else "#4A4A50"}; outline: none; {sans(14.5, 400, t["text"])} line-height: 25px;">The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.</textarea></label>
    <div style="display: flex; align-items: center; gap: 12px;"><span style="flex-grow: 1; {sans(11.5, 400, t["text3"])}">19 words</span>{btn(t, "Copy prompt")}</div>
    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;"><span style="{sans(11.5, 400, t["text3"])}">Uses</span>{chip_ref(t, "Output of 2 · Prompt 2")}{chip_ref(t, "menu.pdf")}</div>
    <div style="display: flex; align-items: center; gap: 4px; padding-top: 16px; border-top: 1px solid {t["hair_card"]};">
      {btn(t, "← Prompt 2", "ghost", attrs='aria-label="Previous prompt: Prompt 2"')}{btn(t, "Prompt 4 →", "ghost", attrs='aria-label="Next prompt: Prompt 4"')}
      <span style="flex-grow: 1; text-align: center; {sans(12, 400, t["text3"])}">Esc closes · ← → move between prompts</span>
      {btn(t, "Done", "primary", 30)}
    </div>
  </div>'''
    return overlay_page(t, 'Full prompt window' if dark else 'Full prompt window, Noon', win)

def composer_card(t):
    dark = t['key'] == 'dark'
    LBL = sans(12.5, 500, t['text'])
    sheet = f'''<div role="dialog" aria-modal="true" aria-labelledby="card-h" style="position: absolute; right: 6px; top: 6px; bottom: 6px; width: 472px; box-sizing: border-box; display: flex; flex-direction: column; border-radius: 12px; background: {t["window"]}; border: 1px solid {t["window_border"]}; box-shadow: {t["sheet_shadow"]};">
    <div style="height: 56px; flex-shrink: 0; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 0 16px 0 24px; border-bottom: 1px solid {t["hair_card"]};">
      <h2 id="card-h" style="margin: 0; flex-grow: 1; {sans(15, 500, t["text"])}">Card</h2>{icon_btn(t, "x", "Close", size=30)}
    </div>
    <div style="flex-grow: 1; overflow: hidden; padding: 24px; display: flex; flex-direction: column; gap: 24px;">
      <section aria-labelledby="cover-h" style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 4px;"><h3 id="cover-h" style="margin: 0; {sans(13.5, 500, t["text"])}">Cover</h3><p style="margin: 0; {sans(12, 400, t["text2"])}">What people see first in the Gallery.</p></div>
        <div style="height: 216px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; background-color: {t["inset"]}; background-image: radial-gradient({t["dot"]} 1px, transparent 1px); background-size: 16px 16px; border: 1px dashed {t["line"]};">
          {glyph("image", t["text2"], 20, 1.1)}
          <span style="{sans(13, 500, t["text"])}">Drop a screenshot or a short video</span>
          <a href="#" style="{sans(12, 400, t["text2"])} text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">or browse your files</a>
        </div>
      </section>
      <label style="display: flex; flex-direction: column; gap: 8px;"><span style="{LBL}">Title</span><input value="Bakery homepage" style="height: 36px; padding: 0 12px; {s_well(t)} outline: none; {sans(13.5, 500, t["text"])}"></label>
      <label style="display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; align-items: baseline;"><span style="flex-grow: 1; {LBL}">One-line summary</span><span style="{sans(11.5, 400, t["text3"])} {TNUM}">74 / 200</span></span><textarea style="height: 80px; resize: none; padding: 8px 12px; {s_well(t)} outline: none; {sans(13.5, 400, t["text"])} line-height: 21px;">A warm homepage for a neighbourhood bakery, with opening hours and a menu.</textarea></label>
      <label style="display: flex; flex-direction: column; gap: 8px;"><span style="display: flex; align-items: baseline; gap: 8px;"><span style="{LBL}">Who it's for</span><span style="{sans(12, 400, t["text3"])}">Separate with commas</span></span><input value="small businesses" style="height: 36px; padding: 0 12px; {s_well(t)} outline: none; {sans(13.5, 400, t["text"])}"></label>
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; {sans(12.5, 400, t["text2"])}"><span>Made with</span>{model_tag(t, "Claude Code · Sonnet 5.5", "Claude Code", t["text"])}{model_tag(t, "Claude · Opus 5.5", "Claude", t["text"])}<span>from your sessions.</span><a href="#" style="color: {t["text"]}; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: {t["line"]};">Change</a></div>
      <button type="button" aria-expanded="false" style="align-self: flex-start; height: 32px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px 0 0; background: transparent; border: 0; {sans(13, 500, t["text"])}">{glyph("chev", t["text3"])}More details<span style="color: {t["text2"]}; font-weight: 400;"> (optional)</span></button>
    </div>
  </div>'''
    return overlay_page(t, 'Composer card' if dark else 'Composer card, Noon', sheet)

# --- Model marks ---------------------------------------------------------------

def model_marks(t):
    dark = t['key'] == 'dark'
    labs = [('Anthropic', 'Claude · Claude Code · Opus 5.5 · Sonnet 5.5 · Haiku 5.5'), ('OpenAI', 'ChatGPT · GPT-6 Astra · GPT-6.1 Sol · GPT-5.6 · GPT-6 Luna'),
            ('Google', 'Gemini · Gemini 4 Argon · Gemini 3.8 Flash'), ('xAI', 'Grok 4.7'), ('DeepSeek', 'DeepSeek V4 Pro'), ('Cursor', 'Cursor')]
    sizes = [14, 16, 20, 24, 28]
    def lab_row(name, products, tool=False):
        sz = ''.join(f'<span style="width: 32px; display: inline-flex; justify-content: center;">{mark(t, name, s)}</span>' for s in sizes)
        return (f'<div style="display: grid; grid-template-columns: 40px 140px minmax(0, 1fr) auto; align-items: center; gap: 16px; min-height: 56px; border-bottom: 1px solid {t["hair"]};">'
                f'{mark(t, name, 32)}<span style="{sans(13, 500, t["text"])}">{name}</span><span style="{sans(12, 400, t["text2"])}">{products}</span>'
                f'<span style="display: flex; align-items: center; gap: 8px;">{sz}</span></div>')
    size_head = ''.join(f'<span style="width: 32px; text-align: center; {sans(11, 400, t["text3"])} {TNUM}">{s}</span>' for s in sizes)
    table = (f'<div style="display: flex; flex-direction: column;"><div style="display: grid; grid-template-columns: 40px 140px minmax(0, 1fr) auto; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid {t["hair"]};">'
             f'<span></span>{eyebrow(t, "Lab")}{eyebrow(t, "Named on the boards")}<span style="display: flex; gap: 8px;">{size_head}</span></div>'
             + ''.join(lab_row(n, p) for n, p in labs)
             + lab_row('Vercel', 'a tool, not a model: a glyph in place of a letter') + lab_row('Gmail', 'a tool, not a model: a glyph in place of a letter') + '</div>')
    labs_sec = (f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "One mark per lab", "Every model and tool a build names gets its lab’s mark beside it. The site already marks labs with their initial in the Gallery; the same tile now travels everywhere a model is named.")}{table}</section>')

    # slot spec
    tile = 'background: linear-gradient(#2E2E33, #222225); border: 1px solid #38383E; border-top-color: #45454C; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 1px 1px rgba(0,0,0,.5);' if dark else 'background: #FFFFFF; border: 1px solid #D6D6D6; box-shadow: 0 1px 2px rgba(0,0,0,.08);'
    slot = (f'<div style="display: flex; align-items: center; gap: 24px;"><span style="position: relative; width: 64px; height: 64px; flex-shrink: 0; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; {tile}">'
            f'<span style="width: 38px; height: 38px; box-sizing: border-box; border: 1px dashed {t["text3"]}; border-radius: 4px;"></span></span>'
            f'<div style="display: flex; flex-direction: column; gap: 8px; {sans(12.5, 400, t["text2"])} line-height: 19px;"><span style="{sans(13, 500, t["text"])}">The slot</span>'
            f'<span>A raised tile, the same at every size. In code the provider’s official mark sits inside at 60%, centred, taken from its brand page. The boards show the initial in its place.</span>'
            f'<span>Radius 4 up to 18px, 5 up to 24px, 6 above. The mark never sits loose on the surface and never takes a coloured border.</span></div></div>')
    use = ''.join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 32px; border-bottom: 1px solid {t["hair"]};"><span style="width: 32px; {sans(12, 500, t["text"])} {TNUM}">{s}</span><span style="{sans(12, 400, t["text2"])}">{w}</span></div>'
                  for s, w in [(14, 'inside tags: AI models in the Gallery table, Made with, the prompt window'), (16, 'map lane names'), (18, 'the Gallery’s Labs list'),
                               (20, 'session group heads, Sources rows, chips'), (24, 'the Details header'), (28, 'What you need: Tools and models')])
    spec_sec = f'<section style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "Slot and sizes")}{slot}<div style="border-top: 1px solid {t["hair"]};">{use}</div></section>'

    # in place
    tool_rows = ''.join(f'<div style="display: flex; align-items: center; gap: 12px; min-height: 48px; border-bottom: 1px solid {t["hair"]};">{mark(t, a, 28)}<div style="display: flex; flex-direction: column; gap: 2px;">'
                        f'<span style="{sans(13, 500, t["text"])}">{a}</span><span style="{sans(11.5, 400, t["text3"])}">{b}</span></div></div>'
                        for a, b in [('ChatGPT', 'GPT-6 Astra · step 1'), ('Claude', 'Opus 5.5 · step 2'), ('Gemini', 'Gemini 4 Argon · step 3'), ('Claude Code', 'Sonnet 5.5 · steps 4–5'), ('Vercel', 'an account · step 5')])
    tools = f'<div style="display: flex; flex-direction: column; gap: 8px;">{eyebrow(t, "Tools and models")}<div>{tool_rows}</div></div>'
    heads = (f'<div style="display: flex; flex-direction: column; gap: 4px;">{group_head(t, "New chat in Claude Code", "Sonnet 5.5 · session 4 · 6 Oct", mk="Claude Code")}'
             f'{group_head(t, "Session 3 · ChatGPT", "typed here", mk="ChatGPT")}</div>')
    tags = (f'<div style="display: flex; flex-wrap: wrap; gap: 8px;">{model_tag(t, "Opus 5.5")}{model_tag(t, "GPT-6 Astra")}{model_tag(t, "Gemini 4 Argon")}{model_tag(t, "Grok 4.7")}'
            f'{model_tag(t, "DeepSeek V4 Pro")}{model_tag(t, "Claude Code · Sonnet 5.5", "Claude Code", t["text"])}</div>')
    chips = (f'<div style="display: flex; flex-wrap: wrap; gap: 8px;">{model_chip(t, "Claude", selected=True)}{model_chip(t, "ChatGPT")}{model_chip(t, "Gemini")}'
             f'{model_chip(t, "Claude Code")}{model_chip(t, "Cursor")}{model_chip(t, "Grok 4.7")}{model_chip(t, "DeepSeek V4 Pro")}</div>'
             f'<span style="{sans(11.5, 400, t["text3"])}">rest and selected: the selected chip takes the ink edge, never a colour</span>')
    src = (f'<div style="{s_card(t, "12px 16px")} display: flex; align-items: center; gap: 12px;">{mark(t, "Claude Code", 24)}<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;">'
           f'<span style="{sans(13, 500, t["text"])}">Session 2 · Claude Code</span><span style="{sans(11.5, 400, t["text3"])}">Sonnet 5.5 · 4 Mar · prompt 3 of 4</span></div>{pill(t, "3 prompts")}</div>')
    lane_demo = f'<div style="position: relative; height: 72px;">{lane(t, "Session 1", "ChatGPT", 0, 72, 280, mk="ChatGPT")}</div>'
    place_sec = (f'<section style="grid-column: span 2; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 48px; padding-top: 32px; border-top: 1px solid {t["hair"]};">'
                 f'<div style="display: flex; flex-direction: column; gap: 16px;">{sec_title(t, "In place")}{tools}</div>'
                 f'<div style="display: flex; flex-direction: column; gap: 24px; padding-top: 36px;">{heads}{src}{lane_demo}</div>'
                 f'<div style="display: flex; flex-direction: column; gap: 24px; padding-top: 36px;"><div style="display: flex; flex-direction: column; gap: 8px;">{eyebrow(t, "Tags")}{tags}</div>'
                 f'<div style="display: flex; flex-direction: column; gap: 8px;">{eyebrow(t, "Chips")}{chips}</div></div></section>')
    head = (f'<div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 32px; margin-bottom: 40px; border-bottom: 1px solid {t["hair"]};">'
            f'<h1 style="margin: 0; {sans(28, 500, t["text"])} letter-spacing: -0.03em;">Model marks</h1>'
            f'<p style="margin: 0; {sans(13, 400, t["text2"])}">Placeholders for the providers’ official marks, which come from their brand pages and replace the initial in code.</p></div>')
    grid = f'<div style="display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 48px 64px;">{labs_sec}{spec_sec}{place_sec}</div>'
    return page(t, 'Model marks' if dark else 'Model marks, Noon', board_shell(t, head + grid), 1440, 1180, fluid=False)


# --- the board list -----------------------------------------------------------

# file name, builder, height, title, dev page the compare harness opens
REFERENCE_BOARDS = (
    ("foundations", foundations, 1180, "Foundations", None),
    ("components", components, 1180, "Components", None),
    ("model-marks", model_marks, 1180, "Model marks", None),
    ("home", home, 1000, "Home", "/dev/kit/pages/home"),
    ("gallery-dashboard", gallery, 960, "Gallery · Dashboard", "/dev/kit/pages/gallery-dashboard"),
    ("build-list", build_list, 2300, "Build page · The build, List", "/dev/kit/pages/build-steps"),
    ("build-map", build_map, 1000, "Build page · The build, Map", "/dev/kit/pages/build-steps"),
    ("activity", activity, 960, "Activity", "/dev/kit/pages/activity"),
    ("composer-list", composer, 1560, "Composer · List", "/dev/kit/pages/sandbox"),
    ("composer-map", composer_map, 1240, "Composer · Map", "/dev/kit/pages/sandbox"),
    ("prompt-window", prompt_window, 1000, "Composer · Full prompt window", "/dev/kit/pages/sandbox"),
    ("composer-card", composer_card, 1000, "Composer · Card", "/dev/kit/pages/sandbox"),
)

LOCAL_FONTS = (
    '<style>\n@font-face{font-family:"Geist";src:url("../../fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}\n'
    '@font-face{font-family:"Geist Mono";src:url("../../fonts/GeistMono-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}\n</style>'
)


def _parts(source: str) -> tuple[str, str]:
    """The page-basics <style> and the board's markup, out of a canvas board."""
    body = source.split("<x-dc>")[1].split("</x-dc>")[0]
    helmet = re.search(r"<helmet>(.*?)</helmet>", body, re.S).group(1)
    body = re.sub(r"<helmet>.*?</helmet>", "", body, flags=re.S)
    style = re.search(r"<style>.*?</style>", helmet, re.S).group(0)
    return style, body.strip()


def standalone_board(theme: dict, builder) -> str:
    """One board as a file that opens in any browser, fonts from design/reference/fonts/."""
    source = builder(theme)
    title = re.search(r"<title>(.*?)</title>", source).group(1)
    style, body = _parts(source)
    if "<dc-import" in body:
        composer_body = _parts(composer(theme))[1]
        body = re.sub(r'<dc-import name="[A-Za-z]*Composer" hint-size="[^"]*"></dc-import>', lambda _m: composer_body, body)
    name = "dusk" if theme["key"] == "dark" else "noon"
    return (
        f'<!doctype html>\n<html lang="en" data-theme="{name}" data-look="refined">\n<head>\n<meta charset="utf-8">\n'
        f'<meta name="viewport" content="width=1440">\n<title>{title} · refined reference</title>\n{LOCAL_FONTS}\n{style}\n</head>\n<body>\n{body}\n</body>\n</html>\n'
    )


def reference_files() -> dict[str, str]:
    """Every board, both themes, plus index.json, keyed by path under design/reference/refined/."""
    files: dict[str, str] = {}
    index = []
    for theme in THEMES:
        name = "dusk" if theme["key"] == "dark" else "noon"
        for page_id, builder, height, title, dev_page in REFERENCE_BOARDS:
            files[f"{name}/{page_id}.html"] = standalone_board(theme, builder)
            entry = {"file": f"reference/refined/{name}/{page_id}.html", "kind": "refined", "theme": name, "page": page_id,
                     "width": 1440, "height": height, "title": f"{title} · {'Dusk' if name == 'dusk' else 'Noon'} · refined"}
            if dev_page:
                entry["devPage"] = dev_page
            index.append(entry)
    files["index.json"] = json.dumps(index, indent=1, ensure_ascii=False)
    return files


# =============================================================================
# The commands
# =============================================================================

# --- finding a prompt ---------------------------------------------------------


def find(key: str) -> Prompt:
    """UI-P83, ui-p83, P83, p83 and 83 all find UI-P83."""
    match = re.fullmatch(r"(?:ui-?)?p?(\d{2})", key.strip().lower())
    if match:
        wanted = f"UI-P{match.group(1)}"
        for prompt in PROMPTS:
            if prompt.id == wanted:
                return prompt
    raise SystemExit(f"There is no prompt {key!r} here. This file holds {PROMPTS[0].id} to {PROMPTS[-1].id}.")


# --- list ---------------------------------------------------------------------


def cmd_list(_args: argparse.Namespace) -> int:
    print(f"{len(PROMPTS)} prompts, one per Claude Code session, in this order.\n")
    for wave, name in WAVES.items():
        print(f"Wave {wave} · {name}")
        for prompt in PROMPTS:
            if prompt.wave == wave:
                print(f"  {prompt.id}  {prompt.title}")
                print(f"          needs first: {prompt.needs}")
        print()
    print("Nothing changes for visitors until UI-P98. UI-P99 deletes the old look; run it last, and only when you are sure.")
    return 0


# --- show ---------------------------------------------------------------------


def cmd_show(args: argparse.Namespace) -> int:
    prompt = find(args.prompt)
    if args.about:
        print(f"{prompt.id} — {prompt.title}")
        print(f"Wave {prompt.wave} · {WAVES[prompt.wave]} · needs first: {prompt.needs}\n")
        print(prompt.lead)
        return 0
    sys.stdout.write(prompt.body.rstrip("\n") + "\n")
    return 0


# --- next ---------------------------------------------------------------------


def committed_ids(repo: Path) -> set[str] | None:
    """The prompt ids with a commit on the current branch, from subjects like 'UI-P77: …'."""
    try:
        log = subprocess.run(
            ["git", "-C", str(repo), "log", "--format=%s"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return {match.group(1) for match in re.finditer(r"^(UI-P\d+)[a-z]?:", log, re.M)}


def cmd_next(args: argparse.Namespace) -> int:
    done = committed_ids(Path(args.repo))
    if done is None:
        raise SystemExit("next reads git log, so run it inside the repo or pass the repo's path.")
    for prompt in PROMPTS:
        if prompt.id in done:
            continue
        print(f"Next: {prompt.id} — {prompt.title} (needs first: {prompt.needs})\n", file=sys.stderr)
        sys.stdout.write(prompt.body.rstrip("\n") + "\n")
        return 0
    print(f"Every prompt from {PROMPTS[0].id} to {PROMPTS[-1].id} has a commit on this branch.", file=sys.stderr)
    return 0


# --- writing ------------------------------------------------------------------

RULES_HEADING = "## Rules of the road"


def index_section() -> str:
    lines = [
        f"{PROMPTS[0].id} to {PROMPTS[-1].id} re-skin the site in the refined look (`design/refined_prompts.py`). "
        "Everything is built behind `REFINED_LOOK_ENABLED`; nothing changes for visitors until UI-P98. "
        "UI-P99 is the only prompt that deletes, and it waits until the refined look has proved itself.",
        "",
    ]
    for wave, name in WAVES.items():
        lines += [f"### Refined wave {wave} — {name}", ""]
        lines += [f"- **[{p.id}]({p.filename})** — {p.title}" for p in PROMPTS if p.wave == wave]
        lines.append("")
    return "\n".join(lines) + "\n"


def all_prompts_section() -> str:
    chunks = []
    for prompt in PROMPTS:
        first, _, rest = prompt.body.partition("\n")
        chunks.append(f"## {first.lstrip('# ').strip()}\n{rest.rstrip()}\n\n---\n")
    return "\n".join(chunks)


def read(path: Path) -> str:
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def save(path: Path, text: str, dry_run: bool) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)


def put(path: Path, text: str, args: argparse.Namespace, changed: list[str], kept: list[str], label: str) -> None:
    """Write one file unless an identical one is there, or a different one is there and --force is not."""
    if path.exists():
        if read(path) == text:
            return
        if not args.force:
            kept.append(label)
            return
    save(path, text, args.dry_run)
    changed.append(label)


def write_boards(folder: Path, args: argparse.Namespace, changed: list[str], kept: list[str]) -> None:
    for name, text in reference_files().items():
        put(folder / name, text, args, changed, kept, f"{folder.as_posix()}/{name}")


GEIST_PACKAGE = "geist@1.7.2"
GEIST_FILES = {
    "package/dist/fonts/geist-sans/Geist-Variable.woff2": "Geist-Variable.woff2",
    "package/dist/fonts/geist-mono/GeistMono-Variable.woff2": "GeistMono-Variable.woff2",
    "package/LICENSE.txt": "Geist-OFL.txt",
}


def fetch_fonts(folder: Path, dry_run: bool) -> str:
    """Geist and Geist Mono (SIL OFL 1.1) out of the `geist` npm package. Nothing is installed."""
    wanted = [folder / name for name in GEIST_FILES.values()]
    if all(path.is_file() and path.stat().st_size > 0 for path in wanted):
        return "already there"
    if dry_run:
        return f"would fetch {GEIST_PACKAGE} with npm pack"
    npm = shutil.which("npm")
    if not npm:
        return "npm is not on this machine: run `npm pack geist@1.7.2` anywhere and copy the three files by hand"
    with tempfile.TemporaryDirectory() as temp:
        try:
            subprocess.run([npm, "pack", GEIST_PACKAGE, "--silent"], cwd=temp, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as error:
            return f"npm pack failed: {(error.stderr or error.stdout or '').strip()[:200]}"
        tarballs = sorted(Path(temp).glob("geist-*.tgz"))
        if not tarballs:
            return "npm pack wrote no tarball"
        folder.mkdir(parents=True, exist_ok=True)
        with tarfile.open(tarballs[0]) as archive:
            for member, name in GEIST_FILES.items():
                source = archive.extractfile(member)
                if source is None:
                    return f"{member} is not in {GEIST_PACKAGE}"
                with open(folder / name, "wb") as target:
                    shutil.copyfileobj(source, target)
    return "fetched"


def cmd_write(args: argparse.Namespace) -> int:
    repo = Path(args.repo)
    folder = repo / "design" / "prompts"
    index = folder / "00-INDEX.md"
    if not index.is_file():
        raise SystemExit(f"{index} is not there. Run this from the repo root, or pass the repo's path.")
    verb = "Would" if args.dry_run else "Did"
    changed: list[str] = []
    kept: list[str] = []

    for prompt in PROMPTS:
        put(folder / prompt.filename, prompt.body.rstrip("\n") + "\n", args, changed, kept, f"design/prompts/{prompt.filename}")

    index_text = read(index)
    if f"({PROMPTS[0].filename})" not in index_text:
        section = index_section()
        at = index_text.find(RULES_HEADING)
        index_text = (
            index_text[:at] + section + "\n" + index_text[at:] if at >= 0
            else index_text.rstrip("\n") + "\n\n" + section
        )
        save(index, index_text, args.dry_run)
        changed.append("design/prompts/00-INDEX.md (a section for the series)")

    every = folder / "ALL-PROMPTS.md"
    if every.is_file():
        every_text = read(every)
        if f"## {PROMPTS[0].id} —" not in every_text:
            save(every, every_text.rstrip("\n") + "\n\n" + all_prompts_section(), args.dry_run)
            changed.append("design/prompts/ALL-PROMPTS.md (the series at the end)")

    write_boards(repo / "design" / "reference" / "refined", args, changed, kept)
    fonts = fetch_fonts(repo / "design" / "reference" / "fonts", args.dry_run)

    if changed:
        print(f"{verb} write:")
        for name in changed:
            print(f"  {name}")
    elif not kept:
        print("Nothing to write: the repo already holds this series and its boards.")
    if kept:
        print("Left alone, because they differ from the ones here (pass --force to replace them):")
        for name in kept:
            print(f"  {name}")
    print(f"Fonts in design/reference/fonts/: {fonts}.")
    if changed and not args.dry_run:
        print("Nothing is committed. Next: python3 design/refined_prompts.py next")
    return 0


def cmd_boards(args: argparse.Namespace) -> int:
    folder = Path(args.folder)
    args.force = True
    args.dry_run = False
    changed: list[str] = []
    write_boards(folder, args, changed, [])
    print(f"Drew {len(changed)} files into {folder}." if changed else f"The boards in {folder} are up to date.")
    if not (folder.parent / "fonts" / "Geist-Variable.woff2").is_file():
        print("The boards load Geist from ../../fonts/: run the fonts command to fetch it.")
    return 0


def cmd_fonts(args: argparse.Namespace) -> int:
    folder = Path(args.repo) / "design" / "reference" / "fonts"
    print(f"Fonts in {folder}: {fetch_fonts(folder, False)}.")
    return 0


# --- the command line ---------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        prog="refined_prompts.py",
        description="The refined look: prompts UI-P77 to UI-P99 and their reference boards.",
    )
    commands = parser.add_subparsers(dest="command")

    listing = commands.add_parser("list", help="the order, and what each prompt needs first")
    listing.set_defaults(run=cmd_list)

    show = commands.add_parser("show", help="print one prompt, ready to paste into Claude Code")
    show.add_argument("prompt", help="UI-P83, P83 or 83")
    show.add_argument("--about", action="store_true", help="print what the prompt does instead of the prompt")
    show.set_defaults(run=cmd_show)

    nxt = commands.add_parser("next", help="print the first prompt with no commit on this branch yet")
    nxt.add_argument("repo", nargs="?", default=".", help="the repo (default: here)")
    nxt.set_defaults(run=cmd_next)

    write = commands.add_parser("write", help="write the prompts, the boards and the fonts into the repo")
    write.add_argument("repo", nargs="?", default=".", help="the repo (default: here)")
    write.add_argument("--dry-run", action="store_true", help="say what would change, change nothing")
    write.add_argument("--force", action="store_true", help="replace files that differ")
    write.set_defaults(run=cmd_write)

    boards = commands.add_parser("boards", help="draw only the reference boards")
    boards.add_argument("folder", nargs="?", default="design/reference/refined", help="where (default: design/reference/refined)")
    boards.set_defaults(run=cmd_boards)

    fonts = commands.add_parser("fonts", help="fetch Geist and Geist Mono into design/reference/fonts")
    fonts.add_argument("repo", nargs="?", default=".", help="the repo (default: here)")
    fonts.set_defaults(run=cmd_fonts)

    args = parser.parse_args(argv)
    if not getattr(args, "run", None):
        print(__doc__)
        return 0
    return args.run(args)


if __name__ == "__main__":
    sys.exit(main())
