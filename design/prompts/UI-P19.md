# UI-P19 — The mobile frame: header, dock, sheets and sideways rows

Follow `design/RULES.md`.

**Goal.** The phone chrome (<768px): a sticky glass header, a floating five-tile dock, bottom sheets and sideways chip rows — built for a phone's browser, not as an app.

**Read first.** `components/shell/MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `RightRailDrawer.tsx` (read only; they stay for `FlatShell`), `index.html` (viewport meta), `@radix-ui/react-dialog` usage elsewhere in the repo, `design/HANDOFF.md` §5.10.

**Reference.** Section `Frame` (mobile header, dock with Home current, dock with Activity current); `data-ui="mobile-header"`, `"dock"`, `"scroll-row"`, `"filter-chip"` on `design/reference/mobile/*`; the solve sheet `mobile/*/solve.html`.

**Build** in `src/components/shell/`:
1. **Viewport.** Add `viewport-fit=cover` to the viewport meta in `index.html` (keep everything else in it).
2. **`MobileHeader`** (`data-testid="mobile-header"`): sticky `top: 0`, `z-index: 20`, height 58, flex, `space-between`, padding 0 14px, background `--header`, 1px bottom border `--header-border`, `backdrop-filter: blur(16px) saturate(1.15)`. Left: `Lockup` 19 (link home). Right, gap 8px: `IconButton` 38 "Search" (opens a full-width search sheet using `HeaderSearch`'s behaviour, input 16px) and the account control: `Avatar` 34 (opens the account sheet: Profile, Library, Settings, `ThemeSegmented` size 36, Sign out) or `Button` secondary 38 "Sign in".
3. **`Dock`** (`data-testid="dock"`): `<nav aria-label="Primary">`, `position: fixed`, `left: 50%`, `transform: translateX(-50%)`, `bottom: calc(16px + env(safe-area-inset-bottom))`, `z-index: 30`; flex, gap 4px, padding 7px, radius 22, background `--dock`, 1px border `--dock-border`, `box-shadow: var(--shadow-dock)`, `backdrop-filter: blur(16px) saturate(1.15)`. Five tiles (`data-testid="dock-tile-<name>"`), each a link 62×54, radius 15, a column with gap 3px, icon 20px stroke 1.8, label Figtree 10px 600:
   - **Home** `/` (`Home`), **Gallery** `/gallery` (`Image`), **New** (create route; `Plus`) — always background `--action`, text `--on-action`, **Bounties** `/bounties` (`Target`), **Activity** `/notifications` (`Bell`).
   - Current tile: background `--text`, text `--on-text`, `aria-current="page"`, and a lamp above it: ellipse 20×6, `top: -11px`, centred, `--lit`, `box-shadow: var(--nav-lamp-glow)`. Others: transparent, `--text`.
   - Activity badge when unread > 0: `top: 5px; right: 9px`, 15×15 (min-width 15), radius 8, `--action` / `--on-action`, DM Mono 10px.
   - Each tile's accessible name is its label; with unread, "Activity, N unread". Tiles are 62×54 (≥44 each way).
4. **Page padding.** `<main>` keeps `padding-bottom: 110px` (dock 68 + 16 gap + air) plus `env(safe-area-inset-bottom)`; the page root uses `min-height: 100dvh`, never `100vh`.
5. **`ScrollRow`** (`gap` 6 | 8): flex, `overflow-x: auto`, `margin: 0 -14px`, `padding: 0 14px`, `scrollbar-width: none` (and the WebKit equivalent via the element's own style where possible; if a scrollbar rule truly needs CSS, it is the one allowed addition to `index.css`, named `.bg-scroll-row::-webkit-scrollbar`). Children never shrink. Used for lenses, tabs, filters, tracks and step chips.
6. **`BottomSheet`** on `@radix-ui/react-dialog`: overlay `--sheet-dim`; content fixed to the bottom, full width, radius 22px 22px 0 0, background `--solid`, 1px top border `--glass-border`, `box-shadow: var(--shadow-sheet)`, padding 10px 16px calc(24px + env(safe-area-inset-bottom)), column gap 12px, max-height 88dvh with its own scroll; a grabber 40×5, radius 3, `--line`, centred at the top. Focus trapped, Escape closes, a downward drag of more than 80px on the grabber closes, a visible Close control for keyboard users (`IconButton` "Close", `X`). Title required (`Dialog.Title`, may be visually hidden).
7. `SiteFrameView` uses `MobileHeader` + `Dock` below 768px.

**Do not.** Edit `MobileTopBar`, `MobileBottomNav`, `ProfileDrawer` or `RightRailDrawer`. Blur anything other than the header and dock.

**Done when.** The mobile header and both dock states in the Frame section compare within 0.04 in both themes; on a 390×844 viewport the dock stays above the bottom edge while scrolling, the last element of a long page is fully visible above it, and the sheet opens, traps focus, closes on Escape.

**Commit.** `UI-P19: mobile header, dock, bottom sheet and scroll row`
