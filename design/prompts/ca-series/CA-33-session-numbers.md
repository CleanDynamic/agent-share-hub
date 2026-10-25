# CA-33 · Session numbers follow the order, counts, loading fill and fixes

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-32, before CA-34. CA-28 and this prompt both change `SandboxCard.tsx` and the session heads, and CA-32 moved the composer into the shared frame, so read the files as they are now. The numbering function this prompt writes is used later by OpenBuilds (CA-42), Builds (CA-51) and the build page. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `ca-33-numbering-and-fixes`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-33 session numbers, counts and fixes` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`, before CA-28 to CA-32 merged. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report. Never invent a table, a column or a policy.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists in `design/audits/composer/ca-33/plan.md`:
  - `Assumptions`: each fact in "What is wrong now" and Part 0 that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test`.
- **Reproduce first.** For every fix, write the test that shows the problem, watch it fail, then fix it. Part 1's first test (3, 1, 2, 4) is written and seen failing before the numbering function exists.
- **A missing premise is reported, not fixed.** If a cause can't be found, don't guess at a fix. Say so and move on.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for CA-54; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. Use the dev pages and the page harnesses.

## What is wrong now (seen on the site)

1. In Part 1 the sessions read **3, 1, 2, 4** from top to bottom. The jump tabs above the list read 1, 2, 3, 4 in a different order from the list.
2. The build line says **3 sessions**, Sources says **4 in build**, and Part 1 says **3 sessions** with four sessions inside it.
3. While a session was importing, it was called **Session 4**, and so was a session already in the build. Two sessions had the same number.
4. A session in the draft, "Haiku 4.5 · 10 Oct · 1 prompt" in Your sessions, shows **No tiles yet** in the build.
5. In the importing sockets, the building blocks fill only the top of each socket. The socket numbers 1, 2 and 3 hang outside the part's frame on the left.
6. The post's drag grip sits on the avatar ("ST ⠿") on a post with one empty block.
7. In Sources, "Claude Code reads CLAU…" cuts the file name, and "Add it" wraps onto two lines.
8. The Classification window has no side padding: its body sits flush to the window's edges.
9. Wording: "+ Add Tile", "Map is now available", "Name your build", "One sentence on what the build does", "Classification will save once the database update is applied", and "Haiku 4.5" used as a session's name.

## The rule for numbers

**A session's number is its place in the List, counted from the top.** Part A's sessions come first, then Part B's, and so on. A session with no tiles counts like any other. Numbers have no gaps and no repeats.

- Moving Session 3 to the top makes it **Session 1**. The session that was 1 becomes 2, and the one that was 2 becomes 3.
- Moving a session to another part renumbers it to its new place.
- **Tiles follow the same order.** Prompt 1 is the first tile of Session 1, and numbering runs down the List without gaps.
- The number is worked out, never stored as text. Everything that shows a session number reads it from one function, and no other code works one out.

## House rules

- Inline styles through `t`. Windows, rows and buttons from `modalRecipes.tsx`. Add every changed file to `src/lib/theme/lookRules.test.ts`.
- No new dependency. Sentence case, no em dashes.
- No component changes its look, except where a part below says so.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `rerender-derived-state-no-effect`, `js-index-maps`. Install no package a rule names.
- **No memo for speed** (`memo`, `useMemo`, `useCallback`) unless a React Profiler trace shows the render as the cost.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

## Motion limits

This prompt adds one piece of motion: the number crossfade in Part 1 step 7.
- It uses CA-22's existing count crossfade helper in `buildMotion.tsx`, with `CROSSFADE` (150 ms) and opacity only. No new `element.animate()` call, so CA-34 can route it through its animator later.
- No new duration, curve, stagger, shimmer or hover look. No ease-in, no spring, no scale.
- Everything is off under reduced motion. `motion.test.ts` must pass.

---

## Part 0 · Read first

- **`src/lib/build/graph.ts` › `sessionGroups`** (around line 1063):
  - groups are opened from the steps, and typed sessions with no step are added from `meta`;
  - the block from "CA-12 P5" (around line 1142) refills places by `order` and numbers the groups.
  - **Find out:** is an imported session with no tiles in `groups` at all?
- **Ordering:**
  - `src/lib/build/sessionLayout.ts`: `getSessionOrder`, `setSessionOrder`, `stackBySessionMoves`;
  - `src/lib/build/workstreams.ts`: `orderByWorkstream`, `workstreamsOf`;
  - `src/lib/build/buildSessions.ts`: `reorderBuildSessions`, `orderOf`.
- **Counts and the next number in `SandboxPage.tsx`:**
  - `order` (around line 286);
  - `counts.sessions: shownGroups(groups).length` (around line 295);
  - `emptySessions` (around line 614);
  - `nextSessionNumber` (around line 728);
  - the `arriving` heads for imports and empty sessions.
- **Parts:** `partsModel.ts` › `listPartsOf`, where `sessions: part.sessions.length` is the part's count.
- **Every place that shows a session number,** and every piece of code that works one out:
  - the session heads;
  - Sources › Sessions in this build;
  - the jump tabs above the list;
  - the Map;
  - Details;
  - the Session window title;
  - the prompt window ("Session 2 · Claude Code");
  - the Link text panel ("S2");
  - linked text tags in the post;
  - the Move to and Add to which session menus;
  - notices and history step names;
  - the published build page (`src/pages/site/build/`).
  List them in the plan.
- **Imports:**
  - the code that writes an imported session's prompts;
  - `sourcesModel.ts` (`NO_APP`, how a library row's name is chosen).
- **Loading:** `ImportingPieces.tsx` (`SOCKET_BLOCK_ROWS = 3`, line 31) and `LoadingBlocks.tsx`. Also the CA-21 socket numbers (lane numbers).
- **Other pieces:**
  - `src/components/post/editor/BlockHandle.tsx` (the grip, 24 left of the block);
  - `SourcesPanel.tsx` around line 285 ("Claude Code reads CLAUDE.md · Add it");
  - `SandboxCard.tsx` (`NOT_LIVE_LINE`, the title placeholder at line 279, the Summary hint at line 287, `useModalInset` read outside any provider);
  - `CardPreview.tsx` (line 46), `SessionHead.tsx` (`addToThis`), `SandboxView.tsx` (`mapHint`, `ADD_ASK_COPY.row` at line 358);
  - `src/lib/classify/storage.ts` (`isMissingColumn`, around line 27).

**Before changing anything,** screenshot at 1440 in Dusk into `design/audits/composer/ca-33/before/`:
- a draft with two parts, where Part 1 holds four sessions, one of them with no tiles;
- an import in progress;
- the post with one empty block;
- Sources with the CLAUDE.md suggestion;
- the Classification window.

Commit: `CA-33 P0: before screens and plan`.

## Part 1 · One order, one numbering

1. **Write the tests first,** and watch them fail: Part 1 holding 3, 1, 2, 4 reads 1, 2, 3, 4; a session with no tiles has a number.
2. **One function** gives every session its number from the List's order (the rule above): parts in order, then each part's sessions in order. Use it in every place from Part 0. **Remove every other numbering,** including the refill in `sessionGroups` if it disagrees. A source check passes only when no other code works out a session number.
   - **Usable outside the composer.** The function is pure (no React, no Supabase) and lives in `src/lib/build/`, so OpenBuilds' step strips (CA-42), the Maps view (CA-40), stored counts (CA-51) and the build page can import it without pulling in the composer's chunk. It takes the steps and the session order and returns the map; a test imports it from a page outside `src/pages/site/compose/`.
   - **One map per order change.** The function builds one map from session key to number each time the order changes, and every place reads from that map (`js-index-maps`). No place runs its own `findIndex` over the order.
   - **Worked out during render, never copied.** No effect copies numbers or counts into state (`rerender-derived-state-no-effect`).
3. **Sessions with no tiles are in that order and are numbered.** That covers typed sessions, imported sessions and sessions still importing.
4. **After every change to the order, the numbers update in the same step.** That means:
   - a drag;
   - Move up and Move down;
   - Move to part;
   - moving a part;
   - adding, importing and removing a session;
   - Undo and Redo.
5. **The stored order matches what is shown.** After each change, write `build_sessions.position` (and `making.session_order`, as `setSessionOrder` does) in the List's order, in one write. A reload and the published build then show the same numbers.
6. **Tiles follow:** after a session moves, its tiles move with it (`stackBySessionMoves`), so tile numbers run down the List without gaps.
7. **The jump tabs** follow the List's order and use the same numbers. They read `{number} {app}`, and add the date when two sessions have the same app: `2 Claude · 25 Sep`.
8. **Motion:** when a number changes in place, the old and new numbers overlap in the same spot and fade at the same time, with no gap between them and no movement (see Motion limits). A fade-out followed by a fade-in leaves an empty frame, so don't do that. The slot keeps its width through the fade, so "9" to "10" doesn't shift the words beside it: use the existing slot or a fixed-width box, never a width animation. If keeping the width needs `font-variant-numeric: tabular-nums`, check that nothing looks different at rest before keeping it. The rest of the move keeps CA-21's sliding.
9. **History and notices** name a session by the number it had when the action was taken, for example `Moved Session 3 to the top`. Linked text tags and the Link text panel always show the current number.

**Tests:**
- Part 1 holding 3, 1, 2, 4 reads 1, 2, 3, 4 after the fix;
- moving Session 3 to the top makes it 1 and shifts the others down by one;
- Move to part renumbers;
- a session with no tiles has a number;
- tile numbers run down the List;
- the stored positions match after each change, and after a reload;
- every place in Part 0 shows the same number for the same session;
- Undo puts the old numbers back;
- a number change has no frame where its slot is empty, and the words beside it don't move;
- no other code works out a session number (source check);
- the map is built once per order change, not once per place that shows a number (count the calls);
- no `useEffect` sets a number or a count from the order (source check).

Commit: `CA-33 P1: session numbers follow the order`.

## Part 2 · Counts and the next number

1. The build line (`countsLine`), Sources' "in build" count, each part's count and Your sessions all count **every** session in the build, including those with no tiles and those importing.
2. `nextSessionNumber` gives a new or importing session the next place at the end of its part, using the Part 1 function. It never repeats a number. When the new session goes into a part that isn't the last, the sessions below it renumber (Part 1, step 4).
3. The counts and numbers agree everywhere on the page.

**Tests:** a build with a session that has no tiles counts it in all four places; importing while such a session exists gives the import a new number; adding into Part 1 of two renumbers Part 2.

Commit: `CA-33 P2: counts include every session`.

## Part 3 · An imported session with no tiles

1. **Find out** why a library row reading "1 prompt" became a session with **No tiles yet**. The prompt may never have been written, or written somewhere the build doesn't read, or the library count may be wrong. Reproduce it in a test first, then fix the cause, and say in the report which it was. If it can't be reproduced, say so and do steps 2 and 3 only.
2. **If an import writes fewer tiles than the row says,** say so in the session head's detail line: `0 of 1 prompts imported`, with a `Retry` text link that runs the import again for the missing prompts.
3. **A library row is named by its first prompt** (the series decision, matching the Drafts and Home boards), with the app's mark, and `<tool> · <model> · <date> · <n> prompts` in the detail line. Never the model alone as the name. When the tool is unknown, the detail line starts `No app chosen` (`NO_APP`) and the row has no mark (`No app chosen · Haiku 4.5 · 10 Oct · 1 prompt`). A first turn that is a Claude Code summary is skipped for the name (CA-35 makes it a Summary tile).

**Tests:** an import that writes all of its prompts; one that writes none shows `0 of 1 prompts imported` and Retry; Retry fills the session; a row is named by its first prompt; a row with an unknown tool reads `No app chosen` first in its detail line; a summary first turn is skipped for the name.

Commit: `CA-33 P3: imports that come back empty`.

## Part 4 · Loading blocks fill the whole socket

1. **`LoadingBlocks` gains `height="fill"`:**
   - it measures its box (`ResizeObserver`, read in the same way as `width="fill"`);
   - it draws as many 12-tall rows and 8-wide columns as fit;
   - it centres what is left over, so the cells cover the whole box.
2. **Importing sockets** (`ImportingPieces.tsx`):
   - the blocks fill the socket's inner area, inset 10 from every edge (the tile's own padding);
   - use `width="fill"` and `height="fill"` in place of `SOCKET_BLOCK_ROWS`;
   - they keep the page-wide wave at its current speed, with no new shimmer, and fade out as each prompt drops in. A socket's blocks and its arriving prompt overlap in the slot, so the socket is never empty for a frame.
3. **The first load** (`ComposeSkeleton.tsx`, which CA-32 made the composer's one placeholder): each tile box fills the tile's full height in the same way, so a block placeholder and a tile are the same size. Keep CA-32's check that the placeholder and the page match.
4. **Socket numbers** sit inside the socket, 10 from its left edge, vertically centred, inside the part's frame. Nothing hangs outside the frame.
5. **The import's progress row** (CA-24 Part 4: the bar, `6 of 18 prompts`, `Stop`) shows whenever the import can report progress. If it still can't, say why in the report.

**Tests:** the cells cover the socket within one cell on every side, at 56, 64 and 72 tall; the first-load tile boxes match the tiles' height; socket numbers sit inside the frame; reduced motion shows a still fill.

Commit: `CA-33 P4: loading fills the socket`.

## Part 5 · The post's grip

1. The grip shows only when the post has **two or more** blocks and the pointer is over a block, or the caret is in one.
2. It never overlaps the avatar: at least 4 clear between them. If the gutter is too narrow, move the grip into the gap between the avatar and the text and narrow nothing else. Measure it in Playwright.

**Tests:** one empty block shows no grip; two blocks show it on hover; its box doesn't intersect the avatar's.

Commit: `CA-33 P5: post grip`.

## Part 6 · Sources' file suggestion

1. The line reads `Claude Code reads CLAUDE.md`, with a text button `Add`.
2. The words wrap onto a second line before any file name is cut. The button keeps its own line height and never wraps (`white-space: nowrap`, no shrinking).

**Tests:** at the Sources column's narrowest width, the full file name shows and `Add` stays on one line.

Commit: `CA-33 P6: file suggestion`.

## Part 7 · Classification window

1. **Padding:** the body gets the same 20 inset as every other window. Provide `ModalInset` around the whole window body, the way `ModalForm` does, so `useModalInset()` reads 20 on a desktop and 0 on a phone. Nothing else about its look changes.
2. **Remove the line** `Classification will save once the database update is applied` from the screen. If a save fails because the columns are missing, the footer status reads `Classification not saved` (CA-28's error form) and the window stays open.
3. **Tighten** what counts as "column missing" in `storage.ts` (`isMissingColumn`, which now matches `/42703|PGRST204|classification|facets/` against the code and the message): match the error **code** only, Postgres `42703` or PostgREST `PGRST204`. Never match message text.
4. **Wording:**

| Now | New |
|---|---|
| Name your build (title placeholder, `SandboxCard.tsx`; also `ComposeView.tsx` if it holds it on disk) | Fox poster |
| Name your build (empty title in the preview, `CardPreview.tsx`) | Untitled build |
| One sentence on what the build does | One sentence |

**Tests:** the inset is 20 on every side of the body at 1440; a missing-column save shows `Classification not saved`; another error whose message mentions "classification" is not read as missing columns.

Commit: `CA-33 P7: Classification window`.

## Part 8 · Wording on the page

| Now | New |
|---|---|
| + Add Tile (`SessionHead.tsx`, `SandboxView.tsx` `ADD_ASK_COPY.row`, the dev page `MotionDemo.tsx`, and every other place on screen) | + Add tile |
| Map is now available (`SandboxView.tsx`, `mapHint`) | (removed) |

Search for any other "Add Tile" on screen and change it. Comments that quote the old words may be updated in the same line; change no other comment.

Commit: `CA-33 P8: wording`.

## Part 9 · Screens and checks

1. Screenshot the Part 0 cases again into `design/audits/composer/ca-33/after/`, at 1440 and 390, in Dusk and Noon. Also take:
   - a move of Session 3 to the top, paused mid-slide and after;
   - an import paused while its sockets hold blocks.
2. Compare with the before shots. Only what the parts above name may differ.
3. Run `npm run audit:design -- --grep composer` and `npm run audit:contrast`. Search the diff for the em dash character.

Commit: `CA-33 P9: screens and checks`.

---

## Report (end the session with exactly this)

```
CA-33 · session numbers, counts and fixes
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N · contrast

P1 one numbering function yes/no · other numbering removed: (list) · places using it: (list) · stored positions match after reload yes/no · tile numbers follow yes/no
P2 counts include sessions with no tiles yes/no · duplicate numbers possible yes/no
P3 empty import cause: (what it was, or "not reproduced") · "0 of N prompts imported" with Retry yes/no · rows named by app yes/no
P4 blocks fill sockets yes/no · first-load tiles match yes/no · socket numbers inside the frame yes/no · progress row shows yes/no (why not)
P5 grip hidden on one block yes/no · clear of the avatar yes/no
P6 file name whole, Add on one line yes/no
P7 inset 20 yes/no · not-live line removed yes/no · column-missing check uses codes only yes/no
P8 wording changed in N places
Dead code seen: (list, or "none")
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly): merge the pull request and press Publish › Publish changes in Lovable. This prompt has no database changes. The CA-16 classification migration has been applied, so Classification saves on the site.
