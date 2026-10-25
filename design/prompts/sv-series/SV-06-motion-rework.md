# SV-06 · Motion rework: one animator, smooth and measured

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-05, before SV-07. SV-07 and SV-18 (Add from Library) use the animator this prompt builds. This prompt reuses SV-04's frame tools (`e2e/audit/support/frames.ts`) and leaves SV-04's page fade alone: it covers motion inside the build page only. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `sv-06-motion-rework`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-06 motion rework` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`, before CA-28 to SV-05 merged. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists at the top of `design/audits/composer/sv-06/before.md`:
  - `Assumptions`: each fact in "Why" that you checked, and what you found;
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test or audit number`.
- **Reproduce first.** For every cause, write the test or audit moment that shows it, watch it fail, then fix it.
- **A missing premise is reported, not fixed.** If a cause listed here isn't there on disk, don't build a fix for it. Say so and move on.
- **Build only what has a caller.** The animator supports the change kinds and plans some action uses today. Nothing is added for a case no code sends.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for SV-26; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. Use the dev pages.

## Why

The motion from CA-21 and CA-22 looks clunky on the site: things snap, stutter, or slide and then jump. A review of the code found these causes.

1. **Five players animate the same list, and each one cancels the others.**
   - The players are:
     - `arrival.tsx` (around line 216);
     - the CA-22 director (`useFlip` in `buildMotion.tsx`, used by `buildDirector.tsx`);
     - `foldMotion.tsx` (around line 134);
     - `useBuildSorting.ts`'s drag (around line 458);
     - `useBuildSorting.ts`'s "any other change of order" (around line 477).
   - Each calls `play()` in `flip.ts` (line 72), and `play()` starts with `settle(root)` (defined at line 37), which cancels every slide in the list.
   - When two react to one change, the last wins and the other's items snap.
2. **Whether a change animates depends on a timer.** `src/lib/build/motionIntent.ts` keeps one module-level intent that expires after 8 seconds (`INTENT_FRESH_MS`). The director reads it and spends it while rendering. Adds and imports bypass the director (`mine` is false while `arriving` is set) and only get `arrival.tsx`'s motion.
3. **Sequences run on timers,** not on the animations they follow: `later(...)` in `buildDirector.tsx`, `mapMorph.tsx`, `arrival.tsx` and `editHandlers.ts` and a bare `window.setTimeout` in `foldMotion.tsx` (line 137). When the main thread is busy, the steps drift. `arrival.tsx` assumes every smooth scroll takes 450 ms.
4. **Layout is read during render.** `useBuildSorting.ts` calls `snapshot()` while rendering when the order signature changes. The director calls `getRoot()`, `peekIntent()` and `spendIntent()` while rendering.
5. **Dragging measures everything on every pointer event.** `decide()` runs per `pointermove`, not per frame. It reads `getBoundingClientRect` and `getComputedStyle` (`naturalBox`, `slidBy`) for every part, session and tile.
6. **Some motion isn't on the compositor.**
   - `clip-path` is animated in `buildMotion.tsx` (line 156, `grow()` and `openClip()`) and in `flip.ts` (line 65). The map's lines animate `stroke-dashoffset` (`mapMorph.tsx`, line 84). These repaint on the main thread every frame.
   - `flip.ts` (line 58, the slide) and `buildMotion.tsx` (line 171, `slideOut()`) use `scale` on bordered, rounded boxes (the lanes), which stretches their borders and corners mid-slide.
7. **Every slide is 150 ms whatever its distance** (`SLIDE_MS = FAST`), so a long move reads as a jump.
8. **Scrolling fights the maker.** `scrollToMiddle()` and `scrollIntoView` don't stop when the maker scrolls.
9. **The tests can't see any of this.** They run in jsdom, with no layout and no real animation.

## The one rule: nothing looks different at rest

- Every component looks exactly as it does now when nothing is moving.
- The motion vocabulary stays the same:
  - slide, drop, lift, outline once, crossfade, fold, the map morph;
  - their timings, except slide duration (Part 5);
  - reduced motion.
- What changes is how motion is run: from one place, without cancelling itself, on the compositor, measured.
- SV-04's page change (the view transition fade, the progress line, scroll on Back) is outside this prompt. Leave it as it is.

## House rules

- Inline styles through `t`. Add every changed file to `src/lib/theme/lookRules.test.ts`.
- No new dependency. Sentence case, no em dashes.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `rerender-no-inline-components`, `rerender-use-ref-transient-values`, `js-batch-dom-css`, `client-passive-event-listeners`, `advanced-effect-event-deps`, `rendering-content-visibility`. React is 19.2, so `useEffectEvent` is available. Install no package a rule names.
- **No memo for speed** (`memo`, `useMemo`, `useCallback`) unless a React Profiler or Chrome trace of the moment shows the render as the cost. Put the trace's finding in the report. React Compiler isn't installed, so the skill's note about it doesn't apply.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

## Motion limits

- `src/lib/theme/motion.ts` gains no new duration. Build page timings live in `src/lib/build/buildMotion.ts`.
- One curve for every entry, exit and move: `STANDARD`. No ease-in, no spring, no overshoot.
- `STAGGER`, `STAGGER_CAP`, `PROMPT_STEP_MS` and every other timing in `buildMotion.ts` keep their values, except the slide and the stagger total (Part 5).
- No scale on press, no new hover look, no new stagger, no new shimmer, and no blur (`motion.test.ts` treats `filter` as a property that can't be composited).
- **Leaving is quicker than arriving.** A lift (`LIFT`, 200) stays shorter than a drop (`DROP`, 240). Nothing that leaves, closes or goes away gets a delay. A delay is only for stagger and for sequencing one step after another.
- **Judge a value by what it does.** A value is wrong when it doesn't fit its usage, never because it is near another number.
- `motion.test.ts` rules hold: transform and opacity only (Part 4 lists the only exception), no `transition: all`, no ease-in.
- After the audit passes, watch each after video beside its before. If a moment now draws the eye to itself (it moves further, longer or more often than before), cut it back and say so in the report. This is reported; only the measured thresholds fail the script.

---

## Part 0 · Read first, then measure

1. **Read:**
   - `src/lib/build/buildMotion.ts` and `motionIntent.ts`;
   - in `src/pages/site/compose/`: `flip.ts` (its `settle`, which cancels slides), `buildMotion.tsx`, `buildDirector.tsx`, `foldMotion.tsx`, `mapMorph.tsx`, `arrival.tsx`, `editHandlers.ts`, `useBuildSorting.ts`, `listNest.tsx`, `skeleton.tsx`, and `largeBuild.tsx` (windowed tiles, and a second `settle`: a per-frame scroll hold after a jump that already stops when the maker scrolls; not the same function as `flip.ts`'s);
   - where `BuildList.tsx` uses each of these, and the CA-22 dev page `src/pages/dev/MotionDemo.tsx` with its fixture `src/dev/fixtures/ca22.ts`;
   - SV-05's number crossfade, which this prompt routes through the animator.
   - **Remounts** (`rerender-no-inline-components`): list every component defined inside another component in `BuildList.tsx`, `SandboxPage.tsx` and the files the list draws, and every `key` that changes when it shouldn't. A remounted element loses its running animation, so it snaps whatever the animator does. Add any found to "Why" in the plan. Part 1 moves them out.
2. **Write a real-browser motion audit:** `e2e/audit/motion.spec.ts` under `playwright.audit.config.ts`, run by a new script `npm run audit:motion`. Build it on SV-04's `e2e/audit/support/frames.ts` (the frame sampler, long tasks, per-frame boxes) and add what is missing there, such as the cancelled-animation counter, so both audits share one set of tools. On the dev pages (MotionDemo, `?build=ca21`, `?build=references`), it plays:
   - each of CA-22's sixteen moments;
   - a tile drag across two sessions;
   - a session drag into another part;
   - an import arriving (CA-21 Part 7);
   - fold and unfold;
   - Collapse all;
   - List to Map and back;
   - remove and Undo;
   - Go to it from a post link.
3. **For each moment, record in the page:**
   - **frame gaps:** a `requestAnimationFrame` sampler, counting gaps over 25 ms;
   - **long tasks** over 50 ms (`PerformanceObserver`, type `longtask`);
   - **cancelled animations:** wrap `Element.prototype.animate` to count animations cancelled before they finish without being continued from where they were;
   - **the largest one-frame jump:** for every `[data-slide-id]` element, its position each frame; report the largest single-frame move as a share of its whole travel;
   - **click to first frame:** the time from the input event to the first frame where anything changed.
4. **Run it at 1440 in Dusk** and save the numbers as a table in `design/audits/composer/sv-06/before.md`, under the `Assumptions` and `Plan` lists. Add a column, `what the eye sees`, with one precise line per moment, for example `lane corners stretch mid-slide` or `tiles snap when the import lands`. Save a Playwright video of each moment into `design/audits/composer/sv-06/before/`.
5. **A motion inventory by usage.** List every `animate()` call and CSS transition in `src/pages/site/compose/` with: what it does (slide, drop, lift, outline, crossfade, fold, open, close, hover), its duration, curve and distance, any delay, and the `buildMotion.ts` timing for that usage. Mark each `matches`, `off the scale for its usage`, or `no timing for this usage`. Judge by what the motion does, never by the nearest number. Change only the `off the scale` ones, in the part that owns them, and report the `no timing` ones. A delay on anything that leaves is `off the scale`.

Commit: `SV-06 P0: motion audit, baseline and plan`.

## Part 1 · One list animator

1. **New module `src/pages/site/compose/listMotion.ts`** with one hook, `useListMotion(rootRef)`, owned by `BuildList`. It is the only thing that animates elements in the build list.
2. **Measure before the DOM changes, in the commit.** Add a small class component, `MotionBoundary`, around the list. Its `getSnapshotBeforeUpdate` records every `[data-slide-id]` element's **visual** box: where it is drawn, including any running transform. Its `componentDidUpdate` measures again and hands both to the animator. No position is read while rendering.
   - **Measuring must not undo the windowing.** `largeBuild.tsx` draws a session's tiles with `content-visibility: auto`, so the browser skips laying out tiles off screen. `MotionBoundary` measures only elements that are drawn: a skipped session is measured as one box, never tile by tile, because reading a skipped tile's box forces it to lay out.
   - All reads in one pass, then all writes (`js-batch-dom-css`).
3. **Remounts found in Part 0** are moved out, so the element survives the commit and its animation can continue.
4. **One plan per commit.** For each element, choose one of:
   - **slide:** it was there and is now somewhere else;
   - **drop:** it is new;
   - **lift:** it is going; the leaving copy is held as `useLeaving` does now;
   - **outline once:** it is the thing that moved, or was found;
   - **crossfade:** its words changed (including SV-05's number crossfade).
   The other modules stop playing anything themselves. They tell the animator what kind of change is coming (Part 2) and anything special: fold, a copy coming out from under its original, the map morph.
5. **Never cancel, always continue.** If an element is already moving when a new plan arrives, its new slide starts from where it is drawn at that moment and goes to its new place. "Where it is drawn" is read in `getSnapshotBeforeUpdate` from the element's running animations (`getAnimations()`) and its computed transform, never from its target box. Remove `settle(root)` from `play()`, and remove every other cancel of another module's animation. `finishSlides` stays only for the animator's own use, and for reduced motion.
6. **Route every player through it:** `arrival.tsx`, the director, `foldMotion.tsx`, the sorting drag and settle, the "any other change of order" watcher, and SV-05's number crossfade. Afterwards `flip.ts` exports only measuring helpers, and only `listMotion.ts` calls `element.animate` in the list. The map morph's flying copies and the notice stay where they are, outside the list.

**Tests (jsdom, with `animate` stubbed):** two changes in one commit make one plan; a change during a slide continues from the drawn position (the stub reports a running transform, and the new slide starts from it); no module other than `listMotion.ts` calls `animate` on list elements (a static check over the source); `play` no longer cancels; no skipped tile is measured (spy on `getBoundingClientRect` over a windowed build); each remount found in Part 0 no longer happens on the change that caused it.

Commit: `SV-06 P1: one list animator`.

## Part 2 · Changes carry their own label

1. **Replace the module-level intent** (`motionIntent.ts`, `INTENT_FRESH_MS`) with a label the action hands to the animator:
   - `motion.expect({ kind, keys })`, where `keys` are the tiles, sessions or parts the action touches;
   - `kind` is one of the kinds some action sends today. `MotionKind` now lists remove, clear, duplicate, convert, merge, split, add, change, move, part, undo, redo and restore. Keep a kind only if a caller sends it; list any you dropped. Keep `duplicate` and `add` whatever the count today: SV-18 (Add from Library) inserts with them, and SV-21 adds sessions and ghost rows with `add`;
   - the animator uses the label on the first commit that contains those keys;
   - it is spent when used, never by time.
   - A change with no label still slides plainly. It never snaps.
2. **Imports and new sessions are labelled too** (`add`). The arrival sequence (lane, sockets, falling prompts) becomes a plan the animator plays, not a separate player.
3. **No reading or spending while rendering:** `peekIntent`, `spendIntent`, `getRoot()` decisions and the sorting snapshot all move to effects or to `MotionBoundary`.

**Tests:** a labelled remove lifts then slides; an unlabelled change slides; a label waits for a slow write (5 s) and is still used; a label for keys that never arrive is dropped when the next labelled action starts; nothing is read in render (spy on `getBoundingClientRect` during render).

Commit: `SV-06 P2: labels travel with the change`.

## Part 3 · Sequences follow the animations

1. **Replace every timer chain** (`later(...)` in `buildDirector.tsx`, `mapMorph.tsx`, `arrival.tsx` and `editHandlers.ts`, the `setTimeout` in `foldMotion.tsx`, and any in `useLeaving`) with steps that wait on the previous step's `animation.finished` (the `MotionRun.finished` that exists). A `later` in `editHandlers.ts` that isn't motion stays; say which.
   - An interrupted step resolves at once and the next starts from where things are.
   - The skeleton fades when the slides it frames have finished, not after a fixed time.
2. **Scrolling then opening** (an arrival off screen) waits for the scroll to end (`scrollend`, or the position unchanged for two frames), not 450 ms.
3. **A hard cap of 1.2 s** per sequence. Past it, everything goes to its end state.

**Tests:** with the main thread blocked 300 ms mid-sequence, the steps still happen in order; an interrupted sequence ends in the right end state; the skeleton never fades before its slides end.

Commit: `SV-06 P3: sequences follow the animations`.

## Part 4 · Only the compositor

1. **No `clip-path` animation** (`buildMotion.tsx` line 156, `flip.ts` line 65):
   - **A thing that grows** (a tile that took a nested row, a converted tile) shows its new part by sliding: the content below its old height drops in from `DROP_FALL` above with opacity, while the box takes its new size at once behind it. Things below slide by the difference.
   - **A part's frame that opens** is drawn as three pieces: the top edge with the head, the sides, and a separate bottom edge. The bottom edge slides down to its place while the sessions drop in. The sides grow with a `scaleY` on a 1px line, which has no corners to stretch.
2. **No `scale` on bordered or rounded boxes** (`flip.ts` line 58, `buildMotion.tsx` line 171). Lanes and sockets change size the same way as part frames: the bottom edge slides. A lane's rounded corners never stretch. `slideOut` for a copy uses a translate and opacity only.
3. **The map's lines** may keep `stroke-dashoffset`. It is the one main-thread exception, and lines draw after the boxes land, when nothing else moves. Say so in the comment.
4. **`will-change: transform, opacity`** is set on an element only while it animates, and taken off when it ends.

**Tests:** a static check that no `animate()` call in `src/pages/site/compose` uses `clipPath`, `strokeDasharray` (other than the map's lines), `height`, `width`, `top`, `left` or `scale` on an element with a border radius; `will-change` is gone at rest.

Commit: `SV-06 P4: compositor only`.

## Part 5 · Duration by distance, stagger by count

1. **In `buildMotion.ts`:**

   ```ts
   export const SLIDE_MIN = FAST;
   export const SLIDE_MAX = 300;
   export const slideMs = (distance: number) => Math.round(Math.min(SLIDE_MAX, Math.max(SLIDE_MIN, 150 + distance * 0.25)));
   ```

   Add a comment on `SLIDE_MAX`: `motion.ts` calls 200 ms the ceiling for UI feedback, and a slide goes past it because it carries something to its place rather than answering a click, as `DROP` (240) already does.
2. Everything that slides together in one plan shares one duration: the one for the longest distance in it. Drops, lifts, outlines and crossfades keep their timings.
3. Reduced motion is unchanged: nothing moves.
4. **A fixed stagger total** (decided by Miles). Today each prompt in an arrival falls `PROMPT_STEP_MS` (110) after the one before, up to the 8th (`arrival.tsx:184`), so the 8th starts 770 ms after the first; a list stagger is `STAGGER` (60) per item up to `STAGGER_CAP` (12), 660 ms. A cascade should finish its spread in about 300 ms. Small sets keep today's spacing exactly; bigger sets close the gap so the spread never grows:

   ```ts
   /** The longest spread from the first prompt's start to the last's: today's spacing for up to 4 prompts. */
   export const PROMPT_SPREAD_MAX = PROMPT_STEP_MS * 3;
   /** The longest spread for a list stagger: today's spacing for up to 6 items. */
   export const STAGGER_SPREAD_MAX = STAGGER * 5;
   export const staggerStep = (count: number, step: number, spreadMax: number) =>
     count < 2 ? 0 : Math.min(step, Math.floor(spreadMax / (count - 1)));
   ```

   - `arrival.tsx` places prompt `n` of `count` at `first + n * staggerStep(count, PROMPT_STEP_MS, PROMPT_SPREAD_MAX)`, and `promptStart` takes the count the same way.
   - `staggerDelay`, `dropIn`, `liftOut` and `liftSpan` (`buildMotion.tsx`) use `staggerStep(count, STAGGER, STAGGER_SPREAD_MAX)` in place of the `STAGGER_CAP` cap.
   - `STAGGERED_PROMPTS` and `STAGGER_CAP` go once nothing reads them. Their comments' promise ("under a second") is kept by the new spread.

**Tests:** 0 px is 150, 200 px is 200, 600 px is 300; one plan, one duration; 2 to 4 prompts keep 110 ms apart; 8 and 18 prompts start within 330 ms of the first; 2 to 6 list items keep 60 ms apart; 12 and 40 items spread over no more than 300 ms; one item has no stagger.

Commit: `SV-06 P5: duration by distance, stagger by count`.

## Part 6 · Dragging once per frame

1. `pointermove` only stores the pointer, in a ref, not in state (`rerender-use-ref-transient-values`). `decide()` runs at most once per animation frame, from `requestAnimationFrame`, and does all its reads before any write.
2. **Listeners are passive** (`client-passive-event-listeners`) unless they call `preventDefault`. Each one that does says why in a comment. Listeners that read the latest props use `useEffectEvent` so they don't re-subscribe on every render (`advanced-effect-event-deps`).
3. **Positions come from a cache:**
   - taken when the drag starts, from `MotionBoundary`'s measure;
   - updated when a plan's slides finish;
   - the animator knows where each element is going, so nothing calls `getComputedStyle` or `getBoundingClientRect` per element per move;
   - `naturalBox` and `slidBy` go.
4. Scrolling while dragging offsets the cached positions by the scroll change. Nothing is measured again.

**Tests:** 200 pointer events in one frame run `decide` once; no layout read per move (spy); placement is unchanged from CA-21's tests; drag and scroll listeners are passive unless they call `preventDefault`.

Commit: `SV-06 P6: dragging once per frame`.

## Part 7 · Scrolling yields to the maker

1. **One scroll helper** for the build page (`scrollToMiddle`, `goToIt`, the arrival scroll and the jump tabs all use it). `largeBuild.tsx`'s `settle` already holds a jump in place frame by frame and stops on the maker's input; the helper reuses it for windowed builds rather than writing a second one. Scroll between pages stays with SV-04 Part 6.
   - it uses the browser's own smooth scroll (`window.scrollTo` with `behavior: "smooth"`; `index.css` keeps `scroll-behavior: auto`);
   - it stops the moment the maker scrolls, touches, presses a key or grabs the scrollbar;
   - it never starts within 300 ms of the maker's own scrolling.
2. It scrolls only when the target would be wholly off screen, by the least distance that brings it into view (or to the middle for Go to it).

**Tests:** a wheel event during a helper scroll stops it; no helper scroll starts during a user scroll; no scroll when the target is already visible.

Commit: `SV-06 P7: scrolling yields`.

## Part 8 · Screens and checks

1. **Run `npm run audit:motion` again** and save `design/audits/composer/sv-06/after.md`, with the before numbers beside the after ones. Thresholds, every one of which must pass:
   - no more than 1 frame gap over 25 ms per moment;
   - no long task over 50 ms while something moves;
   - zero animations cancelled without being continued;
   - no element moves more than 35% of its travel in one frame;
   - click to first frame at or under 100 ms.
   Make `npm run audit:motion` fail when a threshold fails.
   Also run `npm run audit:pages`: SV-03's request rounds and SV-04's page change checks still pass.
2. **Save a Playwright video of each moment** into `design/audits/composer/sv-06/after/`, the same moments as before, so Miles can watch them side by side. Watch them yourself first (Motion limits, last point), and check each `what the eye sees` line from Part 0 is gone.
3. **The stagger total.** Measure the time from click to the last prompt landing for an import of 1, 4, 8 and 18 prompts, before (Part 0) and after Part 5. After, an import of 8 and one of 18 land their last prompt at the same time as an import of 4, within one frame.
4. **At rest, nothing changed:** run `npm run audit:design -- --grep composer` and compare with SV-05's after shots.
5. Run `npm run audit:contrast`. Search the diff for the em dash character.

Commit: `SV-06 P8: screens and checks`.

---

## Report (end the session with exactly this)

```
SV-06 · motion rework
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N · contrast

P0 audit:motion added yes/no · moments measured N
P1 one animator yes/no · players routed through it: (list) · settle-cancel removed yes/no · remounts found and fixed: (list, or "none") · windowed tiles never measured one by one yes/no
P2 labels replace the timed intent yes/no · kinds kept: (list) · kinds dropped: (list) · imports and new sessions labelled yes/no · no layout reads in render yes/no
P3 timer chains replaced: (list of files) · timers left, and why: (list) · 1.2 s cap yes/no
P4 clip-path and scale gone from the list yes/no · exceptions left: (list)
P5 slideMs by distance yes/no · stagger spread fixed (330 ms prompts, 300 ms lists) yes/no
P6 decide once per frame yes/no · no per-move layout reads yes/no · listeners passive yes/no
P7 one scroll helper, yields to the maker yes/no
Before → after (per moment): frame gaps · long tasks · cancelled · largest one-frame jump · click to first frame · what the eye saw, gone yes/no
Thresholds all passing yes/no (list any that fail, with why)
Motion cut back after watching: (list, or "none")
Motion inventory: matches N · off the scale N (changed: list) · no timing for its usage N (list)
Click to last prompt landed, before → after (1 · 4 · 8 · 18 prompts): ms each
memo added: (each, with the trace finding, or "none")
Other audits: pages yes/no
At rest unchanged yes/no
Dead code seen: (list, or "none")
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly): watch the before and after videos in `design/audits/composer/sv-06/`, then merge the pull request and press Publish › Publish changes in Lovable. There are no database changes.
