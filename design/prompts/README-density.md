# The density table (UI-P52 to UI-P58)

The "tighter, organised like the example" pass from the design canvas, as rules. Mega-prompt 1 (UI-P52 to UI-P55) and mega-prompt 2 both apply it. `design/scripts/tighten-reference.py` is the same table as code: it is what tightened `design/reference/**` in UI-P52, and `design/build-kit.py` runs it on every reference board it writes.

| Property | Rule | Common results |
|---|---|---|
| font-size, px line-height | >=28: x0.75; 18-27: x0.85; 14-17: -1; 13 -> 12; 10-12 kept; 9 -> 10 | 40->30, 30->22, 22->19, 21->18, 20->17, 16->15, 14->13 |
| padding, margin, gap | under 6 kept; else round(x0.72), min 4 | 28->20, 24->17, 22->16, 20->14, 16->12, 14->10, 12->9, 10->7, 8->6 |
| height, min-height (and width of square controls) | 20-64: round(x0.82); under 20 and over 64 kept | 64->52, 56->46, 48->39, 40->33, 38->31, 36->30, 34->28, 32->26, 30->25, 24->20 |
| Mobile (below 768) | an interactive element that was >=44 tall stays >=44 | dock tiles, mobile header buttons, primary buttons |
| Never changed | widths of layout columns, radii, colours, tokens, positions, z-index, card content order, copy | |

## Reading the table

- **Rounding is half to even**, as Python's `round()` in the script does. It matters only where a product lands on .5: font sizes 30 -> 22, 34 -> 26, 38 -> 28, 42 -> 32, 46 -> 34, 50 -> 38, 54 -> 40, and height 25 -> 20. Code that maps sizes must round the same way, or it drifts a pixel from the reference.
- **Only whole, positive pixel values are mapped.** Fractional values (`1.5px`, `0.5px`), negative values (`-8px`), percentages, `em`, unitless line-heights and `auto` stay as they are.
- **A value not in the table** gets the table's rule applied to its old value, and the report lists it.
- **Scope.** The pass changes `font-size`, `line-height`, `padding`, `margin`, `gap`, `height`, `min-height` and the size of square controls on existing elements. It does not change `position`, `display`, `overflow`, `z-index`, grid tracks (unless a step gives new tracks), widths of layout columns, radii, colours, tokens, copy, or the order of anything.
