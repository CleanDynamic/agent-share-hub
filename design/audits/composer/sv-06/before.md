# SV-06 · motion rework · before

Measured on `sv-06-motion-rework` at main `8b64663` (SV-05 merged), before any change to the motion code. The dev pages, the audit
and its numbers are described in `e2e/audit/motion.spec.ts`; the numbers are in `before.json`, the videos in `before/`.

## Assumptions

Each fact in the prompt's "Why", checked against the files on 26 October 2026.

1. **Five players, each calling `play()` in `flip.ts`.** True. `arrival.tsx:217` (`play(root, before.current, LANE_OPEN_MS)`); the
   director through `useFlip` (`buildMotion.tsx:257`, used by `buildDirector.tsx`); `foldMotion.tsx:134`; `useBuildSorting.ts:458`
   (the drag) and `useBuildSorting.ts:477` (any other change of order). `play()` is at `flip.ts:72` and starts with `settle(root)`
   (`flip.ts:37`), which cancels every running slide in the list. `useBuildSorting.ts:448` and `:476` call `settle(root)` again.
2. **The intent is module-level and expires after 8 s.** True: `motionIntent.ts`, `INTENT_FRESH_MS = 8000`. The director reads it
   with `peekIntent()` and spends it with `spendIntent()` while rendering (`buildDirector.tsx:344`, `:363`, `:385`). `SourcesPanel.tsx:453`
   also reads it while rendering. Adds and imports bypass the director: `mine` is false while `arriving` is set (`buildDirector.tsx:362`).
3. **Sequences run on timers.** True for `later(...)` in `buildDirector.tsx` (7 calls), `mapMorph.tsx` (3), `arrival.tsx` (4) and the
   bare `window.setTimeout` in `foldMotion.tsx:137` and in `useLeaving` (`buildMotion.tsx:337`). `arrival.tsx:156` assumes a smooth
   scroll takes 450 ms. **Not true for `editHandlers.ts`:** its `later(...)` is CA-18's write buffer (each Details handler queued until
   Save), not motion; it stays.
4. **Layout read during render.** True: `useBuildSorting.ts:471` calls `snapshot()` while rendering when the order signature changes;
   the director calls `getRoot()`, `peekIntent()` and `spendIntent()` while rendering; `foldMotion.tsx:81` calls `snapshot(root)` while
   rendering; `useCrossfade` (`buildMotion.tsx`, SV-05's number crossfade) calls `captureWords` (a `getBoundingClientRect` and a
   `getComputedStyle`) while rendering.
5. **Dragging measures everything per pointer event.** True: `decide()` runs on every `pointermove` (`useBuildSorting.ts:547`) and on
   every scroll; `placeAt` calls `naturalBox` (a `getBoundingClientRect` and a `getComputedStyle` through `slidBy`) for every part,
   session and tile, and every tile again for the middle third.
6. **Off the compositor.** True: `clip-path` in `openClip` (`buildMotion.tsx:156`) and `grow` (`flip.ts:65`), `stroke-dashoffset` in
   `mapMorph.tsx:85`. The `scale` in `flip.ts:58` is used by the skeleton's lanes (`skeleton.tsx` `Box`, whose rects change size) and by
   `openLane` (`scaleY(0)`, `skeleton.tsx:56`): both are bordered, rounded boxes. `slideOut` is at `buildMotion.tsx:216` now, not 171.
7. **Every slide is 150 ms whatever its distance.** True: `SLIDE_MS = FAST`.
8. **Scrolling fights the maker.** True: `scrollToMiddle()` runs its own rAF loop and stops only when cancelled; the arrival's
   `scrollIntoView` and the jump tabs' scroll do not stop on the maker's input. (`largeBuild.tsx`'s `settle` does stop.)
9. **The tests can't see it.** True: every motion test runs in jsdom with `animate` stubbed.

**Remounts** (`rerender-no-inline-components`). No component is defined inside another in `BuildList.tsx`, `SandboxPage.tsx` or the
files the list draws (`SessionHead`, `WorkstreamHead`, `listNest`, `skeleton`, `largeBuild`, `arrival`, `tileRecipes`, `removePieces`,
`referencePieces`, `ImportingPieces`); `card`, `placed`, `drawRun` and `drawPart` are functions called inline, not components. One key
changes when it should not: **a session's run is keyed by its first tile's id** (`buildRuns.ts:25`, `key: step.id`), and an empty
session by `empty:<key>` (`:36`). Removing or moving a session's first tile, or a session gaining or losing its only tile, changes the
key, so the whole session (head and every tile) is unmounted and drawn again, and anything moving in it snaps. Added to "Why" as
cause 10; Part 1 keys a session by its own key. Three structural changes also redraw elements in a new parent (React cannot move an
element to another parent): the first two tiles of a build (`nestOn` wraps tiles in a box), the 60th tile (`WindowedTile`), and going
from one part to two. Since the animator measures by `data-slide-id`, not by element, those still slide from where they were drawn.

## Plan

- Part 0: `npm run audit:motion` (`e2e/audit/motion.spec.ts` on `support/frames.ts`'s new motion recorder) and this file -> verified by: 28 moments and 4 import sizes measured, 28 videos.
- Part 1: `listMotion.ts` with `useListMotion` and `MotionBoundary`; every player routed through it; `settle` gone from `play`; sessions keyed by their own key -> verified by: jsdom tests (one plan per commit, continue from the drawn place, a static check that only `listMotion.ts` animates list elements, no skipped tile measured, no remount on removing a first tile), and `cancelled` at 0 in the audit.
- Part 2: `MotionChannel` and `motion.expect({ kind, keys })` replace `motionIntent.ts`; imports and new sessions labelled `add`; nothing read in render -> verified by: jsdom tests (labelled remove lifts then slides, unlabelled slides, a label waits 5 s, a stale label is dropped, no `getBoundingClientRect` in render).
- Part 3: every motion timer chain waits on `finished`; the arrival waits for `scrollend`; a 1.2 s cap -> verified by: jsdom tests (a 300 ms block keeps the order, an interrupted sequence ends right, the skeleton never fades before its slides).
- Part 4: no `clip-path` or `scale` on bordered boxes: grow by sliding, part frames and lanes in three pieces; `will-change` only while moving -> verified by: a static check over `src/pages/site/compose`, `offCompositor` empty in the audit but for the map's lines, and the composer shots unchanged at rest.
- Part 5: `slideMs(distance)`, one duration per plan, `staggerStep` for imports and lists -> verified by: unit tests of the figures, and the import table (8 and 18 land with 4).
- Part 6: `decide()` once per frame from a ref and a position cache; passive listeners; `useEffectEvent` -> verified by: jsdom tests (200 events, one decide; no layout read per move; CA-21's placement tests unchanged), and frame gaps in the two drag moments.
- Part 7: one scroll helper that yields to the maker -> verified by: jsdom tests (wheel stops it, none starts during a user scroll, none when visible).
- Part 8: the after audit with thresholds, videos, the stagger table, composer shots at rest, contrast -> verified by: `npm run audit:motion` passing, `after.md`.

## Before numbers

| moment | frame gaps > 25 ms | long tasks > 50 ms | cancelled | largest one-frame jump | click to first frame (ms) | settled (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| remove-a-tile | 2 | 2 | 3 | 38% | 4 | 656 |
| undo-the-removal | 1 | 1 | 0 | 56% | 5 | 641 |
| remove-a-session | 2 | 2 | 0 | 0% | 4 | 634 |
| clear-the-build | 1 | 1 | 0 | 40% | 10 | 888 |
| undo-clearing | 2 | 1 | 0 | 20% | 9 | 1094 |
| merge | 2 | 2 | 1 | 0% | 9 | 842 |
| add-a-tile | 1 | 1 | 0 | 0% | 2 | 652 |
| duplicate | 2 | 1 | 0 | 20% | 7 | 669 |
| duplicate-two | 3 | 1 | 0 | 56% | 9 | 662 |
| split | 2 | 1 | 0 | 100% | 10 | 652 |
| add-a-part | 1 | 1 | 0 | 0% | 9 | 656 |
| redo | 3 | 2 | 3 | 38% | 13 | 632 |
| move-to-part | 2 | 1 | 0 | 0% | 61 | 1235 |
| send-together | 2 | 1 | 0 | 0% | 63 | 317 |
| convert | 1 | 1 | 0 | 0% | 14 | 255 |
| selection-bar | 1 | 1 | 0 | 0% | 5 | 250 |
| details | 0 | 1 | 0 | 0% | 16 | 16 |
| go-to-it | 0 | 0 | 0 | 0% | 26 | 2017 |
| fold | 1 | 1 | 0 | 32% | 14 | 266 |
| unfold | 1 | 1 | 0 | 54% | 9 | 410 |
| collapse-all | 1 | 1 | 0 | 34% | 5 | 255 |
| list-to-map | 1 | 0 | 7 | 27% | 9 | 726 |
| map-to-list | 1 | 1 | 0 | 0% | 8 | 311 |
| remove-and-undo | 7 | 3 | 3 | 56% | 9 | 1521 |
| tile-drag-across-sessions | 34 | 7 | 4 | 100% | 9 | 2357 |
| session-drag-into-part | 29 | 4 | 0 | 56% | 5 | 1819 |
| import-arriving | 3 | 1 | 0 | 100% | 9 | 659 |
| go-to-it-from-a-post-link | 3 | 2 | 0 | 0% | 1 | 2118 |

| import | click to last prompt landed (ms) |
| --- | --- |
| 1 prompt | 2048 |
| 4 prompts | 2435 |
| 8 prompts | 2804 |
| 18 prompts | 2870 |

What the numbers mean: a **frame gap** is a frame more than 25 ms after the one before it, from the input until nothing runs; a **long
task** is one over 50 ms while something moves; **cancelled** counts animations cut short (cancelled, or finished early) with nothing
continuing on that element in the same frame; the **largest one-frame jump** is, for any `[data-slide-id]` element in the window, its
largest single-frame move as a share of its whole travel (100% is a snap); **click to first frame** is from the input event to the first
frame where anything changed. Each number is the median of three runs on a fresh page. Chromium here renders in software in a container:
frame gaps and long tasks are higher than on a laptop with a GPU, so they are compared before against after, on the same machine.

## What the eye sees

From the videos in `before/` (read frame by frame from contact sheets) and the jumps the audit names. At 900 tall, a change to Session 2
or Part 2 of the fixture happens below the fold, so its moment shows little on screen; the drags are measured in a window 2400 tall.

| moment | what the eye sees |
| --- | --- |
| remove-a-tile | Prompt 2 lifts; then the tiles below cover 45 of their 117 px in one frame: the gap closes in a jump. 3 slides are cancelled as the sorting watcher replays them. |
| undo-the-removal | Prompt 4 travels 84 of 150 px in one frame: the tiles below jump down to open the gap before the tile drops in. |
| remove-a-session | Session 2 lifts below the fold; nothing on screen moves. |
| clear-the-build | Heads and tiles lift from the last to the first; the "Add a part" row jumps 163 of its 404 px up in one frame. |
| undo-clearing | Everything drops back in; the frames open by `clip-path`, repainted every frame. |
| merge | Below the fold at 900; one animation is cut short. |
| add-a-tile | The new tile drops in; nothing jumps. |
| duplicate | The copy slides out from under its original with a `scale`, so its corners stretch while it moves; it covers 54 of 267 px in one frame. |
| duplicate-two | Prompt 2 covers 75 of 134 px in one frame: the second copy's slide reads as a jump. |
| split | Prompt 3 snaps 30 px into the new session with no slide. |
| add-a-part | The new part's frame is revealed by `clip-path` (repainted every frame); nothing jumps. |
| redo | As remove-a-tile: the gap closes in a jump, and 3 slides are cancelled. |
| move-to-part | Nothing for 61 ms (the demo's write takes 60), then Session 2 slides below the fold. |
| send-together | Nothing for 63 ms (the same write), then the parent tile grows by `clip-path`. |
| convert | The kind line crossfades; nothing jumps. |
| selection-bar | The bar rises in; when it goes it takes as long as it took to come. |
| details | Nothing in the list moves. |
| go-to-it | The page scrolls on a script loop for 450 ms that does not stop if the maker scrolls. |
| fold | The Manual step covers 32 of 102 px in one frame: the tiles below Session 1 jump up as the space closes. |
| unfold | The agent tile covers 168 of 313 px in one frame: the tiles below jump down as the space opens. |
| collapse-all | Prompt 5 covers 73 of 212 px in one frame. |
| list-to-map | 7 animations are cancelled when the map is drawn: the tiles' fold is cut off by the switch. |
| map-to-list | The boxes morph back into heads; nothing in the list jumps. |
| remove-and-undo | Undo 700 ms into the removal: 3 slides are cancelled and Prompt 4 covers 150 of 267 px in one frame. |
| tile-drag-across-sessions | 34 frame gaps: every pointer move measures the whole page. Each step restarts the slides, so Prompt 3 is drawn over the "Lands here" place mid-slide, and the Decision tile snaps 29 px. |
| session-drag-into-part | 29 frame gaps; Session 2 covers 46 of 82 px in one frame. |
| import-arriving | The "Add a session" row snaps 97 px down when the lane opens; the lane shows as a dark block before the head falls. |
| go-to-it-from-a-post-link | The scroll is the same script loop; 3 frame gaps while it runs. |

## Motion inventory

Every `animate()` call and CSS transition in `src/pages/site/compose/`, judged by what it does. "Timing" is the `buildMotion.ts` (or
`motion.ts`) timing for that usage.

| Where | What it does | Duration · curve · distance · delay | Timing for the usage | Verdict |
| --- | --- | --- | --- | --- |
| `flip.ts` `animateFrom` (via `play`) | slide: what moved, to its new place | 150 · STANDARD · any distance · none, or the caller's | `SLIDE` | off the scale for its usage: a long move in 150 reads as a jump (Part 5 owns it) |
| `flip.ts` `grow` | open: the new part of a thing that grew, `clip-path` | 200 · STANDARD · its growth · the slide's | none | no timing for this usage (and off the compositor: Part 4 replaces it with a drop) |
| `buildMotion.tsx` `dropIn` | drop: anything arriving | 240 · STANDARD · falls 20 · stagger 60, capped at 12 | `DROP`, `DROP_FALL`, `STAGGER` | matches (the stagger total is Part 5's) |
| `buildMotion.tsx` `fadeIn` | fade in: counts on a fold, map labels | 150 (or the caller's) · STANDARD · none | `CROSSFADE` | matches |
| `buildMotion.tsx` `liftOut` | lift: anything leaving | 200 · STANDARD · rises 8 · stagger only | `LIFT`, `LIFT_RISE` | matches |
| `buildMotion.tsx` `openClip` | open: a new part's frame, `clip-path` | 200 (`LIFT`) · STANDARD · its height · after the slide | `LANE_OPEN_MS` (200) | matches in value, named for a lift (Part 4 replaces it) |
| `buildMotion.tsx` `resizeFrame` | open and close: a window's frame about its centre (CA-28) | 200 · STANDARD · half the change · none | `BASE` | matches (a window, not the list) |
| `buildMotion.tsx` `slideOut` | slide out: a copy from under its original, with `scale` | 240 · STANDARD · original to copy · after the slide | `DROP` | matches in time (Part 4 takes the scale out) |
| `buildMotion.tsx` `riseIn` · `fallOut` (selection bar) | open and close: the bar rises 16 and fades | 200 in · 200 out · STANDARD · none | `BAR_RISE`, `BASE` | off the scale for its usage: leaving takes as long as arriving. No part of this prompt owns the selection bar: reported, not changed |
| `buildMotion.tsx` `riseIn` · `fallOut` (the notice) | open and close: the notice rises 8 | 150 in · 150 out · STANDARD · none | `NOTICE_RISE`, `FAST` | off the scale for its usage: leaving takes as long as arriving. Not owned by a part: reported |
| `buildMotion.tsx` `Swap` | crossfade: Details' subject changes, old out then new in | 150 + 150 · STANDARD · none | `CROSSFADE` | matches (its timer is Part 3's) |
| `buildMotion.tsx` `outlineOnce` | outline once | 150 in, 500 hold, 300 out · STANDARD | `OUTLINE_IN`, `OUTLINE_HOLD`, `OUTLINE_OUT` | matches |
| `buildMotion.tsx` `goToIt` ring | outline once, held longer | 150 in, 800 hold, 600 out | `GOTO_HOLD`, `GOTO_OUT` | matches |
| `buildMotion.tsx` `scrollToMiddle` | scroll: to the middle, by a rAF loop | 450 · cubic ease-out · any distance | `SCROLL_TO` | matches in time (Part 7 replaces the loop with the browser's) |
| `buildMotion.tsx` `crossfadeFrom` | crossfade: words that change, numbers | 150 · STANDARD | `CROSSFADE` | matches |
| `arrival.tsx` `fall` | drop: a new session's head and prompts | 240 · STANDARD · falls 20 · head at 260, prompts 110 apart up to the 8th | `FALL_MS`, `FALL_SHIFT`, `HEAD_AFTER_MS`, `PROMPT_STEP_MS` | matches (the spread is Part 5's) |
| `foldMotion.tsx` `turnArrow` | turn: the fold arrow, a quarter turn | 150 · STANDARD | `SLIDE` (the CA-22 note says the arrow turns over `SLIDE`) | matches |
| `foldMotion.tsx` lift · drop · `play` | fold: tiles rise 24 and fade, the space closes; unfold: they come down 40 apart | 200 · STANDARD · 24 · stagger 40 up to 8 | `FOLD`, `FOLD_RISE`, `UNFOLD_STAGGER`, `UNFOLD_STAGGERED` | matches |
| `mapMorph.tsx` `fly` | morph: a head's copy flies to its map box, with `scale` | 300 · STANDARD · head to box | `MAP_MORPH` | matches (a copy in a fixed layer, outside the list) |
| `mapMorph.tsx` `drawLines` | draw: the map's lines, `stroke-dashoffset` | 200 in · 100 back · STANDARD | `MAP_LINES`, `MAP_LINES_BACK` | matches (the one main-thread exception, Part 4) |
| `mapMorph.tsx` fold · unfold | lift and drop: the tiles before and after a morph | 180 · 200 · STANDARD · 24 | `MAP_FOLD`, `FOLD` | matches |
| `skeleton.tsx` `Box` | slide: a socket or lane that moved, with `scale` for a lane | 150 · STANDARD | `SLIDE` | matches in time (Part 4 takes the scale out, Part 5 the distance) |
| `skeleton.tsx` `fadeSocket` | fade in: a new session's sockets | 160 · STANDARD · after 80 | `SOCKETS_IN_MS`, `SOCKETS_AFTER_MS` | matches |
| `skeleton.tsx` `openLane` | open: a new lane, `scaleY(0)` on a bordered, rounded box | 200 · STANDARD | `LANE_OPEN_MS` | matches in time (Part 4 replaces the scale) |
| `skeleton.tsx` layer | fade: the skeleton in and out (CSS transition) | 120 in · 200 out · STANDARD | `SKELETON_IN`, `SKELETON_OUT` | matches |
| `listNest.tsx` `DragOverlay` | settle: the held copy drops into its place (dnd-kit) | 200 · STANDARD | `SETTLE_MS` | matches |
| `DetailsOverlay.tsx` | open: the phone's Details slides 16 in from the right and fades | 200 · STANDARD · 16 | none in `buildMotion.ts` (`BASE`) | no timing for this usage: reported |
| `referencePieces.tsx` `useSortable` | slide: a reference row while its group is sorted (dnd-kit's own transition) | 250 · `ease` · a row | none | no timing for this usage, and not `STANDARD`: reported (no part owns the reference windows) |
| `LoadingBlocks.tsx` | fade out: loading blocks | 200 · STANDARD | `BLOCKS_OUT_MS` | matches |
| `SourcesPanel.tsx` | fade: the + out, "In this draft" in | 120 · 160 · STANDARD | `PLUS_OUT_MS`, `WORDS_IN_MS` | matches |
| `PromptsPanel.tsx` | fade (CSS) | 150 · STANDARD | `FAST` | matches |
| `PostTab.tsx` | fade: lines and avatars dim round the focused one | `dimTransition()` | its own | matches |
| `MoreDetails.tsx` | slide: a switch's knob, 14 | 200 · STANDARD | `BASE` (`move()`) | matches |
| `OptionalSection.tsx` | turn: the chevron | 200 · STANDARD | `BASE` (CA-28) | matches |
| `SessionsPanel.tsx` | turn: the chevron | 200 · STANDARD | `BASE` (`move()`) | matches |

Counts: matches 29 · off the scale for its usage 3 (the slide, which Part 5 changes; the selection bar's and the notice's leaving, which
no part owns and are reported) · no timing for its usage 3 (`grow`, which Part 4 removes; Details on a phone; the reference rows'
dnd-kit transition). No delay is set on anything that leaves.
