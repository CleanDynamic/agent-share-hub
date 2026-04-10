
## Make the center panel use the exact same glass structure as the side panels

### What’s actually wrong
Right now the center panel is not built like the side panels:

- **Left/right panels:** one static `LiquidGlassPanel` provides the glass background, and the panel content sits inside it
- **Center panel:** two separate `LiquidGlassPanel` instances are attached to the rotating front/back faces, and there is also extra CSS background/backdrop styling on `.ns-middle-front` / `.ns-middle-back`

That means the center panel is using a different rendering path instead of the same glass surface as the side panels.

### Correct fix
Rebuild the middle panel so it truly mimics the side panels:

1. **Use one outer `LiquidGlassPanel` for the entire middle panel**
   - wrap the whole `.ns-middle-flipper` in a single `LiquidGlassPanel`
   - this outer panel becomes the only glass background for the center column, same as left/right

2. **Remove `LiquidGlassPanel` from the rotating faces**
   - replace the current front/back face `LiquidGlassPanel` wrappers with plain face `<div>` containers
   - keep the 3D flip on those inner faces only

3. **Remove the fake middle-panel frosting**
   - delete the direct `background`, `backdrop-filter`, and `-webkit-backdrop-filter` from `.ns-middle-front` and `.ns-middle-back`
   - make those face containers transparent so the shared outer glass shows through

4. **Keep scrolling inside the face content, not on the outer shell**
   - set the middle panel’s outer `LiquidGlassPanel` content layer to `overflow: hidden`
   - keep `ns-feed-scroll` and `ns-outlet-wrap` as the actual scroll containers

5. **Ensure the face containers fill the full panel**
   - add a shared middle-face class with:
     - `position: absolute`
     - `inset: 0`
     - `height: 100%`
     - `display: flex`
     - `flex-direction: column`
     - `backface-visibility: hidden`
     - `overflow: hidden`
   - keep the back face rotated `180deg`

### Why this is the right approach
This does not “simulate” the side panels with overlays. It makes the center panel use the **same glass panel as the side panels**:
- one glass shell
- transparent internal content
- no extra middle-only frosting layer

That should make the center feel uniform instead of looking like a separate dark card.

### Files to change
| File | Change |
|---|---|
| `src/components/NeoScaleShell.tsx` | Replace the two middle-face `LiquidGlassPanel` wrappers with one outer middle `LiquidGlassPanel`, remove middle-face background/backdrop CSS, add transparent full-height face classes |
| `src/components/LiquidGlassPanel.tsx` | No structural change required unless the middle instance needs a small `contentStyle` override for `overflow: hidden` only |

### Implementation note
I would **not** increase tint, add another overlay, or darken the middle panel again. The next pass should be a structural refactor so the center is literally rendered like the side panels rather than visually approximated.
