# MS-09 · Sessions and parts: frames, opened frames, outlines

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After MS-08 has merged. Read the README, then `MODEL.md`: "How sessions and parts sit on the canvas" and "Grouping". Look at `06-sessions-and-parts.png`. Pull main. Branch `ms-09-sessions-and-parts`. Open one pull request titled `MS-09 map frames and outlines`.

Regions are framed by default (`startFromBuild` already makes them). This prompt lets the maker open a frame to interleave sessions, frame boxes again, outline loose boxes, and move or resize a whole region.

## Part 0: plan

The README's audit file and plan.

## Part 1: the region tab

1. A region's tab (its name on the top edge of the frame) selects the region. The floating bar for a region holds Open frame, and the style controls MS-12 adds.
2. Dragging the tab moves the whole region, with the same candidates and order checks as a box (MS-08 already accepts any node id through `insertNode` and `swapNodes`; make sure `allowedDrops` takes a region).
3. A region's own edges resize it like a box (MS-07's shared edges); its contents keep their proportions.
4. Clicking the line under the tab writes the region's explanation (the same editing MS-10 gives boxes; build the shared piece here or there, whichever comes first, and reuse it).

## Part 2: opening a frame

**Open frame** calls `openRegion`: the boxes stay exactly where they are and become loose siblings, so another session's box can be moved between them. Announce "Session 2's frame is open. Its boxes stay where they are." The session's boxes then show a small session tab at their top-left (its number and name), so membership is still visible. Offer Outline in the same message as a button.

## Part 3: framing again

In Sources (MS-06 left room), each part and session row gets **Frame**:

1. If the session's boxes already form a rectangle, `frameRegion` wraps them at once.
2. If they don't, the canvas shows the `proposal` as a preview with a bar: "Frame Session 2 by moving 1 box?" with Frame and Cancel. Nothing moves until Frame. The proposal must also pass `orderRefusal`; if it doesn't, the button is disabled with the reason.
3. A part frame can hold only whole session regions or loose boxes of that part's sessions. Framing a part whose sessions are interleaved with another part's is refused with the session that's in the way.
4. Two levels of frames at most: part, then session (MS-00's refusal already enforces it; surface its sentence).

## Part 4: outlines

1. In Sources, each part and session row gets **Outline**, a toggle that adds or removes its key in `layout.outlines`.
2. An outline is a right-angled line that hugs all of that session's (or part's) boxes, drawn in the gutters around them, 8 px out from the boxes, redrawn whenever a box moves. Compute it in a pure function `outlineOf(geometry, boxIds)` in `mapLines.ts`: the boundary of the union of the boxes' rectangles grown by 8 px, simplified to right angles. A session's loose boxes that aren't touching give one closed outline per touching group, joined by a dashed connector through the gutters.
3. Part outlines are dashed; session outlines solid. Both quieter than frames. Both `aria-hidden`; the box tabs carry the membership.
4. Outlines never stop anything moving.

## Part 5: tests

- Open a session frame: no box moves; tabs appear; undo puts the frame back.
- Interleave: with S1 and S2 open, move S2's first box beside S1's late box; order checks still apply (moving it after tile 3 is refused).
- Frame again: when boxes form a rectangle it frames at once; when they don't, the proposal moves the fewest boxes and waits.
- `outlineOf`: union of two touching boxes gives one right-angled loop; two apart give two loops and a connector; no segment is diagonal; no outline crosses a box.
- A part frame refused when another part's box sits inside it.

## Done when

- Frames open and close, outlines follow loose boxes, regions move and resize, and none of it can break the order.
- `npm test`, `npm run lint` and `npx tsc --noEmit` pass.
