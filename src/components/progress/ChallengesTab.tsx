import { useMemo } from "react";
import ChallengesPanel from "@/components/challenges/quest/challenges-panel";
import type { Challenge, WeeklyChallenge, ChallengeHistoryEntry, ChallengeState } from "@/components/challenges/quest/types";
import type { DailyChallengeRow, ChallengeHistoryRow } from "@/lib/progress";
import { useClaimChallenge } from "@/hooks/useProgress";

function stateFor(c: DailyChallengeRow): ChallengeState {
  if (c.claimed) return "claimed";
  if (c.progress >= c.target) return "claimable";
  return "go";
}

export default function ChallengesTab({
  challenges,
  history,
  hasNew,
}: {
  challenges: DailyChallengeRow[];
  history: ChallengeHistoryRow[];
  hasNew?: boolean;
}) {
  const claim = useClaimChallenge();

  const dailies: Challenge[] = useMemo(
    () =>
      (challenges ?? []).slice(0, 3).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description ?? undefined,
        xp: c.xp_reward,
        state: stateFor(c),
      })),
    [challenges],
  );

  // Synthesize a placeholder weekly challenge from history aggregate or fallback
  const weekly: WeeklyChallenge = useMemo(() => {
    const w = (challenges ?? []).find((c) => c.challenge_key?.startsWith("weekly_"));
    if (w) {
      return {
        id: w.id, title: w.title, description: w.description ?? "",
        xp: w.xp_reward, progress: w.progress, goal: w.target, state: stateFor(w),
      };
    }
    return {
      id: "weekly-placeholder",
      title: "Weekly stretch",
      description: "Publish, comment, and share through the week.",
      xp: 100,
      progress: 0,
      goal: 5,
      state: "go",
    };
  }, [challenges]);

  const historyEntries: ChallengeHistoryEntry[] = (history ?? []).map((h) => ({
    id: h.id,
    title: h.title ?? h.challenge_key,
    xp: h.xp_awarded,
    completedAt: h.completed_at,
  }));

  // Reset at next midnight UTC
  const resetAt = useMemo(() => {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
  }, []);

  return (
    <ChallengesPanel
      dailies={dailies}
      weekly={weekly}
      history={historyEntries}
      resetAt={resetAt}
      hasNew={hasNew}
      onClaim={(c) => claim.mutate(c.id)}
      onClaimWeekly={(c) => {
        if (c.id !== "weekly-placeholder") claim.mutate(c.id);
      }}
    />
  );
}
