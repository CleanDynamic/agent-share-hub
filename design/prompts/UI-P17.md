# UI-P17 — The site header (desktop)

Follow `design/RULES.md`.

**Goal.** The sticky glass header: lockup, four primary links with the lamp under the current one, search, New build, Activity, theme, account.

**Read first.** `AppShell.tsx` (`allNavItems`: take every href from it, do not invent routes), `components/shell/ShellHeader.tsx`, `NavSearch.tsx` (search behaviour to reuse), the current notification bell and `lib/notifications/` (`getUnreadCount()`, `realtime.ts`), `contexts/ThemeContext.tsx`, `useAuth()`.

**Reference.** `design/reference/components/{noon,dusk}.html` → section `Frame` (header with Gallery current); `data-ui="site-header"` on every desktop board (the current link changes per board).

**Build** `src/components/shell/SiteHeader.tsx` (+ a pure `SiteHeaderView`), `data-testid="site-header"`:
1. **Bar.** `<header>` full width, height 64, background `--header`, 1px bottom border `--header-border`, `backdrop-filter: blur(16px) saturate(1.15)` (the one full-width blurred surface on desktop). Inner row: the same column as `<main>` (max-width 1280, centred), height 64, flex, `align-items: center`, gap 28px.
2. **Lockup** size 21, a link to `/` named "buildgallery home".
3. **Primary links** in `<nav aria-label="Primary">`, flex, no gap: **Home · Gallery · Bounties · Library** (hrefs from `allNavItems`). Each link: height 64, padding 0 14px, Figtree 14px; current: weight 600, `--text`, `aria-current="page"`; others: weight 500, `--text2`. The current link has a lamp: an absolutely placed ellipse 26×6, `left: 50%`, `margin-left: -13px`, `bottom: -1px`, `--lit`, `box-shadow: var(--nav-lamp-glow)`. "Current" is decided by the route's section (a build page counts as Gallery, the rebuild page as Gallery, import and compose as none, Activity as none — the bell shows it instead).
4. A flexible spacer.
5. **Search** `HeaderSearch` (new; reuse `NavSearch`'s submit behaviour and destination): a `<label>` 280×38, padding 0 12px, radius 12, background `--field`, 1px border `--line`, gap 8px, colour `--text2`; `Search` icon 15px; `<input type="search">` named "Search builds", placeholder "Search builds, makers, tools", Figtree 13px, `--text`, transparent, no border; a key hint "/" in DM Mono 10px with a 1px `--line` border, radius 6, padding 0 5px. Pressing "/" anywhere outside a text field focuses the input.
6. **New build**: `Button` primary, size 38, `Plus` icon, "New build" → the existing create route (from `allNavItems` / the current bottom nav). This is chrome; it does not count as the page's primary.
7. **Activity**: a 38×38 link to `/notifications`, radius 12, 1px border `--line`, `Bell` 17px `--text`; background `--tab` when on `/notifications`, otherwise transparent. Unread badge when count > 0: absolute `top: -4px; right: -4px`, min-width 16, height 16, radius 8, background `--action`, text `--on-action`, DM Mono 10px (reference 9px; RULES minimum), "9+" above nine. Accessible name "Activity, N unread". Count from `getUnreadCount()`, kept live by the existing realtime channel.
8. **Theme**: `IconButton` size 38, `Sun` on Noon / `Moon` on Dusk, named "Theme: Noon" / "Theme: Dusk". Click switches between Noon and Dusk (an explicit choice). The three-way choice including System lives in the footer (UI-P18).
9. **Account**: signed in → `Avatar` 34 as a button named "Account" that opens a small menu (Profile `/profile/:handle`, Library, Settings if the route exists, Sign out) — use `@radix-ui/react-dropdown-menu` if it is already in `package.json`, otherwise a non-modal Radix Dialog anchored under the avatar; menu surface `--solid`, radius 14, `--shadow-float`. Signed out → `Button` secondary 38 "Sign in" → `/login?redirect=<current path>`.

**Do not.** Edit `ShellHeader`, `NavSearch` or the old bell (they stay for `FlatShell`). Blur anything inside the header.

**Done when.** The header in the Frame section compares within 0.04 in both themes; keyboard order is lockup → links → search → New build → Activity → theme → account; "/" focuses search; the badge updates when a notification arrives.

**Commit.** `UI-P17: site header`
