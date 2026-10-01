# UI-P16 — The frame skeleton and the `site_frame` flag

Follow `design/RULES.md`.

**Goal.** A new page frame, `SiteFrame`, built beside `FlatShell` and switched on per route behind a `site_frame` flag. This prompt builds the skeleton (backdrop, column, slots) and the flag. UI-P17 to UI-P19 fill the slots; UI-P20 moves the first route.

**Read first.** `src/components/AppShell.tsx` (`allNavItems`, how it mounts `FlatShell`, the drawer and bottom-nav handlers), `src/components/shell/FlatShell.tsx` and `flat-shell.css` (read only — never edit), `wideRoutes.ts`, the existing feature-flag reader (the handoff points at `src/lib/reblog/flags.ts` as the pattern — read it, but note `src/lib/reblog` is legacy and is deleted later, so **copy the pattern, import nothing from it**), the `feature_flags` table, `src/App.tsx`, `design/HANDOFF.md` §3.

**Reference.** Every desktop board in `design/reference/desktop/` (the area under the browser strip) and every mobile board; `data-ui="site-header"`, `"breadcrumb"`, `"site-footer"`, `"mobile-header"`, `"dock"`.

**Build.**
1. **Flag** `src/lib/shell/flags.ts`: `isSiteFrameOn()` and a `useSiteFrameFlag()` hook, reading a `site_frame` row from `feature_flags` the same way the existing reader does (same table, same caching, missing row = off), with no import from `src/lib/reblog`. In development builds only, `?frame=site` or `?frame=flat` overrides it for the browser session (sessionStorage, wrapped in try/catch).
2. **Route list** `src/components/shell/siteFrameRoutes.ts`: `SITE_FRAME_ROUTES: string[]` (React Router patterns) and `usesSiteFrame(pathname)`. Starts empty. Each page prompt adds its own routes.
3. **`SiteFrameView`** (pure, props only) in `src/components/shell/SiteFrame.tsx`, `data-testid="site-frame"`:
   - a root `position: relative; min-height: 100dvh` with `PageBackdrop` (UI-P13) as its first child;
   - **desktop (≥768px):** a header slot (sticky, `top: 0`, `z-index: 20`), then `<main id="main">` — `max-width: 1280px`, `margin: 0 auto`, `padding: 8px 0 46px` at ≥1328px and `8px 24px 46px` below it — holding the breadcrumb slot and then the page; then the footer slot. The 46px bottom padding is the gap between the last panel and the footer on every board;
   - **phone (<768px):** the mobile header slot (sticky), `<main id="main">` with `padding: 14px 14px 110px` and a column gap of 12px, then the dock slot (fixed; UI-P19);
   - `variant: "site" | "bare"`. `bare` (sign in, join, reset, verify) renders only the backdrop and the page.
   - A "Skip to content" link as the first focusable element, visible on focus, targeting `#main`.
4. **Board fit.** Page views take `fit?: "board" | "content"` (default `content`). The dev compare page passes `board`: on desktop the page's grid is exactly **820px** tall (64 header + 8 + 40 breadcrumb + 820 + 46 + 88 footer = 1066, the board height under the browser strip), so panels that fill in the reference get the reference height. On live routes (`content`) the same panels take the reference height as `min-height` and grow with their content (the feed and the wall keep paging). Export a tiny helper `boardHeight(fit)` so every page does this the same way.
5. **`SiteFrame`** (container) wraps the view and supplies live chrome data (from UI-P17–UI-P19). The dev compare page renders `SiteFrameView` with `design/fixtures/sample-data.json → viewer`.
6. **Dev compare page**: `/dev/kit/pages/:page` now renders `SiteFrameView` around the page view, and at `viewport=mobile` renders at 390px wide with the phone chrome.

**Do not.** Touch `FlatShell`, `flat-shell.css`, `AppShell`'s existing layout, or any route yet. Use `position: fixed` for the backdrop.

**Done when.** `/dev/kit/pages/frame?theme=noon|dusk&viewport=desktop|mobile` shows the empty frame (backdrop, empty slots, 820px grid placeholder) at the reference sizes; the flag reads `false` from the live table and `?frame=site` flips it in dev only; tier1 e2e unchanged.

**Commit.** `UI-P16: SiteFrame skeleton and site_frame flag`
