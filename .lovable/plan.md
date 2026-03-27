

# Restore All Missing Functions to NeoScaleShell + Fix Build Errors

## Context

The site now uses `NeoScaleShell` as the layout (via `Layout.tsx`). This shell has a 3-panel flipper design but is missing many features that the old `AppLayout`/`LeftPanel`/`RightPanel` system had. The user wants all existing functionality restored within this new shell, with freedom to adjust panel contents to fit.

Additionally, 6 edge functions have build errors (`err` is of type `unknown`).

---

## Phase 1 — Fix Edge Function Build Errors

Cast `err` to `Error` in the catch blocks of these 6 files:
- `create-checkout-session/index.ts` (line 70)
- `create-donation-session/index.ts` (line 72)
- `create-pwyw-checkout-session/index.ts` (line 110)
- `create-split-checkout-session/index.ts` (line 144)
- `create-subscription-session/index.ts` (line 93)
- `seed-demo-data/index.ts` (line 867)

Fix: `(err as Error).message` in each.

---

## Phase 2 — Restore Left Panel Functions in NeoScaleShell

The NeoScaleShell left panel currently only has: Home, Discover, Library, Upload, Profile.

**Missing nav items to add:**
- Messages (with unread badge from `useUnreadMessages`)
- Notifications (with unread badge from `useUnreadNotifications`)
- Drafts (with draft count badge from `useDraftCount`)
- Analytics (conditionally shown for creators)

**Missing auth features:**
- Sign in / Join free buttons for guests (bottom of left panel)
- User avatar + sign out menu for logged-in users (bottom of left panel)

**Implementation:** Import the auth context and badge hooks into NeoScaleShell. Add the nav items with SVG icons matching existing style. Add conditional rendering based on `isLoggedIn` and `profile?.is_creator`. Add a user section at the bottom of the nav list with avatar and sign-out popover.

---

## Phase 3 — Restore Right Panel Functions in NeoScaleShell

The right panel currently has: decorative search bar, 8-category grid, trending list.

**Missing features to add:**

1. **Working search** — Replace the decorative search with a functional one. Compact version: clicking it navigates to `/search` or opens a small inline search dropdown (query profiles + content_items, same logic as old `SearchSection`). Given the 200px width, a click-to-search approach works best.

2. **Curator Picks section** — After trending, add curator picks (query `curator_recommendations` joined with `content_items`). Show up to 3 picks with title, type badge, curator avatar.

3. **Featured Collections section** — After curator picks, show top 3 public collections with title, owner, item count.

4. **Who to Follow** — For logged-in users, show 3 suggested creators to follow with follow button.

5. **Auth buttons for guests** — Sign in / Join free at the bottom for non-logged-in users.

6. **Footer links** — About, Twitter link at the very bottom.

7. **Missing categories** — The grid currently has 8 categories but is missing: Model Config Guide, Integration Guide, Install Guide, and Bounties from the old `RightPanel`. Add the missing categories or adjust the grid layout to fit within 200px width.

**Implementation:** Add Supabase queries using `useQuery` directly in NeoScaleShell (or extract into small inline components). Style using the existing `ns-` CSS classes, extending with new classes for curator picks, collections, who-to-follow, and auth sections. The right panel has `overflow: hidden` — change to `overflow-y: auto` to allow scrolling for all the new content.

---

## Phase 4 — Restore Mobile Support

The NeoScaleShell is `position: fixed; inset: 0` with a scaling approach that doesn't work well on mobile. The old `MobileNav` component (with bottom tab bar, slide-in panels, search overlay) is no longer used.

**Approach:** Detect mobile viewport in NeoScaleShell. When mobile, bypass the 3-panel flipper layout and render a mobile-friendly layout instead:
- Reuse the existing `MobileNav` component (it's still in the codebase and fully functional)
- Render `<Outlet />` directly with proper padding for top/bottom bars
- This preserves all mobile functionality: bottom tabs, search overlay, slide-in left panel, slide-in right panel (discover)

**Implementation:** Import `useIsMobile` hook. If mobile, return the mobile layout (similar to old `AppLayout` mobile path) instead of the NeoScaleShell desktop layout.

---

## Files to modify
- `src/components/NeoScaleShell.tsx` — Add missing nav items, auth, right panel sections, mobile fallback
- `supabase/functions/create-checkout-session/index.ts` — Fix `err` type
- `supabase/functions/create-donation-session/index.ts` — Fix `err` type
- `supabase/functions/create-pwyw-checkout-session/index.ts` — Fix `err` type
- `supabase/functions/create-split-checkout-session/index.ts` — Fix `err` type
- `supabase/functions/create-subscription-session/index.ts` — Fix `err` type
- `supabase/functions/seed-demo-data/index.ts` — Fix `err` type

## No changes to
- Form submission logic, Supabase queries, routing, or any page components
- The core 3-panel flipper animation and visual design
- The `AppLayout`, `LeftPanel`, `RightPanel`, `MobileNav` source files (kept as-is for reference)

