# MS-05 · Start from the build, and the canvas

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-04 has merged. Read the README (Decisions 1, 2, 4, 5, 6, 10, 11), then `MODEL.md`: "What a new map starts as", "Inside a box" and "How sessions and parts sit on the canvas". Look at `01-finished-map.png`, `06-sessions-and-parts.png` and `07-inside-a-box.png`. Pull main. Branch `ms-05-canvas`. Open one pull request titled `MS-05 map canvas`.

Every build gets the new map, drawn read-only, in the composer's Sessions view and on the build page. No editing yet.

## Part 0: plan

The README's audit file and plan. Also list what `SessionMapColumn` draws in its head (title, "Shown on build page", Map options, Fit to screen) and what each control does, so the new head keeps every one.

## Part 1: the plain arrangement

`src/lib/build/mapStart.ts`: `startFromBuild(steps, groups, making): MapLayout`, pure.

1. One region per part (`of: { part }`), stacked top to bottom in the parts' order. A build with one part (no workstreams) has no part region.
2. Inside each part, one session region (`of: { session }`) per session, each holding one box with all its top-level tiles in build order, Stack layout, text shown, title empty (the session's own title is drawn when the box has none). Sessions that ran side by side (from `stages.ts`) sit in one `across` split with equal sizes; sessions one after another stack in a `down` split.
3. A Result tile (`kind` of the build's result step; check the real kind name in `graph.ts`) goes in a full-width box of its own at the end of its part, still in its session's region. If its session region would then not be a rectangle, the Result box sits after the region inside the part and the session is drawn with an outline instead (add its key to `outlines`).
4. Width standard (960), background grey, dot grid off, numbers build, nothing hidden, no two-way arrows.
5. Implicit groups (`SessionGroup.implicit`, an old build's steps before any session) get a box at the very top with no region.
6. `legacy` sessions (`typed-legacy-n`) work like any session; their keys are never written, because `startFromBuild` is only stored once the maker edits (MS-06), and MS-06 must then key regions for legacy sessions by their first tile's id instead. Note this in a comment.

Tests: every fixture gives a layout that passes `mapLayoutRefusal` and `orderRefusal`, places every top-level tile once, and for `supportInbox` matches the structure of `01-finished-map.png` (an intro box aside, which MS-12's text boxes add).

## Part 2: recipes

`src/pages/site/compose/canvasRecipes.ts`, the one place the canvas's measures and the background table live, written like `mapRecipes.ts`:

- The background presets (README Decision 10) and `inkFor(background)`: the text, line and frame colours for that background (light ink on the dark presets, dark ink on paper), each a token where one fits.
- The fill palette, as tints over the background, with a test that checks every fill on every preset with `contrast` (`src/lib/theme/luminance.ts`): 4.5:1 for tile text, 3:1 for box titles. Change a failing tint until it passes.
- Box: radius 12 by default, padding from `MAP_GRID`, title 14/500, explanation 12.5/400.
- Tile: no recipe here. The map draws the List's step tile (README Decision 14). If MS-00 found it can't render outside the List, extract the presentational part of `BuildList.tsx`'s tile into `src/pages/site/compose/StepTile.tsx`, make the List use it, and keep every List test green; the map then uses the same component with `variant="map"`, which leaves out the drag handle, reorder controls, "Show full prompt" and Uses chips, and takes the parts to show from `show[tileId]`. Snapshot one tile of each kind in both places and assert they match apart from those left-out pieces.
- Frame: 1.5px line, the name tab on the top edge, part frames dashed and quieter than session frames.
- Lines: 1.3px, arrowheads 7px, two-way 1.6px in `t.evidence`.

## Part 3: `MapCanvas`

`src/pages/site/compose/MapCanvas.tsx`, one component for the composer and the build page:

```ts
interface MapCanvasProps {
  layout: MapLayout; steps: Step[]; groups: SessionGroup[]; files: MapPieceLike[]; making: unknown;
  mode: "maker" | "reader";
  selected?: string | null; onSelect?: (id: string | null) => void;  // MS-06 uses these
  onOpenTile?: (id: string) => void;
}
```

1. **Measure.** Render each tile once off-screen at its slot width to get heights (a hidden measuring layer, `ResizeObserver` for changes), then feed `geometryOf`. Cache by tile id, width and shown parts. Nothing may visibly jump: the first paint uses the measured sizes.
2. **Draw.** Positioned boxes, regions with frames and tabs, tiles in their slots, notes with leader lines, then one SVG layer on top for lines (`routeLines`) and two-way arrows. The canvas has the layout's background and, when `dotGrid`, the app's dot grid.
3. **Tiles.** The List's tile at the slot's width (Decision 14), with its number badge showing the layout's `numbers` scheme (README Decision 11). A tile that no longer exists is drawn as a muted slot reading "Removed from the build" for the maker, and not at all for readers (Decision 6). Clicking a tile in reader mode calls `onOpenTile` (the build page opens the Full prompt window, as `ReaderMap`'s `onRead` does today).
4. **Accessibility.** The canvas is a list of boxes in reading order (`readingOrder`), each a group named by its title and session, each holding its tiles as list items with their number, kind and title. Lines, frames and outlines are `aria-hidden`; each tile's description says what it uses and what uses it, from the line sentences.
5. **Performance.** Boxes outside the scroll area plus one screen are drawn as empty rectangles of the right size (MS-13 measures this). Use `content-visibility: auto` if that alone meets MS-13's target.

## Part 4: wiring

1. **Composer.** In `SandboxPage.tsx`, the Sessions view draws `MapCanvas` in maker mode, with `mapLayoutOf(making) ?? startFromBuild(...)`. Keep the head: the title (`mapTitle`), the shown line, Map options (Show on build page, Remove map) and Fit to screen. Remove the direction switch from the Sessions view: the canvas has no direction. `SessionMapPanel` is no longer drawn in the Sessions view; the canvas takes its width. Leave `SessionMapPanel.tsx` and the horizontal and vertical layout in place: MS-15 removes what nothing uses.
2. **`MapViews`** keeps its Sessions / Architecture switch. Architecture is unchanged.
3. **Build page.** `ReaderMap.tsx` draws `MapCanvas` in reader mode with the stored layout or the plain arrangement, at the reader's width (proportions scale it; MS-13 does phones). `readerSeesMap` still decides whether it's offered.
4. **Dev page.** `/dev/map-sandbox` draws the canvas for each fixture, with a maker and reader switch and a width control.

## Part 5: tests

- `MapCanvas.test.tsx`: the `supportInbox` fixture renders 9 tiles in reading order in the accessibility tree; a removed tile shows for the maker only; the number schemes change badges.
- Update `SessionMap.test.tsx` and any test of `ReaderMap` or `SandboxPage` that asserted the old boxes or the panel, so they assert the canvas. Don't delete tests of code that still exists.
- Run `npm run audit:contrast` and `npm run audit:themes`; add `/dev/map-sandbox` to whichever page list those audits read, if they read one.

## Done when

- The Sessions view and the build page draw the new canvas for every build, with no write.
- The plain arrangement for `supportInbox` reads 1 and 4, then 2 and 5, then 3 and 6, then 7, 8 and 9.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run audit:contrast` and `npm run audit:themes` pass.
