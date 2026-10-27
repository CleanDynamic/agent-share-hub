# SV-10 · Home: assumptions and plan

Branch: `sv-10-home`, from `origin/main` at 1322334 (after SV-09).

## Part 0 · Elements

| Element (board) | Function | Exists | Round |
| --- | --- | --- | --- |
| Since you were last here (timeline) | `listActivityFor` (SV-15) | no: dev page only | - |
| Continue editing: three drafts, "n drafts · latest first" | `listDraftsWithSessions` (three with a session, latest first) | yes | 1 |
| Your sessions: model mark, first prompt, "<tool> · <date> · In n drafts", + Add to a new build | `listLibrarySessions` (via `useLibrarySessions`, Drafts' Sessions list), `attachSession(id, { kind: "new" })` | yes (two requests inside: sessions, then their drafts) | 1 (+1 inside) |
| Your week: seven day bars, "n day streak" | `getStreakDays`, `streakOf` | yes | 1 |
| Your week: three challenges | `getMyWeekEvents` (`useMyWeek`), `weeklyProgress` | yes | 1 |
| Tabs Following / Everyone, kind filter | `getBuildFeed({ onlyFollowing })`, `matchesFilter` | yes | 1 |
| "n new since you looked" | rows of the loaded feed newer than `readHomeSeen()` | yes (counted from what is loaded) | - |
| Build post: author row, the post, picture grid, Show more | `FeedPost` with a `GalleryBuild` carrying `post_doc` and its media | `FeedPost` yes; a read by ids: no, added as `getGalleryBuildsByIds(ids)` | 2 |
| Build post: tool marks | `made_with`, `models_used` from the same by-ids read | added | 2 |
| Build post: build line, Plaque, pattern mark | the feed row (Plaque); patterns not read on Home | yes / no (patterns left out, as the feed row has none) | 1 |
| Build post: two classification lines | `classification` from the by-ids read (`toGalleryBuild` maps it) | added | 2 |
| Build post: EngagementRow | `useEngagement(ids, known)`; counts come with the by-ids read | yes | 2 |
| Repro note | the feed row (`repro_note`: handle, model, note, worked) | yes | 1 |
| Rebuild: note, quote box (cover, source title, @handle) | the feed row (`rebuild_note`, `source_title_at_fork`, `source_handle_at_fork`); the quote's cover is the source's and is not on the row: drawn as the dot-grid well | yes | 1 |
| Bounty: gap title, reward | the feed row (`bounty_gap_title`, `bounty_reward_gbp`) | yes | 1 |
| Bounty: "n solutions · closes in n days", "Me too · n" | not on the feed row. Taken from the Open requests read (`listOpenBountyCards`, which carries `solutions`, `closes_at`, `me_too_count`) when the ask is among them; otherwise the clauses are left out | partly | 1 (+1 inside) |
| Bounty: Me too pressed state | `myMeToo(ids, userId)` | yes | 2 |
| End of feed: "You're up to date", More builds, two cards | `listGallery({ limit: 2 })` | yes | 1 |
| Runs today, lit today, runs this week | `countReproducedToday`, `countLitToday`, `countRunsThisWeek` | yes | 1 |
| Latest runs | the feed's `repro_note` rows | yes (three when the loaded feed has three) | 1 |
| Open requests: gap title, "<build> · n days left", reward | `listOpenBountyCards` (the OpenBuilds board's own read and key), sorted by `me_too_count` | yes | 1 (+1 inside) |
| Most run this week: rank, avatar, title, handle, count | new `listMostReproduced({ since, limit })` in `src/lib/build/signals.ts` | added | 1 (+1 inside: the builds' titles and makers) |
| Where next | `getWhereNextForViewer` | yes (a chain of four inside) | 1 (+3 inside) |
| Footer Noon / Dusk / System | `SiteFooter` | yes | - |

## Assumptions (checked on disk at 1322334)

- Board `design/reference/vision/dusk/home.html`; dev page `/dev/kit/pages/vision-home` is `VisionNotBuilt` today.
- **SV-03 did not put the classification columns on `getBuildFeed`.** The feed is the `get_build_feed` RPC, which returns
  none (no migration added them; SV-03's report says nothing on it). The by-ids read in round 2 carries `classification`,
  so no schema change is needed.
- `BUILD_LIST_COLUMNS` is not a name on disk; `GALLERY_BUILD_COLUMNS` (in `gallery.ts`) still includes `post_doc`, and
  `listGallery` reads it. The new `getGalleryBuildsByIds` reads `gallerySelect(false)` (which carries `post_doc`), as
  `feedRows` does for the Builds feed.
- The prompt's `UnderlineTabs` is `TextTabs` (SV-02); its tabs are 36 high and 20 apart, the board's Home tabs 40 high and 24
  apart. `TextTabs` gains optional `height` and `gap`. `Segmented` (brand) draws a solid `--text` segment, not the board's
  raised `--control` one, so the kind filter is drawn in the view as a pressed-button group (`aria-pressed`, as the board).
- `listOpenBounties` returns bare `bounties` rows: no gap title and no build title, which the Open requests rows print.
  `listOpenBountyCards` (the OpenBuilds board's read, already prefetched under `["bounty-board"]`) carries both, plus
  solutions and `me_too_count`. Home uses it with the same key and sorts its first page by `me_too_count`.
- The feed's bounty row carries no `closes_at`, `me_too_count` or solution count (`get_build_feed` returns none).
- `FeedPost` pads `20px 0 16px`; the board pads the post `20px 20px 16px`, so the feed column adds the 20 at the sides.
- `PostRefsProvider` needs the whole build's steps and `making` (`refGroups`), which no list may read (SV-03). Part 4 keeps
  plain words.
- `KEPT_KEYS` already keeps `["feed", "getBuildFeed"]` and `["build", "listDraftsWithSessions"]`.
- The route table's `home` entry prefetches the Everyone feed's first page; `usePageReady("home")` is in `HomePage`.
- SV-08's `frame: { board: true }` pads `40px clamp(16px, 5vw, 76px) 0`; Home's board is `24px clamp(16px, 2.2vw, 32px) 0`.
  The frame's `board` gains a Home value.

## Plan

- Part 1: `HomeView` rewritten as the three columns, each section its own component, plus `HomeFrame.tsx` (columns and the
  loading view, which becomes the route's Placeholder); fixture `src/dev/fixtures/vision/home.ts`; dev page `vision-home`
  -> verified by: `HomeView.test.tsx`, the placeholder match test, the dev page rendering.
- Part 2: `HomePage` wires the table's sources; `getGalleryBuildsByIds`, `listMostReproduced` added with tests; post_doc
  read in batches as posts come within a screen of view -> verified by: `HomePage.test.tsx`, `gallery.test.ts`,
  `signals.test.ts`.
- Part 3: `audit:pages` Home target `maxRounds: 2`; `audit:perf` before and after -> verified by: the audits.
- Part 4: no provider (see above), reported.
- Part 5: `npm run audit:design -- --grep "vision/dusk/home"` within 4%, then the checks.
