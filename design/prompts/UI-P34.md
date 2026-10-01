# UI-P34 — Page: Profile

Follow `design/RULES.md` (§7).

**Goal.** `/profile/:handle` as the reference: the banner, the level ring with tracks, the stats wall label, works, the activity grid and creator marks.

**Read first.** `pages/Profile.tsx`, `profile/ProfileHeader.tsx`, `MakerFigures.tsx`, `profile-game/ProfileLevelHeader.tsx`, `LevelRing.tsx`, `ProfileStatsBar.tsx`, `trophies/*`, `streaks/streak-calendar.tsx`, `src/lib/progress/*` and the `user_progress` table (`xp_total`, `level`, `counters`, `streak_*`) — the level curve is `level = floor((xp / 75) ^ (1 / 1.7)) + 1`, so use the module's own helpers rather than recomputing it; the `badges` table (`is_creator_mark`, `tier`, `criteria`) and `src/components/trophies/*` (there is a second, client-side copy of the badge catalogue in `trophies/badge-data` — read from one source, do not add a third); `streak_days`; `listBuildsByCreator` (verified, `src/lib/build/builds.ts`); `getMakerFigures` (UI-P26); the library's collections module; the follow action; HANDOFF §5.7. Track switching (`architect | curator | mentor | explorer`) and a creator-marks getter may not exist — check, and where they do not, render the track chips read-only and the marks from `user_badges` directly (§8).

**Reference.** `desktop/{noon,dusk}/profile.html`, `mobile/{noon,dusk}/profile.html`.

**Desktop.** A column, gap 12: row 1 grid `minmax(0, 1fr) 440px` at **220px**; row 2 the stats (natural height); row 3 grid `minmax(0, 1fr) 360px` filling, its right track a column (gap 12) of Activity and Creator marks, each `flex-grow: 1`.
- **Banner** `<section>` radius 16, `overflow: hidden`, 1px `--glass-border`, `--shadow-card`: the cover of the maker's most-reproduced build (else `CoverFallback` seeded with the user id); the arc (viewBox 900×260, centre (1150, −420), r 760); a scrim `linear-gradient(0deg, var(--banner-scrim) 0%, transparent 70%)`. At the bottom (left 20, right 20, bottom 18) a row, `flex-end`, gap 18: a 104×104 square (radius 14, `--inverse`, `--shadow-square`) holding `Avatar` 78; a column, gap 6, grows: `Eyebrow` in `--text` "Maker · {place} · since {Mon YYYY}" (omit parts that are missing); `h1` `type.display(52)`, −0.04em, line-height .95, the display name; "@{handle} · {bio}" in Figtree 13px `--text`; then the actions, gap 8: primary "Follow" with `Plus` (following: secondary "Following" with `Check`), secondary "Message" with `MessageSquare` (only if messaging exists). On your own profile: secondary "Edit profile" instead.
- **Level** `Panel` padding 16px 18px: a row, gap 16, centred: `OrbRing` 150 at `xpProgressInLevel()` with the level number and "level"; a column, gap 8, grows: `Eyebrow` "Track"; `Segmented` 30/11 **Architect · Curator · Mentor · Explorer** (own profile: changes track through `setUserTrack` / `respecTrack` with the existing confirmation; others: the same control read-only with `aria-disabled`); "{xp} / {next} xp · {remaining} to {next level name}" in DM Mono 12px `--text2`; a row, gap 6, Figtree 12px `--text2`: `Flame` 15 `--lit-ink` "{n}-day streak · best {m}".
- **Stats** `WallLabel` 4 columns of `Stat`: "Builds hung"; "Reproduced by others" (`--evidence` bar); "Rebuilds of their work" (`--cat-agents` bar); "Bounties solved" with "/ £{earned}" (`--action` bar). Each bar shows progress to that figure's next creator-mark threshold when `getCreatorMarks()` defines thresholds; where it does not, the `Stat` has no bar (an expected compare difference — note it in the report).
- **Works** `Panel` padding 12px 16px 14px: `UnderlineTabs` 13 "Builds {n}" · "Rebuilds {n}" · "Reproduced {n}" · "Collections {n}" (4px below it) and a grid of 4 columns, gap 12, build cards (cover 86, title 17); in `board` fit one row; live, paging with "Show more". Collections shows collection tiles in the same card frame (cover mosaic of the first four builds, title, "{n} builds").
- **Activity** `Panel` padding 14px 16px: `PanelHead` (13px) "Activity" / "22 weeks · outlined days were frozen"; `ActivityGrid` of the last 22 weeks (`getStreakDays(userId, 154)`) 12px below.
- **Creator marks** `Panel` padding 14px 16px: `PanelHead` (13px) "Creator marks" / "Common · rare · highest"; 12px below, a row `space-between` of up to five tiles, 64 wide, column gap 6: the 46×46 tile (radius 13, `Trophy` 20; highest `--lit` / `--on-lit` with `--rank-glow`; rare `--recess`; common 1.5px `--line`) over the mark's name (Figtree 10px `--text2`, centred, line-height 1.2).

**Mobile** (390×1720), gap 12:
1. Banner `<section>` 290 tall: the cover 180 tall (radius 18, 1px `--glass-border`) with the arc (viewBox 362×180, centre (520, −300), r 440); the 92×92 square (radius 16, `Avatar` 70) at left 14, top 130; a text column at left 120, right 0, top 190, gap 4: `Eyebrow` "Maker · {place}", `h1` `type.display(30)`, "@{handle} · {bio}" Figtree 12px `--text2`.
2. Actions: grid 2 columns, gap 8, full-width 48/15 primary "Follow" and secondary "Message".
3. Level `Panel` padding 16: `OrbRing` 118; a column, gap 6: `Eyebrow` "{Track} track", "{xp} / {next} xp" DM Mono 13px `--text`, "{remaining} to {next}" Figtree 12px `--text2`, the streak row; 14px below a `ScrollRow` of `FilterChip`s for the four tracks (margin 14px −2px 0).
4. Stats `WallLabel` 2 columns.
5. Works tabs as a `ScrollRow` of `FilterChip`s; the works grid, 2 columns, gap 6px 10px, cover 90, title 17.
6. Activity `Panel` padding 14px 16px, subtitle "22 weeks · outlined days were frozen", the grid in an `overflow: hidden` box.
Creator marks sit after Activity on phones (not drawn): the same tiles in a `ScrollRow`.

**Done when.** The four Profile boards compare within 0.04 (bars as noted); following, track changes and the works tabs behave as before; nothing calls `award_xp()`.

**Commit.** `UI-P34: Profile in the site frame`
