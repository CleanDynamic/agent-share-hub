# MS-15 · Cleanup, audits and end-to-end tests

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** The last of the series, after MS-14 has merged. Read the README (Done for the whole series), and every `design/audits/map-sandbox/ms-nn-before.md` and pull request report from MS-00 to MS-14, especially their `Dead code seen` and `Questions`. Pull main. Branch `ms-15-cleanup`. Open one pull request titled `MS-15 map sandbox cleanup`.

## Part 0: plan

The README's audit file and plan, plus a table of every `Dead code seen` and `Questions` entry from the series with what this prompt does about each: removed, kept (and why), or left for Miles.

## Part 1: what the old map leaves behind

1. List every export of `sessionMap.ts`, `SessionMap.tsx`, `SessionMapPanel.tsx` and `mapRecipes.ts`, and for each, every importer now.
2. `tileLinksOf`, `sessionOfTiles`, `tileName` and anything else the sandbox uses stay. `layoutSessionMap`, `SESSION_MAP_SIZES`, `SessionMapColumn`, the panel and their recipes are removed **only if** nothing imports them. `BuildsMapsView.tsx` and `buildsMaps.ts` (SV-12, the Builds page's Maps) are separate: they draw small session maps of many builds. Leave them working; if they import something removed, keep that piece and say so. Whether the Builds page should draw the new canvas is a question for Miles, not a change here.
3. `making.map.direction` is no longer used by the Sessions view. If nothing reads it, stop writing it in new maps (keep reading it, so old data stays valid) and say so. `mapRefusal` keeps accepting it.
4. The phone well from `ReaderMap` (Prompt 22) if MS-13 left it.
5. `DevMap.tsx` and its fixtures: keep them if they still render something that exists; otherwise remove them and their route.
6. Every removed file's tests go with it. No test of code that still exists is deleted.

## Part 2: audits

Run and report each, fixing what fails:

- `npm run audit:contrast` and `npm run audit:themes` (with `/dev/map-sandbox` in their page lists).
- `npm run audit:size`: the map editor must be its own chunk, loaded only when the Map view opens, as `SessionMapPanel` and `ArchitectureMap` were (`lazyWindow`, `lazy`). The build page loads the reader canvas only when a reader chooses Map. Report the chunk sizes.
- `npm run audit:perf`: MS-13's targets, once more.
- `npm run audit:motion`: no new motion beyond the composer's own.

## Part 3: end-to-end tests

Playwright tests in the folder the repo's e2e tests use, against the dev fixtures (no live database), following the repo's existing e2e patterns:

1. **Plain map.** Open the composer on `supportInbox`, open Map: 9 tiles, reading order 1 and 4, then 2 and 5, then 3 and 6, then 7, 8 and 9. Nothing is written until a change.
2. **Shaping and moving.** Split S1's box, move tile 3 into the new half, try to drag tile 6 above tile 5 (refused with its reason), swap S1 and S2, undo twice.
3. **Two-way.** Add a two-way arrow between tiles 1 and 4; try 4 and 5 (refused).
4. **Style.** Fill S2 green, switch the background to paper, Tidy, Collapse S3 and open it.
5. **Map file.** Copy for chat (assert the clipboard holds the fixture's text), drop `examples/support-inbox-triage.map.md`, see the check list, Replace map, confirm the structure, undo.
6. **Reader.** The build page shows the saved map read-only; a phone viewport stacks it in reading order.
7. **Keyboard only.** Tab to a box, M, arrows to an allowed place, Enter; the move is announced.

## Part 4: the series' done list

Go through "Done for the whole series" in the README and mark each line done or not, with the test or audit that shows it. Anything not done is the first line of the report.

## Done when

- Nothing unused from the old map remains except what something still imports (listed).
- Every audit passes and the e2e tests pass.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
