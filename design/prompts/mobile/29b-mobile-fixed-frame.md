# 29b: One fixed frame

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

The phone has one frame that never moves: the same header on every dock page, the dock on the screen edge, and the page itself scrolling between them. Match stills `01-home.jpg`, `02-home-bars-hidden.jpg` and `07-builds.jpg`: the top bar's top edge is at the same place in all three, the dock is identical, and nothing from the desktop footer appears.

## Do

1. **The page scrolls, not a box inside it.** In the recordings of the current app, a thin scrollbar appears partway down the screen on Home, Builds and Activity: an element inside the frame scrolls, not the page. That stops Safari shrinking its address bar, breaks tap-the-status-bar-to-top, and changes the scroll momentum.
   - Below 768px, find every ancestor of the page content in `SiteFrame.tsx` (and any page wrapper under it) with `overflow: auto | scroll` or a fixed `height`/`max-height` tied to the viewport, and remove them on the phone so `document.scrollingElement` scrolls. `overflow: clip` on panels may stay (it does not scroll).
   - The phone top bar (`MobileHeader.tsx` or its current name) and the tabs under it become `position: fixed; top: 0`, full width, Page fill, z-index above content. The dock becomes `position: fixed; bottom: 0`.
   - The page content gets `padding-top` = the header's height + `env(safe-area-inset-top)` and `padding-bottom` = the dock's height + `env(safe-area-inset-bottom)`, both read from `chromeSize.ts`, which is the only place these heights live.
   - Prompt 20's hide-on-scroll (the hook behind `useBarsHidden`, check its name) listens to `window` scroll, not the old inner box. Keep its behaviour: hide after 52 of downward scroll, return on any upward scroll of 8 or more, never hide at the top, during a sheet or with reduced motion.
2. **One header height, one top padding.** Today the bar sits about 100pt below the address bar on Home, 45pt on Builds and 35pt on Activity, because Home adds the safe-area inset a second time.
   - The bar is 44 tall on every dock page: avatar 32 (radius 8) at the left edge + 16, centre slot (the logo, 56 wide, on Home; the page title 17/22 700 elsewhere), and Search at the right in a 44 hit area with a 22 icon. Activity puts "Mark all read" (15/20, Text 2) where Search sits.
   - Pages with tabs or pills (Home, Builds, Activity, OpenBuilds) add one 44 (Home tabs) or 52 (pill rows: 32 pills with 10 above and below) row under the bar, inside the fixed header.
   - The only top padding is `env(safe-area-inset-top)`, applied once by the header. Remove every page-level top margin or padding that adds to it.
   - The structural line (Raised, 1px) sits on the header's bottom edge.
3. **Hide the desktop footer on the phone.** `SiteFooter.tsx` (the beaver mark, About, Connect a tool, Sign out) renders under page content on the phone. Do not render it below 768px. Check that About and Connect a tool are reachable from the account drawer and Sign out from the account menu; if either is missing there, add it as a row in the drawer's existing style.
4. **The Lovable badge.** "Edit with Lovable" covers the dock and the sign-in footer. It is injected by the Lovable hosting, not by this repo. Write in your note that the owner turns it off in the Lovable project settings. Do not add CSS that targets it.
5. **The dock on the edge.** `Dock.tsx`: 49 tall plus `env(safe-area-inset-bottom)`, Page fill, the structural line on its top edge, fixed to the bottom. (Its slots and icons change in 29d; here only its position and height.)
6. **Installable to the Home Screen.** Add `public/manifest.webmanifest`: `name` "OpenBuilds", `short_name` "OpenBuilds", `start_url` "/", `display` "standalone", `background_color` and `theme_color` "#040504", icons from `public/brand/` at 192 and 512 (generate the 512 from `beaver-dark.png` on `#040504` if it does not exist). In `index.html` link it, and add `apple-mobile-web-app-capable` "yes", `apple-mobile-web-app-status-bar-style` "black-translucent", `apple-mobile-web-app-title` "OpenBuilds", and an `apple-touch-icon` at 180. With `black-translucent` the page draws under the status bar, which the header's safe-area padding already handles.
7. **Tests.**
   - A Playwright test at 390 x 844 that visits Home, Builds, OpenBuilds and Activity and asserts the top bar's `boundingBox().y` is identical on all four.
   - A test that `document.scrollingElement.scrollTop` changes when the feed is scrolled (the page is the scroller) and that no element inside the frame has a computed `overflow-y` of `auto` or `scroll` on those four pages.
   - A test that `SiteFooter` is not rendered at 390.

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

- At 390 on an iPhone in Safari: scrolling Home shrinks Safari's address bar; tapping the status bar scrolls to the top; the header does not move when switching between the four dock pages (compare with `01-home.jpg` and `07-builds.jpg`).
- No footer, beaver mark or Sign out link appears in page content on any phone page.
- Added to the Home Screen, the app opens full screen with the dock on the bottom edge.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.
