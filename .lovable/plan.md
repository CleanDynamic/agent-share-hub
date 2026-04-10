
## Fix the glass effect properly

### What’s actually wrong
Do I know what the issue is? Yes.

This is not mainly a “React 19” problem anymore. The visual malfunction is architectural:

1. `src/components/LiquidGlassPanel.tsx` is using `liquid-glass-react` as the actual layout/scroll container for full-height panels, then patching the library’s internal DOM with a `MutationObserver`.
2. The route in your screenshot is `/upload?post_type=build`, and that screen renders `CanvasShell`, which paints an almost fully opaque background (`rgba(6,6,10,1)`) across the whole editor.
3. So even when LiquidGlass renders, the upload canvas is covering the effect. The result is either:
   - unstable layout when the library controls the container, or
   - no visible translucency because opaque children sit on top of it.

The library’s own docs/examples are for floating glass UI elements, not for being the structural wrapper of a large scrollable app shell.

### Plan
**1. Rebuild `LiquidGlassPanel` as a layered panel, not a hacked wrapper**
- Keep the panel’s sizing, scrolling, and layout in normal HTML/CSS.
- Move `LiquidGlass` into a dedicated absolute visual layer inside the panel.
- Put real content in a separate relative content layer above it.
- Remove the `MutationObserver` and all direct DOM style patching.

**2. Make the upload/editor screen actually translucent**
- Update `src/components/canvas/CanvasShell.tsx` so the root canvas surface is no longer solid black.
- Replace the opaque background with transparent / low-alpha dark glass styling.
- Keep readability by using subtle borders, gradients, and section surfaces instead of one flat opaque fill.

**3. Tune the editor chrome so the effect can show through**
- Adjust the canvas header / stage tabs / toolbar / TOC to use translucent dark surfaces rather than heavy solid fills.
- Preserve the current dark aesthetic from your reference screenshot while letting the panel read as glass.

**4. Keep the shell stable**
- `src/components/NeoScaleShell.tsx` should continue owning width/height/flip behavior.
- The glass component should be visual only, not responsible for flex layout, overflow, or 3D face structure.

**5. Clean up the unrelated React warning**
- Fix the `Function components cannot be given refs` warning coming from `AccountHoverCard` / `FeedCard`.
- It is not the root cause of the glass issue, but it should be cleaned up while we’re stabilizing the shell.

### Files to change
- `src/components/LiquidGlassPanel.tsx`
- `src/components/NeoScaleShell.tsx`
- `src/components/canvas/CanvasShell.tsx`
- Possibly small styling adjustments in:
  - `src/components/canvas/CanvasHeader.tsx`
  - `src/components/canvas/CanvasToolbar.tsx`
  - `src/components/canvas/CanvasTOC.tsx`
  - `src/components/account-hover-card.tsx` or `src/components/feed-card.tsx`

### Technical detail
The core fix is to stop using `liquid-glass-react` as the element that owns panel layout. It should render as a visual layer only.

Conceptually:

```text
Panel wrapper (relative, border-radius, overflow hidden)
├─ LiquidGlass visual layer (absolute inset-0, pointer-events none)
└─ Content layer (relative z-10, full height, scrollable)
```

That gives you:
- stable panel dimensions
- working scrolling
- preserved 3D flip/layout behavior
- a visible glass effect on the upload canvas instead of today’s opaque slab

If the library still proves too unstable for full-panel overlays after this change, the fallback will be:
- CSS glass for large structural panels
- `liquid-glass-react` only on smaller floating elements like pills, header chips, toolbar groups, and action controls
But the first implementation will try the layered full-panel approach so it matches your intended look as closely as possible.
