# SV-07 plan

Checked on `main` at `8b1dde5` (SV-06 merged), 26 October 2026.

## Assumptions

- `patchMaking`, `setSessionMeta` and `readMadeWith` are in `src/lib/build/making.ts` as the prompt says (at lines 642, 607 and 469 on main). Each reads `builds.making` with `readMadeWith`, changes one key and writes the whole object through `updateBuild`. True.
- `updateBuild` runs writes one at a time through `serial` (`src/lib/build/staleWrites.ts`), and the read is outside that queue. True. Also: `serial` only queues a build that is **watched** (open in the composer with `useTwoTabs`); for any other build it runs the write at once, so two saves are not even queued.
- The `updated_at` stamp check does not save the recorded case on its own. When both saves come from this tab, the second is three-way merged with `base` = what the first wrote, so the merge reads the first save as "unchanged by me" and drops it (`mergeMaking`). Shown by `making.steps.test.ts` failing on main, watched and not.
- `setSessionOrder` (`sessionLayout.ts`), `setWorkstreams`, `setPartLabels`, `setMapSettings`, `setSessionTool`, the Made with writers and `refreshMakingStats` share the pattern. True. More callers read `making` and write it back later: `applyParts`, `editPart`, `onWithAbove` and Remove session in `useSessionEdits.ts`; `setCollapsed`; `addSessionToBuild`, which works the order out from a read made before its tiles are written (seconds earlier on a slow import); `onStartSession`, which writes the order from the page's copy.
- **The cause found for 5 has a second half.** The page's own session writers (`onSessionMeta`, `onSessionGoal`, `onSessionExtras`, `onSessionTogether`, `onSessionColour`, `onPickApp` in `SandboxPage.tsx`) write a session's WHOLE entry from the page's copy of `making`. A copy older than a Move to part puts the old part back.
- CA-23's pending-write queue is `nodes.run` (`pendingWrites.ts`); `WriteBuffer` is in `src/pages/site/compose/editBuffer.ts`. Both exist.
- `BuildList.tsx` draws `sessions-said` and `nest-said` as visible text (lines 2447 and 2451 now, "around 2428" in the prompt). True.
- `AddSessionRow.tsx` labels the row "Adding…" while adding. True.
- `listPartsOf` (`partsModel.ts`) returns null below two parts. True.
- `missingForPublish` is in `src/pages/site/compose/composeModel.ts`, not `src/lib/build/publishChecklist.ts` (which only names it in a comment). Differs.
- `FIRST_SESSION_KEY` is `"typed-first-session"` (`sourcesModel.ts`), drawn by `emptySessions` only while there is no draft. True.
- The jump tabs are `SessionJump` (`src/components/build/SessionJump.tsx`), wired in `SandboxPage.tsx`, not in `SandboxView.tsx`. Differs.

### The Part 0 replay, on main

`src/pages/site/compose/sv07.replay.test.tsx` plays the recorded sequence on the real page (SandboxPage on supabase-js, the network faked by `fakeSupabase.ts`), writes 100 to 800 ms and out of order, reads of the build answered with the data as it was when asked. It samples the List every animation frame. It fails on main on:

- the placeholder drawn next to another session (the first import);
- a layout that came back with no maker action (A, B, A): first import, and each chat added to a part;
- a session whose part changed with no maker action: Start a new session, and each chat added to a part;
- a number that changed with no maker action: first import, and the two chats added to Part 3;
- not on a key drawn twice in one frame (the arriving entry and the saved session were never on screen in the same sample);
- and in the data: Start a new session with three parts and no part chosen is saved in Part 1, not the last part.

The before recording on the dev page needs a page that can write. The dev pages draw the List from fixtures and can't add a session, so Part 9 adds a Playwright spec that serves the same faked backend to the real composer, and records both "before" (on main) and "after" from it.

## Plan

- Part 1: every `making` writer reads, changes and writes in one `serial` step (`makingStep`; `serial` queues unwatched builds too); callers that worked a change out from an older read pass a function of `making` instead; session writers change the stored entry -> verified by: `making.steps.test.ts` (two sessions, order and meta, the recorded Session 5 case, parts and meta, another tab), `sessionLayout.test.ts`, the replay's "part changed" condition.
- Part 2: one model of the draft's sessions (pending, importing, saved) that the List, Sources, jump tabs, counts and Map derive from; one insert path; the placeholder only while nothing exists or is pending; refetches merged under pending changes; a new session placed in its final part at once -> verified by: the replay (keys, placeholder, A-B-A, numbers), a slow import test, a stale refetch test, a source check for effects that copy the model.
- Part 3: Add a part shows parts at once, disabled while writing, adding into a closed part opens it, jump tabs open closed parts -> verified by: page tests for one click within 100 ms, a double click making one part, a closed part opening for an arrival, a jump tab reaching a session in a closed part.
- Part 4: every action in these paths calls `motion.expect` with its keys; no scroll to the top, scrolls only through `scrollToShow` -> verified by: spies on `motion.expect` per action, a source check for `scrollTo(0`/`scrollIntoView` in the paths, `npm run audit:motion` with the replay moment.
- Part 5: no visible status lines, "Adding…" gone, one notice in one place -> verified by: tests that the list prints no status text, the announcer still speaks, the notice's place and timing.
- Part 6: one empty-session look, the import list at the column's width, a whole focus ring, no text selection on labels -> verified by: component tests for each.
- Part 7: Claude Code's summary as a Summary tile; repeated chats marked -> verified by: import tests.
- Part 8: every publish path checks the title -> verified by: a test per publish path.
- Part 9: replay passes; before and after recordings measured; screenshots; audits -> verified by: the numbers in the report.
