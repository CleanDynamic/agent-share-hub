# MS-14 · The map file: a chat can write the map

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-13 has merged. Read the README (Decision 12), then `MODEL.md`: "A chat can write the map". Look at `12-map-from-a-chat.png` and `13-map-file.png`, and read both files in `design/reference/sandbox/examples/`. Pull main. Branch `ms-14-map-file`. Open one pull request titled `MS-14 map file and Copy for chat`.

A maker copies the build out as Markdown, describes the map to any chat or harness in plain words, and drops the file the chat writes back onto the canvas. The result is an ordinary map, checked by the same functions a drag uses.

## What this follows

The repo already does this for whole builds. Read these first and copy their patterns:

- `src/lib/build/portable.ts`: `toMarkdown` turns a build into a document a model can act on. Its rules: no uuid leaves the site, ids become stable numbers.
- `src/lib/build/buildfile.ts`: the Build File parser. Its two principles apply here word for word: **nothing is silently dropped** (every fix leaves a listed warning) and **repair is bounded and named** (only the repairs listed below are attempted, once).
- `src/components/compose/useBuildFileDrop.ts`: a window-level drop that reads, parses and stops at a proposal; a nearer handler wins (`defaultPrevented`); size is checked before the read.
- `public/buildfile/OPENBUILDS_EXTRACTOR.md` and `src/lib/build/buildfileDocuments.test.ts`: a document read by a chatbot, kept true by a test.

## Part 0: plan

The README's audit file and plan.

## Part 1: the format

`src/lib/build/mapFile.ts`. The format is the one in `examples/support-inbox-triage.map.md`, defined exactly here.

**Header.** Lines of `key: value` before the first `##`, in any order:

| Key | Value | Required |
| --- | --- | --- |
| `openbuilds_map` | `1` | yes |
| `build` | the build's slug, or its id when it has no slug | yes |
| `width` | `narrow`, `standard`, `wide`, or a number of px | no (standard) |
| `background` | `grey`, `dusk`, `slate`, `paper`, or `#RRGGBB` | no (grey) |
| `numbers` | `build`, `session`, `part` | no (build) |
| `tiles` | how many tiles the build had when the file was made | no |
| `dot_grid` | `on`, `off` | no (off) |

**Rows.** Each `## Row` heading starts a full-width strip; rows read top to bottom (the root is a `down` split of rows). Optional lines directly under it: `Frame: Part A` (a part region round the whole row, by its label as `workstreamLabel` gives it, or its name) or `Frame: S2` (a session region).

**Items in a row**, each a `- ` list line, separated by ` · `:

- `- Box S1 · cols 6 · tiles 1 2 3` then any of: `Stack`, `Across`, `Grid 2`, `Grid 3`, `notes left`, `notes right`, `indent 6` (tile 6 one level; `indent 6:2` two levels), `show 4: text settings` (repeatable), `fill green`, `border dashed`, `corners 8`, `collapsed`.
- `- Text · cols 12` for a text box.
- `- Column · cols 6` followed by indented `- Box` or `- Text` lines: a `down` split inside the column.
- Indented lines under a box: `Title: …`, `Explanation: …`, `Note 3: …`. Under a text box, the first indented plain line is its explanation and `Title:` its title.

Columns in a row are out of 12. Items inside a `- Column` each take the column's full width, so a `cols` on them is accepted and ignored. `S1` is the session number as the composer shows it. Tiles are top-level build numbers (`Step.number`).

**Two-way.** `## Two-way` with lines `- 1 <-> 4` (tiles) or `- S1 <-> S2` (the two sessions' first boxes).

**Anything else** (a paragraph of commentary, a fenced block wrapped round the whole file, a `## Notes` section) is ignored and listed once as "Ignored text outside the map".

## Part 2: Copy for chat

`forChat(input): string`, from the build's steps, groups, files, making and the current layout. For the `supportInbox` fixture its output has the same sections, tables and wording as `examples/support-inbox-triage.for-chat.md`; where the example disagrees with the code (a kind name, a harness label), the code wins and the report says so. Snapshot the output in a test once it's right. It holds:

1. A one-paragraph instruction: read all of it, then the request at the end, then reply with one map file and nothing else.
2. **The build:** slug, maker handle, counts; then per part, per session (number, title, harness), a table of tiles: number, kind (as `REF_KIND` names it), title, and Uses (from `tileLinksOf`, as numbers, with "made by n" and "tests n" for those verbs).
3. **What can run at the same time:** every pair from `canBeSimultaneous`, tiles and sessions, so the chat never has to work it out. For a large build, list sessions and only tile pairs across sessions that ran side by side, and say so.
4. **How to write the map file:** the rules from Part 1 in plain numbered sentences, the palette and header values, and a short example built from this build's own sessions (plain arrangement, so it is always valid).
5. **The current map,** when `map_layout` is stored: `writeMapFile(layout)` in a fenced block, with "Change this map, or start again, as the request says."
6. **My request:** an empty section with one line telling the maker to write what they want.

Never in the file: prompt text, code, file contents, settings, secrets, uuids, emails. A test asserts that no `Step.text` of the fixture appears in the output.

`writeMapFile(layout, build): string`: the stored layout as a map file. A layout whose tree can't be written as rows and columns (a `down` split nested inside an `across` split inside a `down` split deeper than the format allows) is written as close as the format allows, and the difference is said in a comment line at the top ("This map has nesting the file can't hold; it's shown simplified.").

## Part 3: parsing

`parseMapFile(text, build): { ok: true; layout: MapLayout; changes: MapFileChange[] } | { ok: false; reason: string }`, pure.

1. **Size first:** over 200 KB is refused before parsing.
2. **Bounded repairs, attempted once, each listed:** a fenced block round the whole file is unwrapped; smart quotes and non-breaking spaces become plain; `•` and `*` list markers are read as `-`; `|` used instead of ` · ` between settings is accepted; a `cols` missing on the only item of a row means 12. Nothing else is guessed.
3. **Refused** (nothing applies): no `openbuilds_map`, or a version other than 1 ("This map file is version 2. This site reads version 1."); a `build` that is neither this build's slug nor its id ("This map file is for another build."); no tile placed anywhere.
4. **Read into a layout:** rows into a `down` root, items into `across` splits with sizes `cols / 12`, columns into `down` splits, frames into regions, settings into the box fields, two-way lines into `twoWay` ends (a tile end, or a session's first box).
5. **Then fixed and listed**, using the editor's own functions:
   - Columns in a row that don't add up to 12: scaled to 12. ("Row 3 added up to 10 columns; widened to 12.")
   - A tile listed twice: first place kept. A tile number the build doesn't have: dropped. ("Tile 12 isn't in this build.")
   - A box holding tiles from two sessions: split into one box per session, side by side in its place (`splitBox`).
   - A box whose session doesn't match its `S` label: the label is corrected from the tiles.
   - Order: run `orderProblems`. For each, move the later box down to the first row where order holds (`insertNode`), repeating until `orderRefusal` is null or 50 moves have been made, then refuse ("The order couldn't be kept; try describing the rows again.").
   - Two-way: `twoWayRefusal` failures removed; not level ones slid with `slideToLevel`, else removed.
   - Text over the limits: cut, and listed.
   - `tiles:` in the header different from the build's count now: "The build has changed since this file was made: 10 tiles now, 9 in the file."
6. **Left out and listed:** tiles the file doesn't place stay unplaced ("2 tiles aren't on the map. They're in Sources."); any line describing links ("1 -> 2") is ignored ("Lines come from the build.").
7. The final layout must pass `mapLayoutRefusal`, `orderRefusal` and `twoWayProblems`; a test asserts it for every fixture and every sloppy variant.

`MapFileChange` is `{ kind: "fixed" | "left-out" | "repaired" | "ignored"; text: string }`. Copy in `MAP_FILE_COPY`.

## Part 4: drop, open, paste

`src/pages/site/compose/useMapFileDrop.ts`, written like `useBuildFileDrop.ts`:

1. Window-level, mounted only while the Map view is open; a nearer handler wins.
2. Accepts one `.md` or `.txt` file, size checked before reading, read with `file.text()` in the browser. Anything else: "Drop one .md or .txt map file."
3. While a file is dragged over the Map view, the canvas shows the drop overlay: a dashed `t.evidence` rectangle inset in the canvas reading "Drop a map file".
4. The toolbar gets **Copy for chat** (a menu: Copy to clipboard, Download .md, named `<slug>.for-chat.md`) and **Open file** (a file input). The canvas also accepts pasting map file text when it has focus (Ctrl or Cmd V); text that doesn't start with a header is ignored without a message.
5. Copy to clipboard says "Copied. Paste it into any chat and describe the map you want." through `announce` and a short toast, as the composer's other copy actions do.

## Part 5: the check, then Replace map

A window (the composer's existing modal recipe, `modalRecipes.ts`):

1. The file name as its heading.
2. A small read-only `MapCanvas` of the result at a scale that fits.
3. The list: ticks for what's fine ("9 of 9 tiles placed", "Order holds in every row", "1 two-way arrow: tiles 1 and 4", "Frames for Part A and Part B"), then every `MapFileChange` grouped as Fixed, Left out, Repaired, Ignored.
4. Cancel and **Replace map**. Replace applies the layout through `apply` as one undo step, announces "Map replaced. Undo brings the old one back.", and saves.
5. A refused file shows the reason in the same window with only Close.

## Part 6: the guide stays true

Add `src/lib/build/mapFile.examples.test.ts`:

1. `examples/support-inbox-triage.map.md` parses with no changes against the `supportInbox` fixture, and the result's structure matches `01-finished-map.png`: Part A's row with S1 and S2 side by side, cols 6 each; Part B's column with S3's box and the Result box; one two-way arrow 1 and 4.
2. The example inside `forChat`'s guide parses with no changes for every fixture.
3. `writeMapFile` then `parseMapFile` gives the same layout for every fixture's plain arrangement and for 50 random layouts from MS-01's generator.
4. Sloppy variants, each with its listed change: wrapped in a fence with a paragraph before it; smart quotes; columns adding up to 10; tile 6 in S1's box; S3 placed above S1; two-way 4 and 5; a missing tile; a `1 -> 2` line; version 2 (refused); another build's slug (refused).

## Part 7: tests

Component tests for the hook (drop accepted, wrong kind refused, too big refused before reading, nearer handler wins), the toolbar (copy writes the clipboard; download names the file), paste, and the check window (lists, Replace, Cancel, undo after replace).

## Done when

- Copy for chat produces the example for the fixture; a map file dropped, opened or pasted is checked, listed, and applied only on Replace map; undo restores the old map.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
