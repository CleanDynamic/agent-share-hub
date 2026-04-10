

## Alternative: CSS-based translucent background on middle panel

### Why the current approach fails
The `contentStyle={{ background: 'rgba(200, 200, 210, 0.13)' }}` on `LiquidGlassPanel` is not producing visible translucency — the tint is too faint and the WebGL glass layer underneath may be swallowing it. The side panels look fine because they're smaller and the subtle tint reads better at that scale.

### New approach
Stop relying on the `LiquidGlassPanel` content layer tint for the middle panel entirely. Instead, apply a visible translucent background directly to `.ns-middle-front` and `.ns-middle-back` CSS classes — same as how any frosted glass card works: a semi-opaque background + backdrop-filter blur.

### Changes

**`src/components/NeoScaleShell.tsx`**

1. On the two middle `<LiquidGlassPanel>` instances (lines 1760 and 1849), remove `contentStyle` prop — let the glass panel use its default
2. Add to `.ns-middle-front` CSS (line 239):
   ```css
   background: rgba(22, 22, 30, 0.65);
   backdrop-filter: blur(40px) saturate(1.8);
   -webkit-backdrop-filter: blur(40px) saturate(1.8);
   ```
3. Add the same to `.ns-middle-back` CSS (line 244)

This gives the middle panel a dark translucent base (matching the side panels' visual density) while still letting the `LiquidGlass` WebGL refraction layer show through underneath. The side panels are untouched.

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Add translucent bg + blur to `.ns-middle-front` and `.ns-middle-back` CSS; remove `contentStyle` from middle panel `LiquidGlassPanel` instances |

