# MS-13 · Size, big builds and readers

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-12 has merged. Read the README, then `MODEL.md`: "Canvas size, readers' screens and builds with 50 tiles". Look at `10-canvas-size.png` and `01-finished-map.png`. Pull main. Branch `ms-13-size-and-readers`. Open one pull request titled `MS-13 map size and readers`.

## Part 0: plan

The README's audit file and plan. Measure first: on `/dev/map-sandbox` with `fiftyTiles`, record scroll frame times and the time to first paint of the canvas, in the editor and in reader mode, with the method the repo's `audit:perf` uses. These are the "before" numbers.

## Part 1: canvas width

1. The canvas's right edge is a drag handle in the editor. Dragging uses `snapWidth`: narrow, standard and wide catch within 24 px, otherwise grid steps, clamped to min and max. A readout shows the width and its preset name.
2. A width that would make any box narrower than the minimum is refused at the handle ("Box Refund rules needs at least 160 px").
3. Keyboard: the handle is focusable; arrow keys move it by a grid step, Home and End go to min and max.
4. When the canvas is wider than the column, the column scrolls sideways; Fit (MS-06) zooms to fit the width.

## Part 2: big builds

1. **Scrolling.** The canvas scrolls vertically inside the Map view, with the toolbar and Sources fixed.
2. **Minimap.** Over 20 tiles, or when the canvas is taller than two screens, a minimap sits at the bottom-right of the canvas column: the whole rectangle drawn as box outlines, with the visible area as a frame. Click or drag in it to scroll. It's `aria-hidden`; the keyboard way is Sources.
3. **Sources jump.** Selecting a session or part row in Sources scrolls to its region and flashes it once (MS-06 started this; check it on 50 tiles).
4. **Drawing only what's near.** Boxes outside the scroll area plus one screen draw as empty rectangles of their computed size. Measuring (MS-05) runs only for boxes about to be drawn; cached sizes are reused.
5. **Targets** on `fiftyTiles`, on the audit's throttling: no scroll frame over 16 ms at the 95th percentile, canvas first paint under 300 ms after the Map view opens, a drag start under 50 ms. Report before and after.

## Part 3: the build page

1. `ReaderMap` draws the canvas at the reader's width: the stored width is scaled down to fit (never up past it), using proportions, so it reads the same on a laptop.
2. Readers get: tiles that open the Full prompt window, collapsed boxes they can open, the hidden-links line, and nothing that edits. No placeholders, no "Removed from the build", no unplaced tiles.
3. Remove the old reader controls that no longer mean anything (the direction is gone); keep Fit to screen if the map is wider than the column.

## Part 4: phones

1. Below 768 wide (the breakpoint `ReaderMap` uses today; confirm it), the canvas stacks boxes one per row in `phoneOrder`, full width, regions drawn as frames round their stacked boxes, lines hidden and replaced by each tile's "Uses Prompt 4" line in words, two-way arrows replaced by "Happens at the same time as Prompt 4". Since reading order always matches the build, this needs no stored phone layout.
2. The old phone well (the 420 tall pan and pinch area, Prompt 22) is replaced by this stack. Remove its code if nothing else uses it, or list it for MS-15.
3. The editor on a phone: the Map view shows the same stack, read-only, with "Open on a wider screen to arrange the map." Editing needs at least 1024 wide.

## Part 5: tests

- Width drag snaps and refuses; keyboard handle.
- Minimap appears over the threshold and scrolls the canvas.
- Only near boxes are drawn (count rendered tiles while scrolled).
- Reader: scaled width, no editing controls, collapsed boxes open, placeholders absent.
- Phone: stacked in reading order; lines become words; two-way becomes words.
- The performance targets, with numbers in the report.

## Done when

- Width, scrolling, the minimap, readers and phones work as above, and the targets are met (or the report says by how much they're missed and why).
- `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run audit:perf` pass.
