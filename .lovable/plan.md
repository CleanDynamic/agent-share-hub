

## Upgrade to React 19

### What
Upgrade React from 18.3.1 to 19.x so `liquid-glass-react` works natively, then restore the proper `LiquidGlass` WebGL component in `LiquidGlassPanel.tsx`.

### Changes

**1. Upgrade packages** (`package.json`)
- `react`: `^18.3.1` → `^19.0.0`
- `react-dom`: `^18.3.1` → `^19.0.0`
- `@types/react`: `^18.3.23` → `^19.0.0`
- `@types/react-dom`: `^18.3.7` → `^19.0.0`
- Run `npm install` to resolve

**2. Restore LiquidGlass in `LiquidGlassPanel.tsx`**
- Re-add the `import LiquidGlass from 'liquid-glass-react'` import
- Render `<LiquidGlass>` instead of the plain `<div>` fallback, passing through the WebGL props (cornerRadius, blurAmount, saturation, etc.)
- Keep `overflow: auto` and `width/height: 100%` on the wrapper to ensure content scrolls

**3. Fix any React 19 breaking changes**
- `main.tsx` already uses `createRoot` — no change needed
- React 19 removed `defaultProps` for function components — scan for any usage and inline defaults if found
- React 19 changed `ref` handling (now a regular prop) — no `forwardRef` changes needed unless components break

### Risk
Some third-party UI libraries (radix, shadcn) may have peer dependency warnings with React 19. These are typically safe to ignore since shadcn/radix already support React 19.

