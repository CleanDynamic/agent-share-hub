# 29e: Motion and transitions

You are working in the OpenBuilds repository (`src/`, React 18, Vite, TypeScript, Supabase). This prompt continues the **Synth draft brand pack** series (prompts 01 to 16, already applied) with the **phone version**: every screen below 768px, as drawn in the Synth mobile brand pack (390 wide boards). It takes the look of Spotify's mobile app (shades of surface, no lines, shelves that scroll sideways, bold filled icons on the current tab) and the structure of X's (avatar left, logo centre, one action right, underlined tabs, a round post button, a five-slot bottom bar), using only what the repo already does. Do the work now. Do not ask questions; where this prompt is silent, keep what prompts 01 to 16 and the code do today.

## Where this sits

This is one of **six prompts, 29b to 29g, that run straight after 29a** and before the iOS and Android prompts (30 onwards). Together they make the phone version match the reference click-through exactly. Run them in order, each in a fresh session, each on its own branch, merging after its checks pass. Read the merged code first and change that; names of files, functions and columns come from the files themselves.

**The reference.** `design/reference/mobile-fixed/` holds the reference video (`openbuilds-mobile-fixed.mp4`) and 13 stills taken from it at 780 x 1688 (a 390 x 844 phone at 2x). Open the stills this prompt names and match them: positions, sizes, gaps, colours and what is on screen. Where a still and this text disagree, this text wins and you say so in your note.

## What 29b to 29g change in the phone rules

These replace the matching lines of the phone rules below, for every screen under 768px. Desktop does not change.

- **Type:** 17/22 for post text, names and row titles (700 for names, 600 for row titles); 15/20 for secondary text, handles, ages and tabs; 13/16 for the build line, counts and small labels; the bar title 17/22 700. Mono for counts at their row's size. No other phone sizes except the page title on reading pages (24/28).
- **Lines:** exactly two structural 1px lines in Raised (`#242925`): under the fixed header (under the tabs where a page has them, under the bar where it does not) and along the top of the dock. They mark where fixed chrome ends and scrolling content begins. Everywhere else, still no lines.
- **Motion:** two new phone tokens in `src/lib/theme/motion.ts`, `PHONE_QUICK` 160ms and `PHONE_STANDARD` 280ms, both on `cubic-bezier(.2,.8,.2,1)` (`PHONE_EASE`). Sheets, pushed pages and the hiding bars use `PHONE_STANDARD`; press states, tab indicators and content arriving use `PHONE_QUICK`. Dock tab switches are instant. Reduced motion turns every slide into a `PHONE_QUICK` fade.
- **The dock:** 49 tall plus the bottom inset, five icons with no labels, in this order: **Home, Builds, Import, OpenBuilds, Activity**. There is no New slot.
- **Creating:** the round post button is the only control that creates. It sits on Home, Builds, OpenBuilds and Activity, and opens the New sheet with **New build, New post, Connect a tool**. Import is not in the sheet, because it has its own dock slot.
- **Mint:** a Mint fill appears once per screen, on that screen's main action. Mint text or icons only for a Like that is on, an unread mark and links in text.

## Phone rules (every prompt in this part)

- **The phone view is below 768px**: `useIsPhone()` from `src/components/shell/useMinWidth.ts` (`max-width: 767px`) in components, `@media (max-width: 767px)` in CSS. **Nothing at 768 and up changes.** Wrap every change in the phone branch; where a component is shared, add a `phone` prop or branch inside it rather than changing its desktop output. Run the desktop screenshots again at 1440 and 1024 and confirm they are identical.
- **Width:** design at 390, check at 360 and 430. Side margin 16. Reading line at most 358.
- **Safe areas:** the top bar sits under `env(safe-area-inset-top)`; the bottom bar, sticky footers and sheets pad by `env(safe-area-inset-bottom)` (34 on the boards). Never draw a fake status bar.
- **Touch:** every target at least 44 by 44 (`TOUCH_MIN`, `touchHit()` in `src/lib/theme/controls.ts`), 8 between neighbours. No hover-only information: anything a tooltip says is visible or comes from a long press.
- **Surfaces on a phone:** the desktop's floating panels become sections on the Page shade. A panel's content keeps its inner layout but loses the panel box, except where this prompt asks for a Panel or Card module (`#121513` Panel, `#1B1F1C` Card, `#242925` Raised, radius 12). Still shades of surface, never lines.
- **Type on a phone:** 24/28 600 (tracking -0.02em) only for a visible page title; 20/24 600 (tracking -0.01em) for section heads that state the fact; 17/22 600 for the top bar title and sheet titles; 15/20 for body, rows and post text; 13/16 for meta, labels and pills; mono 13 or 15 for numbers. Geist Serif 400 stays only for works (a build's title).
- **Motion on a phone** (from `src/lib/theme/motion.ts`): a sheet slides up in BASE (200) on STANDARD and down in FAST (150); a pushed page enters from the right in BASE; the drawer slides from the left in BASE; the scrim fades in FAST. Reduced motion swaps every slide for a fade of the same length. Nothing animates a layout property.
- **Icons on a phone** come from the mobile icon set in prompt 18 (`MobileIcon`). Lucide stays on desktop.

## Goal

Every movement on the phone uses one of two durations on one curve, nothing moves that the person did not cause, and nothing flashes. Match the reference video at 0:03 to 0:10 (bars), 0:31 to 0:38 (push and swipe back, stills `09-build-pushed.jpg` and `10-swipe-back.jpg`) and 0:38 to 0:45 (sheet then editor, `11-new-sheet.jpg`, `12-editor.jpg`).

## Do

1. **Tokens.** Add to `src/lib/theme/motion.ts`: `PHONE_QUICK = 160`, `PHONE_STANDARD = 280`, `PHONE_EASE = "cubic-bezier(.2,.8,.2,1)"`, and a helper that returns the reduced-motion version (a `PHONE_QUICK` opacity fade). Replace every other duration and curve used under 768px with these. List what you replaced in your note.
2. **Dock tabs: instant.** Switching dock sections has no transition: the dock icon changes to filled in the same frame, the new page draws its cached content at its remembered scroll (29c). Remove any page fade or `PageArrival` animation for a cached page reached from the dock.
3. **Pushed pages.** Opening a build, a post, a topic or a profile from a feed:
   - The new page enters from the right, `translateX(100%)` to 0 over `PHONE_STANDARD` on `PHONE_EASE`; the page underneath moves to `translateX(-30%)` and its brightness to 88% over the same time. Back reverses it.
   - Its header (back chevron at the left, the title 17/22 700, More at the right) arrives with it, not after it.
   - **Edge swipe back:** a touch starting within 20 of the left edge and moving right drags the pushed page with the finger (and the page underneath from -30% towards 0). Releasing past 35% of the width or with a velocity over 0.5 px/ms completes the back over the remaining fraction of `PHONE_STANDARD`; otherwise it returns. In iOS Safari, where the browser's own back swipe exists, detect `navigator.standalone` or the native app and only enable the custom swipe there; in the browser, let Safari's swipe work.
   - **No black flash.** Keep the old page mounted until the new page's first frame is ready: wrap route changes from feed taps in `startTransition`, and render the outgoing page under the incoming one during the transition. Verify by recording the screen: no frame is plain Page colour between the two pages.
   - Implement once, in the frame's outlet (`FrameOutlet.tsx` or its current name) with the View Transitions API where supported (`document.startViewTransition`) and a CSS transform fallback, not per page.
4. **Sheets.** The New sheet and every phone sheet: the scrim fades to 50% black and the sheet rises from `translateY(100%)` over the same `PHONE_STANDARD`; dragging the grabber moves it with the finger; releasing below a third of its height or with downward velocity over 0.5 closes it over `PHONE_STANDARD`. Today the scrim and sheet run one after the other over about 600ms: run them together.
5. **Sheet to page in one movement.** Choosing New build in the sheet starts the editor's push at the same moment the sheet starts closing, so the two move together (the reference at 0:39.6). Do not wait for the sheet's close to finish.
6. **The bars.** Prompt 20's hiding header and the round button move with `PHONE_STANDARD` on `PHONE_EASE` (today a different duration). With 29b they follow the window scroll.
7. **Press states.** Every tappable element under 768px shows its pressed state on `pointerdown` (not on release): rows and buttons darken by 6% (Raised overlay at 40%), icon buttons shrink to 0.96. Release restores over `PHONE_QUICK`. Use `useInteractive` if it already does this, extended to the phone.
8. **Content arriving.** Data that replaces a skeleton fades in over `PHONE_QUICK` in the same boxes. New posts inserted above the reading position (a refresh while scrolled down, a live insert) keep the post you are reading in place: adjust `window.scrollY` by the inserted height in the same frame.
9. **The keyboard.** When a field is focused on the phone, keep it visible above the keyboard using `visualViewport` (resize and scroll events) and `scroll-margin-bottom: 24px` on fields; the page must not jump twice. 29f uses this on sign-in.

## What must not change

This is a visual restyle. Every behaviour stays exactly as it is:
- Routes, address parameters (`?tab=`, `?kind=`, `?view=`, `?signin=` and the rest), redirects, prefetching and the route table.
- Data reads and writes, query keys, optimistic updates and their rollbacks, toasts and their wording (unless this prompt gives new wording), live channels, autosave, undo and redo, drag and drop, keyboard shortcuts.
- Accessible names, roles, focus order, focus handling on arrival (`PageArrival`, `FocusRescue`, the h1 focus), live regions and announcers.
- Page states (`PageState`): loading, empty, failed with "Try again", signed out. Their copy stays unless this prompt changes it.
- Tests: run the tests for every file you touch. Where a test asserts an old colour, size, radius, font or string that this prompt replaces, update the test to the new value in the same change. Never delete a test to make it pass, and never weaken one that checks behaviour.

Remove from the interface (leave the database, API and backend untouched):
- Everything about reproductions and runs: "Reproduced", "ran your build", run counts, "confirmed", "stale", plaques, lamps, "Re-confirm it still works", "I ran this", reproduction notes, the Reproduced lens, the Notes filter, run challenges, "Where next" built from runs.
- XP everywhere: levels, XP figures and bars, XP rewards and toasts, the XP reset note, leaderboards ranked by XP, and any text about earning XP.
- Tool and harness marks and logos beside names, sessions and facts. Model and tool names may stay as plain text where a field asks for them (a session's harness and model, a tool tile's app, the Connect page).

## Words on screen

- **Headings state the fact.** A section is headed by what it holds: "36 drafts", "8 sessions", "2 published builds", "3 open in your spaces". No label-style heading with the fact underneath, and no subtitle that restates or explains the heading.
- **No repetition.** One word, one place, one meaning per screen. The current nav item already names the page, so on Home, Builds, OpenBuilds and Library the page's h1 is visually hidden (screen readers only, class `sr-only`). A section head never repeats the page title; a tab, button or meta line never repeats the heading above it; a row never says the same thing twice (no "@kit rebuilt" above a "Rebuilt from" box).
- **Posts have no titles.** A feed post is: author row, the post text, pictures, then the build line (the build's name as a 13/500 link with its facts).
- Plain, directional language. No em dashes anywhere in the interface. No exclamation marks.
- Facts are plain text joined by " · ", never chips: "Web app · Made with AI · No coding" (What was built · Role of AI · Skill needed, from `src/lib/classify/lines.ts`, without the stack).

## Check before you finish

- Record the screen at 60fps: dock switches change in one frame; a pushed page slides in over 280ms with no plain-Page frame between pages; the edge swipe follows the finger in the installed app; the New sheet and its scrim move together; New build starts the editor while the sheet closes.
- With reduced motion on, every slide is a 160ms fade.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.
