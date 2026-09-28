# RC state map

Every RC interface prompt uses these treatments; a state not listed here is not built until this file is updated by an owner-approved prompt.

Keys are the real names each treatment resolves to: `t.*` from src/lib/theme/tokens.ts, `r.*` from radius.ts, `type.*`, `SPACE.*`, `elevation.*` and the other bare names from the modules in src/lib/theme/, components from src/components/, and `Check` from lucide-react. src/lib/theme/rcStates.test.ts fails if any of them stops existing.

| # | State | Treatment | Keys |
|---|---|---|---|
| 1 | Primary action (one per view) | --action fill, --on-action label, --r-control | `buttonStyle("default")`, `t.action`, `t.onAction`, `r.control` |
| 2 | Secondary action | transparent background, 1px --line border, --text label, --r-control. Never a glass surface inside another glass surface | `t.line`, `t.text`, `r.control` |
| 3 | Tertiary / ghost action | transparent, no border, --text2 label and icon | `buttonStyle("ghost")`, `t.text2` |
| 4 | Chip, unselected | transparent, 1px --line border, --text2 label, --r-chip, the text style of CategoryChip | `chipStyle("outline")`, `chipType`, `t.line`, `t.text2`, `r.chip`, `CategoryChip` |
| 5 | Chip, selected | --recess fill, 1px --text border, --text label, and a 12px Check icon before the label; aria-checked (radio chips) or aria-pressed (toggle chips) | `t.recess`, `t.text`, `r.chip`, `chipType`, `Check` |
| 6 | Nav item, active | existing behaviour, unchanged. Phone bottom nav: --action text and icon, no fill. Desktop left rail: 2px --action left edge, 12% --action wash, --text label | `MobileBottomNav`, `t.action`, `t.text` |
| 7 | Engagement action, inactive | outline icon in --text2; count in --text2, DM Mono 12, tabular-nums | `t.text2`, `DM_MONO`, `tabular` |
| 8 | Engagement action, active (liked, saved) | icon filled --action, count --text | `t.action`, `t.text` |
| 9 | Focus | the theme's single focus ring: 2px --lit, 2px --bg offset | `focusRing`, `ring`, `t.lit`, `t.bg` |
| 10 | Disabled | the existing Button disabled state; custom controls: --text2 label, no hover response, aria-disabled="true" | `Button`, `buttonStyle`, `t.text2` |
| 11 | Freshness stale / never reproduced | existing Plaque behaviour, unchanged | `Plaque`, `plaqueState` |
| 12 | Gap on a card | existing card treatment (1.5px dashed breakage border, mono "1 part unsolved · £n"), unchanged | `gapEdge("card")`, `GalleryCard` |
| 13 | Bounty row in a list | 1.5px dashed left edge in --cat-breakage, the token GapMarker uses; the row is otherwise flat | `gapEdge("row")`, `t.catBreakage`, `GapMarker` |
| 14 | Solved bounty | solid left edge plus an --evidence note "Solved" | `gapEdge("row", "solved")`, `t.evidence` |
| 15 | Hidden by an admin (banner) | --recess panel, --text copy, --r-panel; no category hue | `t.recess`, `t.text`, `r.panel` |
| 16 | Destructive action | tertiary style, placed last with 16 or more space before it, always confirmed in a dialog whose primary button names the act ("Delete comment"). No danger colour: the theme forbids borrowing the breakage hue, so position, label and confirmation carry the meaning (CONTRACT §5) | `buttonStyle("ghost")`, `SPACE.sm`, `Dialog` |
| 17 | Dialog | the existing Dialog in src/components/ui/dialog.tsx: --r-panel, overlay elevation and its scrim, checked in both themes | `Dialog`, `DialogContent`, `DialogOverlay`, `dialogPanelStyle`, `scrimStyle`, `r.panel`, `elevation.overlay` |
| 18 | Progress fill / tier | --lit fill with --on-lit on it; tiers: common = 1px --line outline, rare = --recess fill, highest = --lit fill | `t.lit`, `t.onLit`, `t.recess`, `t.line` |
| 19 | Empty state | one sentence in --text2 and one action: primary (row 1) only when the view has no other primary, otherwise secondary (row 2) | `t.text2`, `buttonStyle("default")` |
| 20 | Loading | skeleton blocks in --recess at the final layout's size; no shimmer when prefers-reduced-motion | `skeletonStyle`, `t.recess`, `prefersReducedMotion` |
| 21 | No access / error | one sentence, "You don't have access to this." or "Something went wrong.", plus a secondary (row 2) "Try again" | `t.line`, `t.text`, `r.control` |
| 22 | Counts and numbers | DM Mono, font-variant-numeric tabular-nums | `type.data`, `DM_MONO`, `tabular` |

## Notes

- Row 6 records the nav as built. "--action text and icon" is the phone bottom nav only. The desktop rail keeps a --text label because --action as text on the rail's wash measures 3.57:1 (Exhibition) and 3.94:1 (Dusk), under the text floor (src/components/shell/flat-shell.css, BG-P13).
- Rows 2, 19 and 21: Button's "secondary" and "outline" variants paint t.glass and t.glass2. The RC secondary is transparent: Button variant="outline" with `background: "transparent"` in its style prop.
- Row 5 is not `chipSelectedStyle`. That helper marks a selected category chip with an --action border, because the chip's fill already names its category. Row 5 is for lens and filter chips, which carry no category.
- Row 16: Button's "destructive" variant paints t.catBreakage, which the theme forbids borrowing. New destructive actions use the ghost variant and a Dialog confirmation.
- Row 17: src/components/ui/alert-dialog.tsx uses neither dialogPanelStyle nor scrimStyle, so confirmations use Dialog.
- Row 9: on Exhibition the ring measures 1.55–2.13:1 against every ground, under the 3.0 UI floor. BG-P30 escalated this to the owner and src/lib/theme/state-contrast.test.ts records the figures. This map changes nothing about it.
- Measured for this map in src/lib/theme/contrast.test.ts (Exhibition / Dusk): --text on --recess 11.33 / 10.62, --text2 on --recess 4.55 / 5.73, --text as a border on --recess 11.33 / 10.62, --action as an icon on --bg 4.80 / 6.33. --text2 on --recess clears the 4.5 floor on Exhibition by 0.05, so --text2 never goes on a ground darker than --recess.
