# Shared ShellHeader for the centre column

## Goal
Stop every page from inventing its own top region. A single `ShellHeader` component owns the Back button, page title, primary action, tabs, search/controls row, and a secondary right-of-tabs action. Every page renders this component at the top of the centre column with identical positioning and spacing.

## 1. New component: `src/components/shell/ShellHeader.tsx`

Fixed vertical rhythm (always the same, regardless of which optional rows are present):

```text
+----------------------------------------------------------+
| ROW 1  (h:56, pad:0)                                     |
|  [Back]      ......[toggleSlot center]......  [Primary] |
+----------------------------------------------------------+
| ROW 2  (h:32, mt:8)   Page title (optional)              |
+----------------------------------------------------------+
| ROW 3  (h:44, mt:16)  [Tab • Tab • Tab]   [secondary →] |
+----------------------------------------------------------+
| ROW 4  (mt:12)        searchSlot / controls (optional)   |
+----------------------------------------------------------+
| CONTENT begins at mt:16 after the last rendered row      |
+----------------------------------------------------------+
```

### Props
```ts
type ShellHeaderProps = {
  onBack: () => void;                      // Back always present
  primaryAction?: { label: string; icon?: LucideIcon; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean }; // ghost text link, right of tabs row
  title?: string;
  tabs?: { id: string; label: string; count?: number }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  searchSlot?: ReactNode;
  toggleSlot?: ReactNode;                  // center of row 1
};
```

### Style tokens (hard-coded inside the component so every page matches)
- Back: ChevronLeft 16px + "Back" Inter 13/500, color `rgba(255,255,255,0.70)` → hover `0.95`, bg `rgba(255,255,255,0.04)`, radius 8, padding `8px 12px`.
- Primary action: bg `linear-gradient(135deg,#E8571A 0%,#C44514 100%)`, Inter 13/600 white, padding `8px 16px`, radius 8, optional 14px icon left. ORANGE only — no green anywhere.
- Title: Inter 18/600 `rgba(255,255,255,0.95)`, left aligned, single line.
- Tabs: Inter 13/500, padding `10px 0`, gap 24; active `#E8571A` with 2px orange underline; inactive `rgba(255,255,255,0.55)`. Count pill: Inter 10/600, radius 999, bg `rgba(255,255,255,0.08)`.
- Secondary action (in row 3 right): transparent, Inter 12/500, `rgba(255,255,255,0.65)` (disabled `0.30`).
- Row math is implemented with fixed heights + `margin-top` on each optional row so absent rows do not shift content.

### Responsiveness
- Honours `useBreakpoint`; on `mobile` the Back button is suppressed (the existing `MobileTopBar` covers it) but the rest of the rows render identically. No other layout changes.

## 2. Remove existing ad-hoc back buttons
- Delete the floating `.ns-back-btn` injected in `src/components/NeoScaleShell.tsx` (CSS rule + the conditional `<button>` in `ns-middle-wrapper`). The new header owns Back.
- Leave the right rail, left rail, mobile chrome, and Home `FeedShell` untouched.

## 3. Page rollouts (replace each page's current header region only)

| Page | File | onBack | title | primaryAction | tabs | searchSlot | toggleSlot | secondaryAction |
|---|---|---|---|---|---|---|---|---|
| Messages | `src/pages/Messages.tsx` | ✓ | partner name or "Messages" | — | Primary / Requests | "Search conversations…" input | — | — |
| Library | `src/pages/Library.tsx` | ✓ | — | "New collection" + Plus (orange) | Collections / All saved items | — | — | — |
| Discover | `src/pages/Discover.tsx` | ✓ | — | "Submit a blueprint" | Blueprints / Stages / Blocks | "Search blueprints…" input + Filters button | — | — |
| Upload | `src/pages/Upload.tsx` (and `UploadTypeSelector.tsx` if it is the entry) | ✓ | — | — (Publish stays in right rail) | — | — | existing BLUEPRINT / BUILD toggle | — |
| Drafts | `src/pages/Drafts.tsx` | ✓ | — | "New draft" + Plus (orange) | — | — | — | — |
| Notifications | `src/pages/Notifications.tsx` | ✓ | — | — | All / Unread (with counts) | — | — | "Mark all as read" (disabled when unread = 0) |

For each page:
1. Import `ShellHeader`.
2. Delete the existing top toolbar / tab strip / search row / "New …" button / "Mark all as read" button JSX.
3. Render `<ShellHeader …/>` at the very top of the page's returned tree, then keep the existing content below it unchanged.
4. Wire `onBack={() => navigate(-1)}`.
5. For Library/Drafts: route the existing "create" handler into `primaryAction.onClick`, keep the modal/flow logic intact, just change where the trigger lives.
6. For Notifications: pass `handleMarkAll` to `secondaryAction.onClick` and `disabled: unreadCount === 0`; remove the local "Mark all as read" button and the inline tabs (the header renders them).
7. For Messages: pass the conversation partner name as `title` on a thread view, "Messages" on the list view; keep `MessagesThreadList`'s search input by lifting it into `searchSlot` (or pass a small controlled wrapper).
8. For Upload: extract the existing BLUEPRINT/BUILD toggle into `toggleSlot`. Do not touch the right-rail Publish button.

## 4. Verification
- After build, screenshot each of the 7 routes at the current viewport via `browser--view_preview` + `browser--screenshot`.
- Eyeball-check (and crop with `image_tools--zoom_image` where needed) that:
  - Back button's top-left coordinates match across all 7 pages.
  - Primary action's top-right coordinates match across Library / Discover / Drafts.
  - Tabs baseline matches across Messages / Library / Discover / Notifications.
  - First content element sits 16px below the last header row on every page.

## Out of scope (explicitly not touched)
- Left rail, right rail (Explore/Browse/Trending), Home `FeedShell`, mobile bottom nav, page content below the header, any business logic, any backend/RLS work.

## Technical notes
- Component is pure presentational; no data fetching. Tabs are controlled via `activeTab` + `onTabChange` so pages keep owning routing/query-param state (e.g. Notifications' `?filter=unread`).
- All colours/sizes are inline styles inside `ShellHeader` to guarantee parity and avoid Tailwind drift; matches the existing inline-style convention used in `Notifications.tsx` and `AuthButton.tsx`.
- No new dependencies.
