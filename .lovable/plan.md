

## Fix: Consistent flip on every navigation click

### Root cause
The current `flipToBack`/`flipToFront` guards (`if (!isShowingFront()) return;` and `if (isShowingFront()) return;`) silently skip the flip when the panel is already on the target face. So clicking a second right-panel item while already on the back face triggers `navigate()` but no animation — the content just swaps in place. This feels broken and inconsistent.

### Fix
Replace the guard-based approach with a single `doFlip(target: 'front' | 'back', direction: 'left' | 'right')` helper that **always animates**, even when navigating between two back-face pages:

- If already on the target face, perform a **full 360° rotation** in the given direction (visually: a complete flip that lands back on the same face with new content)
- If on the opposite face, perform a normal **180° rotation**
- The `isFlipping` lock stays to prevent overlapping animations
- Direction rules remain: left-panel = `'left'`, right-panel = `'right'`

**Concrete changes in `src/components/NeoScaleShell.tsx`:**

1. Delete `flipToFront()`, `flipToBack()`, `isShowingFront()`
2. Add a `showingFront` ref (boolean, starts `true`) and one helper:
   ```
   doFlip(target: 'front' | 'back', direction: 'left' | 'right')
     if isFlipping → return
     delta = 0
     if already on target face → delta = direction==='left' ? 360 : -360
     else → delta = direction==='left' ? 180 : -180
     update showingFront, animate, set isFlipping lock for 650ms
   ```
3. Update all call sites:
   - Home/Logo: `doFlip('front', 'left')` + `navigate("/")`
   - Left nav items: `doFlip('back', 'left')` + `navigate(route)`
   - Right panel items: `doFlip('back', 'right')` + `navigate(path)`
   - Post-type tiles: `doFlip('front', 'right')` + `navigate("/")`
   - Back button: `doFlip('front', 'left')` + `navigate("/")`

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Replace flip helpers with unified `doFlip`; update all ~15 call sites |

