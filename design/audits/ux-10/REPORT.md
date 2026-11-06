# UX-10 · The profile is a feed

```
UX-10 · The profile is a feed
PASS, with the parts and checks listed under "Parts not done" and "Checks" not met in full
Branch / PR: claude/ux-10-profile-feed-hudrpi (the branch the session gives; the prompt allows it)
Facts in this prompt that were wrong on disk: see "Assumptions" (14 of them)
Baseline → end: tests 11,526 passed / 31 failed (main) → see "Checks"
Compared boards: not comparable: the old profile board is already in design/reference/archive/ (UI-P99) and the prompt brings no new one
Request rounds and requests for the page, before → after:
  profile             first visit 2 rounds* → 2 rounds, 6 requests; cold 11 → 17 requests (baseline updated, see Checks)
  profile-followers   new: 1 round, 2 requests (first visit); cold 7
  profile-following   new: 1 round, 2 requests (first visit); cold 7
  * the old number measured a profile that never loaded in the audit's world (see Checks)
Web Vitals against the last after numbers (LCP · CLS · INP proxy): not measured (audit:perf not run; see Checks)
Built but not live yet: everything here waits on the Lovable message below (new columns, tables and functions)
Layers built only because a target failed: getProfileSummary reads the reader's follow inside the profile's own request
  (it was a second step: 2 rounds → 1 for the follow lists, 3 → 2 for the profile); marks are read on your own profile only
Names that differed from this prompt: see "Names"
Raw values without a token: none
Motion cut back after watching: none (nothing here moves)
Dead code seen: see "Retired"
Lovable messages needed: one (below)
Parts not done: see below
Questions for Miles: see below
```

## Part 0 · Baseline

Pulled main at `5c6ddf3` (UX-09 merged as #444, then three Lovable commits). UX-04 to UX-09 are on main. Reports read:
`design/audits/ux-0{6,7,8,9}/REPORT.md`; UX-04 and UX-05 have none on disk (UX-06 to UX-09 say the same). `node_modules` was missing;
`npm ci` installed the lockfile. The `karpathy-guidelines` skill is not installed; its four rules were followed as written.

Baseline Vitest on main (a clean worktree): **11,526 passed, 31 failed**, all outside the profile: `lookRules.test.ts` (12, the build
page's spacing and colour findings), `readerSteps` (4), `ux03.p4` (3), `ux03.p3` (2), and one each in `everything`,
`onePrompt.snapshot`, `shapes`, `BuildSteps`, `BuildSteps.tiles`, `BuildView`, `readerSessions`, `SandboxPage.add`, `ca21.p7`,
`connection`.

Screenshots, before and after: `design/audits/ux-10/{before,after}/profile-*-{1440,390}-{noon,dusk}.png` (Light is `noon`, Dark is
`dusk`), taken of `/dev/kit/pages/profile` on two dev servers, main and this branch, by a throwaway script. Before is someone else's
profile only: the old dev page has no own-profile view. After has both (`own=1`). No horizontal scroll at 1440 or 390 in either theme.

### Assumptions (each fact the prompt states, and what the disk says)

1. **The route** is `/profile/:handle` (and `/profile` for your own), not `/u/:username`. Followers and following went under it:
   `/profile/:handle/followers`, `/profile/:handle/following`.
2. **The profile files** are as named. Retired: `ProfileBanner.tsx` (deleted), `ProfileView.tsx` (rewritten), `profileModel.ts`
   (trimmed). Tests importing them: `ProfileView.test.tsx`, `ux07.p3.test.tsx`, `profileModel.test.ts`, `ProfilePage.test.tsx`
   (deleted or rewritten), `ux07.budget.test.tsx` (now reads the feed's filter), `src/dev/fixtures/profile.tsx`, `ProfileDemo.tsx`.
3. **`getProfileSummary`** selects the columns named, and `avatar_url` is a **public URL**, not a signed path: `Avatar` draws `src` as
   it comes. It also made a second request (`profile_stats` and `follows`) after the first; nobody reads `profile_stats`' counts any
   more, so that read is gone and the follow check rides on the profile's request (see Checks).
4. **`EditProfileSheet`** writes `banner_url` from a typed field, as stated. Deleted.
5. **`EditMediaDialog`** is told what it edits by `request` (the grid's position, which picture, which tab, where focus returns) and
   `editor` (the Tiptap editor it reads the grid from), with `host` (the picture store). **It returns nothing**: Save writes the
   attributes straight into the editor (`setPictureAttrs`). A profile has no editor, so the dialog gained a third input besides the
   two flags the prompt allows: `picture` (one picture's still, size, crop and ALT) with `onSave` handing back `{ crop, alt }`, and
   `remove` for the footer button, plus `round`. The post path is unchanged (a snapshot taken on main, held here).
6. **On a phone the dialog is not a `BottomSheet`**: it is a full-screen `Dialog.Content`. Left as it is.
7. **Upload.** `uploadPostPicture` needs a build id, as stated; `uploadMedia` writes a `build_media` row. Reading (a) was taken:
   `uploadMedia` takes a profile owner (`{ profileId, file, onProgress }`) and runs the same size and type checks, probe and progress,
   into a public bucket, with no row. **Bucket:** `profile-assets` already exists (20260318185802), public-read, writable only under
   `<uid>/`. No bucket was added. It sets no size or type limit itself; the client checks first (`pictureRejection`, then stills only).
   There is also a public `avatars` bucket, unused by the code.
8. **The build feed function** (`get_build_feed`) takes no person, so `get_profile_feed` was written (Part 4).
9. **`listEntriesBy` does not exist.** The person's topics and replies are read by `listPostsBy` and `listTopicsBy`
   (`src/lib/openbuilds/connections.ts`); by id, `readPostsByIds` and `readCardExtras`, which the feed reuses.
10. **A build's first post** is drawn outside the build page by `FeedPost` (`src/components/gallery/FeedPost.tsx`), exactly as Home
    draws a build; it reads `builds.post_doc`. Read by id with `getGalleryBuildsByIds`.
11. **`MapCardView` does exist** but in `BuildsMapsView.tsx`, not `mapsModel.ts`. The model function is `cardOf(build, map, now)` in
    `mapsModel.ts`, which takes the Builds table's `BuildsTableBuild`; the profile maps a gallery build to it (`tableBuildOf`).
12. **`TopicCard` is `PostCard`** (UX-09 says the same). **Home has no "Replied to @kit in <space>" line**: Home draws a reply group
    (`ReplyGroupItem`). The line the prompt describes is the profile's own UX-07 Topics tab (`Replied to @kit · <heading>`); the feed
    keeps that treatment (the post card with a line above it) with the prompt's words. **Home's note card** is `NoteItem`; it gained an
    optional `heading` so the profile draws the prompt's sentence, Home passing nothing.
13. **The database** had no crop, ALT, pin or settings columns (`avatar_crop` and `banner_crop` found nothing). **`level` on
    `profiles`** is a role word (reader, builder…), not the number; the number is `user_progress.level`, readable by its owner only.
    Before, a visitor's level came from `get_visible_surfaces`, which SV-01 restricted to the caller: it answered the reader's own
    level on someone else's profile. Now a visitor's level comes from `profile_level_of`, which answers only as the owner allows.
14. **The report flow cannot take a person.** `content_reports.target_type` is `build | comment | openbuild_post`. `Report` in the
    head's `···` was not wired (see Parts not done).

Two readings, the safer taken: the upload's owner (7); the reply line (12); a third input to the dialog (5); Follow drawn as a
control in the follow lists, since thirty primaries would break the one primary a view has; reproduction notes default to
Everyone, which is what Home already shows (question below); the side column's counts are what the reader may see, so steps added
to other people's drafts count nothing for a visitor (question below).

### Plan (as carried out)

- Part 1: one migration and `src/lib/profile/settings.ts` → Vitest for parse and limits, a text test of the migration.
- Part 2: header shape, `aspects`, `showWarning`, `round`, `picture` → Vitest, and a snapshot of a post's dialog taken on main.
- Part 3: `uploadProfilePicture`, `saveProfileImage`, `removeProfileImage`, the flow, `Avatar`'s crop → Vitest.
- Part 4: `get_profile_feed`, `getProfileFeed` → Vitest; the page audit.
- Part 5, 5b, 6, 7, 8, 9: the views and the page → Vitest per part; the page audit for the follow lists.
- Part 10: delete and trim → a Vitest that the retired copy is gone.
- Part 11: budget, phone, accessibility → Vitest; screenshots at 390 and 1440 in both themes with the scroll measured.

## What each part did

- **P1** `supabase/migrations/20261109120000_ux10_profile_feed.sql`: the profile's columns with checks (`profile_crop_ok`,
  `profile_links_ok`, `profile_settings_ok`, the about and ALT lengths), `profile_pins` (3 at most, only what you made, a pin without a
  position takes the next free one), `build_profile_display`, indexes, `get_profile_feed`, `get_profile_side`, `list_profile_follows`,
  `save_profile`, and one definer, `profile_level_of`. `src/lib/profile/settings.ts` holds the same limits in words.
- **P2** `CROP_ASPECTS` gains `header` (4:1); `EditMediaDialog` gains `aspects`, `showWarning`, `round`, `picture`, `onSave`, `remove`.
- **P3** `src/lib/profile/pictures.ts` and `avatarCrop.ts`; `useProfilePictures.tsx` (choose, upload with progress, crop, Save; Back
  writes nothing; recrop uploads nothing). **The crop site-wide:** `avatar_url` is read by dozens of queries, so the saved URL carries
  its crop as a fragment, `#crop=x,y,w,h` (never sent by the browser), and `Avatar` draws it once for every surface; `avatar_crop`
  holds the same crop as the record. A header's URL stays plain; the profile reads `banner_crop`. `Avatar` gained an `alt` prop.
- **P4** `getProfileFeed`: the rows, then one read per kind started together; the route prefetches the first page and the side column.
- **P5** `ProfileHead.tsx`, pure. **P5b** `FollowListView.tsx`, `FollowListPage.tsx`, two routes, trail `Home / @maya / Followers`.
- **P6** `ProfileFeed.tsx`, `profileEntries.ts`: the four cards, pins first, the build display rule, `?show=`, empty states, the `···`.
- **P7** `ProfileSide.tsx`. **P8** `CustomiseProfile.tsx` and `src/lib/profile/customise.ts` (Save is one `save_profile` call).
- **P9** Your progress in the side column, own profile only; the track writes through `setUserTrack` and `respecTrack` as before.
- **P10** see Retired. **P11** the budget and accessibility tests; `aria-current="page"` on the account menu's and the phone menu's
  Profile link on your own profile.

Commits are one per part, in the order 1, 2, 3, 4, 5, 5b, 7, 8, 6, 9, 10, 4 (prefetch), 11: the side column and the window had to
exist before the page could draw them.

## Copy changed

- `Builds hung` / `Reproduced by others` / `Rebuilds of their work` / `Bounties solved` (stat boxes) -> `14 builds · 9 reproduced by
  others · rebuilt from 6 times · 31 topics and replies` · `src/pages/site/profile/profileFeedModel.ts` (`recordParts`)
- `Maker · Leeds · since Feb 2026` -> `@maya · Leeds · joined Feb 2026 · 412 followers · 180 following` · `profileFeedModel.ts` (`metaParts`)
- `22 weeks · outlined days were frozen`, `Activity` -> removed · `ProfileView.tsx`
- `Creator marks`, `Common · rare · highest` -> `Marks`, no line · `ProfileSide.tsx`
- Tabs `Builds Rebuilds Reproduced Collections Topics` -> filter `All Builds Topics Replies Notes` · `profileFeedModel.ts` (`FEED_OPTIONS`)
- `No builds hung yet.` and the tabs' empty lines -> `No builds yet.`, `No topics yet.`, `No replies yet.`, `No notes yet.` · `profileFeedModel.ts` (`emptyFeed`)
- `Replied to @maya · <heading>` -> `Replied to @kit in <space>` / `Replied to @kit's topic` · `profileFeedModel.ts` (`repliedToLine`)
- `Edit profile` sheet with `Cover URL` -> Customise profile window · `CustomiseProfile.tsx`
- `<file> is 30.0MB — the limit is 25.0MB` -> `<file> is 30.0MB. The limit is 25.0MB.` · `src/lib/build/media.ts:266` (moved by
  Part 3, its em dash removed)
- New: every string in `HEAD_COPY`, `FEED_COPY`, `CUSTOMISE_COPY`, `PICTURE_COPY`, `SIDE_TITLES`, `EDIT_COPY.only`,
  `followTitle`, `followEmpty`, `privateLine`, `othersLines`, `noteHeading`.

## Retired

- `ProfileBanner` (220, glass-edged, cover from the most-reproduced build): **deleted**.
- The serif name and the uppercase eyebrow (`eyebrowLine`, `handleLine`, `sinceLabel`): **deleted** with the model functions.
- The level ring and its glow (`ringLabel`, `RING_CAPTION`, `LevelTile`): **deleted** from the profile. `LevelRing` and
  `AvatarLevelRing` (`src/components/profile-game/`) have other importers: **left**.
- The four stat boxes (`StatsWall`, `FiguresView`): **deleted**. `getMakerFigures` (`src/lib/profile/figures.ts`) is still read by
  `MakerFigures` and the progress pages: **left**.
- `WORKS_TABS`, `worksTabOf`, `tabLabel`, `emptyLine`, `WorksView`, `CollectionTileView`: **deleted**. `listMakerBuilds`,
  `listMakerReproducedBuilds`, `countMakerWorks` (`src/lib/profile/makerBuilds.ts`) now have no importer but their tests: **dead
  code on the profile, left for SV-26**. So is `listTopicsBy` / `profileTopicEntries`' reader (`listTopicsBy` is still exported).
- `ActivityGrid` and `activityDays`: `activityDays` **deleted**; `ActivityGrid` is used by the dev catalogue: **left as dead code on
  the profile**.
- The marks' tiers (`marksView`, `RankRung` on the profile): `marksView` **deleted**; `RankRung` used by the catalogue: **left**.
- `figuresBarsExpected`: **deleted** with `ProfileViewSkeleton`'s old body.
- `EditProfileSheet`: **deleted** (no importers).
- The old profile board was already in `design/reference/archive/` (UI-P99): nothing to move.

## Checks

- **Type check**: clean. **Lint** on every changed file: no errors (warnings are the existing fast-refresh ones).
  `getProfileSummary.ts` lost its `as any` reads: the row is typed.
- **Vitest**: see the final numbers in the PR description; every new test passes; the failures are main's 31.
- **Build**: passes.
- **`audit:pages`** (profile, followers, following, 3 runs): rounds met (2, 1, 1). Two fixes on the way: the audit's world answered a
  profile read by its handle with every profile, so `.maybeSingle()` refused two rows and the old profile had **never loaded** in the
  audit (its baseline of 11 counted an error page); `pageStage` now answers profiles through the same filter as builds. And
  `pageBaseline.json` now says `profile: 17`, `profile-followers: 7`, `profile-following: 7` (cold, app start-up included).
  The feed's requests: one `get_profile_feed`, then for builds two (`getGalleryBuildsByIds` and `build_profile_display`), for topics
  and replies one then two (posts, then their extras and the replies' topics), for notes one. That is **more than 1 + kinds**: the
  display choice and the posts' extras are each one more. Not built smaller (see Questions).
- **tier 1** (desktop and mobile): see the PR description for the result.
- **Not run**: `audit:design` (no board), `audit:perf`, `audit:themes`, `audit:contrast`. Light and Dark were checked by the
  screenshots only. **Playwright for Parts 3, 5b, 6, 8 and 11** (setting a picture on a test account, opening the lists from the meta
  line, scrolling two pages, changing the filter and seeing it on the profile): not written. The repo's browser worlds have no
  profile, and these needs a world with storage uploads; Vitest covers each behaviour at the component and page level instead.

## Parts not done

- **Report in the head's `···`**: no report flow takes a person (`content_reports.target_type`). Copy link only. Adding `profile` to
  the check and to `resolve_report` is a moderation change; not done here.
- **The feed's request count** is over 1 + kinds (above).
- **Steps added to other drafts** counts only drafts the reader can read (`get_profile_side` is security invoker), so for a visitor it
  is always zero and the line drops out.
- **Playwright** for the parts named above, `audit:perf`, `audit:themes`, `audit:contrast`.
- **Links in About** are drawn as plain text, not made into links: no link-making helper exists in the site (only `ThreadView` has
  its own).
- **Pin to profile** is offered from the profile feed's `···`, not from the `···` on Home, OpenBuilds or the build page (the prompt
  changes none of those).

## Questions for Miles

1. **The bucket.** Profile pictures go to the existing public `profile-assets` bucket, under the owner's `<uid>/`. Public means one
   less round on every page that draws an avatar; it also means a picture's URL works for anyone who has it, even on a private profile.
   Is that acceptable, or should private profiles' pictures be signed?
2. **Works in** is worked out from published builds' `made_with`. Should it be editable later?
3. **Reproduction notes** default to Everyone, which is what Home's feed already shows to everyone whatever this setting says. Should
   the default be Followers, and should `notes_visible` also hide notes from Home?
4. **A fourth pin**: is one ever wanted? The table refuses it.
5. **Steps added to other drafts**: should a visitor see this count? It needs a definer that counts drafts the reader cannot open.
6. **Report a person**: should the report flow take a profile (a new target type, and what an admin does with it)?
7. **Level for a visitor**: before this change a visitor saw their own level on someone else's profile (SV-01 made
   `get_visible_surfaces` answer only the caller). Now they see the owner's, as `level_visible` allows. Is that what you want?

## What Miles needs to do, in order

1. Send this Lovable message (no storage bucket is added):

```
Apply supabase/migrations/20261109120000_ux10_profile_feed.sql exactly as written. Change nothing else.
Then run the six EXPLAIN (ANALYZE, BUFFERS) queries in its header with real ids and paste the plans back.
```

2. Merge the pull request.
3. Press Publish › Publish changes.
