The profile preview card (`AccountHoverCard`) is being clipped by the feed card below it because `HoverCardContent` renders inside its parent DOM tree rather than escaping the stacking context.

**Root cause:** `src/components/ui/hover-card.tsx` does not wrap `HoverCardPrimitive.Content` in a portal. The feed cards use `backdrop-filter` and `position: relative`, which create new stacking contexts. Without a portal, the hover card content remains scoped to its card's context and gets overlapped by the next sibling card.

**Fix:**
1. Import `HoverCardPrimitive.Portal` in `src/components/ui/hover-card.tsx`.
2. Wrap the `HoverCardPrimitive.Content` element with `<HoverCardPrimitive.Portal>`.

This is a one-line structural change. The hover card will then render at the document-body level and sit above all sibling cards regardless of their z-index or stacking context.

No other files need changes.