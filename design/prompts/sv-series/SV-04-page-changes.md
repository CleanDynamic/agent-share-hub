# SV-04 · Smooth page changes across the whole site

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-03, before SV-05. This prompt uses SV-03's route table (`src/lib/routing/routeTable.ts`), its page-ready marks (`usePageReady`) and its page audit (`npm run audit:pages`). SV-06's motion audit reuses the frame tools this prompt adds, and every page prompt (SV-08 to SV-14) registers its `Placeholder` in the boundary this prompt builds. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Motion limits, Performance rules and Database rules apply, and where this prompt says more, this prompt wins. Pull main first. Lovable commits straight to main. Branch `sv-04-page-transitions`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-04 smooth page changes` at the end.

The facts here were checked on 25 October 2026, at `6b8fe912`, before SV-03. **The file on disk wins.** If something here does not match the code, follow the code, do the nearest correct thing, and list the difference in the report.

If the session runs short, stop at the end of a finished part with every test green, commit, and report which parts are left.

## How to work

- **Plan first.** End Part 0 by writing two short lists at the top of `design/audits/pages/sv-04-before.md`:
  - `Assumptions`: each fact in "What a page change looks like now" that you checked, and what you found, including what SV-03 left behind (did it build the kept cache, and `compose_open`?);
  - `Plan`: one line per part, `Part n: what changes -> verified by: which test or audit number`.
- **Measure, then build.** Part 1 alone may fix most of the tour. Run the audit after it. Part 2's waiting is built only for the steps that still fail. Say in the report what Part 1 fixed alone, and what Part 2 was built for.
- **Reproduce first.** For every fix, write the test that shows the problem, watch it fail, then fix it.
- **A missing premise is reported, not fixed.** If a cause can't be found, don't guess at a fix. Say so and move on.
- **Surgical.** Every changed line traces to a part of this prompt. Match the style around it. Remove what your own change leaves unused. Dead code you didn't create goes under `Dead code seen` in the report, for SV-26; don't delete it.
- **Questions.** Miles isn't watching the session. Where you would ask, take the safer reading, carry on, and put the question in the report.
- **The domain isn't live yet.** Don't fetch `https://buildgallery.ai`. The built bundle and the harness are the site.

## What a page change looks like now

From a screen recording of the site, measured frame by frame at 60 frames a second:

1. **Every page change happens in one frame.** The old page vanishes and a blank area or a placeholder takes its place in the next frame. Then the content pops in, often in two or three steps.
2. **Blank areas:**
   - `lazyPage` and the inline `Suspense` fallbacks in `App.tsx` are empty blocks 60vh tall (`<div style={{ minHeight: "60vh", background: "var(--bg)" }} />`);
   - Library showed one for 1.6 seconds.
3. **Opening a draft blanks the whole window, header included.**
   - `ComposeRoute`'s `FALLBACK` is `position: fixed; inset: 0` in the ground colour.
   - The composer route sits outside `Layout`, and draws its own `SiteFrame`, so the header is taken down and drawn again.
4. **Each page shows a different kind of placeholder,** and some show two in a row:
   - a small centred skeleton from `ProtectedRoute`;
   - then a blank block;
   - then the page's own skeleton.
5. **New build** first shows two lines of blocks in the corner, not the page shape (CA-24's `ComposeSkeleton`).
6. **Scroll** isn't kept: Back lands at the top of the page.

`BrowserRouter` (React Router 6.30) runs navigation as an urgent update, so React drops the old page at once when the new one suspends.

## The rules this prompt sets

- **The frame never moves.** The header, the footer and the dock are the same elements from the first page to the last, including the composer. Only the page area changes.
- **The old page stays until the new one is ready, for up to 800 ms.** Ready means its code is loaded and its first-screen data is in the cache (SV-03's route table).
  - Past 300 ms of waiting, a thin progress line shows under the header.
  - Past 800 ms, the new page's placeholder shows, in its final layout.
- **One change, one fade.** The page area crossfades over 150 ms (`FAST`, `STANDARD`), on the compositor. Nothing slides, scales or bounces.
- **Every click shows a change within 100 ms:** the clicked item takes its current state at once.
- **One placeholder per page,** the same one it shows while its data loads. A page never shows two different placeholders in a row.
- **Back and Forward** go back to where the reader was on that page.

## House rules

- Inline styles through `t`. Add every changed file to `src/lib/theme/lookRules.test.ts`.
- No new dependency. Sentence case, no em dashes.
- No component changes its look at rest.
- **Vercel rules.** If the `react-best-practices` skill (`vercel-labs/agent-skills`) is installed, follow these rule files: `async-suspense-boundaries`, `rerender-transitions`, `rendering-usetransition-loading`, `client-localstorage-schema`. Read them for a Vite app: `React.lazy` where they say `next/dynamic`, and no package they name. Ignore the `server-` and `rendering-hydration-` rules.
- Run `npm test`, `npx tsc --noEmit -p tsconfig.app.json` and `npm run lint` before every commit.

## Motion limits

The page fade and the progress line are the only motion this prompt adds.
- Use `src/lib/theme/motion.ts` (`FAST`, `STANDARD`). No new duration and no new curve.
- `STANDARD` for the outgoing page as well as the incoming one. No ease-in, no spring, no overshoot.
- The page change is the same both ways: old and new fade together over 150 ms. It is one reversible motion, not an open and a close.
- No blur, even where a reference recipe uses one. `motion.test.ts` treats `filter` as a property that can't be composited.
- Transform and opacity only. Never `transition: all`.
- No new hover, pressed or focus look, and no scale on press.
- No shimmer or pulse added to any placeholder; they keep the look they have.
- Everything is switched off under reduced motion. `motion.test.ts` must pass.
- After the audit passes, watch the after video beside the before one. If any change now draws the eye to itself, cut it back and say so in the report. This is reported; only the measured thresholds fail the script.

---

## Part 0 · Read first, then measure

1. **Read:**
   - `src/App.tsx` (every `Suspense`, `lazyPage`, `FrameRoute`, `RouteBoundary` and the `BrowserRouter`);
   - `src/components/Layout.tsx`, `AppShell.tsx`, `shell/SiteFrame.tsx` (`wide`, `skipLink`, `<main id="main">`), `shell/SiteHeader.tsx`, `shell/Dock.tsx`, `shell/FrameLink.tsx`, `shell/siteNav.ts`;
   - `src/components/ProtectedRoute.tsx`, `routing/lazyPage.tsx`, `routing/RouteBoundary.tsx`;
   - `src/pages/site/compose/ComposeRoute.tsx` and `ComposeSkeleton.tsx`;
   - SV-03's `routeTable.ts`, `pageReady.ts` and `e2e/audit/pages.spec.ts`;
   - each page's own loading state: Home, Builds, OpenBuilds, Library, Drafts, the build page, Profile, Activity and Connect.
2. **Frame tools for the audits,** `e2e/audit/support/frames.ts`, for this prompt and SV-06:
   - a `requestAnimationFrame` sampler that records each frame's time;
   - a long-task observer (`PerformanceObserver`, `longtask`);
   - a layout-shift observer;
   - a per-frame read of chosen elements' boxes;
   - a check of whether the page area holds content, a placeholder or nothing.
3. **Add page changes to `npm run audit:pages`.** On the built bundle with the 120 ms delay, play this tour:
   - Home → Builds → a build → Back → OpenBuilds → Library → Drafts → a draft → Back to Drafts → Profile, following the nav's links (SV-02's names), never the redirects from `/gallery` and `/bounties`.
   - Play it once cold and once warm.
   - The tour's steps come from one list beside SV-03's page targets, so SV-08 to SV-14 add their page's steps (the Builds view switch, Library's kinds, OpenBuilds' tabs) without changing the spec.
   - For each step, record:
     - click to first visible change, in ms;
     - frames where the page area was empty;
     - the number of different states the page area went through before the page was ready (for example blank, skeleton, content);
     - layout shift during the change;
     - whether the header's element was replaced (give it `data-frame-id` set once at mount, and check it is unchanged);
     - the scroll position after Back.
4. Save the table in `design/audits/pages/sv-04-before.md`, under the `Assumptions` and `Plan` lists, and a Playwright video of the tour in `design/audits/pages/sv-04/before/`. For each step that fails a threshold in Part 7, write one line naming what the eye sees, for example `header blinks out for 3 frames` or `two placeholders, then content`.

Commit: `SV-04 P0: page change audit, baseline and plan`.

## Part 1 · One boundary under the frame

1. **Turn on `future={{ v7_startTransition: true }}`** on `BrowserRouter`, so navigation runs as a transition. With a transition, React keeps the page on screen while the next one's code loads, instead of showing a fallback.
2. **One `Suspense` boundary** sits around the frame's `<Outlet />`.
   - Its fallback is the matched route's `Placeholder`, from the route table.
   - Remove the per-route `Suspense` wrappers in `App.tsx`, and the blank fallback in `lazyPage`. Pages come from the route table's `lazy()`.
   - Keep each `RouteBoundary` for errors.
3. **`ProtectedRoute`** shows the route's placeholder while the session is unknown (SV-03 Part 1), never a small skeleton.
4. **Run the audit,** and record in the report which tour steps now pass every threshold. Part 2 is built for the rest.

`FrameRoute` and its `legacy` props stay as they are. SV-26 removes them.

**Tests:**
- with a page's chunk held back, the old page stays on screen and no fallback shows;
- the first load of a page shows its own placeholder;
- `App.tsx` has no `Suspense` fallback other than the one boundary, plus the legacy composer's own (a source check).

Commit: `SV-04 P1: one boundary under the frame`.

## Part 2 · Ready, then change

Build this only for what Part 1 left failing: pages whose data, not code, holds them up, and the click-to-change and progress line thresholds. If Part 1 already passes every step, build only step 1's first point (the current mark) and the progress line, and say so.

1. **One way to change page:** `go(to)` in `src/lib/routing/go.ts`, plus `PageLink`, a `Link` that calls it.
   - `FrameLink`, build cards, draft rows, Library rows, profile links, the breadcrumb, `SectionHead`'s chevron (SV-02) and every in-app `navigate()` that changes page use one of them.
   - `go`:
     1. marks the target as current at once, so the clicked nav item, tab or row shows as current in the next frame;
     2. calls the route table's `load()` and `prefetch()`, which may already have started on hover (SV-03 Part 6);
     3. waits until both are done, or 800 ms;
     4. changes page inside a transition (Part 3).
   - A second `go` cancels the first: the last click wins.
   - Whether `go` is waiting comes from the `isPending` of one `useTransition` (`rendering-usetransition-loading`), not from a separate loading state. If that alone covers the 800 ms wait, `go` is no more than a transition and the mark.
2. **The progress line:**
   - a 2px line under the header, in `t.accent` at 60%, drawn with `scaleX` (origin left) on a line with no rounded corners;
   - it shows only when `go` has waited 300 ms;
   - while waiting: one animation of `scaleX` from 0 to 0.9 over 2000 ms with `STANDARD`, not a timer loop;
   - when the page changes: `scaleX` to 1 over `FAST`, then opacity to 0 over `FAST`, then it is removed;
   - under reduced motion, it shows still, at `scaleX(0.5)`, and is removed when the page changes.
3. **Back and Forward,** and any address typed in, don't wait. They change page at once, which is instant for pages in the cache (SV-03 Part 7), and otherwise show the page's placeholder.
4. **Links that open the same page with new parameters,** such as Builds filters and views, Library tabs and Profile tabs, don't change page. They keep the old content until the new content arrives (`keepPreviousData`, SV-03 Part 7), with no fade.

**Tests:**
- a click marks the target as current within one frame;
- a page that is ready in 200 ms changes with no progress line;
- one that takes 500 ms shows the line from 300 ms;
- one that takes 2 s shows its placeholder at 800 ms;
- a second click wins;
- Back doesn't wait.

Commit: `SV-04 P2: ready, then change`.

## Part 3 · One fade, on the compositor

1. **The change runs in `document.startViewTransition`** where the browser has it, with the router update inside `flushSync`, so the new page is drawn inside the callback.
2. **The frame stays still:**
   - in `index.css`, the header, the footer, the dock and the progress line each get their own `view-transition-name`, and their groups have no animation;
   - the page area (`<main id="main">`) gets `view-transition-name: page`;
   - `::view-transition-old(page)` and `::view-transition-new(page)` crossfade over `FAST` with `STANDARD`, using opacity only;
   - the root group has no animation.
3. **Without view transitions,** or under reduced motion, the page changes at once with no fade. Never animate the page area some other way.
4. **During the fade the old page can't take clicks.** The fade stays at 150 ms.
5. **A transition already running** is finished (`skipTransition`) before a new one starts.

**Tests (Playwright, real browser):**
- the header's box doesn't move in any frame of a page change;
- the page area's opacity runs from the old page to the new in about 150 ms;
- reduced motion changes page in one frame;
- a browser without `startViewTransition` (stubbed away) changes page at once.

Commit: `SV-04 P3: one fade`.

## Part 4 · The composer shares the frame

1. **One `SiteFrame` for the site and the composer.**
   - Move `/compose`, `/compose/new` and `/compose/:buildId` under a route that shares the frame with `Layout`'s routes.
   - Let the frame read `wide` and `skipLink` from the matched route in the route table, rather than from a second `SiteFrame`.
   - Keep the one-route shape that keeps the page mounted when `/compose/new` becomes `/compose/{id}` (UI-P47's comment in `App.tsx`).
2. **The legacy workspace** (a rebuild, a `from` parameter, an intake arrival) keeps its own chrome, exactly as now.
3. **`ComposeRoute` never blanks the window.**
   - Replace `FALLBACK` with the frame and `ComposeSkeleton`, shown from the first frame.
   - While the rebuild check runs, show the skeleton too. If the build turns out to be a rebuild, swap to the legacy workspace.
4. **New build and opening a draft** show `ComposeSkeleton` in its full page shape. Find why New build shows two lines in the corner now. Write the test that shows it, then fix the cause.

**Tests:**
- going from Drafts to a draft keeps the header's `data-frame-id`;
- `/compose/new` to `/compose/{id}` keeps the page mounted;
- the composer's first frame is the frame plus `ComposeSkeleton`, never a blank window;
- a rebuild still opens the legacy workspace.

Commit: `SV-04 P4: the composer shares the frame`.

## Part 5 · One placeholder per page

1. **Each route's `Placeholder`** is the loading shape the page already draws while its data loads. Each page prompt from SV-08 to SV-14 replaces its route's `Placeholder` with its new page's loading state and keeps this part's match test green. Use the existing component, such as `CardGridSkeleton` or `ComposeSkeleton`, and make no new look. If a page has none, use the closest existing one at the page's real layout: same column widths, header block and first-row heights.
2. **A page shows one placeholder at most** between the click and its content: the route's `Placeholder` (code loading), then the same shape from the page (data loading), with no visible swap between the two.
   - **How the swap works:** the placeholder and the content sit in the same slot. When the data arrives, both fade at once over `FAST` with `STANDARD`, the placeholder out and the content in. The placeholder isn't removed before the content is drawn, and nothing moves.
3. **No shift when content arrives:** placeholders hold the content's sizes. Layout shift during a page change stays at or under 0.02.

**Tests:**
- for each page, the route's placeholder and the page's own loading state match (same element boxes within 2 px);
- the audit counts at most one placeholder state per change;
- no frame between the placeholder and the content has an empty page area.

Commit: `SV-04 P5: one placeholder per page`.

## Part 6 · Scroll

1. **A new page opens at the top,** or at its `#hash` when it has one.
2. **Back and Forward** restore the scroll position that page had. Store it per history entry in `sessionStorage`, with every read and write in try/catch. Key it with a version (`scroll:v1:<entry key>`) and keep only `{ y }` (`client-localstorage-schema`). Restore it after the page is ready (`usePageReady`), in the same frame as the swap, so the page never shows at the top and then jumps. Restore with `behavior: "instant"`, never smooth.
3. Set `history.scrollRestoration = "manual"` once.
4. **The composer** keeps its own scrolling (SV-06's scroll helper), and Back to Drafts restores Drafts.

**Tests:** scroll Builds, open a build, go Back: Builds is at the same position in its first frame; a new page opens at the top; a hash scrolls to its target.

Commit: `SV-04 P6: scroll`.

## Part 7 · Screens and checks

1. **Run `npm run audit:pages`** and save `design/audits/pages/sv-04-after.md`, with the before numbers beside the after ones. Every one of these must pass on the tour:
   - click to first visible change at or under 100 ms;
   - zero frames with an empty page area;
   - at most one placeholder state per change, and none on a warm change;
   - layout shift at or under 0.02 per change;
   - the header never replaced and never moved;
   - Back restores the scroll within 4 px.
   Make the script fail when one fails. Play the tour 3 times and report the median of each number.
2. **No regression elsewhere.** Run `npm run audit:perf`. View transitions snapshot the page and can delay the next paint, so LCP, CLS and the INP proxy must be no worse than SV-03's after numbers. SV-03's request-round checks in `npm run audit:pages` still pass.
3. **Nothing else moves:** a source check that the diff adds no `animate()` call, `transition` or `@keyframes` other than the page fade and the progress line.
4. **Record the tour again** into `design/audits/pages/sv-04/after/`, so Miles can watch the two side by side. Watch them yourself first (Motion limits, last point).
5. **At rest, nothing changed:** run `npm run audit:design`. Run `npm run audit:contrast`. Search the diff for the em dash character.

Commit: `SV-04 P7: screens and checks`.

---

## Report (end the session with exactly this)

```
SV-04 · smooth page changes
Branch / PR:
Facts in this prompt that were wrong on disk: (list, or "none")
Baseline → end: tests N → N · contrast

P1 one boundary yes/no · per-route fallbacks removed N · startTransition on yes/no · tour steps passing after P1 alone: (list)
P2 built for: (steps, or "only the mark and the line") · links routed through go(): (list) · progress line yes/no
P3 view transition fade yes/no · frame named and still yes/no · fallback without support yes/no
P4 one frame including the composer yes/no · blank window removed yes/no · New build corner cause: (cause)
P5 placeholders matched for: (list of pages)
P6 scroll restored on Back yes/no
Before → after, per step of the tour (cold · warm): click to change ms · empty frames · placeholder states · layout shift · header kept
Thresholds all passing yes/no (list any that fail, with why)
Web Vitals against SV-03's after (LCP · CLS · INP proxy): no worse yes/no (per route) · SV-03 round checks pass yes/no
Motion cut back after watching: (list, or "none")
At rest unchanged yes/no
Dead code seen: (list, or "none")
Parts not done: (list, or "none")
Questions for Miles: (list)
```

**What Miles needs to do** (say it in the report, plainly): watch the before and after tour videos in `design/audits/pages/sv-04/`, then merge the pull request and press Publish › Publish changes in Lovable. There are no database changes.
