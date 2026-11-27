# MS-00 before: inventory and plan

Checked on main at `39a6e79` (the prompts were written at `b5fc29f`; `39a6e79` adds only the MS series files on top).

## Assumptions

Each fact MS-00 states about the code, checked.

| Prompt says | Found |
| --- | --- |
| `src/lib/build/sessionMap.ts` has `tileLinksOf`, `sessionOfTiles`, `sessionLinksOf`, `sessionMapModel` / `sessionMapFor`, `layoutSessionMap`, `readingOrder` | Yes, all six. It draws one box per session and no tiles. |
| `tileLinksOf` gives verbs uses, reads, calls, tests, runs after, is defined in | Yes (`TileVerb`). A file a tile makes is not its own link: a use of a file goes to the file's maker when `files` names one (`MapPieceLike.madeBy`), else to the file tile. |
| Links are keyed `${from}>${to}:${verb}` "as `tileLinksOf` keys them" (README, `hiddenLinks`) | **Differs.** `tileLinksOf` de-duplicates on `${to}>${from}:${verb}` (the user first) and `TileLink` has no `id` field. MS-04 should give links an id; this prompt only stores strings, so nothing breaks yet. Reported. |
| `SessionMap.tsx` (`SessionMapColumn`, `NoMap`, `MAP_COPY`), `SessionMapPanel.tsx`, `mapRecipes.ts`, `ArchitectureMap.tsx` (`MapViews`) | Yes. |
| `SandboxPage.tsx` has `mapColumn`, `architectureColumn`, `mapPanel`, `changeMap` | Yes. |
| `ReaderMap.tsx`, offered when `readerSeesMap(build.making)` is true (`BuildPage.tsx`) | Yes: `BuildPage.tsx:614` sets `mapAvailable` from `readerSeesMap`, and `BuildSteps.tsx` lazy-loads `ReaderMap`. |
| The dev page is `src/pages/dev/DevMap.tsx` | **Differs.** `DevMap.tsx` is a hook, `useDevMap`, used by `SandboxDemo`, `LinksDemo`, `MotionDemo`, `MovingDemo` and `ReferencesDemo`, which `KitPages` draws at `/dev/kit/pages/:page`. It has no route of its own. `/dev/map-sandbox` is registered the way the other stand-alone dev routes are (`KitPhone`: a lazy import behind `import.meta.env.DEV` in `App.tsx`). |
| Fixtures live in `src/dev/fixtures/sandbox` | **Differs.** It is one file, `src/dev/fixtures/sandbox.ts` (`MapFixture`, `sandboxMapProps`, the private `step()` helper, `dividers`). |
| `making.ts`: `Making`, `MapSettings` (`on`, `direction`, `onBuildPage`, `view`), `mapOf`, `makerMapOf`, `readerSeesMap`, `mapRefusal`, `setMapSettings`, `storedWorkstreamsOf`, `partLabelsOf`, `sessionsMetaOf`, `sessionOrderOf`, `makingStep` | Yes, all of them. `setMapSettings` writes through `patchMaking`, which runs inside `makingStep`. |
| `setMapSettings` has tests to sit beside | **Differs.** No test calls `setMapSettings`. The `makingStep` tests are in `src/lib/build/making.steps.test.ts` (a fake Supabase backend, `startAuditBackend`), so the `setMapLayout` tests go there with the same mocks. |
| `setWorkstreams` throws on a refusal | Yes: `buildLayerError("setWorkstreams", new Error(why))`, thrown inside the step, so nothing is written. |
| Parts are workstreams: `workstreamsOf`, `workstreamLabel`, `workstreamMark` | Yes (`src/lib/build/workstreams.ts`). |
| `stages.ts`: `stagesOf`, `withAbove`, `startsAfter` | **Differs in name.** `stagesOf` and `withAboveOf` (reads `SessionMeta.withAbove` or `parallelWith`). `startsAfter` is a field of `Workstream`, read by `stagesOf`, not a function. |
| `Step` in `graph.ts` has `id`, `kind`, `number`, `title`, `defaultTitle`, `uses`, `children`, `sentWith`, `session` | Yes (`session` is optional). |
| `SessionGroup` has `key`, `kind`, `implicit`; `groupKey`, `groupOfStep`, `shownGroups` read them | Yes. |
| A Result is a tile | **Differs.** `StepKind` has no `result`. The List draws results from `BuildListProps.results` (`ListResult`: `id`, `title`, `holds`, `facts`, `from`) with `ResultCard`. The fixture keeps the Result beside the steps as a `ListResult`, and MS-05 decides how a box holds it (its id is a string, so `MapBox.tiles` can name it). |
| `builds.making` is JSON | Yes: `JSONB NOT NULL DEFAULT '{}'` with an object check (`supabase/migrations/20261001280000_sessions_and_making.sql:87`), typed `Json` in `src/integrations/supabase/types.ts`. `map_layout` needs no migration. |

## Plan

- Part 0: this file -> verified by: reading it against the code.
- Part 1: `src/lib/build/mapLayout.ts` with the Decision 3 types, `MAP_WIDTH`, `mapLayoutOf`, `mapLayoutRefusal`, `MAP_LAYOUT_COPY`, `newMapNodeId` -> verified by: `src/lib/build/mapLayout.test.ts` (every branch, round trip).
- Part 2: `map_layout` on `Making`, `setMapLayout` -> verified by: `src/lib/build/making.steps.test.ts` (keeps other keys, two writes both land, refused writes nothing, null removes).
- Part 3: `src/dev/fixtures/mapSandbox.ts` -> verified by: `src/dev/fixtures/mapSandbox.test.ts` (tile and session counts, links, the stale tile id).
- Part 4: `src/pages/dev/DevMapSandbox.tsx` at `/dev/map-sandbox` -> verified by: `src/pages/dev/DevMapSandbox.test.tsx` (renders each fixture) and opening the route in a browser.

## Where the map is used

Importers of `sessionMap.ts`:

| File | Uses |
| --- | --- |
| `src/pages/site/compose/SandboxPage.tsx` | `sessionMapFor`, `MapPieceLike` |
| `src/pages/site/compose/SessionMap.tsx` | the model and layout types, `layoutSessionMap`, `readingOrder` and friends (the column) |
| `src/pages/site/compose/SessionMapPanel.tsx` | `MapSession`, `SessionMapModel`, `TileLink` (types) |
| `src/pages/site/build/ReaderMap.tsx` | `joinedSessions`, `sessionMapFor`, `SessionMapModel` |
| `src/lib/build/buildsMaps.ts` | `sessionMapFor`, `MapPieceLike`, `SessionMapModel` (the Builds page's Maps view data) |
| `src/pages/site/builds/mapsModel.ts` | `layoutSessionMap`, `Edge`, `MapSession`, `SessionMapLayout`, `SessionMapModel`; `BuildsMapsView.tsx` and `BuildsMapsPane.tsx` reach the map only through it |
| `src/lib/build/readerSteps.ts` | `MapPieceLike` (type) |
| `src/pages/dev/DevMap.tsx` | `sessionMapFor`, `MapDirection` |
| `src/dev/fixtures/sandbox.ts`, `src/dev/fixtures/shapes.ts` | `MapPieceLike` |
| `src/dev/fixtures/vision/builds-maps.ts` | `sessionMapModel`, `MapSession`, `SessionLink` |
| Tests: `sessionMap.test.ts` (everything), `buildsMaps.test.ts`, `shapes.test.ts` (`layoutSessionMap`, `sessionMapFor`), `buildCounts.test.ts`, `everything.test.ts`, `colour.ui.test.tsx`, `BuildList.nest.test.tsx`, `readerWords.test.tsx` (`sessionMapFor`), `BuildsMapsView.test.tsx`, `SessionMap.test.tsx` (`sessionMapModel`) | |

Importers of `SessionMap.tsx`: `SandboxPage.tsx` (`SessionMapColumn`, `NoMap`), `SessionMapPanel.tsx` (`MAP_COPY`, `sessionTitle`), `ReaderMap.tsx` (`SessionMapColumn`), `DevMap.tsx` (`NoMap`, `SessionMapColumn`), tests `SessionMap.test.tsx` (`MAP_COPY`, `NoMap`, `SessionMapColumn`, `mapTitle`, `MapControls`), `colour.ui.test.tsx` and `BuildList.nest.test.tsx` (`SessionMapColumn`), `sv27.harness.test.ts` (`MAP_COPY`).

Importers of `SessionMapPanel.tsx`: `SandboxPage.tsx` (lazy, `lazyWindow`), `ReaderMap.tsx`, `DevMap.tsx`, tests `SessionMap.test.tsx` (`PANEL_COPY`, `SessionMapPanel`) and `readerWords.test.tsx`.

Importers of `ReaderMap.tsx`: `src/pages/site/build/BuildSteps.tsx` (lazy) and `ReaderMap.test.tsx`.

## What a tile can show

The parts MS-10's Show offers, by `StepKind`, and the `Step` fields that hold each. A tile offers a part only when the field has something in it. Children (`children`) and tiles sent with it (`sentWith`) travel inside their top-level tile and are not parts.

| Kind | Text | Settings | Files | Code | Picture |
| --- | --- | --- | --- | --- | --- |
| prompt | `text` (and `reply`, `boxes`) | `settings` (`model`, `effort`, `instructions`), `model`, `modelRun`, `origin`, `variables` | `attachments` (non-picture `kind`) | no (code it sent is a `sentWith` tile) | `attachments` whose `kind` is a picture |
| agent | `text` (its instructions) | `model`, `models`, `runs`, `harness`, `memory`, `memoryTidy`, `limits`, `output`, `toolRefs`, `modelRun` | no | no (`definedIn` is a link) | no |
| team | `teamInstructions` | `pattern`, `workspace`, `runs` | no | no | no |
| manual | `text` / `lines` | `where`, `tool`, `gate` | no | no | `mediaId` |
| code | no | `language`, `filename`, `entrypoint`, `partOf`, `runsWhere`, `modelRun` | no | `text` | no |
| check | `check.passing` (and `check.tested`) | `check.method`, `reviewer`, `scoring`, `modelTested`, `harness` | test files in `sentWith`, counted in `check.cases` | no | no |
| file | `fileFacts.preview` for a text file | no | `fileFacts` (`name`, `size`, `kind`) | `fileFacts.preview` when `fileFacts.kind` is `code` | `fileFacts.mediaId` when `fileFacts.kind` is `picture` |
| tool | `app.scopes` | `app` (`connection`, `runsAt`, `permissions`, `plan`, `setup`) | no | no | no |
| decision | `decision.questions` | `decision` (`provider`, `model`, `via`, `answer`, `expected`) | no | no | no |
| system_prompt | `systemPrompt.text` / `text` | `systemPrompt` (`scope`, `version`), `variables` | no | no | no |
| dataset | `dataset.description` | `dataset` (`format`, `recordCount`, `columns`, `source`, `licence`, chunking) | no | no | no |
| repo | `repo.description` | `repo` (`url`, `owner`, `visibility`, `usage`, `keyFiles`, `run`) | no | no | no |
| retrieval | `retrieval.corpus` | `retrieval` (`embeddingModel`, `index`, `k`, `recall`, `hybrid`) | no | no | no |

A Result is not a `Step` (see Assumptions): `ListResult.facts` holds a link, `mediaIds` (Picture) and a `file` (Files).

## The tile

How `BuildList.tsx` draws a top-level step, per kind (`card` in `BuildList`, around line 2581):

- **prompt**: `StepCard`. `TileHeader` (the `DragHandle`, `NumberBadge`, the kind line in `TILE_EYEBROW`, `TileTitle` in `TILE_TITLE`, `BoxRows`, still-open, gate and waits lines, `CardColour`, `TileMenu` with `TileOptions`), then `PROMPT_TEXT` clamped to two lines (`useClamped`), "Show full prompt", `MadeLine`, `MentionedLine`, `SentWithList`, `TileFoot`.
- **manual, tool, decision, retrieval, system_prompt, dataset, repo, file**: `PlainCard`: the same `TileHeader` and `TileTitle`, a kind body from the shared tile bodies (`ManualTileBody`, `ToolTileBody`, `FileTileBody` and so on, drawn `lean`), `MadeLine`, `MentionedLine`, `SentWithList`, `TileFoot` with an open link.
- **code**: `CodeCard`: `TileHeader`, `CodePartLine` and `SmallCodeWell` (3 lines, `CODE_TILE_LINES`), `LinkLines` for calls and defines, `TileCostLines`, then the same foot.
- **check**: `CheckCard`: `TileHeader`, "Pass criteria:" (`check-criteria`), the status `DotLine` (`t.evidence` or `t.catBreakage`), the history line, then the foot.
- **agent, team**: `ContainerCard`, which draws the children (`InnerCard`, `TeamAgents`) and the add-a-prompt controls.
- **Result**: `ResultCard` (its own props, not `BuildListProps`).
- **Sent with**: `SentWithTile`, a smaller card (`padding: 12`, gap 6) with the grip, "Sent with ...", the kind and title, code lines or two lines of text, and nest buttons.

From `tileRecipes.tsx` they use `tileStyle` (through `tileCard`), `TILE_HEAD`, `TILE_TEXT`, `TILE_EYEBROW`, `TILE_TITLE`, `NumberBadge`, `TileOptions`, `BoxRow` / `BOX_ROWS`, `TILE_INDENT`, `TILE_FOOT` / `FOOT_FACTS` (through `TileFooter`), `PROMPT_TEXT`, `BODY_LINE`, `SmallCodeWell`, `MarkedName`, `LIST_BOX` / `listRow`, `PICTURE`.

**Can they render outside the List?** Not as they are. Every card and `TileHeader`, `TileTitle`, `TileFoot`, `SentWithTile` is module-private, and each card takes the whole `BuildListProps` (for `onSelect`, `onRename`, `selectedId`, `steps` for numbers, `names`, `intoResult`, `madeNames`, `onEditTile`). They read four contexts, all with defaults, so they would render without a provider: `ListRefsContext` (mentions, colour, hidden), `ListNestContext` (nest buttons), `TileIndentContext`, and dnd-kit's context through `useNestTile` (disabled with no `NestContext`). They also use `useRename` (rename state), `useItemRing` (focus ring), `usePicked`, `useCardRef` and the menu's move controls (`useCanMove`).

**What a presentational `StepTile` would take (MS-05).** Lift the card body into an exported component that takes the `Step`, a `selected` flag, the number to show, the resolved names it needs (`numberOf`, file names) and slots: `menu` (the List passes `TileMenu`, the map its own ··· menu), `handle` (the List's `DragHandle`, none on the map), `title` (the List passes `TileTitle` with rename, the map a plain title) and `foot extras` (Uses chips and nest buttons on the List only). `StepCard`, `PlainCard`, `CodeCard` and `CheckCard` then call it with their List-only pieces, so the List's tests keep passing and no markup is copied. `ContainerCard` is the largest (children and add controls) and needs the same split one level down.

## Numbers

- **`Step.number`** is made in `buildSteps` (`graph.ts:1227`): top-level tiles are numbered `String(index + 1)` in build order across the whole build, and `readStep` numbers children `3.1`, `3.1.2`. It is never session-relative.
- **Session numbers** come from SV-05's `numberSessions` (`src/lib/build/sessionNumbers.ts`): parts in their order, each part's sessions in the build's order, numbered from 1, written into `SessionGroup.number` by `sessionGroups`. So a session number exists; **a tile's position inside its session does not**: there is no session-relative tile number in the composer. MS-12 works out `S<session number>·<position>` from `SessionGroup.stepNumbers` (its top-level steps in order).
- **`partLabelsOf(making)`** gives `"letters"` or `"numbers"` (anything else is numbers). **`workstreamLabel(index, labels)`** gives `"Part B"` or `"Part 2"`; `workstreamMark` gives the letter or number alone (`"B"`). Part numbers in Decision 11 use the mark.

## Limits found

`SESSION_TITLE_MAX` (80, `making.ts`) matches the title limit. Other limits near this one: `TITLE_MAX` (80, `graph.ts`, a tile title), `WORKSTREAM_NAME_MAX` (60), `GOAL_CONDITION_MAX` (200), `ATTACHMENT_NOTE_MAX` (140, `tileExtras.ts`). None is an explanation or a note on a map, so 280 and 200 are new and live in `mapLayout.ts`.
