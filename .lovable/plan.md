

## Add translucent base to LiquidGlassPanel

### Problem
The panels are fully transparent — no base tint. The reference image shows a frosted glass with a light grey/white translucent base that gives the panel body and makes content readable.

### Fix

**`src/components/LiquidGlassPanel.tsx`** — Add a semi-transparent background to the content layer:
- Add `background: 'rgba(200, 200, 210, 0.08)'` to the content div (light grey tint at low opacity)
- Add a subtle `border: '1px solid rgba(255, 255, 255, 0.10)'` on the outer wrapper for the frosted edge
- Add `backdropFilter: 'blur(2px) saturate(1.2)'` on the content layer as a secondary frost to complement the WebGL layer beneath

This gives the panels a visible translucent body — not opaque, not invisible — matching the frosted glass card in the reference.

### Files
| File | Change |
|------|--------|
| `src/components/LiquidGlassPanel.tsx` | Add translucent background + border to wrapper and content layer |

