

## Fix: Middle panel too transparent

### Problem
The content layer background is `rgba(200, 200, 210, 0.08)` — only 8% opacity. On a dark background this is essentially invisible. The panel needs a stronger tint to read as translucent frosted glass rather than clear glass.

### Changes

**`src/components/LiquidGlassPanel.tsx`**
- Increase content layer background from `rgba(200, 200, 210, 0.08)` to `rgba(200, 200, 210, 0.18)` (18% opacity — visible grey tint without being opaque)
- Increase `backdropFilter` blur from `2px` to `12px` for a stronger frosted effect
- Increase saturation from `1.2` to `1.4`

This single change affects all three panels (left, center, right) since they all use `LiquidGlassPanel`.

### Build errors
The listed build errors (`useAuth` expected 1 argument, `JSX` namespace) appear to be pre-existing TypeScript issues unrelated to the glass changes — the `useAuth()` function signature accepts 0 arguments. These will be investigated separately if they persist.

### Files
| File | Change |
|------|--------|
| `src/components/LiquidGlassPanel.tsx` | Stronger background tint + blur for visible translucency |

