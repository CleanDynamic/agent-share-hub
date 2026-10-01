# UI-P40 — The performance pass

Follow `design/RULES.md`.

**Goal.** The new frame must not cost what the old one did not. Blur budget, bundle, paint and queries.

**Read first.** `design/BASELINE.md` (UI-P00), the `neoscale-performance` skill if it is available, `vite.config.ts`, every `React.lazy` route in `App.tsx`.

**Do.**
1. **Blur budget — exactly four surfaces** may have `backdrop-filter`: the desktop header, the mobile header, the dock, and the build page's title plate and action dock (one page's pair). Nothing blurred is nested inside anything blurred. Grep for `backdrop-filter` and `blur(` and remove any other use.
2. **One paint for the room.** The backdrop is one element with a CSS background plus one arc SVG and (Dusk) one grain SVG per page — not per panel. No `position: fixed` full-screen layer, no animation, no `feDisplacementMap`. Check that a scroll of Home stays at 60fps in the Performance panel with paint flashing on.
3. **Lazy.** Every page from UI-P27 to UI-P36 is `React.lazy`, and so is anything with a chart (`LineChart`, `StepChart`, `ActivityGrid` where they are not above the fold), the `Replay` view, the compose and import routes and every `/dev/*` page. Check `dist/` after `npm run build`: the initial chunk must not contain fixtures, dev pages, chart code or the Replay view, and the largest chunk must not be bigger than the baseline's.
4. **Fonts.** Sentient (two weights) is preloaded with `font-display: swap` and subset to Latin if it is not already; no third display weight is added. Figtree and DM Mono are unchanged.
5. **Images.** Every cover has `loading="lazy"` except the first screen's hero, explicit `width`/`height` (or a fixed-height box) so nothing shifts, and `decoding="async"`. `CoverFallback` is inline SVG, never a network request.
6. **Queries.** One query per panel, never one per row. No query inside a `map`. Every list has a `.limit()`. Counts are estimated where an exact number is not shown. The header's unread count is read once and updated by the realtime channel, not polled. Check the network panel on Home: no duplicate requests for the same key, no request per feed row.
7. **Re-renders.** The header, breadcrumb, footer and dock do not re-render when a page's data changes (memo them and keep their props stable); typing in search does not re-render the page body.

**Done when.** `npm run build` output is recorded in `design/BASELINE.md` beside the UI-P00 numbers, with no chunk larger than before; the four blurred surfaces are the only ones; a Lighthouse run on Home and the Build page (desktop and mobile) is no worse than the baseline on LCP, CLS and TBT, and CLS is below 0.1.

**Commit.** `UI-P40: performance pass`
