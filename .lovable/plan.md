

## Fix: Middle panel glass to match side panels

### Root cause
The previous fix added `background` and `backdrop-filter` directly to `.ns-middle-front` and `.ns-middle-back` CSS classes — this creates a visible overlay on top of the content, not a glass panel background. The side panels work because they only use `LiquidGlassPanel`'s built-in content layer tint with no extra CSS backgrounds.

### Solution
1. **Remove** the overlay CSS (`background` and `backdrop-filter`) from `.ns-middle-front, .ns-middle-back` in the `NEOSCALE_CSS` block
2. **Add a `contentStyle` prop** to `LiquidGlassPanel` so callers can customize the content layer's background without changing the component globally
3. **Pass a slightly stronger tint** to the middle panel's `LiquidGlassPanel` instances: `contentStyle={{ background: 'rgba(200, 200, 210, 0.13)' }}` — this compensates for the larger surface area while using the exact same mechanism as the side panels (not an overlay)

Side panels remain completely untouched — they continue using the default `rgba(200, 200, 210, 0.08)`.

### Files
| File | Change |
|------|--------|
| `src/components/LiquidGlassPanel.tsx` | Add optional `contentStyle` prop, merge it into the content layer's inline styles |
| `src/components/NeoScaleShell.tsx` | Remove `background` and `backdrop-filter` from `.ns-middle-front, .ns-middle-back` CSS; pass `contentStyle` with stronger tint to the two middle-panel `<LiquidGlassPanel>` instances (front face ~line 1762, back face ~line 1851) |

