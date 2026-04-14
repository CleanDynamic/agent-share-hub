

## Why the grid background keeps disappearing

The `BlobBackground` component renders at `z-index: 0` with `position: fixed`. Meanwhile, `.ns-root` in `NeoScaleShell` is `position: fixed; inset: 0; z-index: 10` — it sits directly on top and its panel backgrounds (left, middle, right glass panels) fully cover the viewport, hiding the grid.

The grid is technically there — it's just painted behind everything.

## Fix

**File: `src/components/NeoScaleShell.tsx`**

Instead of relying on the separate `BlobBackground` component (which gets covered), inject the same dot-grid pattern directly into `.ns-root`'s background so it renders at the shell level and shows through/behind the translucent glass panels.

1. Change `.ns-root` background from `transparent` to:
   ```css
   background:
     radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px),
     radial-gradient(ellipse 60% 50% at 20% 40%, rgba(46,196,182,0.07) 0%, transparent 70%),
     radial-gradient(ellipse 50% 40% at 80% 30%, rgba(232,87,26,0.05) 0%, transparent 70%),
     radial-gradient(ellipse 70% 60% at 50% 80%, rgba(46,196,182,0.04) 0%, transparent 70%),
     #07070D;
   background-size: 20px 20px, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
   ```

2. The `BlobBackground` component in `App.tsx` can remain as a fallback for any routes that don't use the shell, or be removed — either way it won't conflict.

This is a one-line CSS change in the `NEOSCALE_CSS` string inside `NeoScaleShell.tsx`.

