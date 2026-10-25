# Skill audits of the page and feature prompts (SV-02, SV-08 to SV-25)

These are the 19 prompts that came from VB-00 to VB-16, audited against each skill in turn, the way SV-01 to SV-07 were audited earlier. All eight boards were read in full (`Main`, `OpenWork`, `Builds`, `BuildsMaps`, `BuildsClassification`, `Library`, `LibraryInsert`, `Drafts`), and the findings checked against main at `6b8fe91`. Each finding says where it was applied. It is not a prompt.

## What the boards themselves show

- **No motion anywhere.** No `transition`, `animation` or `@keyframes` in any board. The only effects are a colour change on link hover and an underline on Classification values. That agrees with "no new motion".
- **Focus rings removed.** The header search (Home, Builds) and the Add from Library search set `outline: none`.
- **Drawn controls.** The Builds checklists are styled spans, not checkboxes; the range filters are drawn bars and handles, not sliders; the Add from Library list is `div role="radio"`.
- **Text under 10px.** The model marks on Home and Builds use 9px placeholder letters. The real marks are icons (`markFor`), so no 9px text reaches the live page.
- **Header differs between boards.** Home and Builds draw a header search; the other six don't. The app's `SiteHeader` already has `HeaderSearch` on every page.
- **Page heads differ.** Maps' head is "Builds" with a sentence; Classification's is "n builds" with a sentence; the Table's is a `PageFigure` with stats. The prompts said the Maps and Classification heads were "the same as the Table".
- **Window border.** The Add from Library window's border is `#323237` (`--control-border`), not `--window-border` as the prompt said.
- **Copy.** The window's footer says "@maya is credited ... and her step"; live copy can't know a maker's pronouns.
- **Notes.** Each board has blue `NEW ·` notes and Home has a legend box, all behind a `notes` prop. They are not built, and must be off in the export used for comparison.
- **Fonts.** Each board loads Geist from Google Fonts. The app self-hosts Geist and Geist Mono (`public/fonts`, preloaded in `index.html`).
- **Numbers.** Each board sets `font-variant-numeric: tabular-nums` on its root.
- **Saved by.** Library draws "saved by 14" on a public collection, so the saved-by count is on the board, not optional.

## 1. Karpathy (think first, simplicity, surgical, goal-driven)

| Finding | Applied in |
| --- | --- |
| The README already carries plan and assumptions, reproduce first, measure then build, missing premise, surgical changes, questions in the report | README (unchanged) |
| **Board and prompt disagree in three places** (the Maps and Classification heads, the window border). The board is exact, so the prompts now follow the board, and SV-02 lists any other disagreement it finds before a page prompt meets it | SV-02 Part 0, SV-12, SV-13, SV-18 |
| **The header** is drawn on two boards only. Building a second header from them would be a rewrite nobody asked for. The live header stays `SiteHeader`; the boards' header is masked in comparison | README Boards, SV-02 Part 3 |
| **Notes must be off in the export**, or every comparison fails for a reason that isn't the code | SV-02 Part 0 and Part 1 |
| **Saved-by count** was "build it or leave it out". The board draws it, so it is built | SV-17 Part 3 |
| No speculative features found beyond those already placed last in their prompts (SV-22 Part 3, SV-24 Part 2) | none |

## 2. Fluid (polish: focus, hover, pressed states, touch, restraint)

| Finding | Applied in |
| --- | --- |
| **Focus rings.** `outline: none` from the boards is never ported. Every input and control keeps the app's focus-visible ring | README Accessibility |
| **Hover.** Link and value hover is a colour or underline change at once, never a fade, and only under `HOVER_QUERY` (`(hover: hover) and (pointer: fine)`, from `motion.ts`), so it doesn't stick on touch | README Motion limits |
| **Real controls.** Checklists are checkboxes; range filters are sliders with keyboard support (arrows, Page Up and Down, Home and End, `aria-valuetext`); the window's list is a radio group with one tab stop and arrow keys | README Accessibility, SV-11, SV-18 |
| **Touch targets.** The boards' 28px buttons and chevrons keep their look; on phone their hit area reaches 44px through padding with a matching negative margin, not a bigger box | README Accessibility |
| **Charts need words.** Week bars, Runs 12 weeks, the release check bars and the histograms each get a text summary on the group, with the bars hidden from screen readers | README Accessibility, SV-10, SV-11, SV-14 |
| **Drag needs a keyboard way.** Dragging sessions (Drafts) has the `+` button; reordering filters (SV-24) gets Move up and Move down | SV-24 |
| **Restraint.** The boards have no motion, and the prompts add none. Selected tabs and segments change at once | README Motion limits (unchanged) |

## 3. Performance and Vercel

| Finding | Applied in |
| --- | --- |
| **Fonts.** The boards' Google Fonts link is never ported; the app's self-hosted, preloaded files stay | README Boards |
| **Images** (the feed's pictures, covers, Where next): `loading="lazy"` and `decoding="async"` except the first screen's largest image; boxes sized ahead so nothing shifts; transformed sizes where storage supports them | README Pages, SV-10 |
| **Numbers tabular** on figures, rows and counts, so a changing number doesn't shift its neighbours | README Visual grammar |
| Rounds, parallel starts, `content-visibility`, separate chunks for views and the window, versioned storage, `EXPLAIN` for indexes: already in place | unchanged |

## 4. transitions.dev (usage, open and close, same-slot changes)

| Finding | Applied in |
| --- | --- |
| **The nav lamp** moves to the new current item at once when the page changes. The header is outside SV-04's fade, so the lamp doesn't slide or fade | README Motion limits |
| **Tabs and segments** change at once and are the same both ways; no sliding pill (the boards draw none) | README Motion limits (unchanged) |
| **The window's open and close** use `modalRecipes`' existing motion. SV-06's inventory checks it by usage; if its close is slower than its open, that is reported, not changed here | SV-18 |
| **Placeholder to content** is a same-slot fade, and a number changing in a figure is tabular and changes at once | README Pages, Visual grammar |
