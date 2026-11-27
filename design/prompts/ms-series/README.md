# Series MS-00 to MS-15: the map as a structured sandbox

The Map tab is rebuilt as a structured sandbox. The map is one filled rectangle of boxes that the maker splits, resizes, moves, frames, styles and explains. It shows the build's tiles, and it can never contradict the build's order. A chat can also write the map: the maker copies the build out, describes the map in words, and drops the file the chat writes back onto the canvas.

This file is `design/prompts/ms-series/README.md`. Every prompt of the series sits beside it as `MS-nn-<name>.md`. To run one, tell a session its file, for example "Run `design/prompts/ms-series/MS-00-foundation.md`". Every prompt reads this file first.

## What the series is built from

- **`MODEL.md`** (beside this file): the full model, copied from the doc "The structured sandbox: how the map can work". It describes how every tool behaves. Where `MODEL.md` and this README differ, **this README wins**. Where either differs from the code, **the code wins**: follow it, do the nearest correct thing, and report the difference.
- **`design/reference/sandbox/*.png`**: thirteen boards showing each mechanism. They are pictures for the shape and the behaviour, not exact values. Sizes and colours come from the tokens and recipes named below, never from the pictures.

  | Board | Shows | Used by |
  | --- | --- | --- |
  | `01-finished-map.png` | The finished map for the support inbox triage build | MS-05, MS-13 |
  | `02-tree-of-splits.png` | The split tree and columns from shared edges | MS-01 |
  | `03-shaping-tools.png` | Split, Merge, Shared edge, Span, Even out, Match | MS-07 |
  | `04-order-and-two-way.png` | Bands, reading order, the refused cases, two-way arrows | MS-03, MS-11 |
  | `05-moving.png` | Dragging boxes, Swap, tiles between boxes, keyboard | MS-08 |
  | `06-sessions-and-parts.png` | Frames, opened frames, outlines | MS-09 |
  | `07-inside-a-box.png` | Layouts, reorder, indent, Show, notes | MS-10 |
  | `08-lines.png` | Gutters, routing, bundling, hidden counter | MS-04, MS-11 |
  | `09-style-and-helpers.png` | Box style, background, numbers, Tidy, Collapse | MS-12 |
  | `10-canvas-size.png` | Widths, a 50-tile canvas, phone stacking | MS-13 |
  | `11-editor.png` | The editor inside the composer | MS-06 |
  | `12-map-from-a-chat.png` | Copy for chat, the chat, the drop, the check | MS-14 |
  | `13-map-file.png` | The map file and the drop check | MS-14 |

- **`design/reference/sandbox/source/`**: the boards' HTML sources and the Python that wrote them. `design/reference/sandbox/README.md` maps each board to its source.
- **`design/reference/sandbox/examples/`**: `support-inbox-triage.for-chat.md` (what Copy for chat produces) and `support-inbox-triage.map.md` (a map file a chat would return). MS-14 turns both into test fixtures.

## Order

Each prompt runs after the one before it has merged, one at a time, in number order.

| Prompt | What it does | Migration |
| --- | --- | --- |
| MS-00 | Foundation: inventory, the stored shape, the reader and writer, the fixture, a dev page | no |
| MS-01 | The split tree: a pure model with every shaping operation | no |
| MS-02 | Geometry: pixels from the tree, rows that grow, snapping, widths | no |
| MS-03 | Order: bands per tile, the order check, the two-way rules | no |
| MS-04 | Lines: links from the build, routed through gutters | no |
| MS-05 | Start from the build, and the canvas drawn read-only | no |
| MS-06 | The editor: Sources, toolbar, selection, floating bar, undo, saving | no |
| MS-07 | Shaping tools in the editor | no |
| MS-08 | Moving boxes and tiles, with the order checked during the drag | no |
| MS-09 | Sessions and parts: frames, opened frames, outlines | no |
| MS-10 | Inside a box: layout, reorder, indent, Show, titles, explanations, notes | no |
| MS-11 | Lines and two-way arrows in the editor | no |
| MS-12 | Style and helpers: box style, background, numbers, Tidy, Collapse, Start from the build | no |
| MS-13 | Size and readers: width, big builds, minimap, the build page, phones | no |
| MS-14 | The map file: Copy for chat, the parser, the drop check, Replace map | no |
| MS-15 | Cleanup, audits and end-to-end tests | no |

### Why this order

1. **Pure models first** (MS-01 to MS-04). The tree, the geometry, the order and the lines are plain TypeScript with tests and no React. Each one can be checked by itself before anything is drawn, and every editor prompt then calls functions that already work.
2. **Drawing before editing** (MS-05). The canvas shows a correct map for every build, without any editing, before any tool exists. Readers and the composer both get the new map from the plain arrangement.
3. **One shell, then the tools one family at a time** (MS-06 to MS-12). The editor shell (selection, floating bar, undo, saving) comes first, so each tool prompt only adds its own actions.
4. **Size and readers after the tools** (MS-13). Scrolling, the minimap and phone stacking are measured on maps the tools can actually make.
5. **The map file last of the features** (MS-14). It reuses every check the editor already has: a file is accepted or refused by the same functions a drag uses.
6. **Cleanup last** (MS-15). It removes what the old map leaves unused, after nothing depends on it.

## How every prompt works

- **One Claude Code session** on `CleanDynamic/agent-share-hub`, default branch. Pull main first: Lovable commits straight to main. Branch `ms-nn-<name>` (the prompt names it). Commit at the end of every part, with the prompt and part number in the message. Open one pull request at the end, titled as the prompt says.
- **Plan first.** Part 0 of every prompt ends by writing `design/audits/map-sandbox/ms-nn-before.md` with two lists:
  - `Assumptions`: each fact the prompt states about the code, checked, and what you found.
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test`.
- **The file on disk wins.** These prompts were written against main at `b5fc29f` (27 November 2026). If a name, file or behaviour differs, follow the code, do the nearest correct thing, and list the difference in the report. Never invent a table, a column, a function name or a token.
- **Reproduce first.** For a behaviour that is wrong, write the failing test, watch it fail, then fix it.
- **A missing premise is reported, not built.** If something a prompt relies on isn't there, say so and do the nearest correct thing.
- **Surgical.** Every changed line traces to the prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report for MS-15. Don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **Short session.** If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.
- **The report** goes at the end of the pull request description, with these headings: `Done`, `Differences from the prompt`, `Questions`, `Dead code seen`, `Checks run` (each command and its result).

## House rules

- **No migrations.** Everything the series stores lives in `builds.making`, a JSON column already written through `makingStep` in `src/lib/build/making.ts`. No prompt adds a table or a column. Never apply anything to the live database.
- **No new dependencies.** `@dnd-kit/core`, `@dnd-kit/sortable`, `zod` and `framer-motion` are already in `package.json`. Use what exists or plain pointer events.
- **Writes go through `makingStep`** (SV-07), so two saves close together can't overwrite each other. The map writes only its own key, `making.map_layout`, plus the existing `making.map` settings.
- **Tokens only.** Colours come from `t.<token>` in `@/lib/theme/tokens`, never a hex in a component. Measures live in recipe modules (`mapRecipes.ts`, or the new `canvasRecipes.ts` that MS-05 creates), like every other recipe module in `src/pages/site/compose/`.
- **Copy.** Sentence case. No em dashes. Plain words. Headings state the fact ("9 tiles in 3 sessions"), with no label above them and no subtitle. No page repeats a word, so a heading never says what the tab or nav item beside it already says. Live copy never guesses a person's pronouns. Every user-facing string lives in a `*_COPY` object, as `MAP_COPY` does today.
- **Harnesses.** Claude Code, Cursor and similar tools are harnesses in copy and in code comments, not apps.
- **Never in the UI.** Gradients, glass, blur, glow, emoji, icons inside labelled buttons, hover fades, scroll reveals, coloured-border cards.
- **Motion.** None beyond what the composer already uses. A drop or swap that moves boxes uses the composer's existing animator (SV-06) if it has a recipe for moving a box, otherwise it changes at once. A reduced-motion preference always changes at once.
- **Accessibility.** Every action works with the keyboard (MS-08 sets the scheme). Every move, refusal and fix is announced through the composer's existing live region (`announce`). Focus rings are never removed. Lines, frames and outlines are hidden from screen readers; the same facts are given in words on the box or tile.
- **Tests.** `npm test` (vitest) after every part. `npm run lint` and `npx tsc --noEmit` before the pull request. Pure modules reach full branch coverage of their refusals. Audits named in a prompt are run and their results go in the report.

## Decisions made for this series

These settle what `MODEL.md` leaves open. Every prompt follows them.

1. **The map shows tiles.** Today's map (CA-17, `sessionMap.ts`) shows one box per session and no tiles. The sandbox replaces it in the Sessions view. The Architecture view (`ArchitectureMap.tsx`, SV-27 P10) is unchanged, and the `Sessions` / `Architecture` switch in `MapViews` stays.
2. **What a box can hold.** Top-level tiles (`Step` in `src/lib/build/graph.ts`) from one session. A tile's children (`Step.children`, numbered "3.1") and tiles sent with it (`Step.sentWith`) are never placed on their own: they travel with their top-level tile and are drawn inside it, the way the List draws them.
3. **The stored shape** is `making.map_layout`, a split tree that stores tile ids and session or part keys, never pixel positions. MS-00 writes the types below into `src/lib/build/mapLayout.ts`, and every prompt uses them. A key the reader doesn't know is ignored when reading and never removed when writing, as `storedWorkstreamsOf` does.

   ```ts
   /** builds.making.map_layout. Proportions and ids only: the canvas works out every pixel. */
   interface MapLayout {
     v: 1;
     /** Canvas width in px. Free, snapped to the 12-column grid, between MAP_WIDTH.min and MAP_WIDTH.max. */
     width: number;
     /** A background preset key ("grey", "dusk", "slate", "paper") or "#RRGGBB". */
     background: string;
     dotGrid: boolean;
     numbers: "build" | "session" | "part";
     root: MapNode;
     /** Sessions or parts drawn with an outline: their keys. */
     outlines: string[];
     twoWay: { a: MapEnd; b: MapEnd }[];
     /** Pairs of session keys whose suggested two-way arrow the maker dismissed, as "keyA|keyB" sorted. */
     twoWayDismissed: string[];
     /** Links the maker hid, by link id (`${from}>${to}:${verb}`, as `tileLinksOf` keys them). */
     hiddenLinks: string[];
     /** A link's middle segment moved to another gutter: link id to gutter index. */
     linkGutters: Record<string, number>;
   }
   type MapEnd = { tile: string } | { box: string };
   type MapNode = MapSplit | MapRegion | MapBox;
   interface MapSplit {
     kind: "split"; id: string;
     /** "across": children side by side (sizes are widths). "down": children one above the other (sizes are extra height). */
     dir: "across" | "down";
     /** across: proportions that add up to 1. down: each child's minimum height in px beyond its contents, 0 for none. */
     sizes: number[];
     children: MapNode[];
   }
   interface MapRegion {
     kind: "region"; id: string;
     of: { part: string } | { session: string };
     child: MapNode;
     title?: string; explanation?: string; style?: MapStyle; collapsed?: boolean;
   }
   interface MapBox {
     kind: "box"; id: string;
     /** Top-level tile ids in build order. Empty only for a text box (title or explanation, no tiles). */
     tiles: string[];
     layout: "stack" | "across" | "grid"; gridColumns?: 2 | 3;
     notesSide?: "left" | "right";
     /** Tile id to indent level 1, 2 or 3. Absent: level 0. */
     indent: Record<string, 1 | 2 | 3>;
     /** Tile id to the parts shown. Absent: the default, which is the text part only. */
     show: Record<string, MapTilePart[]>;
     /** Tile id to the maker's note beside it. */
     notes: Record<string, string>;
     title?: string; explanation?: string; style?: MapStyle; collapsed?: boolean;
   }
   type MapTilePart = "text" | "settings" | "files" | "code" | "picture";
   interface MapStyle { fill?: MapFill; border?: "line" | "dashed" | "none"; corners?: 4 | 8 | 12 | 16 }
   type MapFill = "none" | "grey" | "green" | "amber" | "blue" | "violet";
   ```

4. **No layout stored means the plain arrangement.** When `map_layout` is absent, both the composer and the build page draw `startFromBuild` (MS-05), worked out on every render and written only when the maker first changes something. So every existing build gets the new map without a write.
5. **The existing `making.map` settings stay.** `on`, `onBuildPage` and `view` keep their meaning, so `readerSeesMap` and "Create a map" behave as they do now. `direction` stops being used by the Sessions view. It is still read, so nothing breaks, and MS-15 decides whether anything still needs it.
6. **A tile the build no longer has** stays in its box as "Removed from the build" until the maker removes it (Decision 5 in `MODEL.md`). A tile the build has that no box holds is unplaced: it shows in Sources and not on the canvas. Readers never see either; the build page draws placed tiles that still exist.
7. **Measures.** One gutter, 24px, everywhere. Padding inside a box, 20px. A 12-column grid across the canvas width and an 8px rhythm down it. Snap distance 6px. Minimum box width: 2 grid columns at the current width, and never under 160px. Widths: narrow 720, standard 960, wide 1200; min 640, max 1600. These live in `MAP_GRID` and `MAP_WIDTH` in `src/lib/build/mapGeometry.ts` (MS-02) and nowhere else.
8. **Bands.** Two boxes share a band when their vertical spans overlap by more than half of the shorter one. Bands are worked out per tile from each tile's own slot (MS-03).
9. **Two-way arrows** join two tiles or two boxes that can be simultaneous: from different sessions, with no chain of links between them either way. They are always level: a straight horizontal line through the gutter. Two boxes are level when they share a band, and two tiles when their slots share a band.
10. **Colours.** Canvas background presets are stored by key and mapped to values in one table in `canvasRecipes.ts`: grey `#3A3D3B`, dusk `#141416`, slate `#2B3138`, paper `#EDEDE8`. These are canvas paint, like the maker's own part colours, not UI tokens, so this is the one table that holds hex values. Every fill tint is checked against every preset with `contrast` from `src/lib/theme/luminance.ts`: tile text on the tinted box must reach 4.5:1 and box titles 3:1. A tint that fails one preset is changed until it passes, never left out. Selection, snapping guides and allowed drop places use `t.evidence`. Refusals use `t.lit`. Everything else uses the tokens the composer already uses for tiles (`--tile`, `--tile-border`, `--text`, `--text2`, `--label`, `--hairline`).
11. **Numbers.** Build numbers are `Step.number`. Session numbers are `S<session number>·<position in session>`. Part numbers are `<part label>·S<session number>·<position>`, using `partLabelsOf` and `workstreamLabel`. If the composer already has a session-relative number (SV-05), use it and report.
12. **The map file format** is `openbuilds_map: 1`, named to match the Build File's `openbuilds_build` key. MS-14 defines it exactly.
13. **Names on screen.** The left column of the Map view is headed "Sources" on the boards. The composer already has a Sources panel (UI-P64, `SourcesPanel.tsx`). If both can be on screen at once, the map's column is headed "On the map" instead, and MS-06 reports it.

## Vocabulary

Use these words in code, copy and reports, and no others for the same things.

| Word | Means | Not |
| --- | --- | --- |
| canvas | The filled rectangle the map is drawn on | board, sheet |
| box | A leaf of the tree: tiles from one session, or text | card, cell, panel |
| region | A branch drawn as a frame round a session or a part | group, container |
| frame | How a region is drawn: a line with a name tab | border |
| outline | A line that follows a session's or part's loose boxes | hull |
| tile | A top-level step of the build | node, step card |
| band | Tiles or boxes that read as level | row (row means a `down` split's child) |
| gutter | The 24px space between boxes, where lines run | gap, margin |
| two-way arrow | A level arrow between simultaneous things | bidirectional link |
| map file | `openbuilds_map` Markdown | layout file |
| part | A group of sessions. In code it is a workstream (`making.workstreams`), as `making.ts` explains | |

## Files the series creates

| File | Created by | What it holds |
| --- | --- | --- |
| `src/lib/build/mapLayout.ts` | MS-00, MS-01 | Types, `mapLayoutOf`, `mapLayoutRefusal`, every tree operation |
| `src/lib/build/mapGeometry.ts` | MS-02 | `MAP_GRID`, `MAP_WIDTH`, `geometryOf`, snapping, phone order |
| `src/lib/build/mapOrder.ts` | MS-03 | Bands, `orderRefusal`, `allowedDrops`, two-way rules |
| `src/lib/build/mapLines.ts` | MS-04 | Links to draw, routing, bundling |
| `src/lib/build/mapStart.ts` | MS-05 | `startFromBuild` |
| `src/lib/build/mapFile.ts` | MS-14 | `forChat`, `writeMapFile`, `parseMapFile`, `mapFileCheck` |
| `src/pages/site/compose/MapCanvas.tsx` | MS-05 | The canvas, drawn for the maker and the reader |
| `src/pages/site/compose/canvasRecipes.ts` | MS-05 | Every measure and the background table |
| `src/pages/site/compose/MapEditor.tsx` | MS-06 | Sources, toolbar, floating bar, the editor's state |
| `src/pages/site/compose/useMapEditor.ts` | MS-06 | Selection, undo, saving |
| `src/pages/site/compose/useMapFileDrop.ts` | MS-14 | Drop, open and paste of a map file |
| `src/dev/fixtures/mapSandbox.ts` | MS-00 | The support inbox triage build, a 50-tile build, edge cases |
| `src/pages/dev/DevMapSandbox.tsx` | MS-00 | `/dev/map-sandbox`, where every prompt shows its work |

`setMapLayout(buildId, layout)` is added to `src/lib/build/making.ts` beside `setMapSettings` (MS-00).

## Done for the whole series

- Every build opens on a correct map in the composer and on the build page, with no write until the maker changes something.
- No action, file or drag can save a map that leaves a gap, puts a later tile before an earlier one, puts two sessions in one box, or draws a two-way arrow between things in sequence.
- A map made by a chat from `support-inbox-triage.for-chat.md` and dropped on the canvas looks like `01-finished-map.png` in its structure.
- A 50-tile build scrolls smoothly in the editor and reads in build order on a phone.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run audit:contrast`, `npm run audit:themes` and `npm run audit:size` pass.
