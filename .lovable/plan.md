

## Fix: Panels Disappeared Due to liquid-glass-react Layout

### Root Cause

The `liquid-glass-react` `LiquidGlass` component renders children inside a `div` with:
- `display: inline-flex` — collapses to content size
- `overflow: hidden` — clips all scrollable content
- `padding` and fixed font styles — overrides panel styling
- Absolute-positioned backdrop filter overlay

This component is designed for small glass buttons/badges, **not** for wrapping 775px-tall scrollable panels. The panels collapse to near-zero visible area with clipped content.

### Fix

**Revert `LiquidGlassPanel.tsx` back to a CSS-only glass effect.** The `liquid-glass-react` library is architecturally incompatible with wrapping large layout panels. Use CSS `backdrop-filter` to achieve a similar frosted-glass look that works with scrollable content.

### Changes

**`src/components/LiquidGlassPanel.tsx`** — Replace `LiquidGlass` with a plain `<div>` using:
- `backdropFilter: 'blur(20px) saturate(1.4)'`
- `background: 'rgba(255,255,255,0.04)'`
- `borderRadius` from the `cornerRadius` prop
- `overflow: 'auto'`, `width: '100%'`, `height: '100%'`

This is the same CSS fallback from earlier — it's not a workaround, it's the correct approach since the library doesn't support panel-sized containers.

