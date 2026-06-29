## Goal
Mount Session J's profile gamification surfaces on `/profile/:handle` (own + others) and swap feed-card avatars to wrap a 32px `LevelRing`. No business logic changes.

## 1. Add Session J components
Place under `src/components/profile-game/` (renamed from `profile/` to avoid collision with existing `src/components/profile/`):
- `tokens.ts`, `LevelRing.tsx`, `CreatorMarkChip.tsx`, `FounderMark.tsx`
- `ProfileLevelHeader.tsx`, `ProfileStatsBar.tsx`, `ShowcaseStrip.tsx`, `ShowcaseSection.tsx`
- `MasteryRibbons.tsx`, `VisitorCompareFooter.tsx` (placed, **not** mounted)

Port pass per project conventions:
- Strip `"use client"` directives, swap `next/*` (none used).
- Keep inline `style={{}}` token usage as-is (matches Phase 13 glass spec).
- Default-export name preserved.

## 2. Profile-scoped data fetch
`useProgress()` is viewer-only. Add `src/lib/profile-game/getProfileGameData.ts` that takes a `userId` and returns:
```
{ level, xpTotal, xpInLevel, xpForNext, progressPct,
  streakDays, marksCount, marks: CreatorMarkRow[],
  founderBadge: { earned_at, metadata } | null }
```
Reads:
- `user_progress` row → `xp_total`, `level`, `streak_days`
- `creator_marks` (already used by `getCreatorMarks`)
- `user_badges` where `badge_key='founder'` and `state in ('earned','revealed')` → founder presence. Member number = `metadata.member_number` if stored; else fall back to a `rank()` query over `user_badges` ordered by `earned_at` for that key.

Add a `useProfileGameData(userId)` React Query hook. Used for **both** own and visited profiles (own profile no longer needs `useProgress` here).

## 3. Profile page mount (`src/pages/Profile.tsx`)
Replace ONLY the avatar + name block inside `ProfileHeader`. To avoid surgery inside that component, do this instead:
- Keep `ProfileHeader` rendering as-is for cover, bio, follow button, stats stripe, tabs, zones, etc.
- Add a new `headerOverride` slot prop OR (simpler, no API change) render `ProfileLevelHeader` **above** `ProfileHeader` and hide the avatar+name region of `ProfileHeader` via a new `hideIdentity` boolean prop. Implementation choice: add `hideIdentity?: boolean` to `ProfileHeader` — when true, render the cover strip, bio, meta, stats strip exactly as today but omit the avatar/initials block, display name, handle, verified badge, and level chip row. All other markup byte-identical.

Order on the page (own + others, same for all):
```
ProfileLevelHeader  (LevelRing 80, name, handle, verified, FounderMark beside handle if founder, CreatorMarks row — pass marks.slice(0,3); track only if set, currently never)
ProfileStatsBar     (4 L1 stats: Level, XP, Streak, Marks)
ShowcaseSection     (autoPinned, "View cabinet →" → /analytics?tab=trophies)
ProfileHeader hideIdentity   (cover, bio, follow, stats, etc.)
MatchBanner / Welcome / inputs / AuthorStatsPanel / MostReferenced / Zones (unchanged)
```

Showcase items: derive from top creator_marks or featured authored content (use existing `referencedCards.slice(0, 6)` mapped to `ShowcaseItem` shape: `{ id, title, imageUrl, likes: 0, views: 0 }`). Stats bar values:
- Level = `level`
- XP = `xpTotal.toLocaleString()`
- Streak = `streakDays`
- Marks = `marksCount`

Wire `"View cabinet →"` via a `useNavigate("/analytics?tab=trophies")` callback added to `ShowcaseSection` (pass as new optional `onViewAll` prop in the port).

Visitor profiles use the same mounts — `VisitorCompareFooter` is **not** mounted.

## 4. Feed-card avatar swap (`src/components/feed-card.tsx` lines 252–273)
Wrap the existing `<img>` / initials `<div>` (unchanged markup) in `<LevelRing size={32} level={…} progressPct={…} color={tokens.xp} style={{}}>` via a tiny `<AvatarLevelRing>` adapter under `src/components/profile-game/AvatarLevelRing.tsx` that:
- Accepts `userId`, renders `LevelRing size={32}` whose inner ring slot is the existing avatar markup (use a `children` slot variant — add a new `children?: ReactNode` prop to the ported `LevelRing` that, when present, replaces the centre level number with the children at full ring inset).
- Reads `level`/`progressPct` from a lightweight cached query keyed by `userId` (reuse `useProfileGameData`, but with `staleTime: 60_000` and `gcTime: 300_000` to keep feeds cheap).
- Falls back to `level=1, progressPct=0` while loading — ring still renders.

Footprint: 36 → 32 per spec. AccountHoverCard wrapper untouched.

## 5. Comments + DMs avatar swap
Search for shared `Avatar` component usage in comment rows and message threads:
- `src/components/comments/ThreadedComment.tsx`
- `src/components/messages/*Thread*.tsx`

If the avatar is rendered via the shared shadcn `Avatar` component (one-line swap), wrap with `AvatarLevelRing`. Any surface that hand-rolls its avatar markup is skipped (per spec).

## 6. Founder mark
Inside `ProfileLevelHeader` mount, when `founderBadge` is non-null, render `<FounderMark memberNumber={n} />` beside the handle. The ported `FounderMark` accepts `label`; extend it to accept `memberNumber?: number` and render `Founder · #${memberNumber}` (or default label when number absent). Single prop addition — visuals unchanged.

## 7. Out of scope (do not touch)
- `useProgress` hook, `/analytics` page, ambient gamification toasts.
- `ProfileHeader` internals beyond adding the `hideIdentity` boolean.
- `MasteryRibbons`, `VisitorCompareFooter` (placed, not mounted).
- `DailyDigestCard`, `PerkGateTooltip`, `ChallengeNudgePill` (unrelated).

## Test plan
1. Own profile (`/profile`): see 80px ring with current level, name, marks chips (or none), founder crown if eligible, stats bar showing Level/XP/Streak/Marks, Showcase strip with auto-pinned chip; rest of profile byte-identical.
2. Visit another user's profile (`/profile/:handle`): same surfaces render with that user's data; no errors; `VisitorCompareFooter` not present.
3. Home feed cards: avatar is now wrapped by a 32px ring; layout unchanged otherwise; click → hover card still works.
4. Founder test account (badge present): crown chip appears next to handle on own and visited profile.
