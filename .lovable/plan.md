

## Make middle panel translucent (match side panels)

### Problem
The middle panel's `LiquidGlassPanel` uses the same `rgba(200, 200, 210, 0.08)` tint as the side panels, but because it's much larger, the effect reads as fully transparent. The side panels are fine and should not change.

### Fix
Add a translucent background directly to `.ns-middle-front` and `.ns-middle-back` CSS classes in `NeoScaleShell.tsx` to give the middle panel a visible frosted surface, independent of the `LiquidGlassPanel` content layer tint.

**`src/components/NeoScaleShell.tsx`** — Add to the `.ns-middle-front, .ns-middle-back` rule (around line 40):
```css
background: rgba(180, 180, 195, 0.12);
backdrop-filter: blur(12px) saturate(1.3);
```

This gives the middle panel a visible light-grey frosted base while the `LiquidGlass` WebGL refraction layer renders underneath. The side panels remain untouched.

### Also fix: build errors
The build errors (`Expected 1 arguments, but got 0`) are unrelated — they come from `useAuth()` calls across multiple files. These need investigating to determine the cause (likely a recent signature change). Will check and fix in the same pass.

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Add translucent background + backdrop-filter to `.ns-middle-front, .ns-middle-back` |
| Multiple files with `useAuth()` errors | Fix argument mismatch |

