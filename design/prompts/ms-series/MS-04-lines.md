# MS-04 · Lines

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-03 has merged. Read the README, then `MODEL.md`: "Lines" (Build links, Routing, Hiding). Look at `08-lines.png` and `01-finished-map.png`. Pull main. Branch `ms-04-lines`. Open one pull request titled `MS-04 map lines`.

Pure TypeScript in a new `src/lib/build/mapLines.ts`. Lines come only from the build's links. They run at right angles, only through gutters, and never cross a box.

## Part 0: plan

The README's audit file and plan.

## Part 1: which lines exist

`mapLinks(steps, files, layout)`:

1. Start from `tileLinksOf(steps, files)`. Map each end to its top-level tile. Drop links whose two ends are the same top-level tile, and links with an end that isn't placed.
2. Merge links between the same two top-level tiles into one line, keeping every sentence (the line's accessible name lists them).
3. Each line has `id` (the first link's `${from}>${to}:${verb}`, as the README's `hiddenLinks` uses), `from`, `to`, `dashed` (true when every link in it is `tests`), and `hidden` (in `layout.hiddenLinks`).
4. A line between two tiles in the same box whose slots touch (one directly under the other in Stack, with nothing between) is a short drop line inside the box, `inner: true`. Everything else is routed.
5. `hiddenCount(lines)`: how many are hidden, for the toolbar counter (MS-11).

## Part 2: routing

`routeLines(geometry, lines, layout)` returns, for each visible line, a polyline of points with only horizontal and vertical segments, plus the side each end leaves from.

1. **Ports.** A line leaves the `from` tile's slot and enters the `to` tile's slot from the side facing the other end: left or right when they are in different boxes side by side, bottom or top when one is above the other. A port is on the slot's edge, then runs straight to the box edge through the box's padding (the only place a line is inside a box, and only within its own tile's row).
2. **Graph.** Build a grid graph from `geometry.gutters`: nodes at gutter centre lines and their crossings. A route goes port to gutter, along gutters, gutter to port.
3. **Search.** Shortest path by length plus a penalty of 40 px per bend (A* or Dijkstra on the gutter graph). Never enter a box rectangle other than the two end boxes' padding.
4. **Maker's gutter.** When `layout.linkGutters[id]` names a gutter index, the line's middle segment is forced through that gutter's centre. If that gutter no longer exists, ignore it.
5. **Bundling.** Lines sharing a gutter segment run side by side, spaced 6 px apart, centred on the gutter. Keep the order of parallel lines stable along the shared stretch so lines don't cross needlessly: sort by where each line goes next.
6. **Two-way arrows are not routed here.** They are always a straight horizontal segment between two level ends (MS-11 draws them from MS-03's `isLevel`).
7. **Arrowheads.** At the `to` end. Dashed lines keep their arrowhead.

## Part 3: tests

`src/lib/build/mapLines.test.ts`:

- On the `supportInbox` layout from MS-03's tests: 4 to 3 runs through the middle gutter; 1 to 2 is an inner drop line; 6 to 5 is dashed.
- No segment of any route is diagonal.
- No route crosses a box rectangle other than its two end boxes, and it touches those only in their padding.
- Three lines through one gutter sit 6 px apart, centred.
- `linkGutters` moves a line's middle segment to the chosen gutter.
- Hidden lines aren't routed and are counted.
- The 50-tile fixture routes every line in under 30 ms (report the number).

## Done when

- `mapLinks`, `routeLines` and `hiddenCount` exist with tests.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
