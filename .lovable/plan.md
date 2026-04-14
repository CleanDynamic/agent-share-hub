

## Fix Right Panel Dark Text + Upload Page Background

### Problem
The right panel JSX in `NeoScaleShell.tsx` has ~15 hardcoded `rgba(0,0,0,...)` color values — remnants from the light theme revert. These render as dark/invisible text on the dark glass panel. The upload page also shows as solid black instead of matching the grey translucent glass of the side panels.

### Plan

**File: `src/components/NeoScaleShell.tsx`**

1. **Right panel JSX text colors** — Replace all `rgba(0,0,0,X)` inline styles in the right panel section (lines ~1757–2001) with their dark-theme equivalents:
   - `rgba(0,0,0,0.70)` → `rgba(255,255,255,0.70)`
   - `rgba(0,0,0,0.55)` → `rgba(255,255,255,0.55)`
   - `rgba(0,0,0,0.35)` → `rgba(255,255,255,0.35)`
   - `rgba(0,0,0,0.30)` → `rgba(255,255,255,0.30)`
   - `rgba(0,0,0,0.25)` → `rgba(255,255,255,0.25)`
   - `rgba(0,0,0,0.22)` → `rgba(255,255,255,0.22)`

   This affects: search results text, "Browse" label, tile arrows, "Loading…" text, curator pick titles/badges, collection names/metadata, follow suggestion initials.

2. **Right panel "Browse" section label** (line ~1847) — Change `color: 'rgba(0,0,0,0.30)'` to `rgba(255,255,255,0.35)` to match the other section labels.

3. **Upload page (center panel) background** — Update `.ns-outlet-wrap` CSS (line ~344) to use `background: rgba(200,200,210,0.04)` instead of `transparent`, giving it the same grey translucent feel as the side panels. Also add to `.ns-middle-back` a subtle grey tint so all outlet pages inherit the glass surface rather than pure black.

4. **Clean up the cluttered right panel structure** — The "Browse by type" section currently shows individual POST_TYPES with emojis and colored text (from the old `RightPanel.tsx` which is no longer used). The shell's own right panel already has the cleaner 3-tile grid (Blueprints/Blogs/Bounties). No duplicate browse sections exist since the shell renders its own right panel, but the tile arrow color `rgba(0,0,0,0.22)` needs the dark fix.

### Files to change
- `src/components/NeoScaleShell.tsx` — ~20 inline color swaps in the right panel JSX + 1 CSS background tweak for outlet wrap

