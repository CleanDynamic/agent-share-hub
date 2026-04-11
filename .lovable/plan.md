
Goal: restore the original dark glass shell from the reference screenshot and stop reintroducing the light theme.

What I confirmed
- `src/index.css` and `src/components/BlobBackground.tsx` are already dark again.
- The remaining light theme is hardcoded inside `src/components/NeoScaleShell.tsx`.
- `src/components/feed-card.tsx` and `src/components/ReblogFeedCard.tsx` still render light cards/text.
- The center-panel structure is already on the correct path (single outer glass shell). The problem now is styling, not layout.

Plan

1. Restore `NeoScaleShell` to dark glass styling
- Change the injected shell CSS back from the light palette to the dark palette.
- Revert:
  - `.ns-root` background from `#EDEDEF` to the dark shell background
  - middle-panel tokens from black text/borders to white text/subtle white borders
  - left/right panel labels, dividers, search, tiles, trending, footer, auth buttons, menus, and popovers back to dark glass values
  - outlet/page overrides so routed pages inherit the dark shell instead of light surfaces

2. Keep the current unified center-panel glass structure
- Do not add overlays.
- Keep the single outer `LiquidGlassPanel` for the middle column so it matches the side panels structurally.
- Only restore the face-level colors/tokens so the middle panel reads as the same dark glass surface as left/right.

3. Restore dark feed styling
- Revert `FeedCard` from white/light glass cards to dark translucent cards with white text and subtle dark separators.
- Revert `ReblogFeedCard` to the same dark treatment so reblogs do not stay light inside the restored dark shell.
- Ensure icon, metadata, and hover states use the dark palette consistently.

4. Re-align tabs and shell-adjacent UI
- Keep `FeedTabs` in the dark treatment with white/white-muted text and subtle divider styling.
- Sweep for remaining light literals introduced during the light-theme conversion in shell-related UI.

5. Final verification target
- `/browse` should visually match the dark reference:
  - dark background/grid
  - left, center, and right panels all using the same dark liquid-glass feel
  - no white cards, pale menus, or light popovers remaining
  - center panel visually uniform with the side panels

Files to update
- `src/components/NeoScaleShell.tsx`
- `src/components/feed-card.tsx`
- `src/components/ReblogFeedCard.tsx`
- `src/components/feed-tabs.tsx` (only if needed for final dark consistency)

Technical note
- I would not touch `src/index.css` or `src/components/BlobBackground.tsx` again unless a small token mismatch appears during the pass, because those two are already back on the dark version.
