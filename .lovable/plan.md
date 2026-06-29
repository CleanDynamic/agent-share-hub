## Problem

`src/pages/Profile.tsx` currently stacks two competing identity systems with no shared rhythm:

1. **`ProfileLevelHeader`** (level ring + name + handle) — own card
2. **`ProfileStatsBar`** (Level / XP / Streak / Marks)
3. **`ProfileHeader`** (cover banner with "Edit profile" / share buttons floating over it, then name/joined/follower counts *below* the banner — but the name is hidden via `hideIdentity`)
4. `MatchBanner` → `WelcomeCoachmark` → `AuthorStatsPanel` → `MostReferenced` → `ShowcaseSection` → zones

Symptoms visible in the screenshots:
- Page is **880px wide** while the rest of the app (FeedShell, Home) is locked to **600px** — profile sticks out wider than every other route.
- The gamification card + stats bar sit *above* the cover banner, so the banner reads as a second, disconnected header. Name "NeoScaler" appears under the banner with no avatar next to it (avatar is up in the level ring), and follower counts float as a fourth identity row.
- No consistent gap rhythm — sections butt up against each other (`space-y-3` only wraps the first two, everything after has no spacing wrapper).
- `Showcase` strip overflows horizontally with a visible native scrollbar.

## Plan

Restructure the page into one cohesive identity block followed by clearly separated content sections, all on the same 600px column the rest of the app uses.

### 1. Match global width and rhythm
- Change `max-w-[880px]` → `max-w-[600px]` (matches `FeedShell`, `Home`, `ShellHeader`).
- Wrap the entire page body in a single `space-y-6` container so every section has identical 24px vertical rhythm.
- Update `ProfileSkeleton` to the same 600px width.

### 2. Single unified identity block (replaces 3 stacked headers)
New order inside one bordered glass card:

```text
┌─────────────────────────────────────────┐
│  [Cover banner — 160px, rounded top]    │
│                                         │
│  [Avatar w/ LevelRing, -40px overlap]   │
│   Sun Tzu  @suntzu   [Edit] [Share]    │
│   NeoScaler · Joined March 2026         │
│   0 followers · 1 following             │
│   [creator marks row, if any]           │
└─────────────────────────────────────────┘
```

- Keep `ProfileHeader` as the single identity surface; remove `hideIdentity`, remove the standalone `ProfileLevelHeader`.
- Pass `level` + `progressPct` into `ProfileHeader` so the existing avatar is wrapped with `LevelRing` (using the existing `AvatarLevelRing` component already in `src/components/profile-game/`).
- Pass `creatorMarks` and `founderBadge` into `ProfileHeader` as an optional row under the name.
- Move "Edit profile" / Share into the name row (right-aligned), out of the floating overlay on the banner.

### 3. Stats row, demoted and merged
- Delete the standalone `ProfileStatsBar` (Level / XP / Streak / Marks) — Level is already shown on the avatar ring; XP/Streak/Marks belong on `/analytics`.
- Replace the AuthorStatsPanel's "Total views / Referenced / Avg depth" with a tighter 3-column stats strip styled identically to the rest of the app's stat chips (same tokens as `stats-overview.tsx`), so there is exactly **one** stats row on the page.

### 4. Showcase fix
- `ShowcaseSection` currently overflows with a visible scrollbar. Constrain its inner strip to the 600px column, use `overflow-x-auto scrollbar-none snap-x`, and render cards at a size that fits 2 per row (≈ 280px) instead of 3.
- Move "View cabinet →" into the section header instead of floating over the cards.

### 5. Final section order (top → bottom)
```text
1. Identity card        (banner + avatar+ring + name + marks + actions + counts)
2. MatchBanner          (visitor-only)
3. WelcomeCoachmark     (own zero-content state)
4. AuthorStatsPanel     (3-stat strip — single source of stats)
5. MostReferenced       (horizontal strip)
6. ShowcaseSection      (constrained, 2-per-row)
7. ProfileContentZones  (Authored / Curated / Activity / Network tabs)
```

All separated by the same `space-y-6` rhythm.

### Technical details

Files touched:
- `src/pages/Profile.tsx` — width swap, remove `ProfileLevelHeader` + `ProfileStatsBar` from JSX, wrap body in `space-y-6`, drop `hideIdentity`, forward `level`/`progressPct`/`creatorMarks`/`founderBadge` into `ProfileHeader`.
- `src/components/profile/ProfileHeader.tsx` — accept new optional props (`level`, `progressPct`, `creatorMarks`, `founderAccessory`); wrap existing avatar in `AvatarLevelRing`; move action buttons into the name row; render marks row under name.
- `src/components/profile-game/ShowcaseSection.tsx` (or its strip child) — clamp width, hide native scrollbar, switch card size for 2-up layout, move CTA into header.

No data-layer or query changes. No removal of gamification — just consolidated into the existing header instead of stacked above it.
