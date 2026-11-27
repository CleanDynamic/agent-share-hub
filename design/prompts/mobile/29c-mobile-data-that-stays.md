# 29c: Data that stays

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

Content is on screen as soon as a page opens, stays in place while it refreshes, and never loads forever. The repo already keeps fetched data for 30 minutes and treats lists as fresh for 60 seconds (`QUERY_DEFAULTS` in `src/lib/query/client.ts`), and `PageArrival.tsx` already skips the skeleton when data is cached. So the long skeletons in the recordings of the current app (Builds over 3.6s, Activity over 4s, OpenBuilds about 2s, none of them resolving) are queries that do not finish. Fix those first, then make every page behave as stills `07-builds.jpg` and `08-activity-filter.jpg` show.

## Do

1. **Find why the first-screen queries do not finish.** For Builds, OpenBuilds and Activity, in this order, and write what you found in your note:
   1. Log each page's first-screen query (`status`, `fetchStatus`, `error`, timing) in development and load the page against the live Supabase project.
   2. A `PGRST205` / "Could not find the table ... in the schema cache" error means the live database is missing a migration or PostgREST has a stale cache. A build cover in the live feed shows exactly this error for `public.builds`. Compare `supabase/migrations/` with the live schema (`supabase db diff` or the dashboard), list what is missing, and write the steps for the owner (apply the migration; run `NOTIFY pgrst, 'reload schema';`). Do not apply migrations to the live database yourself.
   3. A request that never returns or takes more than 2 seconds: run its SQL with `EXPLAIN ANALYZE` (from the repo's query, with the policies applied) and add the missing index in a new migration.
   4. A request that returns but the page stays on its skeleton: the page's `loading` reads the wrong flag. A page is loading only when it has no data and is fetching (`isPending` in TanStack Query v5), never while it refetches with data.
2. **A ceiling on every skeleton.** In `PageArrival.tsx`, start a timer when `loading` becomes true; at 8 seconds without data, draw the page's failed state with the repo's words ("That didn't load." and "Try again", or whatever the repo uses), and keep the query running so data that arrives later replaces it. One test with a fake clock.
3. **Skeletons only the first time.** A page whose query has data in the cache draws it in the first frame and refreshes quietly. Confirm for Home, Builds, OpenBuilds, Activity and a build page that visiting, leaving and returning within 30 minutes shows no skeleton.
4. **Filters keep the list on screen.** Every list whose query key changes with a filter or lens (Activity's pills, Builds' lenses, Home's kind sheet) uses `placeholderData: keepPreviousData`. While the new list loads, the old rows stay and dim to 60% opacity (`PHONE_QUICK`); when it arrives they are replaced and fade in over `PHONE_QUICK`. Match `08-activity-filter.jpg`: the "Rebuilds" pill is on, its rows are shown, no skeleton.
5. **Scroll position remembered per dock tab.** Keep a map from dock section to `window.scrollY`. Save on leaving a section; on returning, restore after the first paint (`requestAnimationFrame` after the content renders). Pushed pages (a build, a post, a profile) return to where you were when you go back; the browser's own `history.scrollRestoration` stays `manual` if the app sets it.
6. **Nothing moves after it appears.**
   - Every feed picture and cover gets `aspect-ratio` from its stored width and height (16/9 when unknown) and the Card fill until it loads, so posts never jump. Check the media columns the feed query already returns; if width and height are not stored, use 16/9 and say so.
   - Each phone page's skeleton has the same boxes as its content. Builds' skeleton is rows (64 tall: a 15 bar and a 13 bar at the left, a 48 square at the right, 12 between rows), not 110 cards. OpenBuilds draws its feed skeleton from the start under the post box, never a second, different skeleton. Extend the placeholder match test that `PageArrival` relies on to every phone page at 390.
7. **Quieter skeletons.** The dot skeletons draw more attention than real content. On the phone: dots at 35% of their current brightness, each block no taller than the content it stands for, and the motion stops after 2 seconds (the blocks stay, still).

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

- With data in the cache, Home, Builds, OpenBuilds and Activity draw content in the first frame on return, at the scroll position you left.
- No skeleton stays more than 8 seconds; tapping an Activity filter keeps the old rows (dimmed) until the new ones arrive (`08-activity-filter.jpg`).
- Record the screen while the feed loads: no post moves after it first appears.
- Your note lists what the live database was missing, if anything, and the exact steps for the owner.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.
