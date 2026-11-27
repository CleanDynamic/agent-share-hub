# Mobile follow-up (after 29): feed posts at X's proportions, and the beaver pull to refresh

You are working in the OpenBuilds repository (`src/`, React 18, Vite, TypeScript, Supabase). This prompt continues the **Synth draft brand pack** series (prompts 01 to 16, already applied) with the **phone version**: every screen below 768px, as drawn in the Synth mobile brand pack (390 wide boards). It takes the look of Spotify's mobile app (shades of surface, no lines, shelves that scroll sideways, bold filled icons on the current tab) and the structure of X's (avatar left, logo centre, one action right, underlined tabs, a round post button, a five-slot bottom bar), using only what the repo already does. Do the work now. Do not ask questions; where this prompt is silent, keep what prompts 01 to 16 and the code do today.

## Phone rules (every prompt in this part)

- **The phone view is below 768px**: `useIsPhone()` from `src/components/shell/useMinWidth.ts` (`max-width: 767px`) in components, `@media (max-width: 767px)` in CSS. **Nothing at 768 and up changes.** Wrap every change in the phone branch; where a component is shared, add a `phone` prop or branch inside it rather than changing its desktop output. Run the desktop screenshots again at 1440 and 1024 and confirm they are identical.
- **Width:** design at 390, check at 360 and 430. Side margin 16. Reading line at most 358.
- **Safe areas:** the top bar sits under `env(safe-area-inset-top)`; the bottom bar, sticky footers and sheets pad by `env(safe-area-inset-bottom)` (34 on the boards). Never draw a fake status bar.
- **Touch:** every target at least 44 by 44 (`TOUCH_MIN`, `touchHit()` in `src/lib/theme/controls.ts`), 8 between neighbours. No hover-only information: anything a tooltip says is visible or comes from a long press.
- **Surfaces on a phone:** the desktop's floating panels become sections on the Page shade. A panel's content keeps its inner layout but loses the panel box, except where this prompt asks for a Panel or Card module (`#121513` Panel, `#1B1F1C` Card, `#242925` Raised, radius 12). Still shades of surface, never lines.
- **Type on a phone:** 24/28 600 (tracking -0.02em) only for a visible page title; 20/24 600 (tracking -0.01em) for section heads that state the fact; 17/22 600 for the top bar title and sheet titles; 15/20 for body, rows and post text; 13/16 for meta, labels and pills; mono 13 or 15 for numbers. Geist Serif 400 stays only for works (a build's title).
- **Motion on a phone** (from `src/lib/theme/motion.ts`): a sheet slides up in BASE (200) on STANDARD and down in FAST (150); a pushed page enters from the right in BASE; the drawer slides from the left in BASE; the scrim fades in FAST. Reduced motion swaps every slide for a fade of the same length. Nothing animates a layout property.
- **Icons on a phone** come from the mobile icon set in prompt 18 (`MobileIcon`). Lucide stays on desktop.

## When to run this

After the phone prompts (17 to 29 and their follow-ups, including 20a) are merged, and before the iOS and Android prompts (30 onwards). It changes Home's feed posts to X's proportions on the phone and on desktop, removes the new-posts pill on the phone, and adds a pull to refresh on the phone Home where the beaver in the top bar dunks into the water while the feed refreshes. Read the merged Home, feed post and top bar code first and change that.

## Part A: feed posts at X's proportions

One build post component serves desktop and the phone (prompt 06a made it); change its measurements, not its structure. Values below are CSS px; "phone" means below 768px.

| | Phone | Desktop (the 600 centre column) |
|---|---|---|
| Post padding | 12 top, 16 right, 12 bottom, 12 left | 12 top, 16 right, 12 bottom, 16 left |
| Avatar | 48, radius 11 | 40, radius 9 |
| Avatar to text | 8 (text starts 68 from the screen edge) | 8 (text starts 64 from the column edge) |
| Author row | 17/22: name 700 Text, then "@handle · age" Text 3, cut with an ellipsis; More at the right in a 22 box with a 44 hit area | 15/20, the same layout; More in a 20 box with a 32 hit area |
| Post text | 17/22, Text | 15/20, Text |
| Text to pictures | 12 | 12 |
| Pictures | radius 14, 2 apart; two to four pictures in one 16:9 box (two side by side; three as one tall left and two stacked right; four as two by two); one picture at its own ratio between 16:9 and 4:5 | radius 16, the same rules |
| "Rebuilt from" Card (rebuilds) | 12 above, padding 14, radius 14, Card fill: "Rebuilt from" 13 Text 3; a row with a 20 avatar (radius 5), the source's maker 700 and "@handle · age" Text 3; the source's name in Geist Serif at the post text size; the source's first picture 14 below, radius 10 | 12 above, padding 12, radius 16, the same content, picture radius 12 |
| Build line | 12 above, 13/16: the build's name 500 as a link, its facts Text 2 | the same |
| Actions | 12 above, a 20 tall row, icons 20, counts mono 15 Text 3, each button with a 44 hit area (negative margins so the row stays 20) | 12 above, a 20 row, icons 19, counts mono 13, 32 hit areas |
| Action positions | Comment at 0, Rebuild at 20.7%, Like at 42% of the text column, Save at its right edge (X's reply, repost, like and bookmark positions; there is no views count) | Comment 0, Rebuild 22.5%, Like 45.3%, Save at the right edge |
| Between posts | 24 of space (the two paddings), no line | the same |

- Topics in the feed use the same grid and sizes: the lead line in the post text size at 600, the text in Text 2, actions Like, Reply, Save at Comment's, Rebuild's and Save's positions.
- **Threads** (prompt 06a and 20): "Show more · 2 more posts" sits **under the pictures**, above the build line and actions, at the post text size in Text 3 with a 44 hit area on the phone (32 on desktop) and 12 above it. Opened, the following posts show no avatar or author row, start 24 below the previous post's last element, and keep the connector (2px, radius 1) in the avatar column, centred on the avatar (24 from the post's left padding on the phone, 20 on desktop), with a 10 node per post. The build line and actions appear once, under the last visible post.
- Keep the rounded square avatars and the no-lines rule: these are the two places Home differs from X on purpose.

## Part B: remove the new-posts pill on the phone

On the phone Home, remove "3 new since you looked" in both its forms (in the flow above the first post, and floating under the tabs with avatars). New posts arrive with the pull to refresh in Part C. Keep the repo's count of new posts (the logic that fed the pill) and use it for Part C's announcement. Desktop keeps the pill as it is, since desktop has no pull to refresh.

## Part C: pull to refresh with the beaver (phone Home)

This replaces prompt 34's and 40's dot ring on Home only; the other screens keep theirs. It runs on the phone web and inside the iOS and Android apps. The animation plays 16 drawn frames of the beaver dunking and resurfacing, blended so the motion is continuous. The reference implementation is in the appendix; port it to TypeScript as it is, keeping every number.

1. **Assets.** Add `public/brand/beaver-frames.webp` (the 16-frame atlas the owner supplies: 4 x 4 cells of 384 x 345 px on a transparent background, every frame aligned to one waterline at y 196.5 and one content box starting at x 20.25, 339 wide). Preload it on Home after the first paint (`<link rel="preload" as="image">` is not needed; an `Image()` created in an idle callback is enough). If it has not loaded when a pull starts, the refresh still works and the logo pulses as in reduced motion.
2. **Parts** (`src/components/feed/beaverFrames.ts` for the engine, `src/components/feed/PullToRefresh.tsx` for the gesture and the canvas, used by the phone Home only):
   - a canvas over the top of the screen (full width, 320 tall, `pointer-events: none`, `aria-hidden`, above the top bar and the feed), sized for `devicePixelRatio` up to 2;
   - the top bar's logo `<img>` stays as the resting state; the engine fades it out as the frames fade in while the logo grows, and back at the end;
   - the tabs move with the feed, so the pull opens space directly under the top bar.
3. **Choreography**, one `requestAnimationFrame` loop, no CSS transitions:
   - **Pull:** `offset = 125 × (1 − e^(−drag / 170))`; the logo grows to 2.35× and moves into the opened space (`smoothstep(offset / 80)`), handing over from the logo image to the frames over the first 15% of that growth; frames 1 to 4 follow the finger (frame index `3 × smoothstep(offset / 80)`).
   - **Dive** (released at or past 80): the feed eases to 112 over 200ms and holds; frames 4 to 9 play over 380ms (`index = start + (8 − start) × x^1.25`).
   - **Under:** frames 9 to 11 loop smoothly (`index = 8 + (1 − cos(2π t / 0.8))`) until the refetch settles, at least 350ms.
   - **Rise and return together:** from the loop's upper half, over 650ms with one `easeInOutCubic` curve, the frames play to 16 **while the feed moves back up from 112 to 0 in step with the beaver**, and the logo shrinks back into its exact top bar place as it rises (size and place follow the offset). The frames hand back to the logo image over the last part of the shrink. There is no separate return step and no pause: the feed starts closing the moment the beaver starts coming up.
   - **Released before 80:** everything returns over 200ms ease-out.
   - Between frames, the two neighbouring frames are drawn with `globalCompositeOperation = "lighter"` at `1 − fraction` and `fraction`, a linear blend on the dark background.
4. **Gesture:** starts only at the very top of the feed with no sheet open, on a downward move; `touchmove` is non-passive and calls `preventDefault` only while a pull is in progress; `overscroll-behavior-y: none` on the page while Home is shown. In the app, one light haptic the first time the pull crosses 80 and a success haptic when frame 13 is reached (the head breaks the surface).
5. **Data:** on release past 80, refetch Home's feed query and the new-posts count through React Query and call `done()` when it settles. If it fails or takes more than 10 seconds, call `done()` anyway and, after the return, show the repo's failed toast with "Try again".
6. **Performance:** the loop runs only while pulling or animating; at most two `drawImage` calls a frame.
7. **Accessibility:**
   - a polite live region says "Refreshing" when it starts and the repo's count when it ends;
   - a "Refresh" button for keyboard and screen reader users (new wording), visually hidden until focused, first in the feed;
   - with reduced motion on there is no canvas: the feed does not follow the finger (a pull past 150px still refreshes) and the logo's opacity pulses between 1 and 0.45 while refreshing.
8. **With prompt 20's hiding bars:** a pull only happens at the top, where the bars are always shown; they never hide during a pull or a refresh.

## Part D: tests

Unit tests for `PullToRefresh` (does nothing unless at the top; offset follows the formula; arms at 80; returns below it; refreshes, stays under at least 350ms, returns; the failed path; the live region text; the Refresh button; reduced motion) with the query and the canvas mocked, and for the engine (offset and frame index at given times with a fake clock; the img is hidden while running and shown at rest; the loop stops at rest). An e2e test on the phone viewport that drags the feed down past 80 with mocked new posts (prompt 20a's fixtures) and sees them at the top. Update the feed post tests for the new sizes.

## What must not change

This is a visual restyle. Every behaviour stays exactly as it is:
- Routes, address parameters (`?tab=`, `?kind=`, `?view=`, `?signin=` and the rest), redirects, prefetching and the route table.
- Data reads and writes, query keys, optimistic updates and their rollbacks, toasts and their wording (unless this prompt gives new wording), live channels, autosave, undo and redo, drag and drop, keyboard shortcuts.
- Accessible names, roles, focus order, focus handling on arrival (`PageArrival`, `FocusRescue`, the h1 focus), live regions and announcers.
- Page states (`PageState`): loading, empty, failed with "Try again", signed out. Their copy stays unless this prompt changes it.
- Tests: run the tests for every file you touch. Where a test asserts an old colour, size, radius, font or string that this prompt replaces, update the test to the new value in the same change. Never delete a test to make it pass, and never weaken one that checks behaviour.

Remove from the interface (leave the database, API and backend untouched):
- Everything about reproductions and runs: "Reproduced", "ran your build", run counts, "confirmed", "stale", plaques, lamps, "Re-confirm it still works", "I ran this", reproduction notes, the Reproduced lens, the Notes filter, run challenges, "Where next" built from runs.
- XP everywhere: levels, XP figures and bars, XP rewards and toasts, the XP reset note, leaderboards ranked by XP, and any text about earning XP.
- Tool and harness marks and logos beside names, sessions and facts. Model and tool names may stay as plain text where a field asks for them (a session's harness and model, a tool tile's app, the Connect page).

## Words on screen

- **Headings state the fact.** A section is headed by what it holds: "36 drafts", "8 sessions", "2 published builds", "3 open in your spaces". No label-style heading with the fact underneath, and no subtitle that restates or explains the heading.
- **No repetition.** One word, one place, one meaning per screen. The current nav item already names the page, so on Home, Builds, OpenBuilds and Library the page's h1 is visually hidden (screen readers only, class `sr-only`). A section head never repeats the page title; a tab, button or meta line never repeats the heading above it; a row never says the same thing twice (no "@kit rebuilt" above a "Rebuilt from" box).
- **Posts have no titles.** A feed post is: author row, the post text, pictures, then the build line (the build's name as a 13/500 link with its facts).
- Plain, directional language. No em dashes anywhere in the interface. No exclamation marks.
- Facts are plain text joined by " · ", never chips: "Web app · Made with AI · No coding" (What was built · Role of AI · Skill needed, from `src/lib/classify/lines.ts`, without the stack).

## Check before you finish

- Phone Home at 390 and desktop Home at 1440 measure as the table in Part A (check with Playwright bounding boxes: avatar, text start, the gaps, action positions).
- "Show more · 2 more posts" sits under the pictures; opening a thread follows Part A.
- No "3 new since you looked" on the phone Home; desktop still has it.
- At rest the canvas is empty and the logo `<img>` is shown; mid-animation screenshots at pull, dive, under, rise and return match the reference board.
- On an iPhone in Safari and in an Android phone's Chrome, and in both apps if built: pulling sinks the beaver, releasing past the arm point refreshes with the rings, the beaver rises back into the logo, new posts appear at the top; pulling while scrolled down just scrolls.
- With reduced motion on, nothing moves and the logo pulses while refreshing.
- Screenshot every screen this prompt touches at 390 and 360 wide, in dark and light, and the same routes at 1440 to show the desktop did not change.
- `npm run lint` and `npm test` pass. `npx tsc --noEmit` passes. Run the phone e2e projects if the repo has them.
- Search the files you touched for `#` colour literals, `px` font sizes and durations that are not from the tokens and motion modules, and replace them.
- Search the touched files for the removed words (reproduc, run this week, confirmed, stale, plaque, lamp) and for em dashes, and remove what renders.
- Write a short note at the end of your reply: what you changed, which tests you updated and why, and anything you could not do.


## Appendix: reference engine (port to TypeScript, keep every number)

```js
// Beaver dunk from 16 drawn frames: pull-to-refresh animation.
// makeBeaver(canvas, logoImg, atlasImg, geo, hooks) -> { pull(dragPx), release() -> armed, done(), busy(), destroy() }
// atlas: 4 x 4 frames, each CELL_W x CELL_H, all aligned to one waterline (WL_Y) and one content box (CONTENT_X, CONTENT_W).
// geo: { cx, cy, w, barBottom, width, height } in CSS px relative to the canvas; hooks: { offset(px) }
function makeBeaver(cv, img, atlas, geo, hooks) {
  var ARM = 80, MAX = 125, HOLD = 112, KMAX = 2.35, LOGO_WL = 0.62;
  var CELL_W = 384, CELL_H = 345, WL_Y = 196.5, CONTENT_X = 20.25, CONTENT_W = 339;
  var T_DIVE = 0.38, T_LOOP = 0.8, T_MIN_UNDER = 0.35, T_RISE = 0.65, T_BACK = 0.2;
  var ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(geo.width * dpr); cv.height = Math.round(geo.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingQuality = "high";
  var aspect = img.naturalHeight / img.naturalWidth;
  var mode = "idle", t = 0, mt = 0, last = 0, raf = 0, offset = 0, off0 = 0, f = 0, f0 = 0, doneAt = -1, underFrom = 0;
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  var eOut = function (x) { return 1 - Math.pow(1 - x, 3); };
  var eIO = function (x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  function geom() {
    var pp = clamp(offset / ARM, 0, 1), e = smooth(pp), k = 1 + (KMAX - 1) * e;
    var cy = geo.cy + (geo.barBottom + offset * 0.56 - geo.cy) * e, w = geo.w * k, h = w * aspect;
    return { pp: pp, k: k, w: w, left: geo.cx - w / 2, yW: cy - h / 2 + LOGO_WL * h, kf: (k - 1) / (KMAX - 1) };
  }
  function cell(n, a, g) {                            // draw frame n (0 to 15) at alpha a, fitted to the logo
    if (a <= 0.003) return;
    var s = g.w / CONTENT_W, sx = (n % 4) * CELL_W, sy = Math.floor(n / 4) * CELL_H;
    ctx.globalAlpha = a > 1 ? 1 : a;
    ctx.drawImage(atlas, sx, sy, CELL_W, CELL_H, g.left - CONTENT_X * s, g.yW - WL_Y * s, CELL_W * s, CELL_H * s);
  }
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; t += dt; mt += dt;
    if (mode === "pull") f = 3 * smooth(clamp(offset / ARM, 0, 1));                       // frames 1 to 4 follow the finger
    else if (mode === "back") { var xb = clamp(mt / T_BACK, 0, 1); offset = off0 * (1 - eOut(xb)); f = 3 * smooth(clamp(offset / ARM, 0, 1)); if (xb >= 1) return end(); }
    else if (mode === "dive") {                                                            // frames 4 to 9: the dunk
      var xd = clamp(mt / T_DIVE, 0, 1); offset = off0 + (HOLD - off0) * eOut(clamp(mt / 0.2, 0, 1));
      f = f0 + (8 - f0) * Math.pow(xd, 1.25);
      if (xd >= 1) { mode = "under"; mt = 0; underFrom = t; }
    }
    else if (mode === "under") {                                                           // frames 9 to 11 loop while loading
      offset = HOLD; f = 8 + (1 - Math.cos(mt / T_LOOP * 6.2832)) * 1.0;
      if (doneAt >= 0 && t - underFrom > T_MIN_UNDER && f > 9.6) { mode = "rise"; mt = 0; f0 = f; }
    }
    else if (mode === "rise") {                                                            // frames 11 to 16: back up, while the feed closes and the logo shrinks home
      var xr = clamp(mt / T_RISE, 0, 1), er = eIO(xr);
      offset = HOLD * (1 - er);                      // the feed closes as the beaver rises, in step with it
      f = f0 + (15 - f0) * er;
      if (xr >= 1) return end();
    }
    hooks.offset(offset);
    var g = geom(), fade = clamp(g.kf / 0.15, 0, 1);
    img.style.opacity = String(1 - fade);                                                  // the logo hands over to the frames as it grows
    ctx.clearRect(0, 0, geo.width, geo.height);
    var lo = Math.floor(f), fr = f - lo, hi = Math.min(15, lo + 1);
    ctx.globalCompositeOperation = "lighter";                                              // linear blend between neighbouring frames
    cell(lo, (1 - fr) * fade, g); if (fr > 0.003) cell(hi, fr * fade, g);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
  function end() {
    mode = "idle"; offset = 0; f = 0; doneAt = -1; hooks.offset(0); img.style.opacity = "1";
    ctx.clearRect(0, 0, geo.width, geo.height); cancelAnimationFrame(raf); raf = 0;
  }
  return {
    busy: function () { return mode !== "idle" && mode !== "pull"; },
    pull: function (drag) { if (mode !== "idle" && mode !== "pull") return; mode = "pull"; offset = MAX * (1 - Math.exp(-Math.max(0, drag) / 170)); run(); },
    release: function () {
      if (mode !== "pull") return false;
      off0 = offset; f0 = f; mt = 0;
      if (offset >= ARM) { mode = "dive"; doneAt = -1; return true; }
      mode = "back"; return false;
    },
    done: function () { doneAt = t; },
    destroy: function () { cancelAnimationFrame(raf); raf = 0; img.style.opacity = "1"; }
  };
}

```
