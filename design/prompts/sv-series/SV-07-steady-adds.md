# SV-07 · Steady adds, imports and parts: no flicker, no jumps, no lost changes

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-06, before SV-08. SV-05 sets how sessions are numbered and counted, and this prompt keeps that. SV-06 builds the one list animator (`listMotion.ts`, `motion.expect`) and the one scroll helper, and this prompt uses both. SV-16 (credit) and SV-21 (session requests) write `making` through the writers Part 1 makes, and SV-18 inserts through the model Part 2 makes. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `sv-07-steady-adds`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-07 steady adds, imports and parts` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`, before CA-28 to SV-06 merged. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report. Never invent a table, a column or a policy.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists in `design/audits/composer/sv-07/plan.md`:
  - `Assumptions`: each fact in "What a screen recording shows" and "The cause found for 5" that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test or replay condition`.
- **Reproduce first.** The Part 0 replay fails before anything is fixed, and passes at the end. Every other fix also starts with a failing test.
- **Check what exists before adding.** Where a part asks for a guard, first check whether existing code already gives it (the `serial` queue, the `updated_at` stamp check, CA-23's clash window). Add code only where a test shows the gap.
- **A missing premise is reported, not fixed.** If a cause can't be found, don't guess at a fix. Say so and move on.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for SV-26; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. Use the dev pages and the harnesses.

## What a screen recording shows (measured frame by frame, at 60 frames a second)

1. **Flicker on the first import (about 2 seconds).**
   - The list switches between two layouts several times a second.
   - The empty "Session 1 · No app chosen" (with its prompt box) and the importing "Session 1 · Haiku 4.5" are both on screen, sometimes drawn over each other.
   - Sources lists the empty one as a real session.
   - Just before it settles, the list shows "Session 1 · No app chosen" and "Session 2 · Claude" for one sixth of a second, then snaps to a single Session 1.
2. **A new session lands in the wrong place, then jumps.** "Start a new session" draws Session 2 in Part 2. About 0.3 seconds later it jumps up into Part 1. All three parts appear in the same single frame, and the page scrolls with a snap.
3. **"Add a part" shows nothing.** With one session, clicking it changed nothing on screen for six seconds, so the maker clicked again. Three parts appeared later, all at once.
4. **Choosing a part for an import throws the page to the top.** The maker was scrolled down at Part 3. One frame later the page was at the top, and the session arrived about three seconds later, out of sight.
5. **Adding a session moved another one.**
   - Session 5 was in Part 3.
   - When Session 6 was added to Part 3, Session 5 moved to Part 2: Part 2 went from 2 sessions to 3, and Part 3 held only Session 6.
6. **Closed parts swallow things.** Sessions added to a closed part arrive unseen. The jump tabs for sessions in a closed part do nothing visible.
7. **Changes snap.** When sessions are added, imported or put into parts, 97% of the change happens in a single frame. CA-21's and CA-22's sliding runs only when dragging.
8. **Status text stays on the page.** Under the list sit lines like "Adding Haiku 4.5 · 10 Oct as Session 1…", "Adding…", "Added Session 1 with 1 prompt." and "Added a part.". `BuildList.tsx` draws `sessions-said` and `nest-said` (around line 2428) as visible text, as well as announcing them.
9. **The undo notice moves around.** "Added Session · Undo" shows at the bottom right once and under the build column another time, where it covers the list.
10. **Other things seen:**
    - The import list under "Import from connected chats" opens narrow and covers the rows below.
    - Empty sessions look two different ways: "No tiles yet" in one, a dashed "Drop a tile here" in another.
    - A clipped focus ring shows as a small blue bar left of "+ Add a session to this part".
    - Clicking around selects page text, for example the Details placeholder.
    - Claude Code's own summary, "This session is being continued from a previous conversation that ran out of context…", came in as Prompt 1 (6,100 words).
    - Two "Claude · 25 Sep · 3 prompts" rows in Your sessions import the same prompts (Prompts 13 to 15 and 16 to 18).
    - The Home page's visitors' book shows "@suntzu hung Untitled build": a build with no title was published.
    - Library › Saved's error, the first load's two lines in the corner and the 27 empty drafts were dealt with in SV-03 and SV-04. Check they stay fixed.

## The cause found for 5

`patchMaking` and `setSessionMeta` in `src/lib/build/making.ts` read the whole `builds.making` (`readMadeWith`), change one key and write the whole object back through `updateBuild`.
- `updateBuild` already runs writes one at a time per build, through `serial` (defined in `src/lib/build/staleWrites.ts`, used by `builds.ts`, CA-23 P4), but the **read** happens before, outside that queue.
- Two saves close together both read the same old copy. The queue then writes both, and the second overwrites the first.
- `setSessionOrder` (`sessionLayout.ts`), `setWorkstreams`, `setPartLabels` and the rest share the same pattern.

## The rules this prompt sets

- **One path from click to result.** What the maker sees during an add or import is drawn from one model, with one entry per session key. A pending entry and the saved row are the same entry, and it is never drawn twice.
- **Nothing moves unless the maker moved it.** No save can change another session's part, order or number.
- **Every click shows a change within 100 ms:** a pressed state, the pending entry, or the menu.
- **Everything that arrives or moves is animated by SV-06's animator,** labelled with `motion.expect`. Nothing jumps in one frame.
- **The page never scrolls by itself,** except through SV-06's scroll helper, to bring a just-added item into view when it would be completely off screen. It never scrolls to the top.

## House rules

- Inline styles through `t`. Windows, rows and buttons from `modalRecipes.tsx`. Add every changed file to `src/lib/theme/lookRules.test.ts`.
- No new dependency. Sentence case, no em dashes.
- No component changes its look, except where a part below says so.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `rerender-derived-state-no-effect`, `rerender-no-inline-components`, `js-set-map-lookups`, `rendering-activity`. React is 19.2, so `<Activity>` is available. Install no package a rule names.
- **No memo for speed** (`memo`, `useMemo`, `useCallback`) unless a React Profiler trace shows the render as the cost.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

## Motion limits

**This prompt adds no motion.**
- Don't call `element.animate`, add a `transition` or `@keyframes`, or scroll the window yourself. Hand every change to SV-06's animator with `motion.expect({ kind, keys })`, and every scroll to SV-06's scroll helper.
- If something still snaps after it is labelled, the fix belongs in SV-06's animator. Report it with the moment it happens in; don't patch around it here.
- No new hover, pressed or disabled look, and no scale on press. Pressed and disabled states use the existing styles from `modalRecipes.tsx`.
- After the replay passes, watch the after recording beside the before one. If a step now draws the eye to itself, say so in the report.

---

## Part 0 · Read first, then reproduce

- **Saving:** `src/lib/build/making.ts` (`patchMaking` around line 642, `setSessionMeta` around line 607, `readMadeWith` around line 469, `setWorkstreams`, `setPartLabels`, and every other function that writes `making`), `src/lib/build/sessionLayout.ts` (`setSessionOrder`), `src/lib/build/staleWrites.ts` (`serial`, the stamp check), and CA-23's pending-write queue and `WriteBuffer`.
- **The page's state:**
  - `SandboxPage.tsx`: `arriving`, `setArriving`, `pendingAdd`, `emptySessions` and `FIRST_SESSION_KEY`, `sessionSaid`, `onAddSession`, `onStartSession`;
  - the import path near `setSessionSaid(\`Adding …\`)`;
  - every `scrollIntoView` and scroll call (around lines 462, 731, 1285, 1425 and 1431 at `6b8fe912`; SV-06 may have moved some to its helper);
  - every refetch after a write (`refreshRecord`, `queryClient` invalidations).
- **Parts:** `useSessionEdits.ts` (`onAddPart`, Move to part), `partsModel.ts` (`listPartsOf` returns null below two parts), and the Your sessions "Add this session to · Part n" menu.
- **The list:** `BuildList.tsx` (`sessions-said`, `nest-said`, `Quiet`), `arrival.tsx`, `AddSessionRow.tsx` ("Adding…"), and the jump tabs (`SandboxView.tsx` around lines 1007 and 1034).
- **Also:** `ImportingPieces.tsx`, CA-20's notice, the "Import from connected chats" list, and the publish path (`missingForPublish` in `src/lib/build/publishChecklist.ts`, `onPublish`).
- `ca20Harness.tsx` and `ca21Harness.tsx`: in-memory tables for page tests.

### Reproduce first

Write `src/pages/site/compose/sv07.replay.test.tsx` on the harness, playing the recorded sequence:
1. a new draft;
2. import a one-prompt chat from the empty build panel;
3. "Add a part" twice;
4. "Add a session" › Start a new session;
5. add a library chat to Part 2;
6. collapse Part 2 and add another chat to it;
7. add a chat to Part 3, then another to Part 3 straight after;
8. click a jump tab for a session in the closed Part 2.

Make the writes slow (100 to 800 ms, out of order) and let refetches return older data than the page holds. **Sample the list after every animation frame** and record, each time, the session keys in order, their parts, their numbers, and whether `FIRST_SESSION_KEY` is drawn.

It must fail now, on:
- a key drawn twice;
- the placeholder drawn next to any other session;
- a layout that returns to an earlier one with no maker action (A, B, A);
- a session whose part changed with no maker action;
- a number that changed with no maker action.

Record in the plan which of these it failed on. Keep it: it must pass at the end. Also save a before recording of the same sequence on the dev page with Playwright (`video` on), into `design/audits/composer/sv-07/before/`.

Commit: `SV-07 P0: replay, before recording and plan`.

## Part 1 · Saves can't overwrite each other

1. **Read and write in the same step.** Every function that writes `making` runs its read, its change and its write inside one step of the build's existing `serial` queue (`staleWrites.ts`). Export what `making.ts` needs, rather than making a second queue.
2. **Each write re-reads `making` inside that step** and changes only its own path:
   - one session's entry in `sessions_meta[key]`, never the whole map;
   - `session_order`;
   - `workstreams`;
   - and so on.
3. **Another tab's change.** First write a test: another tab changes `making` between this tab's read and its write. If the existing `updated_at` stamp check and CA-23's clash window already keep both changes, or show the clash window, add nothing and say so. Only if the test shows a change lost silently, read again and re-apply inside the same step.
4. CA-23's pending-write queue, `WriteBuffer` and the two-tabs clash window stay as they are.
5. `build_sessions` writes for one change go in one request where possible (`reorderBuildSessions`).

**Tests:**
- two writes started together, to two sessions' entries, both survive;
- a write to `session_order` and one to `sessions_meta` started together both survive;
- the recorded case: Session 5 stays in Part 3 when Session 6 is added to Part 3 straight after.

Commit: `SV-07 P1: saves can't overwrite each other`.

## Part 2 · One model from click to result

1. **One model per draft:** session entries keyed by session key, each with its part, its place, and a status (`pending`, `importing` or `saved`). The list, Sources, the jump tabs, the counts and the Map all read it. Numbers still come from SV-05's one function, reading this model's order.
   - **One insert path.** The model has one function that adds tiles or a session at a place (`pending`, then `saved`), used by import, Start a new session and Duplicate. SV-18 (Add from Library) and SV-21 (offered sessions) will call it, so it takes a ready-made copy as well as an import, and returns the new keys for `motion.expect`.
   - **One store, everything derived.** The list, Sources, the jump tabs, the counts and the Map work out what they show from the model during render. No effect copies the model, or part of it, into another state (`rerender-derived-state-no-effect`). Copies kept in sync by effects are how two views end up drawing the same session differently.
   - No component that draws the model is defined inside another component (`rerender-no-inline-components`), so a pending entry that becomes saved keeps its element.
2. **A pending entry takes the key the saved row will have,** or is re-keyed in place when the row arrives. It keeps its position, so the saved session replaces it in the same frame. Never remove-then-add.
3. **The empty first-session placeholder** (`FIRST_SESSION_KEY`) is drawn only while the draft has no sessions and nothing is pending. The moment an import or a new session starts, it goes.
4. **Refetches never undo what the page shows.** A refetch that answers with data older than a pending or just-saved change is merged under the model, not drawn over it: the change wins until a newer read confirms it.
5. **A new or imported session is placed in its final part and place at once,** at the end of the chosen part, or the last part when none was chosen. It is never drawn somewhere first and moved later.

**Tests:** the Part 0 replay's conditions for keys, the placeholder, A-B-A and numbers all pass; a slow import shows one entry from the first frame to the last; a stale refetch doesn't bring back an old layout; no `useEffect` copies the model into other state (source check).

Commit: `SV-07 P2: one model from click to result`.

## Part 3 · Parts

1. **"Add a part" answers at once.** The first click shows the parts within 100 ms: Part 1 holding the sessions there are, and the new empty Part 2 ("No sessions yet", "+ Add a session to this part"). Parts show as soon as the maker has added one, even with one session.
2. **While a part is being written, the button is disabled,** with the existing disabled style from `modalRecipes.tsx`, so a second click can't make a second part. When the write lands, it is enabled again.
3. **Adding into a closed part opens it first** (the animator's unfold), then the session arrives (`motion.expect({ kind: "add" })`).
4. **Jump tabs for a session in a closed part** open the part, then use the scroll helper so the session's head sits 24 below the sticky title row. The tab's session then gets the animator's outline once.
5. In Your sessions, the "Add this session to · Part n" menu marks the part chosen last, and adding there behaves as in step 3.
6. **Closed parts keep their sessions.** First check whether closing a part unmounts its sessions. If it does, and opening it remounts them (which cancels the unfold), try `<Activity mode="hidden">` for the closed part's body (`rendering-activity`) and measure the moment with `npm run audit:motion`. Keep it only if the moment gets better and nothing hidden can still take focus or be announced. Otherwise leave it and report the numbers.

**Tests:** one click on "Add a part" makes one part, shown within 100 ms; double-clicking makes one; adding into a closed part opens it; a jump tab opens a closed part and reaches the session.

Commit: `SV-07 P3: parts`.

## Part 4 · Wire every change to the animator

1. **Every action in this prompt's paths** calls `motion.expect({ kind, keys })` before it changes the model, using the kinds SV-06 kept:
   - add, import, start a new session;
   - Add a part;
   - Move to part, Move up and down;
   - remove, Undo and Redo.
   SV-06's animator then plays it from the one commit that shows it.
2. **Remove every scroll to the top** and every `scrollIntoView` left in these paths. The only scroll is SV-06's helper, used when a just-added or just-moved item would be wholly off screen.
3. Run `npm run audit:motion` (SV-06) with the Part 0 replay added as a moment. All of SV-06's thresholds must pass for it. Where one fails because of the animator itself, report it (Motion limits).

**Tests:** each action above calls `motion.expect` with its keys; there's no scroll to the top; in the replay, no element moves more than 35% of its travel in one frame.

Commit: `SV-07 P4: changes go through the animator`.

## Part 5 · What the page says

1. **Remove the visible status lines** (`sessions-said`, `nest-said`, and any other place the list prints "Adding …", "Added …" or "Added a part."). Keep the same words for screen readers through the existing announcer. The visible confirmation is CA-20's notice alone.
2. **The "Adding…" text** on the add rows goes. The disabled state and the arriving entry show that it is working.
3. **The notice always sits in one place:** fixed, 24 from the bottom of the window, centred on the build column. It arrives as a drop (`DROP`, 240 ms, `DROP_FALL` 20) and leaves as a lift (`LIFT`, 200 ms) with no delay: leaving is quicker than arriving. One notice at a time; a new one replaces the old in place, with no stack. Both go through SV-06's animator, and neither uses blur or scale. While it shows, the page gets bottom padding equal to its height plus 16, so it never covers the last row of the list.

**Tests:** no status text in the list; the announcer still speaks each step; the notice sits in the same place for every action; it leaves with no delay and in less time than it arrives; the last row stays clear.

Commit: `SV-07 P5: one notice, no stray text`.

## Part 6 · Small fixes seen in the recording

1. **Empty sessions** look one way: `No tiles yet` and `+ Add tile`. The dashed "Drop a tile here" shows only while something is being dragged.
2. **The import list** under "Import from connected chats" opens at the build column's width, under the row, and the rows below it slide down (through the animator) rather than being covered. The same goes for the "Add a session" menu.
3. **The focus ring** on "+ Add a session to this part" (and every row link like it in the part frame) is drawn whole. No clipping by the part's frame: give the row the room, or draw the ring inside.
4. **Text selection:** the labels and controls seen in the recording (session heads, counts, the jump tabs, the Details placeholder, and the menus) can't be selected by clicking or dragging. Prompt text, post text and anything meant to be copied can. Don't sweep other surfaces; list any others you notice.

**Tests:** one empty-session look; the import list's width matches the column; the focus ring's box sits within the visible area; a drag across a session head selects nothing.

Commit: `SV-07 P6: small fixes`.

## Part 7 · Imports

1. **Claude Code's summary:**
   - a turn that starts `This session is being continued from a previous conversation that ran out of context` becomes a tile of kind `Summary`, not `Prompt`;
   - it reads `Summary of an earlier chat`, with its word count, and opens in the same read window;
   - it doesn't count as a prompt in any count, and isn't numbered as one;
   - a draft's or session's name taken from its first prompt skips it (the series decision);
   - nothing is dropped: the maker can convert it to a prompt from its menu (CA-20's Convert).
   - Check how the extractive connector stores these turns. Don't change the connector; this is how the build reads them.
2. **Repeated chats:**
   - when a library row's prompts are already in the build (same text, same order), its row in Your sessions shows `Same prompts as Session 5`;
   - find repeats with one `Map` from a session's joined prompt text to its session number, built once per change of the build (`js-set-map-lookups`), not by comparing every row with every session;
   - adding it adds the session as usual, and each repeated tile shows `Also in Session 5` under its kind line.
   - Find out why two rows exist for one chat (a continued Claude Code chat, or two imports of one chat), and say which in the report.

**Tests:** the summary turn becomes a Summary tile and isn't counted; Convert makes it a prompt; repeated prompts are marked on the row and on the tiles.

Commit: `SV-07 P7: imports`.

## Part 8 · Publishing without a title

1. Find how "@suntzu hung Untitled build" was published. Write a test for that path first.
2. If any path skips `missingForPublish`, route it through the same check.
3. If the database should refuse it too, write the migration file (a check on publish with an empty title) and give Miles the Lovable message in the report. Don't apply it yourself.

**Tests:** every publish path refuses a build with no title.

Commit: `SV-07 P8: publishing without a title`.

## Part 9 · Screens and checks

1. **The Part 0 replay** passes.
2. **Record the same sequence again with Playwright** into `design/audits/composer/sv-07/after/`. Measure both recordings (before and after) frame by frame, and report for each step:
   - the time from click to the first change, in ms;
   - the largest single-frame change, as a share of the list;
   - any scroll the maker didn't make.
   Every click must answer within 100 ms. No step may change more than 25% of the list in one frame outside a slide.
   Also report the long tasks over 50 ms per step (SV-06's tools). The count at the end must be no higher than at the start.
3. **Screenshot at 1440 and 390, in Dusk and Noon:**
   - an import mid-way;
   - a new part;
   - a closed part opening for an arrival;
   - the notice;
   - an empty session;
   - a Summary tile.
4. Run `npm run audit:design -- --grep composer` and `npm run audit:contrast`. Search the diff for the em dash character.

Commit: `SV-07 P9: screens and checks`.

---

## Report (end the session with exactly this)

```
SV-07 · steady adds, imports and parts
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N · contrast

P0 replay failed before on: (list) · passes now yes/no
P1 making read and written in one serial step yes/no · writes changed to single paths: (list) · another-tab re-apply needed yes/no (what the test showed) · Session 5 case fixed yes/no
P2 one model yes/no · views derived, no effect copies yes/no · placeholder never beside a session yes/no · stale refetches ignored yes/no
P3 Add a part answers in N ms · double-click makes one part yes/no · closed parts open for arrivals yes/no · jump tabs open closed parts yes/no · closed parts kept with Activity yes/no (numbers)
P4 every action labelled with motion.expect yes/no · scrolls to the top removed yes/no · audit:motion passes for the replay yes/no · animator issues reported: (list, or "none")
P5 visible status text removed yes/no · notice in one place yes/no
P6 empty session look, import list width, focus ring, selection: yes/no each
P7 Summary tiles yes/no · repeated chats marked yes/no · why two rows: (cause)
P8 untitled publish cause: (cause) · every path checks the title yes/no
Before → after, per step: click-to-change ms · largest one-frame change · unasked scrolls · long tasks
Dead code seen: (list, or "none")
Parts not done: (list, or "none")
Questions for Miles: (list)
Lovable message needed: (the message, or "none")
```

**What Miles needs to do** (say it in the report, plainly): merge the pull request and press Publish › Publish changes in Lovable. If Part 8 wrote a migration, send the Lovable message from the report as well.
