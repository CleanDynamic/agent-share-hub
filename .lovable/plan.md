

## Remove cursor repulsion from side panels

The `LiquidGlass` WebGL layer on the left and right panels creates a 3D displacement effect that follows the cursor. The fix is to disable this on side panels while keeping it on the middle panel.

### Approach

**`src/components/LiquidGlassPanel.tsx`** — Add a `disableEffect` prop. When true, skip rendering the `LiquidGlass` visual layer entirely and rely only on the CSS frosted glass styling (the content layer already has `backdrop-filter` and translucent background).

**`src/components/NeoScaleShell.tsx`** — Pass `disableEffect` to the left and right `LiquidGlassPanel` instances (lines ~1680 and ~1869). The middle panel keeps the effect.

### Result
Side panels retain the translucent frosted look via CSS but no longer have the interactive cursor-following distortion. The middle panel keeps the full liquid glass effect.

