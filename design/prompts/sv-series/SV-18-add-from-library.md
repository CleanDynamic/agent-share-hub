# SV-18 · Composer: Add from Library

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-17, before SV-19. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-18-add-from-library`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-18 Add from Library` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-17 merged. **The file on disk wins.**

## Intent

The composer's Add menu gains "From Library": a window that lists saved items that fit where the maker is adding, and inserts a copy that keeps its source and credits its maker. It must match `design/reference/vision/dusk/composer-add-from-library.html`. Saved steps and sessions exist since SV-17, so the window ships switched on.

## Source

- Board: `design/reference/vision/dusk/composer-add-from-library.html` (the dev page draws the same still of the composer behind the window), picture `design/screens/vision/composer-add-from-library.png`, sample data in `design/reference/vision/source/LibraryInsert.dc.html`.
- Today: the Add menu in `src/pages/site/compose/SandboxView.tsx` and `SandboxPage.tsx`, the tile windows (`AddAgentDialog` and the rest), `modalRecipes.tsx`, `src/lib/build/duplicate.ts` (`duplicateTiles`), `src/lib/build/buildHistory.ts`, `src/lib/build/forkRules.ts`, the List's ghost rows (where the composer decides what may be added inside an agent or a team), `source_ref` on `build_nodes`.

## What earlier prompts left here

- **SV-05:** the numbering function; a new tile and session take their number from the List's order.
- **SV-06:** the one list animator and `motion.expect({ kind, keys })`; the scroll helper.
- **SV-07:** one model per draft from click to result; saves through the `serial` queue; a pending entry is the saved entry, never drawn twice.
- **SV-16:** `contributor_id` on tiles and in `sessions_meta`.
- **SV-17:** `listSavedItems`, snapshots, "Used in" counts.

## Layout (exact values are in the board)

- The window: 640 wide, 80 from the top, `--window`, 1px `--control-border` (the board's value), radius 12, `--window-shadow`, over `--scrim`. No blur. Built from `modalRecipes.tsx`.
- Head (padding `20px 20px 0`): "Add from Library" 14/500; "Inside <place> · <what> fit here" 12 `--label`; a 28 close button named "Close".
- `UnderlineTabs` Steps and Collections with counts; on the right, why a kind is missing ("Sessions don't fit inside an agent").
- A search field (32 high, `--well`, 16px text on phone), keeping the app's focus ring (the board sets `outline: none`; that isn't ported).
- A radio group of saved items, with one tab stop and arrow keys between items. Each: title 500, state on the right (`Edited since saved` in `--lit`, `Same`, `Stale`); "Step n · <build> · @maker · <model> · used in n builds" in 12 `--label`. The selected item has `--selected-fill`, 1px `--selected-edge`, radius 8, and a `Segmented` "Saved version · <date>" and "Current version · <date>" (the switch goes live in SV-19).
- Footer (padding `16px 20px`, hairline above): "Copied as a new <type> with its source. @maker is credited on the tile, and their step will show used in n builds." (never a pronoun for the maker; the board's "her" is sample copy); Cancel; Insert (primary).

## Rules for this prompt

- **Vercel rules:** `bundle-dynamic-imports` and `bundle-preload` (the window is its own chunk, fetched on hover or focus of Add › From Library and at idle after the composer is ready, as SV-26 Part 3 will expect), `rerender-no-inline-components`, `js-set-map-lookups` (what fits is looked up, not searched).
- **Motion:** the window opens and closes with `modalRecipes`' existing motion, nothing new. The inserted tile arrives through SV-06's animator: the insert calls `motion.expect({ kind: "duplicate", keys: [<new tile key>] })` (or the kind SV-06 kept for copies) before it changes SV-07's model, and the animator drops it in. The scroll helper brings it into view only if it would be wholly off screen.
- **The window's open and close** are `modalRecipes`' own. If SV-06's motion inventory found its close slower than its open, report it here; don't change it.
- **One writer.** Insert goes through the same writer Duplicate uses, through SV-07's model and its `serial` queue. No second writer.

---

## Part 0 · Read and plan

Find the function that decides what may be added at a place (inside an agent: prompts; inside a team: agents; top level: everything). Find how Duplicate writes rows and records one history step, and how it reaches SV-07's model and SV-06's animator. Write `Assumptions` and `Plan`.

Commit: `SV-18 P0: plan`.

## Part 1 · The window

`AddFromLibraryWindow`, pure: props for the place, the items, the selection and the version. Arrow keys move the selection; Enter inserts; Escape closes; focus returns to the Add menu. The dev page `vision-composer-add-from-library` renders it over a still of the composer.

Commit: `SV-18 P1: Add from Library window`.

## Part 2 · Insert

1. Failing tests first: inserting a saved prompt inside an agent adds one prompt tile with the snapshot's method (as `forkRules` copies it), `source_ref` set to the source tile, `contributor_id` set to the source tile's contributor or maker (SV-16), and one undo step whose sentence names it; Undo removes it; an item that doesn't fit is not listed; the insert calls `motion.expect` with the new tile's key; the pending tile and the saved tile are one entry from the first frame (SV-07's replay conditions hold).
2. Insert goes through Duplicate's writer.

Commit: `SV-18 P2: insert from Library`.

## Part 3 · Switch it on

1. Add › From Library is in the composer's Add menu, listing saved steps and sessions that fit.
2. Library's "Start a build from this collection" (SV-17) goes live: it makes a draft from the collection's items in order, each inserted as Part 2 inserts.
3. "Used in n builds" shows in the window.

Commit: `SV-18 P3: From Library in the Add menu`.

## Part 4 · Compare and measure

1. `npm run audit:design -- --grep "vision/dusk/composer-add-from-library"` within 4%.
2. `npm run audit:motion` with an insert from Library added as a moment: all of SV-06's thresholds pass for it.
3. The composer's chunk stays within SV-26's 120 KB target once it has run; until then, report its size before and after.

Commit: `SV-18 P4: compare and checks`.

---

## Report

The README's report, plus: `audit:motion for the insert: frame gaps · long tasks · cancelled · largest one-frame jump`.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration.
