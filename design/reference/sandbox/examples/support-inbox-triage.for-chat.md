# Support inbox triage: build for a map

This file was copied from OpenBuilds with "Copy for chat". It holds the build and the rules for writing a map file. Read all of it, then read the request at the end, then reply with one map file and nothing else.

## The build

- Build: support-inbox-triage
- Made by: @neoscaleai
- 9 tiles in 3 sessions and 2 parts

### Part A

#### S1 · Classify · Claude Code

| Tile | Kind | Title | Uses |
|---|---|---|---|
| 1 | Prompt | Label the last 200 emails | |
| 2 | File | labels.json | made by 1 |
| 3 | Prompt | Merge the refund rules | 2, 4 |

#### S2 · Refund rules · Cursor

| Tile | Kind | Title | Uses |
|---|---|---|---|
| 4 | Prompt | Write the refund rules | |
| 5 | Code | refundRules.ts | made by 4 |
| 6 | Check | Rules pass 30 cases | tests 5 |

### Part B

#### S3 · Draft and send · Claude Code

| Tile | Kind | Title | Uses |
|---|---|---|---|
| 7 | Agent | Reply drafter | 3, 8 |
| 8 | Tool | Gmail | |
| 9 | Result | Support inbox | made by 7 |

### What can run at the same time

These pairs have no link between them, so a two-way arrow is allowed: 1 and 4, 1 and 5, 2 and 4, 2 and 5, 7 and 8, S1 and S2.

## How to write the map file

The map is one filled rectangle on a 12-column grid. You describe it top to bottom as rows. The canvas works out exact sizes, bands and lines.

1. Start with the header block exactly as shown in the example, keeping `build: support-inbox-triage`.
2. Each `## Row` is a full-width strip. Rows are read top to bottom.
3. Inside a row, each `- Box` takes a number of columns. The columns in a row add up to 12.
4. To stack boxes inside one column, write `- Column · cols N` and indent the boxes under it.
5. A box holds tiles from one session only. List them by number: `tiles 1 2 3`.
6. Every tile goes in exactly one box. A tile you leave out stays unplaced.
7. A tile can never sit above a tile that comes before it in the build. A tile it uses must be in the same row or a row above.
8. Optional box settings: `Stack`, `Across` or `Grid`; `notes left` or `notes right`; `indent N` (up to 3 levels); `fill` and `border` from the palette below; `collapsed`.
9. Optional lines under a box: `Title:`, `Explanation:`, `Note N:` (a note beside tile N).
10. `Frame: Part A` on the line under a `## Row` heading draws a frame around that row.
11. `## Two-way` lists pairs as `1 <-> 4`. Use only pairs from "What can run at the same time".
12. Do not write lines between tiles. They come from the build.
13. A row can be text only: `- Text · cols 12` with the text on the next line.

Palette for `fill`: none, grey, green, amber, blue, violet. For `border`: line, dashed, none.
Settings for the header: `width` narrow, standard or wide; `background` grey, dusk, slate or paper; `numbers` build, session or part.

### Example

```
openbuilds_map: 1
build: support-inbox-triage
width: standard
background: grey
numbers: build

## Row
- Text · cols 12
  How the support inbox triage is built.

## Row
- Box S1 · cols 6 · tiles 1 2 3 · Stack · notes left
- Box S2 · cols 6 · tiles 4 5 6 · Stack · notes right

## Row
- Box S3 · cols 12 · tiles 7 8 9 · Across
```

## My request

(Write in plain language how you want the map to look, then send this file to the chat.)
