

## Fix the lighter filter on the middle panel

The middle panel appears lighter than the side panels because backgrounds are stacking:

1. `LiquidGlassPanel` content layer adds `background: rgba(200,200,210,0.08)` + `backdrop-filter: blur(2px) saturate(1.2)`
2. `.ns-outlet-wrap` adds another `background: rgba(200,200,210,0.08)` on top

The side panels only have the `LiquidGlassPanel` layer — no extra tinted child. So the middle panel gets double the tint.

### Fix

**File: `src/components/NeoScaleShell.tsx`**

Change `.ns-outlet-wrap` background from `rgba(200,200,210,0.08)` to `transparent`. The `LiquidGlassPanel` wrapper already provides the matching glass tint — the outlet wrap doesn't need its own.

```css
/* Line 351: change from */
background: rgba(200,200,210,0.08);
/* to */
background: transparent;
```

One line change. The middle panel will then match the side panels exactly since all three rely solely on `LiquidGlassPanel` for their glass surface.

