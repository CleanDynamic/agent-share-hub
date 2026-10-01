# UI-P25 — Data: where next, for the viewer

Follow `design/RULES.md`.

**Goal.** The Home "Where next — from what you ran this week" list. `getWhereNext()` exists but is keyed on one build; this is keyed on the viewer.

**Read first.** whatever module holds the existing per-build "where next" logic (the handoff calls it `getWhereNext` in `src/lib/build/whereNext.ts`; if it is not there, `grep` for it and use the real one — §8), `build_reproductions` (`build_id`, `user_id`, `created_at`), `weekStartUtc`. If no per-build version exists, build this one from scratch in `src/lib/build/whereNext.ts` and say so.

**Build** `getWhereNextForViewer(userId: string, limit = 3): Promise<WhereNextItem[]>` in `whereNext.ts`:
1. The viewer's reproductions since `weekStartUtc()` (build ids, newest first, `.limit(20)`).
2. For up to three of those builds, reuse `getWhereNext`'s internals (factor them out without changing its behaviour or tests) to gather candidates with their reason.
3. Remove builds the viewer created or already reproduced; de-duplicate; keep the first `limit`.
4. Each item: `{ build: { id, slug, title, coverSky/ cover }, reason: 'same_tool' | 'rebuilt_from_one_you_ran' | 'more_from_maker', reasonDetail: string /* the tool name or @handle */, spark: number[] /* 14 daily reproduction counts, oldest first */ }`. Get all sparks in one query: `build_id, created_at` for the chosen ids over 14 days, `.limit(1000)`, bucketed by UTC day.
5. Returns `[]` for a viewer with no runs this week (the view shows its empty state).
The label is rendered by the view in DM Mono caps: "SAME TOOL · SONNET-4.5", "REBUILT FROM ONE YOU RAN", "MORE FROM @INES". Tests for each reason, the exclusions and the empty case.

**Commit.** `UI-P25: getWhereNextForViewer`
