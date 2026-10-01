# UI-P39 — Between the boards: 768 to 1279, and the tablet chrome switch

Follow `design/RULES.md`.

**Goal.** The kit draws 1440 and 390. This makes every width between them behave, with no new layout invented.

**Read first.** Every page view's grid, `SiteFrameView`, `ScrollRow`.

**Rules to apply.**
1. **The column.** `max-width: 1280px` with 24px side padding below 1328px. Nothing is ever wider than the viewport; no page scrolls sideways at any width from 320 to 2560.
2. **Chrome switch at 768px.** At 768 and above: the desktop header and footer. Below: the mobile header and dock. One breakpoint, one switch, in `SiteFrameView` only — no page decides its own chrome.
3. **Between 768 and 1279**, in this order:
   - a three-track row (Build page bottom row, Import) drops its narrowest side panel below the other two, full width, keeping its height;
   - a two-track row (Home, Gallery, Bounties, Profile, Activity) keeps both tracks to 1024, the right track narrowing to 340 minimum, then stacks below 1024 with the right track's panels in the order they appear on the phone;
   - the gallery wall goes 4 → 3 columns at 1279 and 2 at 1023; the works grid 4 → 3 → 2; the bounty frames 3 → 2 at 1023;
   - the featured build keeps its two-column span to 1024, then becomes the stacked mobile composition;
   - the desktop header's search shrinks to 200px at 1100 and becomes an `IconButton` that opens the search sheet below 900; the New build label becomes icon-only below 980 (keeping its accessible name).
4. **Above 1440** nothing grows except the backdrop: the column stays 1280 and stays centred.
5. **Zoom.** At 200% browser zoom on a 1280 viewport the page is usable and nothing overlaps (this is the same code path as 640px wide).

**Done when.** Screenshots at 360, 390, 414, 768, 834, 1024, 1280, 1440 and 1920 in both themes show no horizontal scrollbar, no overlap, no clipped text and no element narrower than its content; the 1440 and 390 boards still compare within 0.04; a tier1 spec checks the chrome switch at 767 and 768.

**Commit.** `UI-P39: widths between the boards`
