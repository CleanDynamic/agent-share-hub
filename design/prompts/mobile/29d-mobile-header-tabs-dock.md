# 29d: Header, tabs, dock and the round button

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

The header and dock are quiet and identical everywhere, and there is exactly one way to create. Match stills `01-home.jpg`, `07-builds.jpg`, `08-activity-filter.jpg` and `11-new-sheet.jpg`.

## Do

1. **Avatar.** The 32 avatar in the bar (and the 48 and 40 avatars in feeds and rows) shows the person's picture when they have one. Without one, initials in mono (12 at 32, 15 at 48, 13 at 40), 600, at 62% white, on one of six muted tints chosen by a stable hash of the user id: `#2D3B36`, `#3B2F45`, `#3D3A2A`, `#2A3645`, `#45302D`, `#2F4536`. Radius 8 at 32, 11 at 48, 9 at 40. Add the tints to the tokens file as `avatarTints`, not as literals in components.
2. **Home's tabs** (prompt 20's Following / Everyone):
   - Centred as a pair, not stretched to halves: each tab is its word plus 16 either side, 44 tall, 24 between the two tabs.
   - Current tab 15/20 700 Text; the other 15/20 500 Text 3. The chevron (16, Text 3) 4 after the current tab's word, as prompt 20 says.
   - The indicator is exactly as wide as the word, 3 tall, radius 2, in **Text** (not Mint), on the tab's bottom edge. It moves to the other tab over `PHONE_QUICK` (left and width), instantly with reduced motion.
   - The structural line runs full width under the tab row.
3. **Pill rows** (Builds' lenses, Activity's filters): 32 tall pills, padding 0 14, radius 16, 14/20 500; off: Card fill, Text 2; on: Text fill, Page text. 8 between pills, 16 side margin, 10 above and below. A row that overflows scrolls sideways with a 40 wide fade to Page at the right edge.
4. **The dock** (`Dock.tsx`, `siteNav.ts`, `chromeSize.ts`):
   - Five equal slots, in this order: **Home** (`home`, filled `homef` when current), **Builds** (`builds` / `buildsf`), **Import** (`import`), **OpenBuilds** (`ob` / `obf`), **Activity** (`bell` / `bellf`), from the mobile icon set.
   - Icons 26, centred in each slot 12 from the dock's top; current icon in Text, others Text 3. **No labels.** Each slot is a link with an `aria-label` (Home, Builds, Import, OpenBuilds, Activity) and `aria-current="page"` when current.
   - **Import** goes to `/import` (the route the New sheet's Import already uses in `NewSheet.tsx`). It is a section of its own for the dock's current state.
   - Unread Activity: a 16 tall Mint pill (min width 16, padding 0 4, radius 8) with the count in 11/16 700 Page colour, at the icon's top right (top -4, left 44 within the slot). Over 99 shows "99+". The repo's `useUnreadNotifications` supplies the count.
   - Remove the Mint New pill and its label entirely, and the "New" entry from `SITE_NAV`'s phone dock list. Update every test that expects five labelled slots with New in the middle.
5. **The round post button** (one component, for example `CreateButton.tsx`):
   - 56 round, Mint fill, a 24 plus icon (stroke 2.4) in Page colour, shadow `0 6px 18px rgba(0,0,0,.45)`, 16 from the right edge and 16 above the dock (`bottom: dock height + inset + 16`).
   - Shown on Home, Builds, OpenBuilds and Activity; not on pushed pages, the editor, settings or sign-in. On Home it slides away with the bars (translateY of its own height plus 16, `PHONE_STANDARD`) and returns with them.
   - Tap opens the New sheet. Press and hold for 500ms opens a new build directly (`SITE_NAV.create`), with a light haptic in the native app (prompt 34 and 40 helpers when present). `aria-label` "New", `aria-haspopup="dialog"`.
   - It replaces prompt 20's Home-only post button and any other create entry on these pages; there is no second plus anywhere on them.
6. **The New sheet** (`NewSheet.tsx`): three rows, **New build, New post, Connect a tool** (remove Import, which now has its own slot). Content height: grabber (36 x 5, Raised, 8 from the top, 10 below), three 52 rows (icon 22 Text 2, 14 gap, label 17/22), bottom padding 8 + the inset. Panel fill (`#121513`), radius 20 at the top. Match `11-new-sheet.jpg`.
7. **Tests:** dock order and labels (aria-label only), the badge count and 99+, the round button's presence per page, long press, the sheet's three rows.

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

- The dock at 390 shows five unlabelled icons in the order Home, Builds, Import, OpenBuilds, Activity, on one baseline, no Mint in it except the unread pill (`07-builds.jpg`).
- One Mint fill on Home, Builds, OpenBuilds and Activity: the round button. Tapping it shows the three-row sheet (`11-new-sheet.jpg`); holding it opens a new build.
- Import in the dock opens the import page with the Import slot current.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.
