# MS-12 · Style and helpers

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-11 has merged. Read the README (Decisions 10 and 11), then `MODEL.md`: "Style and helpers" and "Keeping freedom from turning into clutter". Look at `09-style-and-helpers.png`. Pull main. Branch `ms-12-style-and-helpers`. Open one pull request titled `MS-12 map style and helpers`.

## Part 0: plan

The README's audit file and plan.

## Part 1: box and region style

1. The floating bar for a box or region gets a style group: **Fill** (the six swatches from `canvasRecipes`, the current one ringed), **Border** (Line, Dashed, None) and **Corners** (4, 8, 12, 16).
2. **Copy style** and **Paste style** on the bar: copy keeps the selection's `style` in the editor's state; paste applies it to every selected box or region as one undo step.
3. Swatches are radio buttons with names ("Green fill"), never colour alone.

## Part 2: canvas background

The toolbar's **Background** opens a small menu: the four presets as swatches with names, a hex field (`#RRGGBB`, checked with the app's existing hex normaliser), and Dot grid on or off. On a light background the ink flips (`inkFor`, MS-05). A hex background is accepted only when `inkFor` can reach 4.5:1 for tile text on it with every fill; otherwise it says "Text wouldn't be readable on that colour." Readers see the same background.

## Part 3: numbers

Already works (MS-06). Check the Session and Part schemes against README Decision 11 on `fiftyTiles`, including the agent's children (they keep their "3.1" form under their parent in every scheme: "S2·3.1").

## Part 4: Tidy

A pure `tidy(layout, geometry, facts)` in `mapLayout.ts` and a toolbar button:

1. Snaps edges within 6 px of each other or of a grid line.
2. Evens out sizes in the same split that are within 3% of each other.
3. Removes `linkGutters` entries that only add bends.
4. Removes empty boxes (no tiles and no text), giving their space to a neighbour.
5. Never changes order, grouping, regions, outlines, two-way arrows or anything inside a box. Its result must pass `orderRefusal`; if a step would break it, that step is skipped.

The button shows the result as a preview with "Tidy: 4 edges, 2 sizes, 1 empty box" and Apply or Cancel. Nothing to tidy: "Nothing to tidy." Apply is one undo step.

## Part 5: Collapse

1. **Collapse** on the bar for a box or region, and on the toolbar for "Collapse all boxes" and "Open all". A collapsed box is one line: its title, its tile number range ("4–6"; use an en dash for ranges as the app does elsewhere, or "4 to 6" if the app avoids it; check and report) and its count ("3 tiles").
2. Neighbours take the height (geometry does this).
3. Collapsed boxes publish collapsed. A reader can open one (a disclosure button on the line), which doesn't change the stored layout.

## Part 6: Start from the build

In Map options (the head menu): **Start from the build**. It asks first ("Replace this map with the plain arrangement? Explanations, notes and styles stay with their tiles and regions.") and then:

1. Runs `startFromBuild`.
2. Carries over, by tile id and by session or part key: notes, Show choices, indents, box titles, explanations and styles (from each session's first box), region explanations and styles, outlines, hidden links, two-way arrows still allowed and level, background, numbers, width.
3. Applies it as one undo step.

## Part 7: tests

- Fill, border and corners save and render; copy and paste style across three boxes is one undo step.
- Every fill on every preset passes contrast (the MS-05 test, extended to custom backgrounds the hex field accepts).
- `tidy`: each rule; never changes order; skipped steps; the preview count.
- Collapse and open; readers open collapsed boxes without a write.
- Start from the build keeps notes, styles and explanations, and undo restores the old map.

## Done when

- Every style and helper above works by pointer and keyboard, previews where it says, and saves as one undo step.
- `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run audit:contrast` pass.
