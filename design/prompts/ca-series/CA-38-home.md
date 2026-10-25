# CA-38 · Home

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-37, before CA-39. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `ca-38-home`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-38 Home` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before CA-29 to CA-37 merged. **The file on disk wins.**

## Intent

Home becomes three columns: the maker's own work on the left, a feed of build posts in the centre, the site's activity on the right. It must match `design/reference/vision/dusk/home.html`. Home now carries the feed; CA-39 retires the Gallery's feed view.

## Source

- Board: `design/reference/vision/dusk/home.html`, picture `design/screens/vision/home.png`, sample data in `design/reference/vision/source/Main.dc.html`.
- Today: `src/pages/site/home/HomeView.tsx`, `HomePage.tsx`, `homeModel.ts`; `src/components/gallery/FeedPost.tsx` (the post, as the composer previews it); `src/lib/feed/getBuildFeed.ts`.

## What earlier prompts left here

- **CA-31:** `getBuildFeed` returns the classification columns in its one request (Part 4); `BUILD_LIST_COLUMNS` has no `post_doc` or `making`; the route table entry and `usePageReady("home")`; fetching at idle.
- **CA-32:** the route's `Placeholder` and its match test; `PageLink`.
- **CA-36:** the drafts list and the Sessions list's source.

## Layout (exact values are in the board)

- Surface padding `24px clamp(16px, 2.2vw, 32px) 0`. Columns `280px minmax(0, 628px) 300px`, centred, no gap. The centre column has a 1px `--hairline` left and right. Left column padding `8px 28px 48px 4px`, sections 32 apart with a hairline between. Right column padding `8px 4px 48px 28px`, the same.
- Below 1100px the left column is hidden. Below 760px one column: a single row above the feed linking to Drafts ("n drafts in progress · n sessions"), then the feed, then the right column's sections in order.

### Left column, top to bottom

1. **Since you were last here**: section head, then a timeline: a 9px dot per line (`--evidence` worked, `--cat-breakage` didn't, `--text2` rebuild, `--text` answer), a 1px `--hairline` joining the dots, a 500 title, a 12 `--label` detail, the age on the right.
2. **Continue editing**: section head with chevron to Drafts; three rows (48 high): title (an untitled one in `--text2`), "n sessions · edited <age>" in Geist Mono 10.5.
3. **Your sessions**: section head with chevron to Drafts; two rows (52 high): model mark, title (the first prompt, as on Drafts), "<tool> · <date> · In n drafts" in mono, a 28 `+` button named "Add to a new build".
4. **Your week**: seven day bars (6 high, today dashed), then three challenges, each a 12.5/500 title, "n / m" on the right, and a 4px bar.

### Centre column

1. `UnderlineTabs` Following, Everyone; on the right a `Segmented` All, Builds, Rebuilds, Notes, Asks.
2. A pill "n new since you looked" (28 high, `--module`, 1px `--module-border`, radius 14), shown only when n > 0.
3. Feed items, separated by hairlines:
   - **build**: `FeedPost` as it is: the author row, the post (heading 28/500, body 16/1.55, post counter "1 / 4"), the picture grid, Show more, the build line (title, Plaque, pattern mark), the two classification lines, `EngagementRow`.
   - **repro note**: 28 avatar, "@kit ran <build>, and it worked on <model>" (a failed run says "and it didn't work" in `--cat-breakage`), the note in 12 `--text2` (with the lamp before it when it worked), the age.
   - **rebuild**: author row "@dax rebuilt · 3h", the note at 16/1.55, a quote box (`--module`, radius 8, padding 10: an 88 × 58 cover, "Rebuilt from", the source title, "@handle"), the rebuild's build line, `EngagementRow`.
   - **bounty**: author row "@mira opened a step request · 6h", a box (`--module`, radius 8, padding 14): gap title 14/500 and the reward 20/500 on the right; "on <build> · n solution(s) · closes in n days"; Solve it (the page's primary) and "Me too · n".
4. End of feed: "You're up to date", "More builds" (a `PageLink` to Builds), then two cards from Builds.

### Right column

1. `PageFigure size="room"`: "n runs", meta "Reproduced today", chevron to Activity. Two inner tiles side by side: lamp + "n" with "builds lit today", and "n" with "runs this week". Then three run rows: a state chip ("Worked" on `--evidence-fill` in `--evidence`; "Didn't" on `--cat-breakage-fill` in `--cat-breakage`), build and maker, age.
2. **Open requests**: section head with chevron to OpenBuilds, "Most needed first"; three rows: gap title, "<build> · n days left", reward right.
3. **Most run this week**: rank, 28 avatar, title and handle, count right.
4. **Where next**: a 56 × 40 cover, title, the reason in mono caps.

The footer carries the Noon, Dusk, System switch.

## Rules for this prompt

- **Vercel rules:** `async-parallel`, `async-defer-await`, `rendering-content-visibility`, `rerender-no-inline-components`, `bundle-dynamic-imports`.
- **Two rounds, no more.** Round 1: every read that doesn't depend on another starts at once with the feed's first page, the left and right columns included. Round 2: only the build posts' `post_doc` for the feed's ids.
- **`post_doc` only where it's seen.** It is heavy (CA-31 took it out of list reads for that reason). Read it for the posts in the first screen; read the rest as each post comes within one screen of view (`IntersectionObserver`), in one request per batch.
- **Images:** the README's image rule; the first post's picture is the one that isn't lazy if it is the largest image in the first screen.
- **Charts:** Your week's day bars carry a text summary ("Active 5 of 7 days").
- **The feed's off-screen items** use `content-visibility: auto` with a `contain-intrinsic-size` near their real height.
- **Motion:** the "n new" pill appears in place, with no slide; choosing it adds the new items at the top at once, with no stagger. Tabs and the kind filter are the same page with new parameters: old items stay until the new arrive, no fade.

---

## Part 0 · Read and plan

Read the files above. Map every element in the board to the function that supplies it today, in a table: element → function → exists or not → round 1 or 2. Write `Assumptions` and `Plan`.

Commit: `CA-38 P0: plan`.

## Part 1 · The view

`HomeView` takes props for all three columns, each section its own component. Reuse `FeedPost`, `Plaque`, `EngagementRow`, `Avatar`, `MadeWithMarks` and CA-30's pieces. The dev page `vision-home` renders it from `src/dev/fixtures/vision/home.ts`. The route's `Placeholder` becomes this page's loading state.

Commit: `CA-38 P1: Home view`.

## Part 2 · Wire what exists

| Element | Source |
| --- | --- |
| Tabs and kind filter | `getBuildFeed` (`onlyFollowing`), `matchesFilter` |
| New since you looked | rows newer than `readHomeSeen()`, counted from what is loaded |
| Build posts | `FeedPost` needs a `GalleryBuild` with `post_doc`. Read it by id with `GALLERY_BUILD_COLUMNS`, in batches as above; if no function does this, add `getGalleryBuildsByIds(ids)` to `src/lib/build/gallery.ts` (named columns, `.limit()`) |
| Repro notes, rebuilds, bounties | the feed row's own fields; Me too through `toggleMeToo` |
| End of feed | `listGallery` |
| Continue editing | `listDraftsWithSessions`, three with something in them, latest first |
| Your sessions | the function Drafts uses for its Sessions list |
| Your week | `weeklyProgress`, `getStreakDays` |
| Runs today, lit today, this week | `countReproducedToday`, `countLitToday`, `countRunsThisWeek` |
| Latest runs | the feed's `repro_note` rows, or a new `listRecentReproductions(limit)` in `src/lib/build/signals.ts` if the feed can't supply three |
| Open requests | `listOpenBounties({ home: "build" })`, sorted by `me_too_count` |
| Most run this week | new `listMostReproduced({ since, limit })` in `src/lib/build/signals.ts`: a count of `build_reproductions` in the window grouped by build. No schema change. The `EXPLAIN` to run goes in the function's comment, and in the report for Miles |
| Where next | `getWhereNextForViewer` |

**Not live yet:** Since you were last here (CA-43). The view renders it from props; the live page leaves the section out until CA-43.

Commit: `CA-38 P2: Home data`.

## Part 3 · Requests and performance

1. `npm run audit:pages` gains Home with the two-round target, and fails when it is missed. Report the request count and the JSON received.
2. `npm run audit:perf` before and after: LCP, CLS and the INP proxy must not get worse.

Commit: `CA-38 P3: requests and performance`.

## Part 4 · Post links in the feed

The board draws links in a post as `RefLinks` draws them on the build page. The feed has no `PostRefsProvider` today, so links show as plain words. Add the provider only if each build's link targets can be read for the whole page in the round 2 request; otherwise keep plain words and say so in the report.

Commit: `CA-38 P4: post links in the feed` (or no commit, with the reason).

## Part 5 · Compare

`npm run audit:design -- --grep "vision/dusk/home"` within 4%. List every remaining difference.

Commit: `CA-38 P5: compare and checks`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration. If the report gives an `EXPLAIN` for `listMostReproduced`, run it in Supabase and paste the plan into the next session.
