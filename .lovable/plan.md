

## Fix: Translucency on all pages + hide scrollbars

### Issues

1. **Middle panel back face has no glass effect** — The front face (feed) is wrapped in `LiquidGlassPanel`, but the back face (Library, Discover, Profile, etc.) at line 1859 is a plain `div` with `ns-middle-back` class that uses a CSS gradient background instead of the glass component. This is why non-feed pages look opaque/black.

2. **Left and right panels show scrollbars** — The left panel (`ns-left-panel`) has no scrollbar hiding. The right panel has `overflow-y: auto` but only styles the webkit scrollbar thumb, not hiding it. The `LiquidGlassPanel` content layer also sets `overflow: auto` which adds a second scrollbar source.

### Changes

**`src/components/NeoScaleShell.tsx`** (lines 1858-1863)
- Wrap the back face content in `<LiquidGlassPanel>` just like the front face, so all routed pages get the translucent glass effect
- Remove the opaque gradient background from `ns-middle-back` CSS class (lines 252-261)
- Add scrollbar-hiding CSS for `ns-left-panel` and the `LiquidGlassPanel` content layer

**`src/components/LiquidGlassPanel.tsx`**
- Add CSS to hide scrollbars on the content layer: `scrollbarWidth: 'none'` and `-webkit-scrollbar { display: none }`

### Specific edits

1. **CSS `ns-middle-back`** — Remove `background`, `backdrop-filter`, `box-shadow` from lines 252-262 since the glass panel will provide the translucent surface.

2. **Back face JSX** (line 1859) — Wrap in `LiquidGlassPanel`:
```tsx
<LiquidGlassPanel cornerRadius={20} elasticity={0.15} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
  <div className={`ns-middle-back${flipDir === -1 ? " rtl" : ""}`}>
    <div className="ns-outlet-wrap">
      {renderBackFaceContent()}
    </div>
  </div>
</LiquidGlassPanel>
```

3. **Left panel CSS** — Add `overflow: hidden` to `.ns-left-panel` and scrollbar-hide rules.

4. **LiquidGlassPanel content layer** — Add `scrollbarWidth: 'none'` to the content div style and add a `<style>` tag or inline rule to hide webkit scrollbars.

5. **Right panel CSS** — Add `.ns-right-panel::-webkit-scrollbar { display: none }` and `scrollbar-width: none`.

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Wrap back face in LiquidGlassPanel; strip opaque bg from ns-middle-back; hide scrollbars on left/right panels |
| `src/components/LiquidGlassPanel.tsx` | Hide scrollbars on content layer |

