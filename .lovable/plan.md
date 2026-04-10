

## Fix: Coherent flip system — no 360° spins, consistent directions

### Root cause of all bugs

The `doFlip` function does a **full 360° rotation** when navigating between pages on the same face. This causes:
- **Home button**: Already on front face → 360° spin for no reason, and during the spin the back face content briefly shows (bounties or whatever was last loaded)
- **Left panel double-flips**: Clicking a second left-panel item while already on back face → 360° spin instead of a simple content swap
- **Right panel tiles**: Filter tiles do `doFlip('front', 'right')` while already on front → -360° backward spin

### The fix: Remove 360° logic entirely

The 360° "same-face flip" was meant to give visual feedback when navigating between pages on the same face, but it's fundamentally broken because it briefly exposes the opposite face's stale content mid-rotation.

**New rules:**
1. If already on the target face → **skip the flip, just navigate** (content updates via React router)
2. If switching faces → **180° flip** in the correct direction
3. Home button → if already on front, just navigate to `/`; if on back, flip to front

**Updated `doFlip` function:**
```
doFlip(target: 'front' | 'back', direction: 'left' | 'right')
  if isFlipping → return
  if already on target face → return (no animation, just let navigate() handle content change)
  delta = direction === 'left' ? 180 : -180
  showingFront = (target === 'front')
  animate rotation, lock for 650ms
```

**All call sites remain the same** — the only change is inside `doFlip` itself. The `navigate()` calls after `doFlip` still fire, so content updates even when the flip is skipped.

### Direction rules (unchanged)
| Source | Target | Direction |
|--------|--------|-----------|
| Home/Logo click | Front face | left (skip if already front) |
| Left panel nav item | Back face | left |
| Right panel item | Back face | right |
| Post-type filter tiles | Front face | right (skip if already front) |
| Back button | Front face | left |

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Remove the 360° branch from `doFlip` — when `onTarget` is true, just `return` early instead of doing a full rotation |

This is a 3-line change inside the `doFlip` function (lines 1367-1385). No other files affected.

