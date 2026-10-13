# Token map

Every colour in `design/reference/**` resolves to one of these tokens. When porting a reference element, find its raw value here and use the token — never the raw value.

`tokens.css` is the drop-in. `tokens.json` is the machine-readable source (the key names are the mockup generator's). This file is the lookup.

| Token | Noon | Dusk | Job |
|---|---|---|---|
| `--bg` | `#E9EBE7` | `#1F1829` | base colour under the backdrop; the colour of an empty page |
| `--backdrop` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | page background: the horizon (Noon) / deep aubergine with a glow near the arc (Dusk) |
| `--ambient` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | soft light layered over --backdrop |
| `--text` | `#1A2320` | `#EEEAF4` | primary text; filled chips; the active segment |
| `--text2` | `#505A55` | `#B3ABC6` | secondary text, metadata |
| `--label` | `#505A55` | `#A59EBA` | mono eyebrow labels, counts, timestamps |
| `--on-text` | `#F8F8F6` | `#15121C` | text on a --text fill (active segment, current dock tile) |
| `--line` | `rgba(26,35,32,.15)` | `rgba(238,234,244,.14)` | control borders, chip borders, tab rule |
| `--hairline` | `rgba(26,35,32,.09)` | `rgba(238,234,244,.09)` | dividers inside panels; wall-label gutters |
| `--header` | `rgba(249,250,248,.50)` | `rgba(13,10,20,.60)` | sticky site header, footer, mobile header (with blur 16px) |
| `--header-border` | `rgba(255,255,255,.92)` | `rgba(238,234,244,.16)` | header/footer edge; raised tab edge |
| `--glass` | `rgba(255,255,255,.68)` | `rgba(31,27,45,.66)` | panels and build cards (never blurred) |
| `--glass-border` | `rgba(255,255,255,.95)` | `rgba(238,234,244,.12)` | panel and card edge |
| `--glass-2` | `rgba(255,255,255,.58)` | `rgba(238,234,244,.06)` | segmented track, secondary buttons, icon buttons, filter chips |
| `--cell` | `rgba(255,255,255,.55)` | `rgba(14,11,20,.35)` | wall-label cells |
| `--row-highlight` | `rgba(255,255,255,.85)` | `rgba(238,234,244,.10)` | the one highlighted feed row / selected list row |
| `--solid` | `#F8F8F6` | `#17131F` | opaque surfaces: part viewer, bottom sheets, rank badges bg |
| `--flat` | `#EEF0EC` | `#1B1725` | workspace panels (compose, import) — no glass |
| `--recess` | `#D7DBD5` | `#372F4A` | wells, the viewer's own turns, rare rank fill |
| `--viewer-block` | `#E9EBE7` | `#0C0A12` | left block of the part viewer's tab strip |
| `--tab` | `rgba(255,255,255,.82)` | `rgba(238,234,244,.10)` | raised tab in the part viewer |
| `--field` | `rgba(255,255,255,.72)` | `rgba(238,234,244,.07)` | inputs and search fields |
| `--media-tag` | `rgba(248,248,246,.92)` | `rgba(14,11,20,.78)` | shape tag / small badges laid over covers |
| `--plate` | `rgba(247,248,249,.72)` | `rgba(14,11,20,.62)` | frosted title plate over the build cover (blur 16px) |
| `--scrim` | `rgba(247,248,249,.35)` | `rgba(14,11,20,.55)` | gradient scrim over the Home hero image |
| `--dock` | `rgba(255,255,255,.55)` | `rgba(30,24,44,.62)` | mobile dock and the build action dock (blur 16px) |
| `--dock-border` | `rgba(255,255,255,.95)` | `rgba(238,234,244,.20)` | dock edge |
| `--dock-tile` | `rgba(255,255,255,.85)` | `rgba(238,234,244,.08)` | inactive tile inside the build action dock |
| `--action` | `#8C3B36` | `#D98C6B` | the one primary button per view; active tab underline |
| `--on-action` | `#F8F8F6` | `#241B1A` | label on --action |
| `--evidence` | `#256659` | `#86BDD3` | reproduction, 'it worked', done states |
| `--evidence-fill` | `#C8E3DC` | `rgba(134,189,211,.16)` | '41 reproduced' tag fill |
| `--on-evidence-fill` | `#1A2320` | `#86BDD3` | text on --evidence-fill |
| `--inverse-evidence-fill` | `#C8E3DC` | `#C8E3DC` | the reproduction tag on an --inverse panel (the featured build): Noon's evidence fill in both themes |
| `--on-inverse-evidence-fill` | `#1A2320` | `#1A2320` | text on --inverse-evidence-fill |
| `--lit` | `#D9A441` | `#D9A441` | the lamp: light only, never text |
| `--on-lit` | `#1A2320` | `#241B1A` | text on a lamp fill (highest rank) |
| `--lit-ink` | `#8F4309` | `#D9A441` | amber that has to be READ (the BUILD / DEPLOY labels, the ~ change glyph, the streak flame): darkened on Noon to pass 4.5:1; the reference draws these in --lit |
| `--ring-glow` | `none` | `0 0 40px rgba(217,164,65,.35)` | glow around the level / readiness ring (Dusk only) |
| `--focus-ring` | `#1A2320` | `#D9A441` | keyboard focus outline (UI-P04) |
| `--bar-base` | `#C5CAC3` | `#3A3350` | unfilled part of striped bars and facet mini-bars |
| `--tagline-chip` | `#1A2320` | `#EEEAF4` | staggered tagline chips |
| `--on-tagline-chip` | `#F8F8F6` | `#1F1B2B` | tagline text |
| `--tagline-lamp` | `#D9A441` | `#9E4B2C` | lamp of the mark inside the tagline |
| `--inverse` | `#1A2320` | `#F7F8F9` | hero composition panel and the overlapping square |
| `--on-inverse` | `#F8F8F6` | `#1B2026` | text on --inverse |
| `--on-inverse-2` | `#C5CBC7` | `#565E66` | secondary text on --inverse |
| `--orb-glass` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | glass orb fill |
| `--orb-glass-edge` | `rgba(255,255,255,.95)` | `rgba(238,234,244,.45)` | glass orb inner edge |
| `--on-orb-glass` | `#1A2320` | `#EEEAF4` | text in a glass orb |
| `--orb-solid` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | solid orb fill |
| `--on-orb-solid` | `#F8F8F6` | `#1B2026` | number in a solid orb |
| `--on-orb-solid-2` | `#C5CBC7` | `#565E66` | labels in a solid orb |
| `--arc-1` | `#8FA79B` | `#FFFFFF` | arc gradient start / Dusk core line |
| `--arc-2` | `#E3A594` | `#CBC6E4` | arc gradient middle |
| `--arc-3` | `#8C3B36` | `#D98C6B` | arc gradient end |
| `--arc-haze` | `#F1D5CB` | `#8C78C4` | the wide blurred haze behind the arc |
| `--arc-outer` | `#8FA79B` | `#CBC6E4` | the thin outer ring 12px outside the arc |
| `--shadow-float` | `0 40px 90px rgba(26,35,32,.20)` | `0 40px 100px rgba(4,3,8,.6)` | floating things: sign-in card, bottom sheets |
| `--panel-highlight` | `inset 0 1px 0 rgba(255,255,255,1)` | `inset 0 1px 0 rgba(238,234,244,.10)` | 1px top highlight added to every glass panel's box-shadow |
| `--glass-fill` | `rgba(255,255,255,.58)` | `rgba(26,21,35,.80)` | the tint under body text on a liquid-glass page panel (`.bg-glass`). Not symmetric on purpose; `.96` under reduced transparency |
| `--glass-rim` | `rgba(255,255,255,.55)` | `rgba(255,255,255,.55)` | inner rim light of a liquid-glass panel |
| `--panel-highlight-color` | `rgba(255,255,255,1)` | `rgba(238,234,244,.12)` | the colour of the 1px top highlight inside `.bg-glass::before` |
| `--glass-halo` | `0 0 21px -10px rgba(26,35,32,.18)` | `0 0 21px -8px rgba(255,255,255,.22)` | outer edge light of a liquid-glass panel, placed before `--shadow-card` |
| `--ring-track` | `rgba(27,32,38,.10)` | `rgba(238,234,244,.10)` | unfilled part of the level / readiness ring |
| `--lamp-glow` | `none` | `0 0 10px rgba(217,164,65,.6)` | glow on a lit lamp dot (Dusk only — a glow needs darkness) |
| `--picture-lamp-glow` | `none` | `0 0 14px rgba(217,164,65,.65)` | glow on a lit picture lamp (Dusk only) |
| `--picture-lamp-wash` | `rgba(255,255,255,.9)` | `rgba(217,164,65,.22)` | light cast down from the picture lamp (white on Noon, amber on Dusk; x0.45 when stale) |
| `--shadow-card` | `0 14px 30px rgba(26,35,32,.11)` | `0 18px 40px rgba(4,3,8,.35)` | panels and cards |
| `--nav-lamp-glow` | `none` | `0 0 12px rgba(217,164,65,.8)` | glow on the lamp under the current header link / above the current dock tile (Dusk only) |
| `--rank-glow` | `none` | `0 0 20px rgba(217,164,65,.5)` | glow on the highest creator-mark tile (Dusk only) |
| `--banner-scrim` | `rgba(247,248,249,.8)` | `rgba(14,11,20,.75)` | bottom-up scrim on the profile banner (0% → transparent at 70%) |
| `--inset` | `rgba(255,255,255,.7)` | `rgba(14,11,20,.4)` | small inset note inside a panel: the credit a rebuild will carry |
| `--turn` | `#FFFFFF` | `rgba(238,234,244,.05)` | the assistant's turns in the import transcript (the viewer's turns use --recess) |
| `--on-evidence` | `#FFFFFF` | `#15121C` | check mark / label on an --evidence fill (checklists, the done step chip) |
| `--secret-fill` | `rgba(242,109,109,.2)` | `rgba(242,109,109,.2)` | highlight behind a secret found in a transcript (text stays --cat-breakage) |
| `--sheet-dim` | `rgba(10,8,14,.45)` | `rgba(10,8,14,.45)` | dims the page behind a bottom sheet |
| `--shadow-square` | `0 14px 30px rgba(0,0,0,.35)` | `0 14px 30px rgba(0,0,0,.35)` | the overlapping square of a hero composition (mobile: 0 12px 26px) |
| `--shadow-dock` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | mobile dock |
| `--shadow-sheet` | `0 -20px 50px rgba(0,0,0,.35)` | `0 -20px 50px rgba(0,0,0,.35)` | bottom sheets |
| `--signin-edge` | `*(gradient — see tokens.css)*` | `*(gradient — see tokens.css)*` | the glowing inner edge of the desktop sign-in page |
| `--cat-instruction` | `#9C3E12` | `#F0865A` | part category hue: instruction (text/dots only, never fills) |
| `--cat-configuration` | `#0F6B31` | `#5CCB7C` | part category hue: configuration (text/dots only, never fills) |
| `--cat-data` | `#1D4ED8` | `#6AA1FF` | part category hue: data (text/dots only, never fills) |
| `--cat-artefact` | `#8F4309` | `#F5B83D` | part category hue: artefact (text/dots only, never fills) |
| `--cat-evidence` | `#0E635C` | `#86BDD3` | part category hue: evidence (text/dots only, never fills) |
| `--cat-narrative` | `#565B63` | `#A8A6A3` | part category hue: narrative (text/dots only, never fills) |
| `--cat-agents` | `#6D28D9` | `#A78BFA` | part category hue: agents (text/dots only, never fills) |
| `--cat-breakage` | `#B91C1C` | `#F26D6D` | part category hue: breakage (text/dots only, never fills) |
| `--cat-media` | `#BE185D` | `#F472B6` | part category hue: media (text/dots only, never fills) |

## Raw values that appear in the reference HTML and what they mean

- `#15121C` (Dusk) / `#F8F8F6` (Noon) as text on a filled control → `--on-text`.
- `#C8E3DC` with `#1A2320` on the featured build's inverse panel → `--inverse-evidence-fill` / `--on-inverse-evidence-fill` (Noon's evidence fill, kept in both themes because the panel is inverse).
- The browser strip at the top of every desktop board (tab, address bar) uses its own greys. It is the visitor's browser, drawn for context. **Never build it.**
- Cover landscapes (`data-ui="cover-fallback"`) use the six fixed skies in `tokens.json → _notes.coverFallbackSkies`. They are artwork, not theme colours, and are identical in both themes.
- Mark colours: the mark's lamp is always `--lit`; its body is `currentColor`.
- The generator's `violet` (the REBUILD / rebuilt hue) is `--cat-agents`; its `square` / `squareMark` (the overlapping square) are `--inverse` / `--on-inverse`.
- Row highlights drawn as `rgba(255,255,255,.8–.95)` (Noon) or `rgba(238,234,244,.07–.12)` (Dusk) — the selected anatomy part, unread activity rows, the selected bounty, the accepted-solution row, the highlighted feed row — are all `--row-highlight`.
- The Build page action dock (`rgba(30,26,44,.55)` / `rgba(255,255,255,.55)`, tiles `.08` / `.8`) is `--dock` / `--dock-tile` / `--dock-border`.
- Mobile only: the Home hero scrim (Noon `.45`) is `--scrim`, and the mobile title plate (`.66` / `.78`) is `--plate`. The small difference is accepted and inside the compare threshold.
- Fixed values that are the same in both themes and sit on artwork (cover skies, avatar hues, the missing window `#F7F8F9` on `rgba(14,11,20,.55)`, the orbs' neutral drop shadows `rgba(0,0,0,.25)` and inner light `rgba(255,255,255,.18)`) are written as named constants in the component that owns them, as the primitive prompts say. Nothing theme-dependent is ever a constant.
- `json` key `css` in `tokens.json` holds this whole table.

## Refined

The refined look (UI-P79 to UI-P99). Applies only under `<html data-look="refined">`; the current look is unchanged. Values live in `:root[data-theme="…"][data-look="refined"]` in `src/index.css`, `src/lib/theme/refined.ts` and `tokens.css` here. Under the current look each new name is an alias of the token a primitive reads today (`semantics.ts`).

| Token | Noon | Dusk | Current-look alias |
|---|---|---|---|
| `--frame` | `#E9E9E9` | `#0F0F10` | `var(--bg)` |
| `--surface` | `#F4F4F4` | `#19191B` | `var(--flat)` |
| `--surface-border` | `#DCDCDC` | `#232326` | `var(--hairline)` |
| `--surface-shadow` | `0 1px 2px rgba(0,0,0,.05)` | `inset 0 1px 0 rgba(255,255,255,.035)` | `var(--panel-highlight)` |
| `--module` | `#FAFAFA` | `#1E1E21` | `var(--glass)` |
| `--module-border` | `#E1E1E1` | `#29292D` | `var(--glass-border)` |
| `--module-shadow` | `0 1px 2px rgba(0,0,0,.04)` | `none` | `var(--shadow-card)` |
| `--tile` | `#EFEFEF` | `#232327` | `var(--cell)` |
| `--tile-border` | `#E2E2E2` | `#2E2E33` | `var(--hairline)` |
| `--well` | `#ECECEC` | `#141416` | `var(--field)` |
| `--well-border` | `#D9D9D9` | `#27272B` | `var(--line)` |
| `--well-shadow` | `inset 0 1px 2px rgba(0,0,0,.05)` | `inset 0 1px 1px rgba(0,0,0,.35)` | `none` |
| `--hairline` | `#E0E0E0` | `#26262A` | (existing token) |
| `--hairline-module` | `#E7E7E7` | `#2A2A2E` | `var(--hairline)` |
| `--line` | `#CFCFCF` | `#34343A` | (existing token) |
| `--text` | `#1C1C1C` | `#EDEDEF` | (existing token) |
| `--text2` | `#575757` | `#A0A0A6` | (existing token) |
| `--label` | `#666666` | `#8E8E94` | (existing token) |
| `--control` | `#FFFFFF` | `#27272B` | `var(--glass-2)` |
| `--control-border` | `#D9D9D9` | `#323237` | `var(--line)` |
| `--control-shadow` | `0 1px 2px rgba(0,0,0,.07), inset 0 -1px 0 rgba(0,0,0,.03)` | `inset 0 1px 0 rgba(255,255,255,.04), 0 1px 2px rgba(0,0,0,.35)` | `none` |
| `--control-on` | `#FFFFFF` | `#2F2F34` | `var(--tab)` |
| `--seg-track` | `#E6E6E6` | `#141416` | `var(--glass-2)` |
| `--seg-border` | `#D9D9D9` | `#27272B` | `var(--line)` |
| `--action` | `#1C1C1C` | `#EDEDEF` | (existing token) |
| `--on-action` | `#FFFFFF` | `#121214` | (existing token) |
| `--action-shadow` | `inset 0 1px 0 rgba(255,255,255,.1), 0 1px 2px rgba(0,0,0,.25)` | `inset 0 -1px 0 rgba(0,0,0,.14), 0 1px 2px rgba(0,0,0,.45)` | `none` |
| `--tag-fill` | `#E9E9E9` | `#26262A` | `var(--glass-2)` |
| `--on-tag` | `#575757` | `#A0A0A6` | `var(--text2)` |
| `--pill` | `#E6E6E6` | `#303035` | `var(--glass-2)` |
| `--on-pill` | `#333333` | `#CFCFD3` | `var(--text)` |
| `--lit` | `#E0A21A` | `#F5CB4C` | (existing token) |
| `--lit-mark` | `#F5CB4C` | `#F5CB4C` | `var(--lit)` |
| `--lamp-glow` | `none` | `0 0 6px rgba(245,203,76,.7), 0 0 14px rgba(245,203,76,.25)` | (existing token) |
| `--nav-mark` | `#1C1C1C` | `#F5CB4C` | `var(--lit)` |
| `--nav-lamp-glow` | `none` | `0 0 8px rgba(245,203,76,.55)` | (existing token) |
| `--lit-ink` | `#8F5E00` | `#E8C468` | (existing token) |
| `--evidence` | `#166F31` | `#86D193` | (existing token) |
| `--evidence-fill` | `#E1F1E5` | `rgba(134,209,147,.12)` | (existing token) |
| `--breakage` | `#C42E1C` | `#E5807F` | `var(--cat-breakage)` |
| `--breakage-fill` | `#F9E6E3` | `rgba(229,128,127,.12)` | `var(--secret-fill)` |
| `--info` | `#2563EB` | `#82A9E8` | `var(--cat-data)` |
| `--frozen` | `#3F86B5` | `#8FB8D0` | `var(--cat-data)` |
| `--selected-edge` | `#1C1C1C` | `#8E8E95` | `var(--text)` |
| `--selected-fill` | `#FFFFFF` | `#222226` | `var(--glass)` |
| `--selected-ring` | `0 0 0 1px #1C1C1C` | `0 0 0 1px #8E8E95` | `0 0 0 1px var(--text)` |
| `--scrim` | `rgba(28,28,28,.32)` | `rgba(10,10,11,.72)` | (existing token) |
| `--window` | `#FAFAFA` | `#1E1E21` | `var(--solid)` |
| `--window-border` | `#DCDCDC` | `#2E2E33` | `var(--glass-border)` |
| `--window-shadow` | `0 2px 6px rgba(0,0,0,.08), 0 32px 64px -16px rgba(0,0,0,.3)` | `inset 0 1px 0 rgba(255,255,255,.04), 0 2px 6px rgba(0,0,0,.4), 0 32px 64px -16px rgba(0,0,0,.75)` | `var(--shadow-float)` |
| `--sheet-shadow` | `-24px 0 64px -16px rgba(0,0,0,.25)` | `-24px 0 64px -16px rgba(0,0,0,.7)` | `var(--shadow-float)` |
| `--dot-grid` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.055)` | `var(--hairline)` |
| `--avatar-fill` | `#E2E2E2` | `#2C2C30` | `var(--recess)` |
| `--on-avatar` | `#333333` | `#CFCFD3` | `var(--text)` |
| `--logo-ink` | `#1C1C1C` | `#EDEDEF` | `var(--text)` |
| `--bar-base` | `#E0E0E0` | `#3A3A3F` | (existing token) |
| `--bar-mid` | `#C4C4C4` | `#55555B` | `var(--line)` |
| `--paper` | `#F1F1F1` | `#0C0C0D` | `var(--porthole)` |
| `--dim-filter` | `contrast(.42) brightness(1.32)` | `brightness(.48) saturate(.5)` | `opacity(.45)` |
| `--focus-ring` | `#2563EB` | `#8EB4F0` | (existing token) |
| `--cat-instruction` | `#C0623A` | `#E39A78` | (existing token) |
| `--cat-instruction-fill` | `rgba(192,98,58,.10)` | `rgba(227,154,120,.12)` | (existing token) |
| `--cat-configuration` | `#857A14` | `#C9C27A` | (existing token) |
| `--cat-configuration-fill` | `rgba(133,122,20,.10)` | `rgba(201,194,122,.12)` | (existing token) |
| `--cat-data` | `#2D6BE4` | `#82A9E8` | (existing token) |
| `--cat-data-fill` | `rgba(45,107,228,.10)` | `rgba(130,169,232,.12)` | (existing token) |
| `--cat-artefact` | `#A3741A` | `#D9B36C` | (existing token) |
| `--cat-artefact-fill` | `rgba(163,116,26,.10)` | `rgba(217,179,108,.12)` | (existing token) |
| `--cat-evidence` | `#23804F` | `#86D193` | (existing token) |
| `--cat-evidence-fill` | `rgba(35,128,79,.10)` | `rgba(134,209,147,.12)` | (existing token) |
| `--cat-narrative` | `#5F5F5B` | `#A0A0A6` | (existing token) |
| `--cat-narrative-fill` | `rgba(95,95,91,.10)` | `rgba(160,160,166,.12)` | (existing token) |
| `--cat-agents` | `#6B52D6` | `#A996E8` | (existing token) |
| `--cat-agents-fill` | `rgba(107,82,214,.10)` | `rgba(169,150,232,.12)` | (existing token) |
| `--cat-breakage` | `#C93E32` | `#E5807F` | (existing token) |
| `--cat-breakage-fill` | `rgba(201,62,50,.10)` | `rgba(229,128,127,.12)` | (existing token) |
| `--cat-media` | `#BE4C84` | `#E08FB4` | (existing token) |
| `--cat-media-fill` | `rgba(190,76,132,.10)` | `rgba(224,143,180,.12)` | (existing token) |
| `--bg` | `var(--frame)` | `var(--frame)` | (existing token) |
| `--backdrop` | `var(--frame)` | `var(--frame)` | (existing token) |
| `--ambient` | `linear-gradient(transparent, transparent)` | `linear-gradient(transparent, transparent)` | (existing token) |
| `--recess` | `var(--well)` | `var(--well)` | (existing token) |
| `--glass` | `var(--module)` | `var(--module)` | (existing token) |
| `--glass-2` | `var(--control)` | `var(--control)` | (existing token) |
| `--glass-border` | `var(--module-border)` | `var(--module-border)` | (existing token) |
| `--glass-hi` | `rgba(255,255,255,.6)` | `rgba(255,255,255,.04)` | (existing token) |
| `--glass-fill` | `var(--module)` | `var(--module)` | (existing token) |
| `--glass-rim` | `transparent` | `transparent` | (existing token) |
| `--glass-halo` | `0 0 0 0 transparent` | `0 0 0 0 transparent` | (existing token) |
| `--panel-highlight` | `var(--surface-shadow)` | `var(--surface-shadow)` | (existing token) |
| `--panel-highlight-color` | `transparent` | `rgba(255,255,255,.035)` | (existing token) |
| `--card-frame` | `var(--module)` | `var(--module)` | (existing token) |
| `--card-thread` | `var(--tile)` | `var(--tile)` | (existing token) |
| `--on-evidence` | `#FFFFFF` | `#121214` | (existing token) |
| `--on-evidence-fill` | `var(--evidence)` | `var(--evidence)` | (existing token) |
| `--on-lit` | `#111112` | `#111112` | (existing token) |
| `--porthole` | `var(--paper)` | `var(--paper)` | (existing token) |
| `--chrome-hi` | `#FFFFFF` | `#45454C` | (existing token) |
| `--chrome-lo` | `#D6D6D6` | `#222225` | (existing token) |
| `--on-text` | `#FFFFFF` | `#121214` | (existing token) |
| `--header` | `transparent` | `transparent` | (existing token) |
| `--header-border` | `transparent` | `transparent` | (existing token) |
| `--cell` | `var(--tile)` | `var(--tile)` | (existing token) |
| `--row-highlight` | `var(--tile)` | `var(--tile)` | (existing token) |
| `--solid` | `var(--module)` | `var(--module)` | (existing token) |
| `--flat` | `var(--surface)` | `var(--surface)` | (existing token) |
| `--viewer-block` | `var(--well)` | `var(--well)` | (existing token) |
| `--tab` | `var(--control-on)` | `var(--control-on)` | (existing token) |
| `--field` | `var(--well)` | `var(--well)` | (existing token) |
| `--media-tag` | `rgba(255,255,255,.88)` | `rgba(15,15,16,.78)` | (existing token) |
| `--plate` | `rgba(250,250,250,.84)` | `rgba(15,15,16,.62)` | (existing token) |
| `--dock` | `var(--surface)` | `var(--surface)` | (existing token) |
| `--dock-border` | `var(--surface-border)` | `var(--surface-border)` | (existing token) |
| `--dock-tile` | `var(--control)` | `var(--control)` | (existing token) |
| `--inverse` | `var(--text)` | `var(--text)` | (existing token) |
| `--on-inverse` | `#FFFFFF` | `#121214` | (existing token) |
| `--on-inverse-2` | `#BDBDBD` | `#55555B` | (existing token) |
| `--inverse-evidence-fill` | `#1F3A27` | `#DDF2E1` | (existing token) |
| `--on-inverse-evidence-fill` | `#DDF2E1` | `#14301C` | (existing token) |
| `--ring-glow` | `0 0 0 0 transparent` | `0 0 0 0 transparent` | (existing token) |
| `--rank-glow` | `0 0 0 0 transparent` | `0 0 0 0 transparent` | (existing token) |
| `--tagline-chip` | `var(--control)` | `var(--control)` | (existing token) |
| `--on-tagline-chip` | `var(--text)` | `var(--text)` | (existing token) |
| `--tagline-lamp` | `var(--lit)` | `var(--lit)` | (existing token) |
| `--orb-glass` | `linear-gradient(var(--module), var(--module))` | `linear-gradient(var(--module), var(--module))` | (existing token) |
| `--orb-glass-edge` | `var(--module-border)` | `var(--module-border)` | (existing token) |
| `--on-orb-glass` | `var(--text)` | `var(--text)` | (existing token) |
| `--orb-solid` | `linear-gradient(var(--module), var(--module))` | `linear-gradient(var(--module), var(--module))` | (existing token) |
| `--on-orb-solid` | `var(--text)` | `var(--text)` | (existing token) |
| `--on-orb-solid-2` | `var(--text2)` | `var(--text2)` | (existing token) |
| `--arc-1` | `transparent` | `transparent` | (existing token) |
| `--arc-2` | `transparent` | `transparent` | (existing token) |
| `--arc-3` | `transparent` | `transparent` | (existing token) |
| `--arc-haze` | `transparent` | `transparent` | (existing token) |
| `--arc-outer` | `transparent` | `transparent` | (existing token) |
| `--shadow-float` | `var(--window-shadow)` | `var(--window-shadow)` | (existing token) |
| `--shadow-card` | `var(--module-shadow)` | `var(--module-shadow)` | (existing token) |
| `--shadow-square` | `0 1px 2px rgba(0,0,0,.08)` | `0 1px 2px rgba(0,0,0,.45)` | (existing token) |
| `--shadow-dock` | `0 12px 32px rgba(0,0,0,.12)` | `inset 0 1px 0 rgba(255,255,255,.04), 0 12px 32px rgba(0,0,0,.5)` | (existing token) |
| `--shadow-sheet` | `0 -16px 48px rgba(0,0,0,.14)` | `0 -16px 48px rgba(0,0,0,.5)` | (existing token) |
| `--ring-track` | `var(--hairline-module)` | `var(--hairline-module)` | (existing token) |
| `--picture-lamp-glow` | `var(--lamp-glow)` | `var(--lamp-glow)` | (existing token) |
| `--picture-lamp-wash` | `rgba(245,203,76,.16)` | `rgba(245,203,76,.10)` | (existing token) |
| `--banner-scrim` | `rgba(244,244,244,.85)` | `rgba(15,15,16,.75)` | (existing token) |
| `--inset` | `var(--tile)` | `var(--tile)` | (existing token) |
| `--turn` | `rgba(0,0,0,.025)` | `rgba(255,255,255,.03)` | (existing token) |
| `--secret-fill` | `var(--breakage-fill)` | `var(--breakage-fill)` | (existing token) |
| `--sheet-dim` | `rgba(28,28,28,.25)` | `rgba(10,10,11,.5)` | (existing token) |
| `--signin-edge` | `inset 0 0 0 1px var(--module-border)` | `inset 0 0 0 1px var(--module-border)` | (existing token) |
| `--elev-raised` | `var(--control-shadow)` | `var(--control-shadow)` | (existing token) |
| `--elev-overlay` | `var(--window-shadow)` | `var(--window-shadow)` | (existing token) |
