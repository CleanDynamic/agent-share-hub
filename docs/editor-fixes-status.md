# Editor fixes status

Branch: `editor-fixes`
Started from: `main` at commit `c177bb05f41fe421713f7c564f5c1270b2756f72`

## Baseline (before any change)

- `npm run lint`: FAIL. 1417 problems (888 errors, 529 warnings). Not fixed.
- `npm test` (vitest run): FAIL. 14 of 717 test files failed; 31 of 11475 tests failed (11444 passed). Not fixed. Failing tests (file > test):

  - `src/components/build/ux03.p4.test.tsx > UX-03 P4: two groups by provenance > puts each value under its provenance, the maker's first`
  - `src/components/build/ux03.p4.test.tsx > UX-03 P4: two groups by provenance > shows a reader with only derived values one group and no Not stated`
  - `src/components/build/ux03.p4.test.tsx > UX-03 P4: two groups by provenance > shows the maker, on their own build, Not stated for each empty facet they set, and where to fill it`
  - `src/lib/build/everything.test.ts > everything at once, on the build page > says every part`
  - `src/lib/build/onePrompt.snapshot.test.tsx > the one-prompt build > draws the build page as before`
  - `src/lib/build/readerSteps.test.ts > readerSteps · B1 the bakery > What you need: tools and models, files, time`
  - `src/lib/build/readerSteps.test.ts > readerSteps · B3 the team > What you need: the columns row for row`
  - `src/lib/build/readerSteps.test.ts > readerSteps · B4 and the edges > a typed prompt is a new chat in its own tool, with no model recorded`
  - `src/lib/build/readerSteps.test.ts > readerSteps · a file a step makes (TF-08) > What you need says where a made file is made, with no download`
  - `src/lib/build/shapes.test.ts > CA-04 P7: one sitting, then agents; and a session that runs on GitHub > draws one sitting on the build page: both sessions, the tiles indented, Setup, the goal line, the team, and MCP in What you need`
  - `src/lib/theme/lookRules.test.ts > src/pages/site/build/BuildSteps.test.tsx > keeps the look's rules`
  - `src/lib/theme/lookRules.test.ts > src/pages/site/build/BuildSteps.tsx > keeps the look's rules`
  - `src/lib/theme/lookRules.test.ts > src/pages/site/build/BuildView.tsx > keeps the look's rules`
  - `src/pages/site/build/BuildSteps.test.tsx > a file a step makes > What you need lists a made file once, as a link to its step, with no Download`
  - `src/pages/site/build/BuildSteps.tiles.test.tsx > the build page, every kind with its optional details given (CA-15 P12) > tells a reader a team's pattern, a check's method, reviewer, scoring, model and evidence`
  - `src/pages/site/build/BuildView.test.tsx > a check on the build page (CA-03 P5) > draws it as a step: the test description, pass criteria, failure notes and its status`
  - `src/pages/site/build/readerSessions.test.tsx > a session with no tile yet > is drawn for a reader as its head and No steps in this session (UX-03 P3), so the numbers run on without a gap`
  - `src/pages/site/compose/ca20.p2.test.tsx > a file > goes at once, out of the tiles that use it, and comes back into them`
  - `src/pages/site/compose/connection.test.tsx > What you need > gives an MCP server's row one more line, signing in when its setup kept a placeholder, and says Before you connect`
  - `src/pages/site/compose/ux02.p2.test.tsx > UX-02 P2 · Add to session on the composer > writes a File step tile at the end of that session, with the same stored file, labelled an add`
  - `src/pages/site/compose/ux03.p3.test.tsx > UX-03 P3: one label per step > draws a File step tile with its name and Download, and the Files list links to it`
  - `src/pages/site/compose/ux03.p3.test.tsx > UX-03 P3: one label per step > heads each step Step <n> · <Type>, with the number exactly as given and no generated title`

Note: 21 distinct names are listed for 31 failed tests. Names that repeat across files (e.g. "keeps the look's rules") are listed once per file/test in the lookRules group.

## Items

| Item | Prompt | Status | Files changed | Evidence |
|---|---|---|---|---|
| F1 | 1 | blocked | src/components/compose/useBuildFileDrop.ts, useBuildFileDrop.test.tsx | Done: dragover highlight withheld only when every item has a non-accepted MIME type (`couldBeBuildFile`); test `useBuildFileDrop.test.tsx > refuses a.docx…` asserts message `a.docx is not one of .md, .json, .txt.` and state `failed`. NOT done: the refusal is drawn by `BuildFileIntake.tsx` RefusalPanel (role="alert", no timeout, replaces the page body) — needs role="status", 4s minimum, drop-point placement; that file is not on the Prompt 1 list. Asked in report. |
| F2 | 1 | done | src/pages/site/compose/BuildList.tsx, BuildList.nest.test.tsx | `move` in BuildList.tsx: after Make it its own step, `showOwnStep` selects the tile, `scrollToShow(..., {align:"nearest"})`, `outlineOnce` (reduced-motion handled inside it). Index was already parent+1 (`after`). Test: BuildList.nest.test.tsx expects onNest("c1", null, 2) and onSelect("c1"). |
| F3 | 1 | done | src/pages/site/compose/BuildList.tsx | Footer "Open file" was already a button (TextButton via FooterLink) opening the tile window. Added `userSelect: none` to FooterLink; FileCard now opens non-picture stored files in a new tab (`openFileInTab`); pictures keep the tile window. Not covered by a unit test; not checked in a browser (see report). |
| F4 | 1 | already fixed | (none) | DetailsPanel.tsx AddDetails uses the same `onEdit` as Edit and is only rendered when `notSet.length > 0`. Focus-in-first-field is the Edit window's own behaviour; the 400ms timing was not measured. |
| F5 | 1 | already fixed | (none) | ClassificationPicker.tsx Suggestion onAdd → `add({id})`; chosen row has Remove, suggestion hidden once chosen. Test: ClassificationPicker.test.tsx "adds one on press". |
| F6 | 1 | done | src/pages/site/compose/editKit.tsx, ModelPicker.tsx | UsesBlock: with no options and no attach, disabled "Add input" with `EDIT_COPY.noInputs` ("No other step tiles yet") beside it. ModelPicker pick-tool state: disabled button now has `MODEL_PICKER_COPY.pickToolReason` beside it. Menus already opened on click otherwise. |
| F7 | 1 | done | src/pages/site/compose/SourcesPanel.tsx | FileRow name/note is now a SelectButton: click calls onOpen (select) and scrolls the tile with scrollToShow nearest. Drag starts only from the grip (`SourceGrip`, existing). |
| F8 | 1 | done | src/components/build/tileBodies.tsx, BuildList.tsx | FileTileBody gets optional `onPreview`; the thumbnail is then a button (aria-label "Preview <name>") that opens the tile window. File name spans have cursor default. |
| F9 | 1 | done | src/components/post/editor/PostToolbar.tsx | Eye button is 36 (desktop) / 44 (phone) square, already with a hover state. Added `previewOpen` prop → aria-pressed, and a title naming what it shows or hides. PostTab.tsx does not pass `previewOpen` yet (not on the list). |
| F10 | 1 | done | src/pages/site/compose/SandboxCard.tsx, SandboxCard.test.tsx | SandboxCard guards onOpenChange: when any field differs from open, Escape/outside/close square shows an in-dialog Keep editing / Discard changes choice. useLeaveGuard is router-only, not reused. Tests: `F10 · closing Classification with changes`. |
| F11 | 2 | not started | | |
| F12 | 2 | not started | | |
| F13 | 2 | not started | | |
| F14 | 2 | not started | | |
| F15 | 5 | not started | | |
| F16 | 5 | not started | | |
| F17 | 6 | not started | | |
| F18 | 12 | not started | | |
| F19 | 6 | not started | | |
| F20 | 3 | not started | | |
| F21 | 3 | not started | | |
| F22 | 3 | not started | | |
| F23 | 3 | not started | | |
| F24 | 3 | not started | | |
| F25 | 3 | not started | | |
| F26 | 3 | not started | | |
| F27 | 3 | not started | | |
| F28 | 3 | not started | | |
| F29 | 4 | not started | | |
| F30 | 4 | not started | | |
| F31 | 4 | not started | | |
| F32 | 4 | not started | | |
| F33 | 4 | not started | | |
| F34 | 4 | not started | | |
| F35 | 4 | not started | | |
| F36 | 4 | not started | | |
| F37 | 4 | not started | | |
| F38 | 4 | not started | | |
| F39 | 4 | not started | | |
| F40 | 5 | not started | | |
| F41 | 5 | not started | | |
| F42 | 6 | not started | | |
| F43 | 6 | not started | | |
| F44 | 6 | not started | | |
| F45 | 6 | not started | | |
| F46 | 6 | not started | | |
| F47 | 6 | not started | | |
| F48 | 7 | not started | | |
| F49 | 7 | not started | | |
| F50 | 7 | not started | | |
| F51 | 7 | not started | | |
| F52 | 7 | not started | | |
| F53 | 7 | not started | | |
| F54 | 6 | not started | | |
| F55 | 7 | not started | | |
| F56 | 2 | not started | | |
| F57 | 2 | not started | | |
| F58 | 8 | not started | | |
| F59 | 8 | not started | | |
| F60 | 8 | not started | | |
| F61 | 8 | not started | | |
| F62 | 12 | not started | | |
| F63 | 7 | not started | | |
| F64 | 12 | not started | | |
| F65 | 11 | not started | | |
| F66 | 7 | not started | | |
| F67 | 12 | not started | | |
| F68 | 9 | not started | | |
| F69 | 11 | not started | | |
| F70 | 12 | not started | | |
| F71 | 12 | not started | | |
| F72 | 11 | not started | | |
| F73 | 11 | not started | | |
| F74 | 12 | not started | | |
| F75 | 12 | not started | | |
| F76 | 12 | not started | | |
| F77 | 13 | not started | | |
| F78 | 13 | not started | | |
| F79 | 13 | not started | | |
| F80 | 14 | not started | | |
| F81 | 10 | not started | | |
| F82 | 13 | not started | | |
| F83 | 14 | not started | | |
| F84 | 14 | not started | | |
| F85 | 14 | not started | | |
| F86 | 14 | not started | | |
| F87 | 14 | not started | | |
| F88 | 14 | not started | | |
| F89 | 14 | not started | | |
| F90 | 14 | not started | | |
| F91 | 14 | not started | | |
| F92 | 14 | not started | | |
| F93 | 14 | not started | | |
| F94 | 14 | not started | | |
| F95 | 14 | not started | | |
| F96 | 14 | not started | | |
| F97 | 14 | not started | | |
| F98 | 14 | not started | | |
| S1 | 10 | not started | | |
| S2 | 10 | not started | | |
| S3 | 10 | not started | | |
| S4 | 10 | not started | | |
| S5 | 10 | not started | | |
| S6 | 10 | not started | | |
| S7 | 10 | not started | | |
| S8 | 10 | not started | | |
| S9 | 10 | not started | | |
| S10 | 10 | not started | | |
| S11 | 10 | not started | | |
| S12 | 10 | not started | | |
| S13 | 10 | not started | | |
| S14 | 10 | not started | | |
| S15 | 10 | not started | | |
| S16 | 10 | not started | | |
| S17 | 10 | not started | | |
| S18 | 10 | not started | | |
| S19 | 11 | not started | | |
| S20 | 11 | not started | | |
| S21 | 11 | not started | | |
| S22 | 11 | not started | | |
| S23 | 11 | not started | | |
| S24 | 11 | not started | | |
| S25 | 11 | not started | | |
| S26 | 11 | not started | | |
| S27 | 11 | not started | | |
| S28 | 11 | not started | | |
| S29 | 11 | not started | | |
| S30 | 11 | not started | | |
| S31 | 11 | not started | | |
| S32 | 11 | not started | | |
| S33 | 11 | not started | | |
| S34 | 12 | not started | | |
| S35 | 12 | not started | | |
| S36 | 11 | not started | | |
| S37 | 12 | not started | | |
| S38 | 11 | not started | | |
| S39 | 10 | not started | | |
| S40 | 9 | not started | | |
