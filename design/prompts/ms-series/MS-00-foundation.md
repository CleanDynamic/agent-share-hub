# MS-00 · Foundation

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** The first of MS-00 to MS-15. Read `design/prompts/ms-series/README.md` first and follow it; then read `MODEL.md` beside it in full. Pull main. Branch `ms-00-foundation`. Commit at the end of every part. Open one pull request titled `MS-00 map sandbox foundation`.

Nothing a person sees changes in this prompt. It checks the ground, writes the stored shape and its reader and writer, and makes the fixture and dev page every later prompt uses.

## What exists now

Checked at `b5fc29f`. Confirm each in Part 0.

- **The map of sessions** (CA-17) is `src/lib/build/sessionMap.ts`: `tileLinksOf` (every link between two tiles, with a verb: uses, reads, calls, tests, runs after, is defined in), `sessionOfTiles`, `sessionLinksOf`, `sessionMapModel` / `sessionMapFor`, `layoutSessionMap` (horizontal or vertical), `readingOrder`. It draws one box per session and no tiles.
- **The views**: `src/pages/site/compose/SessionMap.tsx` (`SessionMapColumn`, `NoMap`, `MAP_COPY`), `SessionMapPanel.tsx` (the 312 panel that replaces Details in the Map view), `mapRecipes.ts` (rail 52, gap 24, map, gap 48, panel 312), `ArchitectureMap.tsx` (`MapViews`, the Sessions / Architecture switch). The composer is `SandboxPage.tsx` (`mapColumn`, `architectureColumn`, `mapPanel`, `changeMap`). Readers get `src/pages/site/build/ReaderMap.tsx`, offered when `readerSeesMap(build.making)` is true (`BuildPage.tsx`). The dev page is `src/pages/dev/DevMap.tsx` with fixtures in `src/dev/fixtures/sandbox`.
- **`builds.making`** is read and written in `src/lib/build/making.ts`: `Making`, `MapSettings` (`on`, `direction`, `onBuildPage`, `view`), `mapOf`, `makerMapOf`, `readerSeesMap`, `mapRefusal`, `setMapSettings`, `storedWorkstreamsOf`, `partLabelsOf`, `sessionsMetaOf`, `sessionOrderOf`, and `makingStep`, which reads and writes `making` in one step of the build's write queue.
- **Parts** are workstreams (`making.workstreams`, `src/lib/build/workstreams.ts`: `workstreamsOf`, `workstreamLabel`, `workstreamMark`). **Stages** (`src/lib/build/stages.ts`: `stagesOf`, `withAbove`, `startsAfter`) say which sessions ran side by side.
- **Steps** are `Step` in `src/lib/build/graph.ts` (`id`, `kind`, `number`, `title`, `defaultTitle`, `uses`, `children`, `sentWith`, `session`), grouped by `SessionGroup` (`key`, `kind`, `implicit`). `groupKey`, `groupOfStep` and `shownGroups` read them.

## Part 0: inventory and plan

1. Read every file named above. In `design/audits/map-sandbox/ms-00-before.md`, write the README's `Assumptions` and `Plan`, then three more sections:
   - `Where the map is used`: every importer of `sessionMap.ts`, `SessionMap.tsx`, `SessionMapPanel.tsx` and `ReaderMap.tsx`, and what each uses. Include `BuildsMapsView.tsx`, `buildsMaps.ts`, `DevMap.tsx` and the tests.
   - `What a tile can show`: for each `StepKind`, which of the parts Text, Settings, Files, Code and Picture it has, and the `Step` fields that hold each. MS-10's Show needs this table.
   - `Numbers`: how `Step.number` is made, whether the composer already has a session-relative number (SV-05), and what `partLabelsOf` and `workstreamLabel` give.
2. Check that `builds.making` is JSON (so `map_layout` needs no migration) by reading the column in `supabase/migrations/` and the generated types. If it isn't, stop and report.

## Part 1: the stored shape, read and refused

Create `src/lib/build/mapLayout.ts` with the types in the README's Decision 3, exactly as written.

1. `mapLayoutOf(making: unknown): MapLayout | null` reads `making.map_layout` defensively, the way `storedWorkstreamsOf` does:
   - Not an object, or `v` isn't 1: null.
   - Every node is checked. A node of an unknown kind, a split with a different number of `sizes` and `children`, or a box with a non-string tile is dropped, and its space goes to its sibling (so the tree is still full). If the root itself can't be read: null.
   - `across` sizes that don't add up to 1 are scaled to 1. A size under 0 is 0.
   - A width outside `MAP_WIDTH` is clamped. An unknown background is `grey`. An unknown `numbers` is `build`.
   - A tile id that appears in two boxes keeps its first place only.
   - Unknown keys anywhere are ignored, never removed.
   `MAP_WIDTH` belongs to MS-02. For now define it here with the README's numbers and a comment that MS-02 moves it to `mapGeometry.ts`.
2. `mapLayoutRefusal(layout: MapLayout): string | null`, pure, so the editor can say no first. One plain sentence each, in a `MAP_LAYOUT_COPY` object:
   - more than 2,000 nodes, or nesting deeper than 24;
   - a split with fewer than 2 children;
   - an `across` split whose sizes don't add up to 1 within 0.001;
   - two nodes with the same id;
   - a tile in two boxes;
   - a region inside a region of the same kind, or a session region outside its part's region when that part is framed;
   - a title over 80 characters, an explanation over 280, a note over 200 (the limits match `SESSION_TITLE_MAX` where one exists; report any other limit you find);
   - the stored JSON over 256 KB.
3. `newMapNodeId()`: `m-` plus a uuid, made like `newWorkstreamKey`.

Tests in `src/lib/build/mapLayout.test.ts` for every branch of both functions, including a round trip: `mapLayoutOf({ map_layout: x })` of a valid `x` gives `x` back.

## Part 2: the writer

In `src/lib/build/making.ts`:

1. Add `map_layout?: MapLayout` to `Making`, with a comment naming MS-00.
2. Add `setMapLayout(buildId: string, layout: MapLayout | null): Promise<Record<string, unknown>>` beside `setMapSettings`. It goes through `makingStep`, refuses with `mapLayoutRefusal` before writing (throwing the same kind of error `setWorkstreams` throws), writes only `making.map_layout`, and removes the key when `layout` is null. It resolves with `making` as written.
3. Tests next to the existing `setMapSettings` tests, using the same mocks: a write keeps every other key of `making`; two calls close together both land (the second starts from the first's result); a refused layout writes nothing.

## Part 3: the fixture

Create `src/dev/fixtures/mapSandbox.ts`, built the way the fixtures in `src/dev/fixtures/sandbox` are built (same helpers, same `Step` and `SessionGroup` shapes):

1. **`supportInbox`**: the build on `design/reference/sandbox/01-finished-map.png` and in `examples/support-inbox-triage.for-chat.md`. 9 tiles in 3 sessions and 2 parts:
   - Part A: S1 Classify (Claude Code): 1 Prompt "Label the last 200 emails", 2 File "labels.json" (made by 1), 3 Prompt "Merge the refund rules" (uses 2 and 4). S2 Refund rules (Cursor): 4 Prompt "Write the refund rules", 5 Code "refundRules.ts" (made by 4), 6 Check "Rules pass 30 cases" (tests 5).
   - Part B: S3 Draft and send (Claude Code): 7 Agent "Reply drafter" (uses 3 and 8), 8 Tool "Gmail", 9 Result "Support inbox" (made by 7).
   - S1 and S2 ran side by side (stages). Its `making` has the two workstreams and no `map_layout`.
2. **`fiftyTiles`**: 50 tiles in 8 sessions and 3 parts, with uses across sessions, two pairs of sessions side by side, one agent with 3 children, and a Result.
3. **Edge cases**: `oneSession` (4 tiles, one session, no parts); `noUses` (3 sessions side by side, no links); `removedTile` (a `making.map_layout` that names a tile id the build no longer has); `legacy` (an old build whose sessions are `typed-legacy-n` keys).

## Part 4: the dev page

Create `src/pages/dev/DevMapSandbox.tsx` at `/dev/map-sandbox`, registered the way `DevMap` is. For now it shows a fixture picker and, for the chosen fixture, `tileLinksOf` as a list of sentences and the result of `mapLayoutOf(fixture.making)`. Later prompts add the canvas to it. It writes nothing.

## Done when

- `mapLayoutOf`, `mapLayoutRefusal` and `setMapLayout` exist, with tests, and nothing calls them yet.
- `/dev/map-sandbox` opens on each fixture.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
- The audit file has the inventory, the parts table and the numbers section.
