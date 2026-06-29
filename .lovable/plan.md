# Level-5 Depth Reveal + L2 Surface Mount

All visibility flows from `getVisibleSurfaces()`; reveal only flips server state via `mark_depth_revealed()`.

## 1. Migration — engine + perks + notifications

New migration adds the missing engine pieces (current schema has tables but no RPCs):

- `mark_depth_revealed()` SECURITY DEFINER — sets `user_progress.depth_revealed_at = now()` if null, flips all `user_badges` rows where `user_id = auth.uid() AND state = 'pending_reveal'` → `'earned'`, returns the timestamp.
- `set_user_track(_track text)` — first-time pick (no respec window check), records track; `respec_track(_track text)` — enforces 30-day cooldown from `last_respec_at`, refunds `track_xp` per spec (reset to 0).
- `perks` catalogue table (`slug`, `track`, `tier`, `effect_key`, `description`) seeded with the four T1 perk-gated controls (`desc_length_1000`, `templates`, `custom_tags_advanced`, `advanced_filters`) plus `architect_t2_template`.
- `user_perks(user_id, perk_slug, earned_at)` derived view or table populated when `level` crosses tier thresholds within the active track; `has_perk(_user_id uuid, _slug text)` SQL function used by RLS-friendly client reads.
- Extend `get_visible_surfaces()` to return `depth_revealed` boolean, `tabs: ['overview','skill_tree','trophies','challenges','history']` once `depth_revealed_at IS NOT NULL`, and `skill_tree_isnew` / `challenges_isnew` flags (true for 7 days after reveal).
- `get_quest_state` / weekly challenge instantiation function (`ensure_weekly_challenge`) that materialises one weekly row + tops up to 3 dailies.
- Notification subkinds: emit `depth_unlocked` on first level-5 award inside `award_xp`, `tier_unlocked` when a perk crosses tier 2/3 within track, plus `streak_milestone` / `streak_lost` / `streak_saved` from a `record_daily_activity()` engine function (called from existing engagement hooks).
- All new tables get `GRANT SELECT` to `authenticated` + RLS owner-only policies; RPCs `GRANT EXECUTE TO authenticated`.

## 2. Library layer — `src/lib/progress/`

- Extend `index.ts` with `markDepthRevealed()`, `setUserTrack()`, `respecTrack()`, `getUserPerks()`, `hasPerk(slug)`, `getMasteryTracks()`, `recordDailyActivity()`, `getStreakDays(range)`.
- Update `VisibleSurfaces` type to include new flags + tabs.
- New hooks in `useProgress.ts`: `useUserPerks()`, `useHasPerk(slug)`, `useStreakDays()`, `useWeeklyChallenge()`, `useMasteryTracks()`, `useSetTrack()`, `useRespec()`, `useMarkDepthRevealed()`.

## 3. v0 component placement

```text
src/components/skilltree/   ← session-c
  SkillTreeCanvas, SkillNode, TrackPicker, TrackUndecidedState,
  PerkDetailPanel, TrackXpBar, RespecDialog, PerkPill, TierUnlockModal, tokens.ts
src/components/streaks/     ← session-e additions
  StreakCalendar, FreezeIndicator (already), StreakMilestoneModal,
  StreakLostCard, StreakSavedToast (already)
src/components/trophies/    ← additions
  CabinetGrid (already), BadgeDetailModal (already), HiddenBadgeSlot (already),
  MasteryTrackCard, FounderBadgeCallout
src/components/depth/
  DepthRevealModal.tsx (wraps existing PendingRevealStrip)
src/components/profile-game/
  MasteryRibbons.tsx, VisitorCompareFooter.tsx
```

Each component normalised: replace v0 design tokens with `src/styles/tokens` Sienna palette; rewrite hardcoded `text-white`/`bg-*` to semantic classes per project conventions; convert `next/link` → `react-router-dom`.

## 4. Reveal sequence

In `GamificationToasts.tsx` add a notification subscriber for `notification_type IN ('depth_unlocked')`:

1. Fetch `user_badges` where `state = 'pending_reveal'` joined to `badges`.
2. Mount `<DepthRevealModal pendingBadges={…} />` once per session (guard: `depth_revealed_at` null **and** modal not already opened in this session ref).
3. On modal close: `await markDepthRevealed()` → invalidate `['progress']`, `['visibleSurfaces']`, `['userBadges']`. Modal becomes inert once RPC returns (re-open impossible because `depth_revealed_at` is set).

## 5. `ProgressTabBar` driven by surfaces

`Analytics.tsx`:

- `tabs = surfaces.tabs` mapped through label table (adds `skill_tree`, `challenges`).
- `isNew` dot rendered on Skill tree + Challenges when `Date.now() - depth_revealed_at < 7 days`.
- Tab content switch extended with two new branches.

## 6. Skill Tree tab

```text
if (progress.track == null)
  → <TrackPicker onPick={setTrack} onDefer={() => showUndecided=true}/>
  → if showUndecided → <TrackUndecidedState onPick={…} />
else
  → <TrackXpBar track={progress.track} xp={progress.track_xp}/>
    <SkillTreeCanvas track perks={userPerks} onSelect={setSelectedPerk}/>
    <PerkDetailPanel perk={selectedPerk} unlocked={hasPerk(slug)} />
    <button onClick={openRespec}>Switch path</button>
    <RespecDialog cooldownUntil={progress.last_respec_at + 30d} onConfirm={respec}/>
```

`TierUnlockModal` driven by `tier_unlocked` notification subscription in `GamificationToasts`.

## 7. Challenges tab

New `ChallengesPanel`:

- 3 dailies (existing `useChallenges`) + countdown to local midnight.
- `WeeklyChallengeCard` from `useWeeklyChallenge()`.
- Overview's existing `DailyNudgeCard` shrinks to a compact pointer linking to `?tab=challenges`.

## 8. Trophies tab upgrade

- Replace simple grid with `CabinetGrid` (filter chips, sort dropdown).
- `BadgeDetailModal` opens on tile click.
- `HiddenBadgeSlot` shows count of unearned `kind='hidden'` badges.
- `MasteryTrackCard` list from `useMasteryTracks()`.
- `ShowcaseStrip` switched to `autoPinned={false}`; "Manage" button mounts `ShowcaseEditor` (drag-to-reorder persists via `user_badges.showcase_order`).
- `FounderBadgeCallout` when viewer is founder-eligible (badge slug `founder` earned or pending) and cabinet has < 3 earned.

## 9. Streak surfaces

Below the `ProgressHero` on Overview: `<StreakCalendar days={streakDays}/>` + `<FreezeIndicator used={progress.freezes_used_month} cap={2}/>`.

`GamificationToasts` subscribes to `streak_milestone` → `StreakMilestoneModal`, `streak_lost` → in-feed `StreakLostCard` (queue), `streak_saved` → toast.

## 10. Remix depth

- `DescendantBadge`: flip `interactive` default → true; clicks navigate to `/b/:slug/lineage`.
- New route in `App.tsx`: `<Route path="/b/:slug/lineage" element={<Lineage/>}/>` rendering `LineageTreeView` fed by an RPC `get_post_lineage(_root_id)` returning post tree (post_id, parent_post_id, author, title, depth).
- `RemixSettingsRow`: pass `advanced={depthRevealed}` plus `hasPerk={hasPerk('architect_t2_template')}` → unlocks the attribution-info row and template toggle.

## 11. Ambient L2

- `DailyDigestCard` mounted at top of `FeedShell` (Home), shown once per day (`localStorage` key `digest:<date>:<userId>`) and only when `surfaces.depth_revealed`.
- `PerkGateTooltip` wraps four T1 controls in Upload editor:
  - description length picker (`desc_length_1000`)
  - templates picker (`templates`)
  - custom tags advanced mode (`custom_tags_advanced`)
  - advanced discover filters (`advanced_filters`)
- `ChallengeNudgePill` mounted from `GamificationToasts`, throttled to 1/day via `localStorage`.

## 12. Profile

- `MasteryRibbons` under bio (above stats bar) reads `useMasteryTracks(profileUserId)`.
- `VisitorCompareFooter` mounts at profile bottom when **both** viewer and owner have `depth_revealed_at` set (skip otherwise).

## 13. Manual verification

Bump admin's XP via insert tool to ~1500 (level 5+):

1. Reload `/analytics` → `DepthRevealModal` fires once with pending badges → close → RPC sets `depth_revealed_at`; reload doesn't re-trigger.
2. Tabs now include Skill tree + Challenges with isNew dots.
3. Pick Architect track → upload editor description limit accepts 1000 chars (enforced via `hasPerk('desc_length_1000')`).
4. Defer track pick → `TrackUndecidedState` persists.
5. Trophy filters/sort work; drag showcase order; reload preserves order.
6. Create a 2-level remix chain; `/b/:slug/lineage` renders tree.
7. Sign in as a fresh L1 account: no skill tree / challenges tab, no depth modal, no DailyDigestCard, no perk tooltips.

## Files

**New migration**: `supabase/migrations/<ts>_depth_reveal_engine.sql`

**New libs/hooks**:
- `src/lib/progress/index.ts` (extend)
- `src/hooks/useProgress.ts` (extend)
- `src/lib/remix/getLineage.ts`

**New components**:
- `src/components/skilltree/*` (9 files)
- `src/components/streaks/StreakCalendar.tsx`, `StreakMilestoneModal.tsx`, `StreakLostCard.tsx`
- `src/components/trophies/MasteryTrackCard.tsx`, `FounderBadgeCallout.tsx`
- `src/components/depth/DepthRevealModal.tsx`
- `src/components/challenges/ChallengesPanel.tsx`, `WeeklyChallengeCard.tsx`
- `src/components/profile-game/MasteryRibbons.tsx`, `VisitorCompareFooter.tsx`
- `src/pages/Lineage.tsx`

**Edited**:
- `src/pages/Analytics.tsx` (tabs + new panels)
- `src/components/ambient/GamificationToasts.tsx` (depth_unlocked, tier_unlocked, streak_*)
- `src/components/ambient/DailyDigestCard.tsx` (gate by surfaces.depth_revealed + daily throttle)
- `src/components/ambient/ChallengeNudgePill.tsx` (mount + throttle)
- `src/components/remix/DescendantBadge.tsx` (default interactive)
- `src/components/remix/RemixSettingsRow.tsx` (advanced prop)
- `src/pages/Upload.tsx` (PerkGateTooltip wrappers)
- `src/pages/Home.tsx` (DailyDigestCard at feed top)
- `src/pages/Profile.tsx` (MasteryRibbons + VisitorCompareFooter)
- `src/App.tsx` (lineage route)
