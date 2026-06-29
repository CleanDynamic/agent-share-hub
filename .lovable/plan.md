## Ambient Gamification Layer — Mount Plan (ready to build)

Migration already approved & applied: `user_badges` table, `welcome_xp_shown_at` on `user_progress`, `mark_welcome_xp_shown()` RPC, realtime on both `user_badges` and `xp_events`.

### Files to create — `src/components/ambient/`
Ported from Session L (xp/) and Session H (remix/LineageXpToast):
- `tokens.ts`, `NavProgressChip.tsx`, `PostXpFootnote.tsx`, `ActionXpHintInner.tsx` (raw v0), `WelcomeXpModal.tsx`, `LineageXpToast.tsx`
- Placed but unmounted: `DailyDigestCard.tsx`, `PerkGateTooltip.tsx`, `ChallengeNudgePill.tsx`
- New thin shells:
  - `XpToast.tsx` — small bottom-right toast for "+N XP · {reason}" (matches PostXpFootnote visual language but compact)
  - `BadgeEarnedToast.tsx` — sienna-bordered badge card with title/description
  - `ActionXpHint.tsx` — **wrapper** component: `<ActionXpHint amount n trigger>{children}</ActionXpHint>`. Renders child inside a `position:relative` span and overlays the v0 `ActionXpHintInner`. Zero changes to child markup, handlers, or layout.
  - `GamificationToasts.tsx` — singleton toast bus
  - `useWelcomeXp.ts` hook

### GamificationToasts behaviour
- Mounted once in `Layout.tsx` (auth-gated tree).
- Two Supabase realtime channels (random UUIDs):
  - `xp_events` INSERT WHERE user_id=auth.uid() → coalesce within 2 s by `reason` prefix; `metadata.action_type in ('remix_received','lineage_cut')` routes to `LineageXpToast`; everything else to `XpToast`.
  - `user_badges` INSERT WHERE user_id=auth.uid() → `state='earned'` shows `BadgeEarnedToast`; `state='pending_reveal'` is silently ignored.
- Also listens for a `window` custom event `gamification:post-xp` so the bounty-solution submit (which has no success screen) can dispatch a PostXpFootnote without an extra success route.
- Drives `WelcomeXpModal` via `useWelcomeXp`: on first authenticated session whose `user_progress.welcome_xp_shown_at IS NULL`, opens the modal once; CTA navigates `/analytics`; dismiss calls `mark_welcome_xp_shown` RPC. Covers both verify-email and OAuth-first-time paths because the modal triggers off Supabase session, not the auth callback page.

### Surface integrations
- **NavProgressChip** — inserted in `NeoScaleShell.tsx` directly above the `.ns-user-section` (logged-in only); inserted in `ProfileDrawer.tsx` header below avatar/name. Both pull from `useProgress`. Click → `/analytics`.
- **PostXpFootnote** — added to the Upload success screen (`src/pages/Upload.tsx` line ~1362) using XP from the `award_xp` RPC response wired into the existing publish mutation; `BountySolvePage.handleSubmit` dispatches the `gamification:post-xp` event after `submitSolution`.
- **ActionXpHint wrapper** — wraps Like, Save, Download buttons in `src/components/feed-card.tsx` and the matching three actions in `src/components/content-detail/FloatingEngagementBar.tsx`. Fires on successful optimistic mutation only (skipped on rollback). No edits to existing button markup or handlers.

### Explicitly NOT mounted / NOT touched
- `DailyDigestCard`, `PerkGateTooltip`, `ChallengeNudgePill` — files placed, no imports elsewhere.
- `FeedShell`, tab bar, compose strip — untouched.

### Notes
- Award-XP integration: the publish mutation already calls `award_xp` via the data layer hook; if the response shape isn't yet bubbled to the UI, I'll thread it through (returning `{ contentId, awardedXp, badgesEarned }` from the publish helper). The badge toast is fired automatically from the realtime channel, so no UI threading needed for that.
- Toasts render in a bottom-right portal stack (z-index 1200) with FIFO eviction after 5.
- Channel cleanup on Layout unmount; channels keyed by `auth.uid()` so they re-subscribe on user change.

Approve to switch to build mode and apply the file changes.
