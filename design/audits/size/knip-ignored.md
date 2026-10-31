# Files `knip` is told to ignore (knip.json), and why

- `src/components/layout/LeftPanel.tsx`, `RightPanelExplore.tsx`: externally supplied visual shells; the repo's review rules say editing them is an automatic fail. Nothing imports them. `LeftPanel` imports `src/hooks/useNavBadges.ts` and `useDraftCount.ts`, which stay for that reason. Delete all four together once Miles agrees.
- `src/pages/dev/VisionNotBuilt.tsx`: a dev page for the boards' unbuilt sections; kept until Miles says it is not wanted.
- `supabase/functions/**/*.test.ts`: Deno tests, run by Deno, not imported.
