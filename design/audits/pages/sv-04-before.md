# SV-04 · before

Branch `sv-04-page-transitions`, from main at `71cbfd2` (SV-03 merged, its migration applied).

## Assumptions

Each fact in the prompt's "What a page change looks like now", checked on disk and in the built bundle.

- **Every page change happens in one frame.** True. `BrowserRouter` has no `future` prop (React Router 6.30.3), so navigation is an urgent update and React drops the old page in the next frame. React is **19.2.5**, not 18: transitions may be async (an `async` function inside `startTransition` keeps `isPending` true until it ends), which `go()` uses.
- **Blank areas.** Partly out of date. SV-03 already replaced `lazyPage`'s 60vh blank and the inline `Suspense` fallbacks inside the frame with `RoutePlaceholder` (the route table's `Placeholder`, or a 60vh blank for an address the table does not hold). Blank fallbacks remain outside the frame: `/compose/start`, the legacy composer, `/rebuild/:slug`'s legacy branch, `/convert`, `/oauth/consent`, the dev pages, `/dev/wide`, and `legacy={<Suspense fallback={null}>}` on Profile and Activity. The tour shows no blank frame inside the frame except opening a draft.
- **Opening a draft blanks the whole window, header included.** True. `ComposeRoute`'s `FALLBACK` is `position: fixed; inset: 0` in `--bg`, shown while the session is unknown and while the rebuild check runs, and the composer route sits outside `Layout` with its own `SiteFrame`. Measured: 9 frames with no page area and a new header element (`data-frame-id` changes) on Drafts → a draft, and again on Back to Drafts.
- **Different placeholders, some two in a row.** True, as measured below: Home → Builds and Drafts → Profile go through two different placeholder shapes (the route's `Placeholder`, then the page's own loading state, which is a different shape). `ProtectedRoute` already shows the route's `Placeholder` (SV-03), not the small skeleton, for a route in the table; the small skeleton stays for the rest.
- **New build shows two lines in the corner.** Checked in Part 4.
- **Scroll isn't kept.** Not as written: Back lands where it was, because the browser's own `scrollRestoration = "auto"` puts it back when nothing else moves the scroll. The real fault is the other way round: **a new page opens at the scroll position of the page it came from** (Builds → a build opens 295 px down; Drafts → a draft 260 px down), because nothing scrolls to the top on a page change.
- **What SV-03 left behind.** The route table (`src/lib/routing/routeTable.ts`, entries `home gallery bounties library drafts create build profile`, each with `load`, `prefetch`, `Placeholder`), `usePageReady` (`pageReady.ts`, `data-page-ready` on `<html>`), `IntentLink` and `useIntent` (fetch on hover, focus, touch, press), `RouteWarmup`, the idle loader, and `npm run audit:pages`. **The kept cache was built** (`src/lib/query/persist.ts`). **`compose_open` was not built.** There is no `go.ts`, no `PageLink`, and no frame tools.
- **The composer.** `/compose` is one route with children `new` and `:buildId` (UI-P47's comment), outside `Layout`; it draws `SiteFrame wide skipLink={<SkipToBuild />}` when `SANDBOX_COMPOSER_ENABLED`.
- **Where pages show they are loading.** Home, Builds, OpenBuilds, Library, Drafts, the build page and Profile each draw their own view in a loading state (sections with `Skeleton` blocks, the page's heading and tabs drawn); the route table's `Placeholder`s are generic `ListPlaceholder`s, a different shape.

## Plan

- Part 0: frame tools (`e2e/audit/support/frames.ts`), the tour (`support/tourSteps.ts`, `page-changes.spec.ts` in `npm run audit:pages`), `data-frame-id` on the header slot -> verified by: the table below and the before video.
- Part 1: `v7_startTransition`, one `Suspense` under the frame's `<Outlet />` with the matched route's `Placeholder`, per-route `Suspense` wrappers removed -> verified by: a unit test with a held chunk (old page stays), a source check on `App.tsx`, and the tour run again.
- Part 2: `go()` and `PageLink`, the current mark at once, the progress line, built only as far as the tour after Part 1 needs -> verified by: unit tests (mark within a frame, no line at 200 ms, line at 300 ms, placeholder at 800 ms, last click wins, Back does not wait) and the tour's click-to-change.
- Part 3: `document.startViewTransition` for the change, the frame named and still, the page area crossfading over `FAST` -> verified by: Playwright (header box still in every frame, page opacity over about 150 ms, reduced motion and no support change at once).
- Part 4: the composer inside `Layout`'s frame, `wide` and `skipLink` from the route table, no blank window -> verified by: tests on `data-frame-id` Drafts → a draft, `/compose/new` to `/compose/{id}` kept mounted, first frame is the frame plus `ComposeSkeleton`, a rebuild opens the legacy workspace; the tour's empty frames and header kept.
- Part 5: each route's `Placeholder` is the page's own loading shape -> verified by: a Playwright box match within 2 px per page, the tour's placeholder states.
- Part 6: a new page at the top (or its hash), Back restores from `sessionStorage` (`scroll:v1:<key>`), `scrollRestoration = "manual"` -> verified by: Playwright (Builds, a build, Back) and the tour's opened-at and Back columns.
- Part 7: thresholds fail the tour, `audit:perf`, the source check on motion, the after video, `audit:design`, `audit:contrast` -> verified by: `sv-04-after.md`.

## The tour, before

`npm run audit:pages` (page-changes.spec.ts) on the built bundle, every database request 120 ms late, 1440 x 700, median of 3. Raw numbers: `sv-04-before.json`. Video: `sv-04/before/tour.webm` (the first run, cold then warm).

"Opened at y" is where a new page opened (it should be 0); "Back scroll off" is how far Back landed from where the page was left. "Click to change" is the first frame that differs from the one before the click; before this prompt the old page vanishes in that frame, so it is always quick.

| step | way | click to change ms | to ready ms | empty frames | placeholder states | states before ready (first run) | layout shift | header kept | header still | opened at y | Back scroll off px | longest task ms |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- | --- | ---: | ---: | ---: |
| Home → Builds | cold | 7 | 871 | 0 | 2 | placeholder#1 → placeholder#2 | 0.018 | yes | yes | 0 |  | 0 |
| Builds → a build | cold | 8 | 324 | 0 | 1 | placeholder#1 | 0.05 | yes | yes | 295 |  | 62 |
| Back to Builds | cold | 6 | 6 | 0 | 0 | none | 0.037 | yes | yes |  | 0 | 0 |
| Builds → OpenBuilds | cold | 8 | 324 | 0 | 1 | placeholder#1 | 0 | yes | yes | 0 |  | 0 |
| OpenBuilds → Library | cold | 9 | 310 | 0 | 1 | placeholder#1 | 0.001 | yes | yes | 0 |  | 0 |
| Library → Drafts | cold | 7 | 307 | 0 | 1 | placeholder#1 | 0.012 | yes | yes | 0 |  | 0 |
| Drafts → a draft | cold | 7 | 1707 | 9 | 1 | empty → placeholder#1 | 0.025 | no | no | 0 |  | 748 |
| Back to Drafts | cold | 5 | 5 | 0 | 0 | none | 0 | no | yes |  | 0 | 0 |
| Drafts → Profile | cold | 9 | 1340 | 0 | 2 | placeholder#1 → placeholder#2 | 0.035 | yes | yes | 0 |  | 0 |
| Profile → Home | warm | 8 | 8 | 0 | 0 | none | 0.021 | yes | yes | 0 |  | 0 |
| Home → Builds | warm | 9 | 9 | 0 | 0 | none | 0 | yes | yes | 0 |  | 0 |
| Builds → a build | warm | 8 | 8 | 0 | 0 | none | 0.037 | yes | yes | 295 |  | 0 |
| Back to Builds | warm | 7 | 7 | 0 | 0 | none | 0.037 | yes | yes |  | 0 | 0 |
| Builds → OpenBuilds | warm | 8 | 8 | 0 | 0 | none | 0 | yes | yes | 0 |  | 0 |
| OpenBuilds → Library | warm | 9 | 9 | 0 | 0 | none | 0 | yes | yes | 0 |  | 0 |
| Library → Drafts | warm | 8 | 8 | 0 | 0 | none | 0.013 | yes | yes | 0 |  | 0 |
| Drafts → a draft | warm | 9 | 9 | 0 | 0 | none | 0 | no | yes | 260 |  | 64 |
| Back to Drafts | warm | 6 | 6 | 0 | 0 | none | 0 | no | yes |  | 0 | 0 |
| Drafts → Profile | warm | 5 | 1305 | 0 | 1 | placeholder#1 | 0.022 | yes | yes | 0 |  | 0 |

## What the eye sees, for each step that fails a Part 7 threshold

- Home → Builds (cold): two placeholders, then content (the route's list blocks, then the Builds page's own loading shape).
- Builds → a build (cold): the page jumps as the build arrives (layout shift 0.05), and the build opens 295 px down, not at its top.
- Back to Builds (cold and warm): the Builds page shifts as it is drawn again (0.037).
- Builds → OpenBuilds (cold): one placeholder, then content; passes.
- Drafts → a draft (cold): the header blinks out for 9 frames: the whole window is the ground colour, then a new header and the composer's blocks, then content; the header is a different element afterwards.
- Back to Drafts (cold and warm): the header is drawn again (a different element), though it does not move.
- Drafts → Profile (cold): two placeholders, then content, and a layout shift of 0.035 as the profile arrives.
- Drafts → Profile (warm): the profile is not kept, so a placeholder shows again on a page already visited (1.3 s), with a shift of 0.022.
- Profile → Home (warm): a shift of 0.021 as Home is drawn again.
- Builds → a build (warm), Drafts → a draft (warm): the new page opens where the last one was scrolled to (295 and 260 px down).
