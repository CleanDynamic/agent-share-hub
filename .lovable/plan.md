

## Fix: Simplify flip mechanics and correct directions

### Problems identified

1. **Home button broken** — The home/logo click (lines 1685-1696, 1704-1714) flips to front face but never calls `navigate("/")`, so the route stays on the previous page and the auto-flip effect fights back.

2. **Double flips** — The `useEffect` auto-flip (lines 1366-1391) fires on every `location.pathname` change. But the manual `flipMiddle()` calls from nav items ALSO flip. So clicking a left-panel nav item triggers `flipMiddle('left')` + `navigate()` → route changes → auto-flip fires again = two flips.

3. **Wrong directions on right panel** — Right panel items like "Who to Follow" profiles (line 2122) just call `navigate()` with no flip at all. The post-type tiles (line 2025) flip to front face directly. Inconsistent.

### Solution: Remove auto-flip, consolidate into one helper

**Delete** the auto-flip `useEffect` (lines 1366-1391) entirely. All flips should be explicit — triggered only by user clicks, never by route changes.

**Create two simple helpers:**

```text
flipToBack(direction: 'left' | 'right')
  → adds +180 if direction='left', -180 if direction='right'
  → used when navigating FROM home TO a page

flipToFront()
  → snaps to nearest 360
  → used when going back to home feed
```

**Apply the rules:**

| Trigger | Action |
|---------|--------|
| Left panel: Home button / Logo | `flipToFront()` + `navigate("/")` |
| Left panel: Any other nav item | `flipToBack('left')` + `navigate(route)` |
| Right panel: Any clickable item (trending, search results, collections, profiles, etc.) | `flipToBack('right')` + `navigate(route)` |
| Right panel: Post-type tiles (filter feed) | `flipToFront()` (shows front face with filtered feed) |
| Back button on back face | `flipToFront()` + `navigate("/")` |

**Guard against re-flipping when already on correct face:**
- `flipToBack`: skip if already showing back face
- `flipToFront`: skip if already showing front face

This eliminates the double-flip bug entirely since there's no auto-flip effect competing with manual flips.

### Files
| File | Change |
|------|--------|
| `src/components/NeoScaleShell.tsx` | Remove auto-flip useEffect; replace `flipMiddle()` with `flipToBack(dir)` and `flipToFront()`; fix home button to navigate; fix all right-panel clicks to use `flipToBack('right')`; fix right-panel profiles that have no flip call |

