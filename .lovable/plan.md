

## Replace Side Panel Glass Effect with Vertical Expansion Cursor Animation

### What changes

Replace the `LiquidGlass` WebGL repulsion effect on the left and right panels with a custom vertical expansion highlight that follows the cursor. The effect: a soft, glowing horizontal band that tracks the mouse Y position and expands/contracts vertically as it follows — like a light stripe scanning up and down the panel.

### Implementation

**`src/components/LiquidGlassPanel.tsx`**

Add a new optional prop `cursorEffect?: 'glass' | 'vertical-expand'` (default `'glass'`).

When `cursorEffect === 'vertical-expand'`:
- Remove the `LiquidGlass` visual layer
- Add a mouse-tracking overlay div instead:
  - Track `onMouseMove` on the wrapper to get cursor Y position
  - Render an absolutely-positioned gradient highlight band centered on cursor Y
  - The band is a radial/linear gradient (~80-120px tall) with soft edges, using `rgba(255,255,255,0.06)` center fading to transparent
  - Animate with CSS `transition: top 0.15s ease-out, height 0.1s ease-out`
  - On mouse enter: band appears and expands from 0 to full width
  - On mouse leave: band fades out
- Keep the translucent content layer and border unchanged

When `cursorEffect === 'glass'` (or default): keep current `LiquidGlass` behavior for the middle panel.

**`src/components/NeoScaleShell.tsx`**

Pass `cursorEffect="vertical-expand"` to the left and right `<LiquidGlassPanel>` instances (lines ~1680 and ~1869). Middle panel keeps the default glass effect.

### Files
| File | Change |
|------|--------|
| `src/components/LiquidGlassPanel.tsx` | Add `cursorEffect` prop, implement vertical expansion cursor tracker |
| `src/components/NeoScaleShell.tsx` | Pass `cursorEffect="vertical-expand"` to left & right panels |

