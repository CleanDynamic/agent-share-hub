

## CSS Cleanup and LiquidGlass Import Fix

### Findings

1. **`.ns-panel` CSS class**: Only exists in the CSS definition (lines 96–117). No JSX element uses `className="ns-panel"` anywhere in the codebase. Safe to delete both `.ns-panel` and `.ns-panel::before` rule blocks.

2. **LiquidGlassPanel import error**: The package `liquid-glass-react` exports a **default** export, not a named one. Line 1 of `LiquidGlassPanel.tsx` uses `import { LiquidGlass }` (named import) which fails. Fix: change to `import LiquidGlass from 'liquid-glass-react'`. Also add a type declaration file since the package lacks types.

### Changes

**1. Delete `.ns-panel` CSS rules** (`src/components/NeoScaleShell.tsx`)
- Remove lines 95–117 (the `.ns-panel { ... }` block and `.ns-panel::before { ... }` block) from the `NEOSCALE_CSS` template string.

**2. Fix LiquidGlass import** (`src/components/LiquidGlassPanel.tsx`)
- Change line 1 from `import { LiquidGlass } from 'liquid-glass-react'` to `import LiquidGlass from 'liquid-glass-react'`

**3. Add type declaration** (new file `src/liquid-glass-react.d.ts`)
- Content: `declare module 'liquid-glass-react';`
- Prevents TS2614 errors if the package ships no types.

### Files

| File | Action |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Delete `.ns-panel` and `.ns-panel::before` CSS blocks (lines 95–117) |
| `src/components/LiquidGlassPanel.tsx` | Fix import to default import |
| `src/liquid-glass-react.d.ts` | Create type declaration |

