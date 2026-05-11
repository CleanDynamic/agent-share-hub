## Goal

On the upload editor at `lg`/`md` breakpoints, drop the floating toggle button. Instead, the right panel (WorkspaceShell) is always shown, and a new **Navigation** tab is prepended to the WorkspaceShell tab rail so the user can still reach the left-panel nav items (Home, Discover, Library, Drafts, Messages, Notifications, Profile, Analytics) from inside the right panel.

Behaviour matrix (no change for `xl` and `mobile`):

| Breakpoint | Left rail | Right panel | Nav tab in right panel |
|---|---|---|---|
| xl ≥1280 | shown | shown | hidden |
| lg/md on upload editor | hidden | shown | **shown (5th/6th tab)** |
| lg/md elsewhere | shown | hidden | n/a |
| mobile | MobileNav | n/a | n/a |

## Changes

### 1. `src/components/NeoScaleShell.tsx`
- Remove `uploadSidePanel` state + its reset effect.
- Remove `showUploadToggle` derived flag.
- Simplify visibility:
  - `showRightPanel = breakpoint === "xl" || (isUploadEditor && isSmallDesktop)`
  - `showLeftPanel = (breakpoint === "xl" || breakpoint === "lg" || breakpoint === "md") && !(isUploadEditor && isSmallDesktop)`
- Update `nativeW` formula: when `isUploadEditor && isSmallDesktop`, use `844` (middle 600 + gap 24 + right 220), independent of any toggle state.
- Delete the entire toggle `<button>` block (lines ~2025–2061).
- Pass `showNavTab={isUploadEditor && isSmallDesktop}` to `<WorkspaceShell />`. (Right panel currently renders `<WorkspaceShell />` directly inside NeoScaleShell — confirm and update that call site.)

### 2. `src/lib/workspaceStore.ts`
- Extend `WorkspaceToolId` union with `'nav'`.
- Add `nav: undefined` to `initialToolState`.
- No changes to `setStageOpen` defaulting logic.

### 3. `src/components/workspace/WorkspaceShell.tsx`
- New optional prop: `showNavTab?: boolean` (default `false`).
- New tool definition `{ id: 'nav', label: 'Navigation', icon: Home, render: () => <NavTool /> }` added to `TOOLS` registry.
- When `showNavTab` is true, prepend `'nav'` to both `ARTICLE_MODE_ORDER` and `STAGE_MODE_ORDER` at render time (compute `visibleTools` with the prefix, don't mutate the constants).
- Skip the selection-driven auto-switch to `inspector` when `activeTool === 'nav'` so users can stay parked there.
- New local `NavTool` component (in same file or sibling `tools/NavTool.tsx`):
  - Vertical list of nav rows (Home / Discover / Library / Upload / Drafts / Messages / Notifications / My Profile / Analytics).
  - Uses the same `useAuth`, `useUnreadMessages`, `useUnreadNotifications`, `useDraftCount`, `useNavBadges` hooks already used by NeoScaleShell, and the same `ICONS` map (extract or duplicate the small icon set — duplication is fine to avoid coupling).
  - Hides `authOnly` rows when logged out and `creatorOnly` when not a creator.
  - `onClick` calls `navigate(route)`. No 3D flip needed — the upload editor stays mounted; on navigation the route changes and the shell takes over.
  - Styled to match existing tool panel surface (subtle hover row, badge pill on the right reusing the badge styling pattern already in NeoScaleShell, but scoped locally).

### 4. Out of scope
- `src/components/layout/AppLayout.tsx` and `src/components/layout/RightPanel.tsx` (legacy AppLayout shell — not the live shell).
- Mobile chrome and `xl` behaviour.
- WorkspaceShell tab order in non-upload contexts.

## Verification

Resize preview to ~1100 px on `/upload/blueprint?...`:
- No floating toggle visible.
- Right panel always visible with WorkspaceShell.
- Tab rail shows: **Navigation** | Inspector | Outline | Comments | Versions (and Library when a stage is open).
- Clicking Navigation reveals the nav list; clicking Home navigates to `/`.
- At `xl` (≥1280), both panels return and the Navigation tab disappears.
- At `<768`, MobileNav still takes over.
- On `/discover` at 1100 px, behaviour unchanged (left rail visible, right hidden, no Nav tab).
