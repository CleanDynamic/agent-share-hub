# 29f: Builds, OpenBuilds, Activity, the editor and sign-in

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

Each page fixes its own faults, inside the frame, data rules and motion from 29b to 29e. Match `07-builds.jpg`, `08-activity-filter.jpg`, `12-editor.jpg` and `13-sign-in-keyboard.jpg`.

## Do

1. **Builds** (`07-builds.jpg`):
   - Header: avatar, "Builds" centred, Search; the lens pills (All, Rebuilt, Still open, the repo's lenses minus anything removed earlier) in the 52 row; the structural line.
   - List rows: padding 10 16, 12 gap. Left: the build's name 15/20 600 (one line, ellipsis), under it its facts 13/16 Text 2 ("3 sessions · 12 steps · @maker", the repo's facts). Right: its cover as a 48 square, radius 9, Card fill, `object-fit: cover`. No lines between rows. The whole row is the link.
   - The Table, Maps and Classification views stay, reached from a More button in the bar (replace Search's slot with More only if Search is reachable elsewhere on this page; otherwise put More as a second icon before Search). They no longer push the list down as a pill row.
2. **OpenBuilds:** the post box is one 44 row under the header (avatar 32, then "Post anything" or the repo's placeholder in 17/22 Text 3), tapping it opens the post sheet (prompt 20a). The feed uses the 29a post. One skeleton shape from the start (29c).
3. **Activity** (`08-activity-filter.jpg`):
   - Header: avatar, "Activity" centred, "Mark all read" 15/20 Text 2 at the right; the filter pills (All, Rebuilds, Comments and replies, Likes, Follows, the repo's) with the right-edge fade.
   - Rows: padding 12 16, avatar 40 (radius 9), 12 gap, the line 15/20 with the person's name 700, the age 13/16 Text 3 under it. Unread rows: a 6 round Mint dot 5 from the left edge, centred on the avatar. No lines.
   - Remove the "live" label with its dot. Live inserts still happen, as new rows.
   - Empty: the drop ripple and the repo's empty line ("All caught up." or the repo's words), centred in the space between the pills and the dock.
4. **The new build editor** (`12-editor.jpg`):
   - Bar: back at the left, the beaver mark 44 wide in the centre, **"Skip to build" as a 15/20 Text 2 text button at the right** (replacing the outlined Mint chip).
   - Under it: "Draft" 13/16 Text 3; the List / Map / Sources pills (29d pill style; View stays as a More item); "Add your first session" 17/22 700; the session card (Panel, radius 12) with two rows, each with its icon from the mobile set at 20 in Text 2 (`import` for Import from connected chats, `session` for New empty session; today these are blank grey squares), the label 15/20 and the sub-line 13/16 Text 3.
   - The drop zone: 64 tall, radius 12, 1.5px dashed Raised border (the one dashed border on the phone), "Drop sessions or files" 14/20 Text 3.
   - The composer row: avatar 32 and "What did you build?" 17/22 Text 3. Remove its separate plus; the toolbar icons appear only once the composer is focused. "Characters left" and its ring appear only once typing starts.
   - One round button, 44, Raised fill, plus icon in Text, 16 from the right and 12 above the footer: it adds a session. It is not Mint (Publish is this screen's Mint).
   - The footer pinned to the bottom on `#0B0D0C`, 84 tall including the inset: "0 of 4 ready to publish" 13/16 Text 2 at the left, **Publish** at the right (Mint fill, 44 tall, radius 22, 16/20 650, the publish icon at 18). The list scrolls behind it, so there is no dead space.
5. **Sign-in** (`13-sign-in-keyboard.jpg`):
   - Autofill: add to the global stylesheet `input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus { -webkit-box-shadow: 0 0 0 1000px <Card> inset; -webkit-text-fill-color: <Text>; caret-color: <Text>; transition: background-color 9999s; }` using the token values, so fields stay on Card.
   - Errors appear only after Sign in is pressed; each field's error clears as soon as that field changes. Remove the red border shown while typing.
   - Sign in / Sign up become the tab pattern from 29d (44 tall, word-width Text indicator), not small pills.
   - Fields 48 tall, radius 12, Card fill, 16/20 text (no iOS zoom), focused: an inset 1.5px Text ring. Buttons 48 tall, radius 24: Continue with Google (Text fill, Page text), the others Card; Sign in Mint.
   - **Keyboard:** when a field is focused, the beaver animation moves up and fades out (`translateY(-200px)`, opacity 0, `PHONE_STANDARD`) and the form moves up so the focused field, the password field and Sign in all sit above the keyboard, using 29e's `visualViewport` handling. On blur with the keyboard closed, everything returns.

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

- Each page at 390 and 360 matches its still: Builds rows, Activity rows and dots, the editor's bar, icons, single round button and pinned footer, sign-in with the keyboard up and Sign in visible.
- Autofill on iOS and Android Chrome leaves the fields on Card.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.
