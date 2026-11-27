# MS-08 · Moving boxes and tiles

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-07 has merged. Read the README, then `MODEL.md`: "Moving things" and "The order the canvas can never break". Look at `05-moving.png` and `04-order-and-two-way.png`. Pull main. Branch `ms-08-moving`. Open one pull request titled `MS-08 map moving`.

Drag a box, swap two boxes, move a tile between boxes, drag a tile in from Sources, and do all of it by keyboard. The order is checked while dragging, so a wrong drop is impossible.

## Part 0: plan

The README's audit file and plan. Decide between `@dnd-kit/core` (already a dependency) and plain pointer events for the canvas, and say why. Whatever is chosen, drops come from MS-03's `allowedDrops`, never from the library's own collision logic.

## Part 1: dragging a box

1. Press on a box's title area and move 4 px to start. The box lifts (drawn as a translucent copy under the pointer, the original faded to 40%).
2. At drag start, call `allowedDrops(layout, measure, facts, { box })` once. Show every candidate:
   - **Insert places:** a 4px bar along each box edge where it could go. Allowed ones in `t.evidence`, refused ones in `t.lit` at low opacity.
   - **Swap targets:** other boxes. Allowed ones get a dashed `t.evidence` outline on hover; refused ones a dimmed fill.
3. Hovering a refused place shows its reason by the pointer ("Ship comes after Route", built from the tile names). Hovering an allowed place shows the `result` as the preview.
4. Dropping on an allowed place applies the candidate's `result` with an announcement ("Box Refund rules moved to the right of Classify, row 2."). Dropping anywhere else cancels with no change.
5. Its explanation, notes, style and contents go with it.

## Part 2: swap

Dropping directly on a box swaps when allowed (`swapNodes`). Two boxes from sessions that ran side by side can always swap; two in sequence can't. The copy for a refused swap names the tiles: "Tile 7 uses tile 3, so S3 can't sit above S1."

## Part 3: tiles

1. Dragging a tile out of a box: candidates are boxes of the same session (`into`), box edges (`insert`, which splits a new box for it), and nothing else. A box of another session shows "Prompt 4 is in Session 2. This box holds Session 1." The last tile of a box can't be dragged out: the drag doesn't start and the message says "Remove the box instead".
2. A tile lands in its build-order position in the target box.
3. **From Sources:** drag a tile row onto the canvas with the same candidates. Dropping on the right or bottom quarter of a box of its session splits that box and places it in the new half in one step (`splitBox` with `newTiles`), as `MODEL.md` describes.

## Part 4: keyboard

With a box or tile selected:

- M picks it up. The allowed places are listed in reading order; arrow keys move between them, skipping refused ones (each skip is announced once with its reason). Enter drops; Escape puts it back.
- Every move announces where it went in plain words.
- Picking up and dropping is one undo step.

## Part 5: tests

- Box drags on `supportInbox`: S2 beside S1 allowed; S1 below S3 refused with its reason; swap S1 and S2 allowed; swap S1 and S3 refused.
- Tile drags: tile 5 into S1's box refused; tile 2 to a new box split beside S1's box allowed, landing in order; the last tile can't be dragged.
- From Sources: placing an unplaced tile splits correctly.
- Keyboard: pick up, skip a refused place (announced), drop, undo.
- A test that runs 200 random allowed drops on `fiftyTiles` and checks `orderRefusal` stays null and every tile is placed once.
- Drag start on `fiftyTiles` stays under 50 ms (MS-03's number); report it.

## Done when

- Boxes and tiles move by pointer and keyboard, only to allowed places, with reasons for refused ones.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
