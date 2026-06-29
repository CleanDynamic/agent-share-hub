
## Goal
Transform `/analytics` into a gamified "Your Progress" page with three tabs (Overview / Trophies / History). Existing analytics (stat cards, chart, posts table, heatmap) are kept verbatim, nested under Overview > "Your content" section. Build the full progress backend (XP, level math, quests, daily challenges, creator marks, visible surfaces) and wire v0 components from five GitHub repos.

## Phase 1 — Database (single migration)

New tables (all with GRANTs + RLS):

- `user_progress` — `user_id PK→auth.users`, `xp_total int`, `level int`, `eligible_at timestamptz NULL`, `counters jsonb` (saves, comments, publishes, returns, etc.), `quest_state jsonb` (per-step booleans + completed_at), `last_active_date date`, timestamps. Self-read/update only.
- `xp_events` — `id`, `user_id`, `amount int`, `reason text`, `source_type text`, `source_id uuid NULL`, `metadata jsonb`, `created_at`. Self-read only; inserts via SECURITY DEFINER RPC.
- `creator_marks` — `id`, `user_id`, `mark_key text` (e.g. `first_publish`, `streak_7`, `comment_10`), `earned_at`, `pinned bool default false`, `display_order int`. Public read, self-update for pin/order.
- `daily_challenges` — `id`, `user_id`, `challenge_key text`, `target int`, `progress int`, `claimed bool`, `xp_reward int`, `expires_at`, `created_at`. Self-read/update.
- `challenge_history` — `id`, `user_id`, `challenge_key text`, `xp_awarded int`, `completed_at`. Self-read; insert via RPC.

RPCs (SECURITY DEFINER):
- `award_xp(_reason text, _amount int, _source_type text, _source_id uuid, _metadata jsonb)` — inserts xp_event, bumps `user_progress.xp_total`, recomputes level via `floor((xp/75)^(1/1.7))`, recomputes `eligible_at` (first time xp ≥ threshold), returns new totals.
- `claim_challenge(_challenge_id uuid)` — validates ownership + progress ≥ target + not claimed, awards XP via internal call, inserts history row, marks claimed.
- `get_visible_surfaces(_user_id uuid)` returns jsonb — server-side computes which surfaces show (quest, daily_nudge, marks_row, showcase, ledger, empty_state, eligibility_notice) based on level, account age, quest state, counters. **Single source of truth for visibility.**
- `get_quest_state(_user_id uuid)` returns jsonb with each step status + next milestone label.

Trigger on `auth.users` insert seeds `user_progress` row (extend existing `handle_new_user`).

## Phase 2 — v0 component pull

Clone all five repos into `/tmp/v0/` then copy needed `.tsx` files:

| Repo | Dest folder | Files to copy |
|---|---|---|
| v0-session-a | `src/components/progress/` | LevelRing, XpBar, XpToast, LevelUpModal, XpLedger, XpStatCard, EligibilityNotice, CreatorMarkChip |
| v0-session-b | `src/components/progress/` | ProgressHero, PeriodToggle, SectionHeader, EngagementGrid, NextUnlockCard, EmptyProgressState, ProgressTabBar, DepthRevealModal |
| v0-session-f | `src/components/challenges/` | QuestChecklist, DailyNudgeCard, ClaimButton, ChallengeCompleteToast, ChallengeHistoryRow (+ place but don't mount: ChallengesPanel, WeeklyChallengeCard) |
| v0-session-d | `src/components/trophies/` | CreatorMarkTile, CreatorMarksRow, ShowcaseStrip (+ place rest, don't mount) |
| v0-session-e | `src/components/streaks/` | StreakFlame, StreakInlineNote (only these two for now) |

Normalize imports (`@/` paths, shadcn primitives, `cn` from `@/lib/utils`), strip Next.js artifacts, swap fonts to Playfair/Inter, swap colors to existing Sienna/Teal tokens.

## Phase 3 — Data layer (`src/lib/progress/`)

- `getUserProgress.ts` — selects user_progress row; computes derived `xp_in_level` / `xp_to_next` using the 75×L^1.7 curve.
- `getVisibleSurfaces.ts` — calls RPC; returns typed object.
- `getQuestState.ts` — calls RPC; maps to steps array with `done`, `goHref`, `label`.
- `getChallenges.ts` — selects today's daily_challenges (creates a row via RPC if none exists for today).
- `getXpEvents.ts` — paged select from xp_events ordered desc.
- `getCreatorMarks.ts` — selects earned + pinned.
- `claimChallenge.ts` — calls RPC, returns `{ xp_awarded, new_total, new_level, leveled_up }`.
- `awardXp.ts` — thin wrapper around RPC (for client-driven nudge completion etc.).
- `index.ts` — barrel.

## Phase 4 — `src/hooks/useProgress.ts`

Single hook using react-query. Fires four parallel queries: `getUserProgress`, `getVisibleSurfaces`, `getQuestState`, `getChallenges`. Exposes `{ progress, surfaces, quest, challenges, marks, isLoading, refetch }`. Mutations exposed via separate hooks `useClaimChallenge` and `useAwardXp` (invalidate progress + challenges + ledger on success; trigger `XpToast` + `LevelUpModal` if `leveled_up`).

## Phase 5 — Page composition (`src/pages/Analytics.tsx`)

Keep route path `/analytics`. Rename visible title to "Your Progress". Refactor file to:

```text
<SeoHead title="Your Progress — NeoScale AI" />
<ShellHeader title="Your Progress" backHref="-1" />
<ProgressTabBar tabs={surfaces.tabs ?? ['overview','trophies','history']} />

{tab === 'overview' && (
  <>
    {surfaces.eligibility_notice && <EligibilityNotice eligibleAt={progress.eligible_at} />}
    <ProgressHero
      level={progress.level}
      xpInLevel={...} xpToNext={...}
      avatarUrl={profile.avatar_url}
      name={profile.display_name}
      marks={marks.slice(0,3)}
      rightSlot={<><StreakFlame days={progress.streak} /><StreakInlineNote /></>}
    />
    {surfaces.quest && <QuestChecklist steps={quest.steps} onGo={handleQuestGo} />}
    {surfaces.daily_nudge && challenges.today && (
      <DailyNudgeCard challenge={challenges.today} onClaim={claim} />
    )}
    <NextUnlockCard
      milestoneLabel={quest.next_milestone}
      isMysterious={quest.completed && progress.level < 5}
    />
    {surfaces.empty_state ? (
      <EmptyProgressState />
    ) : (
      <EngagementGrid counters={progress.counters} />
    )}
    <SectionHeader title="Your content" />
    <ExistingAnalyticsBlock />  {/* OverviewCards + ViewsDownloadsChart + ContentPerformanceTable + BlockEngagementHeatmap, unchanged */}
  </>
)}

{tab === 'trophies' && (
  <>
    <CreatorMarksRow marks={marks} showInvitations />
    <ShowcaseStrip marks={marks.filter(m=>m.pinned)} autoPinned />
  </>
)}

{tab === 'history' && (
  <>
    <XpLedger events={events} onLoadMore={...} />
    <SectionHeader title="Challenges completed" />
    <ChallengeHistoryRow.List items={history} />
  </>
)}
```

Existing analytics functions (`OverviewCards`, `ViewsDownloadsChart`, `ContentPerformanceTable`, `BlockEngagementHeatmap`) are extracted unchanged into a single `ContentAnalyticsSection` wrapper component for clarity — no styling or query changes.

## Phase 6 — Quest step deep-links

`handleQuestGo(stepKey)`:
- `verify-email` → trigger Supabase `resend({type:'signup'})` + toast
- `complete-profile` → `navigate('/profile')` (edit modal)
- `first-save` → `navigate('/discover')`
- `first-comment` → `navigate('/discover')`
- `first-publish` → `openUploadPicker()` via `UploadPickerContext`
- `first-nudge` → `scrollIntoView` on DailyNudgeCard ref
- `return-tomorrow` → no-op info row

## Phase 7 — Visibility rules (server, in `get_visible_surfaces`)

- `eligibility_notice`: `eligible_at IS NULL OR eligible_at > now()`
- `quest`: `quest.completed = false OR age_days < 14`
- `daily_nudge`: always true when authed
- `marks_row` / `showcase` / `ledger`: always true on respective tabs
- `empty_state`: counters all zero AND level = 1
- `tabs`: always `['overview','trophies','history']` for now

## Phase 8 — Verification

- Fresh test account: Overview shows EligibilityNotice + ProgressHero (L1) + QuestChecklist + DailyNudgeCard + NextUnlockCard + EmptyProgressState. Existing analytics still rendered below SectionHeader.
- Established account with seeded xp_events + marks: hero shows correct level (verify 75×L^1.7), ledger paginates, marks row populated, analytics table intact.
- Tab bar shows only Overview / Trophies / History.
- ProtectedRoute still gates; non-creator gate removed (progress shows for all users).

## Out of scope (explicit)
ChallengesPanel, WeeklyChallengeCard, CabinetGrid, ShowcaseEditor, DepthRevealModal, skill-tree components — files placed but not imported. No changes to left rail, right rail, feed, or other routes.

## Files touched
- `supabase/migrations/<new>.sql` (new)
- `src/components/progress/*` (8 new)
- `src/components/challenges/*` (7 new, 5 mounted)
- `src/components/trophies/*` (3+ new, 3 mounted)
- `src/components/streaks/*` (2 new)
- `src/lib/progress/*` (9 new)
- `src/hooks/useProgress.ts` (new)
- `src/hooks/useClaimChallenge.ts`, `useAwardXp.ts` (new)
- `src/pages/Analytics.tsx` (restructured; analytics sub-components extracted intact)
