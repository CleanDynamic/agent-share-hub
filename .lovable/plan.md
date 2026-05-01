## Why it's broken

Two compounding problems, both rooted in a wrong assumption from the previous turn.

**Problem 1 — There is no edge-to-edge in NeoScale.** `NeoScaleShell` is built around a fixed 600 × 775 px middle card that flips in 3D between a home feed (front face) and the route outlet (back face). My previous plan tried to make Messages "full-bleed" — it can never be full-bleed inside that shell. The flip mechanism, the right Explore panel hide, and the page-shell removal all "worked" but the result is just a 600 × 775 box hosting a layout (320 list + chat pane + ThreadView with absolute composer) that was designed for a full window.

**Problem 2 — The composer escapes the card.** `ThreadView` renders the `MessageInputBar` with `position: absolute` (or fixed) anchored to the viewport, not to the card. That is why screenshot 1 shows the composer floating in the bottom-right of the page **outside** the middle card. Once it is painted outside, the back face is mostly empty (the "black void"), and because `LiquidGlassPanel` clips with `overflow: hidden`, anything that does manage to escape leaves a ghost on the WebGL surface that persists across navigation — that is the "glitch stays there when I go to other pages."

Screenshot 2 (the one that looks correct-ish) is just the *empty* state — no thread selected, no `ThreadView` mounted, no composer to escape. As soon as you click `TheGrizzler`, the ThreadView mounts, the absolute composer leaks, and the card goes black.

## Fix

Three small, surgical changes. No new architecture, no shell rewrites.

### 1. Make Messages fit the 600×775 card

`src/pages/Messages.tsx` — keep the two-column layout but reclaim space for the chat pane:

- Wrap the root in `position: relative; overflow: hidden; height: 100%; width: 100%` so the card becomes the containing block for any absolutely-positioned children inside (composer, modals, drawers).
- Shrink `MessagesThreadList` width from 320 → **220** when inside NeoScale. The card is only 600 wide; 320 leaves 280 for the chat pane which is unusable. A `width: 220` list + 380 chat pane fits the card.
  - Make the list width a prop (`width?: number`) on `MessagesThreadList` defaulting to 320 so other layouts still work.

### 2. Stop ThreadView from leaking out

`src/components/dm/ThreadView.tsx` — the composer (`MessageInputBar`) is positioned against the viewport. Change it to `position: absolute` anchored to the ThreadView root, and make the ThreadView root `position: relative; height: 100%; min-height: 0; overflow: hidden`. The message list scrolls inside, the composer pins to the bottom of the card — not the bottom of the screen.

I will read `ThreadView.tsx` and `MessageInputBar.tsx` before editing to find the exact element/style to change.

### 3. Restore the right Explore panel

The previous turn hid the right Explore panel on `/messages`, premised on "we need horizontal room for the two-column UI." We don't — the card is fixed-width regardless. Restore the right panel by removing the `/messages` exclusion at line 1638 of `NeoScaleShell.tsx`. This brings the page visually in line with every other route in the shell (Library, Drafts, Notifications all keep the right panel).

### Out of scope (intentionally)

- I am **not** touching the flipper snap effect, the back-face render branch, or the `ns-page-shell` chrome — those changes from the prior turn are correct for `/messages` and should stay (no duplicate "Messages" header, no `← Back`).
- I am **not** modifying the data layer, modals, notifications, or unread badge.
- I am **not** trying to make Messages "look like" the v0 mockup which assumes a full-width layout. Inside NeoScale it will be a tighter 220+380 split. If you want the wide v0 layout, that is a separate decision: switch the `Layout` export from `NeoScaleShell` back to `AppLayout` for the `/messages` route only — happy to do that as a follow-up if you want.

## After the fix

- Click a thread → conversation pane renders inside the card, composer pinned to the bottom of the card (not floating in the page).
- No black voids; no WebGL ghost trailing into other routes.
- Right Explore panel returns on `/messages`.
- Navigation in/out of `/messages` is clean.

## Files touched

- `src/pages/Messages.tsx` — root container styles + pass `width={220}` to thread list.
- `src/components/messages/MessagesThreadList.tsx` — accept optional `width` prop.
- `src/components/dm/ThreadView.tsx` — root becomes positioning context; composer pinned to it.
- `src/components/NeoScaleShell.tsx` — remove `/messages` exclusion on the right panel (line 1638).
