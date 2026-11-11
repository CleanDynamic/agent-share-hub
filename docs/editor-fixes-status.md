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
| F11 | 2 | done | src/pages/site/compose/SandboxPage.tsx, BuildList.tsx (comment) | `select` in SandboxPage.tsx (one `useState` kept, its setter renamed `setSelectedRaw`); every former `setSelectedId` call now calls `select`. "Open prompt" and the prompt window's prev/next go through `openPrompt`; a file dropped on the List, a source file added as a tile, an add from the composer and an add from Library now select. Test `selection.ui.test.tsx > "Open prompt" selects the prompt it opens`. |
| F12 | 2 | done | src/pages/site/compose/SandboxPage.tsx | `select` sets `reveal`; the effect after it calls `scrollIntoView({ block: "nearest" })` on `[data-node-id]` / `[data-tile-id]` and the card shows `data-selected`. Test `selection.ui.test.tsx > a click on a prompt in Sources selects its tile and scrolls it into view, nearest`. Not checked on the dev kit page: scroll behaviour of a real browser. |
| F13 | 2 | done | src/pages/site/compose/SandboxPage.tsx | Composer prompt: `onAddPrompt` picks the id before the write and selects it; tool/result/agent/decision/code/check/manual/source tiles already selected and now scroll through `select`; Library insert selects its first tile. The effect waits until the new tile is drawn. No dedicated test for the composer add (see report). |
| F14 | 2 | done | src/pages/site/compose/DetailsPanel.tsx, SandboxView.tsx, DetailsPanel.test.tsx, SandboxView.test.tsx, aroundBuild.test.tsx | `DETAILS_COPY.empty` = "Select a step to see its details" (and the same line in SandboxView `DETAILS_EMPTY`). Tests `DetailsPanel.test.tsx > shows tile B's title after tile A's, and the line again when the selection is cleared (F14)`; `selection.ui.test.tsx > selects tile A, then tile B: the panel's title is B's`. |
| F15 | 5 | done | src/pages/site/compose/BuildList.tsx, BuildList.test.tsx | `LIST_COPY.placeholder` = "Add a prompt to this session" (the agent's field: `placeholderAgent`, "Add a prompt to this agent"); the ArrowUp `IconButton` is a primary `Button` reading "Add" (`composer-add`; the agent's field the same, `agent-prompt-add`); Enter still adds. Test `BuildList.test.tsx > F15 and F41 · the composer > F15…`. Seen on /dev/kit/pages/sandbox (dusk, desktop): field, Select a tool, Model, Add. |
| F16 | 5 | done | src/pages/site/compose/SandboxPage.tsx (`stepOf.prompt`, `COMPOSER_ADDED_COPY`), referencePieces.tsx (`role="status"`), selection.ui.test.tsx | Files allowed by the owner after the Prompt 5 question. The composer's add was already one step of the history (`asStep(ADDED.prompt, onAddPrompt)`), without a notice. It is now `track(ADDED.prompt, …, { notice: "Prompt added" })`: the history's one notice (`ReferenceNotice`, `NOTICE_MS` six seconds, Undo) — the mechanism useSessionEdits.ts uses, no second undo stack. The notice now carries `role="status"`. Test `selection.ui.test.tsx > undo after adding from the composer (F16) > adds "abc", says Prompt added with Undo, and Undo takes the tile back off`. |
| F17 | 6 | done | src/pages/site/compose/BuildList.tsx (StepCard), BuildList.test.tsx, BuildList.edit.test.tsx, BuildList.nest.test.tsx, tileRecipes.test.tsx, ux02.p10.test.tsx, ux02.p5.test.tsx, selection.ui.test.tsx | The pencil (`Rename prompt N`) and the `LIST_COPY.openPrompt` footer link are gone from prompt tiles; a click selects (`onSelect`), `onDoubleClick={open}` and Enter open the prompt window; the right panel's Edit already opened it (`openTile` → `setOpenPromptId`). Rename stays in the tile menu and the dialog. A Summary tile keeps its footer link (its one footer action, F44). Other tiles' links unchanged. ux02.p5's "nothing answers a double click" now excepts prompt tiles (D8 over UX-02 P5). Tests `BuildList.test.tsx > F17: a prompt tile has no pencil…`, `F17: a click selects a prompt; a double click and Enter open it`. Dev kit (`?build=shape-everything`, dusk, exhibition, phone): 0 pencils, 0 Open prompt links. |
| F18 | 12 | not started | | |
| F19 | 6 | done | src/lib/build/graph.ts (`plainPreview`, beside `previewOf`), src/pages/site/compose/BuildList.tsx, graph.test.ts, BuildList.test.tsx | `plainPreview` strips heading marks, `**`/`__`, backticks, fence lines and list markers and joins lines with one space; the prompt tile's preview uses it. A prompt with marked changes (`step.changes`) keeps its text as written so the marks stay on their words (noted). Tests `graph.test.ts > F19: a preview as plain words…` ("## Plan\n**Bold** and `code`" → "Plan Bold and code") and `BuildList.test.tsx > F19: a prompt's preview is plain words`. |
| F20 | 3 | done | src/pages/site/compose/OptionalRows.tsx, modalRecipes.tsx (`OPTIONAL.lineRow`, `OPTIONAL.suggestedChip`), SandboxCard.test.tsx, ux03.p5.test.tsx | An unset row's line reads its description ("Not set") and, beside it, `optional-suggested-chip` ("Suggested: <label>", dashed `t.segOnBorder` edge, `t.text2`); the value in `t.text` only once filled. Test `SandboxCard.test.tsx > F20 to F28 > F20: an unset row reads Not set with a dashed Suggested chip beside it`. Seen on /dev/kit/pages/classification in dusk, exhibition and mobile. |
| F21 | 3 | done | src/pages/site/compose/OptionalRows.tsx | `line` and `value` no longer carry `!open` (OptionalRows.tsx, `const line = filledText && filled ? summary : description`). Test `F21: an open row's header still says its value`. |
| F22 | 3 | done | src/pages/site/compose/OptionalRows.tsx (`undo` prop, `AcceptButton` takes an action), SandboxCard.tsx (`undo` state by row name, `undoOf`, `openOne`) | Accept stores the row's entries, sets the value, the row stays closed; `optional-undo` ("Undo", name "Undo <row>") stands where Accept stood until the row opens (`openOne` clears it) or the window closes (CardBody unmounts). Test `F22: Accept sets the value and leaves the row closed; Undo stands where Accept stood and puts the row back`. Seen on the dev page: accepted → "Government and public sector › Policy", Undo → "Not set" with the chip back. |
| F23 | 3 | done | src/pages/site/compose/SandboxCard.tsx, OptionalRows.tsx | "From the build" no longer passed in the count slot of Tools and stack or From the build (both now `suggestionCount` / the question count or undefined). The per-row `paddingRight: inset + ACCEPT_ROOM` (the differing right padding, on any row with an offer, the Task row among them) is gone: a fixed `ACTION_ROOM` spacer sits between the count and the chevron, so every row is label, value, count, chevron with one padding. Test `F23: every row ends the same way` (one distinct `padding` across all row heads). |
| F24 | 3 | done | src/pages/site/compose/SandboxCard.tsx | `suggestionCount` returns `undefined` at 0. Test `names the rows in the board's order` now expects `SettingNot set`. |
| F25 | 3 | done | src/pages/site/compose/ModalFrame.tsx (`MODAL_TOP = 48`) | Desktop `Dialog.Content`: `top: 48`, `transform: translateX(-50%)`, `maxHeight: calc(100dvh - 96px)`; header and footer are `flexShrink: 0`, the body scrolls (`card-body` overflowY auto). Phone sheet untouched. Test `F25: the window is pinned 48 from the top and its body scrolls inside`. Dev page, dusk and exhibition at 1440×900: opened Field, Task, Setting one after another; dialog top 48 and close button at (951, 69) throughout. |
| F26 | 3 | done | src/pages/site/compose/SandboxCard.tsx | `attempted` state, set in `onSave` when the title is empty; `FieldRequiredLine` drawn only when `attempted && !titleOk`. "Required" beside the label and the footer line unchanged. Because Save is disabled with no title (existing test), Enter in the Title field now calls `onSave`, which is the one way to attempt a save with an empty title — see the question in the Prompt 3 report. Test `F26: Required beside the label and in the footer stay; the line under the field waits for a save attempt`. |
| F27 | 3 | done | src/pages/site/compose/ReadFromBuild.tsx (`onOpenStack`, `READ_COPY.openStack`), SandboxCard.tsx | DERIVED_FACETS includes `stack`, so the From the build list repeated the Tools and stack values. That row now draws the facet name and a text button "Edit in Tools and stack" that opens the row (`openOne("Tools and stack")`). Test `F27: Tools and stack is one row; From the build offers a button that opens it instead of its values`. |
| F28 | 3 | done | src/pages/site/compose/OptionalRows.tsx (`open`/`onOpenChange`), SandboxCard.tsx (`openRow`) | `OptionalRow` takes `open` and `onOpenChange`; given, its own state is unused and `forceOpen` still opens it. CardBody holds `openRow` (the one name) and passes it to every row of the Optional section. Build details' inner rows and the prompt window's rows keep their own state. Tests `F28: one row open at a time: opening Task closes Field` and `F28: a row passed forceOpen stays open when another opens`. |
| F29 | 4 | blocked | (none) | Classification and Add a dataset are on `ModalShell` (title, one-line description, close at top right, body, footer Cancel then primary). The prompt dialog (`FullPromptWindow.tsx`) draws its own `Dialog.Content`. What its frame does that `ModalShell` does not: (1) the title is an editable field with Rename (`RefinedTitleField`, the `Dialog.Title` visually hidden); (2) Previous and Next icon squares in the header's icon slot before Close; (3) the footer hint "Esc Close · ← → Previous or next prompt"; (4) ← → key handling on the content; (5) `onOpenAutoFocus` prevented (focus goes to the text) and a caller's `onCloseAutoFocus`; (6) z-index 60/61 over the page's 50/51; (7) on a phone a full-screen frame, not a `BottomSheet`; (8) `aria-describedby={undefined}`, width 640. (3) and the footer live in the children, as the Card's do. (1), (2), (4), (5), (6) need `ModalShell` props beyond content: a title node, extra header icons, `onKeyDown`, focus overrides, a z-index. Stopped as the prompt asks; see the Prompt 4 report. |
| F30 | 4 | done | src/components/build/FullPromptWindow.tsx, FullPromptWindow.test.tsx, FullPromptWindow.refined.test.tsx, modalBoards.test.tsx | Found: the prompt dialog writes on every change (title on blur or Enter, reply on blur, settings and variables through `onExtras` as they change, `PromptEdits` through its handlers at once). So "Done" is now "Close" (`FULL_PROMPT_COPY.close`, `prompt-close`, accessible name "Close window" since the header's square is "Close") and "Saved" (`prompt-saved`, role status) stands beside it after each write: `saving()` wraps `onTitle`, `onChanges`, `onReply`, `onExtras`, `onText` and `handlers`. Classification keeps Cancel/Save, Add a dataset keeps Cancel/Add. Test `FullPromptWindow.sections.test.tsx > F30: writes as it goes…`. |
| F31 | 4 | done | src/pages/site/compose/AddDatasetDialog.tsx, modalRecipes.tsx (`PLACEHOLDER_CLASS`), AddSourceDialogs.test.tsx | Every example in `DATASET_DIALOG_COPY` starts "e.g. "; Record count, Chunk size and Chunk overlap have no placeholder and show a unit beside the field (`recordsUnit` "records", `chunkUnit` "tokens" — an assumption, see the report). `FieldInput`/`FieldArea` carry `placeholder:text-[color:var(--label)]` (the project's one way to colour `::placeholder`, as ui/input.tsx): `--label` is dimmer than `--text` in dusk and exhibition. Test `F31: every example says e.g.…`. Seen on /dev/kit/pages/sandbox?build=ca28&window=dataset in both themes. |
| F32 | 4 | done | src/components/build/FullPromptWindow.tsx, FullPromptWindow.test.tsx | `titlePlaceholder: "Add a title"`. |
| F33 | 4 | done | src/pages/site/compose/AddDatasetDialog.tsx, editKit.tsx, src/components/build/FullPromptWindow.tsx | Dataset Name: `Row` → `Block` + `BlockHead htmlFor`; Chunk strategy, size, overlap and embedding get a `BlockHead` above each. Prompt dialog: the Model `Row` → `Block` + `BlockHead`; each variable's `Row` → `BlockHead` over its field. Classification already had labels above (`RefinedField`). Test `F33: the Name label sits above its field`. |
| F34 | 4 | already fixed (label blocked) | src/pages/site/compose/AddSourceDialogs.test.tsx | Each option is already a button with `aria-pressed` (`OptionGrid` → `OptionButton`, modalRecipes.tsx) and its chosen state is the `SELECTED` recipe (`--selected-fill` #FFF / #222226, edge, ring), not the well a text field sits in (`--well` #ECECEC / #141416): different in both themes. Test `F34: each Use option is a toggle…`. The label "Use (select all that apply)" was NOT applied: `use` is one `DatasetUse | null` (`payload.use`, `DatasetInput` in graph.ts) and a second press clears it — the label would promise a multi-select the data does not hold. Asked in the report. |
| F35 | 4 | done | src/components/build/FullPromptWindow.tsx, FullPromptWindow.test.tsx, FullPromptWindow.refined.test.tsx | Both `NavSquare`s are always drawn in the header's icon slot (Previous, Next, Close); the one with no neighbour is `disabled` (dim filter) and named "Previous prompt"/"Next prompt". Tests `disables the previous button at the first prompt…` and `disables the next button at the last prompt, and neither arrow moves between prompts`. |
| F36 | 4 | done | src/components/build/FullPromptWindow.tsx, src/pages/site/compose/editKit.tsx, FullPromptWindow.sections.test.tsx | Model once: `PromptOptional` takes `modelElsewhere` and leaves the picker (and the model in its summary) out of Model settings when the window draws `PromptEdits`' Model section; `PromptEdits` draws Model for every prompt view, not only typed ones. Used by no longer disappears: `GoesBlock` takes `empty` and says "Not used by any step yet". The order Prompt, Response, Model, (How it was run), Uses, Makes, Used by, Optional is fixed in code. How it was run is drawn only for a model that runs locally or has open weights (not applicable, not empty) — noted. Test `F36: Model appears once, Used by stays…`. |
| F37 | 4 | done | src/pages/site/compose/editKit.tsx (`PromptSession`, `PROMPT_EDIT_COPY.fromSession`), src/components/build/FullPromptWindow.tsx | The window passes the prompt's session (`group.tool`, `group.model`; a legacy run of typed prompts is no session). With no model of its own the Model section says "From session: <model>" (`model-from-session`) and the picker uses the session's tool; `noSession` is drawn only when there is no session at all. Test `F37: a prompt in a session with no model of its own reads the session's…`. |
| F38 | 4 | done | src/pages/site/compose/buildMotion.tsx (`resizeFrame`), OptionalSection.tsx (comments), src/components/build/FullPromptWindow.tsx | Files allowed by the owner after the Prompt 4 question. `resizeFrame` now holds the pinned top edge: only the bottom of the clip and the footer move, by the whole difference; header and body stay. The prompt dialog (still not on `ModalShell`, F29) is pinned as ModalShell is: `top: MODAL_TOP`, `translateX(-50%)`, `maxHeight: calc(100dvh - 96px)`. Playwright on the dev kit at 1440×900, dusk and exhibition, sampled every 40ms while Optional opens: Add a dataset (`?build=ca28&window=dataset`) header y 49 throughout (was 115 → 49); prompt dialog (`/dev/kit/pages/sandbox`, Open prompt) top 48, header 49 throughout, open and close (was top 53.5 → 230.5). Phone: not changed (`framed()` is null on a phone). No jsdom test: jsdom runs no animations. |
| F39 | 4 | done | src/pages/site/compose/ClassificationPicker.tsx (`TaskMenu`), ClassificationPicker.test.tsx | File allowed by the owner after the Prompt 4 question. Composer: `ToolPicker` (Radix Popover + listbox) and `ModelPicker` (Radix DropdownMenu, `MenuContent`); prompt dialog: `ModelPicker` and `PickMenu` (Radix DropdownMenu, `MenuContent`, `menuItem`); Classification: `PickMenu` and `TaskMenu`. `TaskMenu` was a hand-made `role="menu"` div; it is now the same Radix `Menu.Root` + `MenuContent` + `menuSurface` + `menuItem` as PickMenu (no new component, the others unchanged): opens on click, Enter and ArrowDown, closes on Escape and outside, arrows move the highlight, same item height and ring. `ToolPicker` already has the same keys. Test `ClassificationPicker.test.tsx > F39: the chip menu behaves as the other menus…`. |
| F40 | 5 | done | src/pages/site/compose/addMenuGroups.ts, SandboxView.tsx (`ADD_MORE_COPY`, `add-more-types`, `add-primary`), addMenuGroups.test.ts, ux02.p6.test.tsx, SandboxView.addMenu.budget.test.tsx, SandboxView.test.tsx, SandboxPage.add.test.tsx | `addMenuLayout` (still pure) returns `primary` (Prompt, Agent, Tool, File, Dataset, those live) in place of `first`; the rest keep their groups under a "More types" row that opens in place (desktop menu item with `aria-expanded`, phone sheet row), and a search shows every type. No group holds both Check (Evidence) and Approval (Narrative), so Decision is listed with the ungrouped entries (`UNGROUPED_KEYS`), as the prompt says to do and say. Tests: `addMenuGroups.test.ts > F40…`, `ux02.p6.test.tsx > F40…` and the budget test. Not seen on the dev kit page: the sandbox demo does not draw the Add step tile row (`addToSession` is SandboxPage's). |
| F41 | 5 | done | src/pages/site/compose/ModelPicker.tsx (`MODEL_PICKER_COPY.label`), BuildList.tsx | The composer's picker takes `MODEL_PICKER_COPY.label` ("Model") as its placeholder; `MenuButton` already shows the chosen model's name alone. The accessible-name word stays "model". Test `F41: the model control reads Model until one is chosen, then that model's name`. Seen on the dev kit page. |
| F42 | 6 | done | src/lib/build/graph.ts (`promptTitleOf`, `defaultTitle`), src/pages/site/compose/BuildList.tsx, graph.test.ts, BuildList.test.tsx, titleRepeats.test.tsx, selection.ui.test.tsx, sv07.imports.test.tsx, sv07.small.test.tsx, ca20.p7.test.tsx, ca20.p8.test.tsx | Owner's answer: do as the prompt says. The header is the number badge, the type line and the title alone (`TILE_TITLE`, `--text2` while automatic); `Step N` (`PromptName` place) is no longer in it. `defaultTitle` of an untitled prompt is its first eight words (plain), "Prompt N" only when it has no words. The session is not in it (line ~1238 `promptPlace` is used only by Open Builds labels: not present on tiles). Details' title follows (same `stepTitle`). Test `graph.test.ts > calls a prompt by its first eight words (F42)…`, `BuildList.test.tsx > F42: heads a prompt with its badge…`. Dev kit: titles read e.g. "Write a welcome email for Ada's Bakery and". The default fox fixture still says "Prompt 1": src/dev/fixtures/sandbox.ts sets `defaultTitle` by hand (not on the list). |
| F43 | 6 | done | src/components/build/tileBodies.tsx (`FileTileBody`, `lean`) | In a list tile the file mark + name row is not drawn (the name is the title, type and size the type line); with no preview and no note the body is null. The build page (`plain`) and the tile window (full) unchanged. Tests `BuildList.lighter.test.tsx > has a type line, a title and no empty rows` (menu.pdf), `ux03.p3` baseline unchanged. |
| F44 | 6 | done | src/pages/site/compose/BuildList.tsx, src/components/build/tileBodies.tsx | Differences found before the change: (1) the prompt and Summary title was `PromptName` (place + own title, 14/500 `--text2`) with a pencil beside it, the file title `TileTitle` (`TILE_TITLE`); (2) the file body repeated the name under a mark; (3) the prompt and Summary footer link "Open prompt", the file's "Open file". Now all three: badge, type line, title (`TILE_TITLE`), body, and one footer action where they have one: the file's Open file, the Summary's Open prompt; a prompt tile has none (F17, D8 — read as the more specific item). |
| F45 | 6 | done | src/lib/build/tileLines.ts (file type line), src/components/build/tileBodies.tsx (`FileTileBody` size), DetailsPanel.test.tsx | Owner allowed tileLines.ts. Found: the tile used `formatSize` (readerSteps.ts: 1,500 B → "1.5 KB"), the panel `fileSize` (detailsModel.ts: "1 KB"). Both now call `fileSize`. A result's file size and the reader page keep `formatSize` (not file tiles). Test `DetailsPanel.test.tsx > F45: the same byte count reads the same on the tile and in the panel` (12, 1500, 217088, 3400000 bytes). |
| F46 | 6 | done | src/lib/build/tileSections.ts (FILE, `READ_ONLY`), ux02.p9.test.tsx, DetailsPanel.test.tsx | "Type" and "From" (From, Size) are one section `file` headed "File" with rows Type, Size, Added by (`tile.from`); it is read-only like Type was. Test `DetailsPanel.test.tsx > F46: one section headed File…`. Dev kit `?details=file`: "File / Size 212 KB / Added by opened in session 1". |
| F47 | 6 | done | src/pages/site/compose/DetailsPanel.tsx (`DetailsHead`, `DETAILS_COPY.open`), DetailsPanel.test.tsx | The head's one button (`details-action`, same place) reads Open for a file and Edit for every other object; a file had none before. Both call the panel's `onEdit` (the tile's window). Test `F47: one action in the head's place…`. Not seen on the dev kit: its Details demo passes no `onEdit`. |
| F48 | 7 | not started | | |
| F49 | 7 | not started | | |
| F50 | 7 | not started | | |
| F51 | 7 | not started | | |
| F52 | 7 | not started | | |
| F53 | 7 | not started | | |
| F54 | 6 | done | src/components/post/editor/PostToolbar.tsx (`TOOLBAR_COPY`, `ToolButton` `text`, `CharacterRing`), PostTab.proportions.test.tsx, one-prompt.post-toolbar.html | Every `ToolButton` already had `aria-label` and `title`. The two non-standard icons: the target (`Glyph name="reference"`, "Link to a group, part, session or tile") now shows the word "Reference"; the circle (`CharacterRing`, characters left) gains a `title` and the visible word "Characters left". Phone sizes unchanged (44). Test `PostTab.proportions.test.tsx > the character ring…`, toolbar snapshot. |
| F55 | 7 | not started | | |
| F56 | 2 | done | src/lib/build/graph.ts, tileSections.ts, src/components/build/FullPromptWindow.tsx, tileBodies.tsx (comment), src/pages/site/compose/BuildList.tsx, SourcesPanel.tsx, detailsView.ts, detailsModel.ts, useSessionEdits.ts, src/dev/fixtures/detailsKinds.ts, sandbox.ts | `stepLabel(number)` = "Step N" (graph.ts). Tile, panel line (`headOf`), prompt window title and Sources row all call it with `step.number`: same N, no computation changed. Position in session only in the dialog's grey line "Step 4 · 1 of 2 in Session 2 · …". Sentences: "Moved step 1 to Session 2", "Split Session 2 at step 5". Test `selection.ui.test.tsx > a build of two sessions: the tile, the panel, the prompt window and Sources all say Step 4 for the same step`. |
| F57 | 2 | done | src/lib/build/graph.ts, src/pages/site/compose/SandboxPage.tsx, detailsView.ts, src/components/build/FullPromptWindow.tsx, selection.ui.test.tsx | Page-header count: not present (the CA-20 draft page renders one prompt count, `sandbox-counts`; `buildSummary` has no caller; stored `step_count` counts steps, not prompts). Mismatch fixed: `isCountedPrompt` (graph.ts) = a prompt step, not a Summary tile, not an agent's `:instructions`; called by the Build line's count (SandboxPage.tsx), Details' session list (detailsView.ts `sessionView`) and the prompt window's "of N". Test `selection.ui.test.tsx > one prompt count (F57)`: 3 prompts + system prompt + agent with instructions + Summary tile → "3 prompts", "2 of 3 in Session 1", "3 of 3". |
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
