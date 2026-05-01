# Notifications UI cleanup

The current page looks broken because the NeoScale shell already renders a "← Back" button and a "Notifications" page title (see `NeoScaleShell.tsx` line 1416 + `renderBackFaceContent`), but `src/pages/Notifications.tsx` then renders its **own** `← Back` link and `<h1>Notifications</h1>` immediately below. That's why the screenshot shows two stacked back-links and two "Notifications" titles. A few smaller polish issues stack on top of that.

## Issues visible in the screenshot

1. Duplicate "← Back" (shell + page).
2. Duplicate "Notifications" title (shell uses Playfair, page uses Inter — they fight).
3. "Mark all as read" sits on a header row with no title to its left, looks orphaned.
4. Tabs row hugs the very top of the page body with no breathing room.
5. Empty state is centered text only — feels lifeless on a tall surface.
6. Cards use a chunky 4px teal left border for unread, plus a teal-tinted background on pulse — too noisy for a feed of small rows.

## Plan

### 1. `src/pages/Notifications.tsx` — strip duplicated chrome, restructure header

- Remove the in-page `<Link to="/">← Back</Link>` block entirely (shell owns it).
- Remove the in-page `<h1>Notifications</h1>` (shell owns it).
- Replace the current header `<div>` with a single compact toolbar row that holds:
  - **Left:** the All / Unread tabs (already designed, just move them up).
  - **Right:** "Mark all as read" button (disabled state when `unreadCount === 0`, same styling as today but smaller).
- Drop the `marginBottom: 8` / `marginBottom: 12` stack and use a single `border-bottom` divider under the toolbar.
- Reduce outer wrapper padding from `8px 0 32px` to `0 0 32px` (shell already pads).

### 2. Empty state polish (`EmptyAll`, `EmptyUnread` in same file)

- Add a soft circular icon badge above the headline (Bell for All, CheckCircle for Unread) using the same `IconBadge` aesthetic as `NotificationCard` (36–48px, teal tint, 1px ring).
- Tighten copy:
  - All: "You're all clear" / "Follows, references, mentions and messages will land here."
  - Unread: "All caught up" / "Nothing new since your last visit."
- Constrain max width ~360px and center.

### 3. `src/components/notifications/NotificationCard.tsx` — visual refinements

- Replace the 4px solid teal left border for unread with a subtler treatment: keep the border slot at 2px and use `rgba(46,196,182,0.55)` for unread, `transparent` for read. Less shouty, still scannable.
- Change pulse background from `rgba(46,196,182,0.15)` (very loud teal wash) to `rgba(46,196,182,0.06)` plus a 1-second teal ring fade on the border.
- Bump card vertical rhythm: `mb-1.5` → `mb-2`, `py-3.5` → `py-3`, gap stays 3.
- Move "Mark as read" out of the always-on-hover column and into a small icon-only check button (`Check` from lucide, 12px) in the top-right that only renders when `!isRead`. Avoids layout shift on hover and cleans up the right column.
- Right column: keep only the CTA button. Reduce CTA padding `5px 10px` → `4px 9px`, font 11→11 (unchanged). For `new_follower` not-following, keep the orange treatment.
- Group header: reduce `marginTop: 18` → `14`, keep typography.

### 4. No changes needed to:

- Data layer (`getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, realtime hook).
- Routing or shell wiring.
- Backup `Notifications.legacy.tsx`.

## Acceptance check

- Only one "← Back" and one "Notifications" title visible on `/notifications`.
- Tabs sit directly under the shell title, "Mark all as read" aligned right on the same row, divider underneath.
- Empty state shows a teal icon badge + 2 lines of copy, vertically comfortable.
- Unread cards show a thin teal left rule (not a chunky bar); pulse is a soft glow, not a teal wash.
- "Mark as read" is a small check icon in the card's top-right, no hover layout shift.
- Existing data, realtime arrivals, infinite scroll, deep-links, and "Mark all as read" continue to work unchanged.
