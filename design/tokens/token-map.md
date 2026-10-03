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
