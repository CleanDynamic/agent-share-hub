

## Fix: Preview Not Loading Due to React Version Incompatibility

### Root Cause

The `liquid-glass-react` package requires **React 19+**, but this project uses **React 18.3.1**. The `LiquidGlassPanel` component wraps all three shell panels (left, middle, right), so when it fails to render, the entire app goes blank. The ErrorBoundary catches it silently showing "Something went wrong" or just a blank screen.

### Fix

**Replace `LiquidGlassPanel` with a CSS-only glass effect** that works with React 18. The `LiquidGlassPanel` wrapper will become a simple `div` with a `backdrop-filter` glass effect applied via inline styles, achieving a similar frosted-glass look without the WebGL dependency.

### Changes

**1. `src/components/LiquidGlassPanel.tsx`**
- Replace the `LiquidGlass` import and render with a plain `<div>` that applies:
  - `backdrop-filter: blur(20px) saturate(1.4)`
  - `background: rgba(255,255,255,0.04)`
  - `border-radius` from the `cornerRadius` prop
  - `overflow: auto` to preserve scrolling
- Keep the same props interface for compatibility (unused WebGL props are just ignored)

**2. No other files change** — the shell panels, feed cards, nav links, and flip animation all remain untouched since `LiquidGlassPanel` is used as a transparent wrapper.

### Technical detail
- The `liquid-glass-react` package can optionally be removed from `package.json` later, but for now the fix is just bypassing its render to unblock the preview immediately.

