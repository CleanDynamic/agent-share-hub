

## Fix: LiquidGlass Panels Invisible

### Problem

The `LiquidGlass` component from `liquid-glass-react` renders a WebGL canvas overlay and wraps children in a container with `display: inline-flex`, `overflow: hidden`, and zero effective dimensions. The `useEffect` override in `LiquidGlassPanel` tries to fix this by querying the first child and patching its styles — but this is fragile and race-prone. The library's internal render may happen after the effect, undoing or ignoring the patches. Result: all three panels collapse to 0×0 and are invisible.

### Solution

Use a `MutationObserver` instead of a one-shot `useEffect` to continuously enforce layout overrides on the library's internal container. This catches any re-renders by the library that reset styles.

### Changes

**`src/components/LiquidGlassPanel.tsx`**

Replace the `useEffect` with a `MutationObserver` approach:

```tsx
useEffect(() => {
  const wrapper = wrapperRef.current;
  if (!wrapper) return;

  function applyOverrides() {
    const el = wrapper!.querySelector(':scope > div > div') as HTMLElement | null;
    // Also try the direct child
    const direct = wrapper!.querySelector(':scope > div') as HTMLElement | null;
    
    for (const target of [direct, el]) {
      if (!target) continue;
      target.style.display = 'flex';
      target.style.flexDirection = 'column';
      target.style.overflow = 'auto';
      target.style.width = '100%';
      target.style.height = '100%';
      target.style.padding = '0';
      target.style.fontFamily = 'inherit';
      target.style.fontSize = 'inherit';
      target.style.lineHeight = 'inherit';
      target.style.position = 'relative';
    }
  }

  applyOverrides();

  const observer = new MutationObserver(() => applyOverrides());
  observer.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

  return () => observer.disconnect();
}, []);
```

This ensures that every time `LiquidGlass` re-renders or mutates its internal DOM, the layout overrides are immediately re-applied, preventing the panels from collapsing.

### Files
| File | Action |
|------|--------|
| `src/components/LiquidGlassPanel.tsx` | Replace `useEffect` with `MutationObserver`-based style enforcement |

