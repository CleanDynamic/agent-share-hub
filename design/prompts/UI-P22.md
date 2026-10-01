# UI-P22 — Data: gallery lens counts, gallery stats and the shape facet

Follow `design/RULES.md`. **One commit per item** (UI-P22a, b, c).

**Goal.** The numbers on the Gallery header: per-lens counts, the stats row, and a Shape facet.

**Read first.** `src/lib/build/gallery.ts` — verified to hold `listGallery`, `getGalleryFacets`, `countOpenBountyBuilds`, `inGallery` and `GALLERY_BUILD_COLUMNS`; read it for the lens names, the page size and the threshold helper as they actually are (§8) — plus `signals.ts` from UI-P21 and `STALE_AFTER_DAYS`.

**Build.**
- **a) `countGalleryLenses(): Promise<Record<GalleryLens, number>>`** — for each lens the gallery already supports (drawn as `all | proven | rebuilt | unsolved`), an estimated head count using **the same filter `listGallery` applies for that lens** (extract the filter into a shared helper if it is inline, without changing behaviour; the existing gallery tests must still pass unchanged).
- **b) `getGalleryStats(): Promise<GalleryStats>`** with `{ inGallery: number; reproducedThisWeek: number; weeklyGoal: number | null; freshPct: number }`: `inGallery` = the `all` lens count; `reproducedThisWeek` = `countRunsThisWeek()`; `freshPct` = gallery builds confirmed within `STALE_AFTER_DAYS`, as a whole percentage of `inGallery` (0 when there are none); `weeklyGoal` from a new exported constant `WEEKLY_REPRODUCTION_GOAL` in `src/lib/progress/goals.ts`, set to `null`. When it is `null` the Gallery shows the number and a bar at the fraction of last week's count instead of "/ goal" (UI-P28). Leave a comment saying the goal is an editorial number for the product owner to set.
- **c) Shape facet** — add `shapes: { value: BuildShape; count: number }[]` to `GalleryFacets`, computed the same way as `roles` and `tools`, ordered by count. Shapes are the code's own union (`app, agent, workflow, prompt, dataset, study, media, technique, other`); do not invent new ones. Update the facet test.

**Done when.** Three commits, each with tests, all green.

**Commit.** `UI-P22a: countGalleryLenses` · `UI-P22b: getGalleryStats` · `UI-P22c: shape facet in getGalleryFacets`
