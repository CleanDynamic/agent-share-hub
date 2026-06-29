import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getChallengeHistory,
  getChallenges,
  getCreatorMarks,
  getQuestState,
  getUserProgress,
  getVisibleSurfaces,
  getXpEvents,
  claimChallenge,
  xpProgressInLevel,
} from "@/lib/progress";

export function useProgress() {
  const { user } = useAuth();
  const userId = user?.id;

  const results = useQueries({
    queries: [
      { queryKey: ["progress", userId], queryFn: () => getUserProgress(userId!), enabled: !!userId },
      { queryKey: ["progress.surfaces", userId], queryFn: () => getVisibleSurfaces(userId!), enabled: !!userId },
      { queryKey: ["progress.quest", userId], queryFn: () => getQuestState(userId!), enabled: !!userId },
      { queryKey: ["progress.challenges", userId], queryFn: () => getChallenges(userId!), enabled: !!userId },
      { queryKey: ["progress.marks", userId], queryFn: () => getCreatorMarks(userId!), enabled: !!userId },
    ],
  });

  const [pq, sq, qq, cq, mq] = results;
  const progress = pq.data ?? null;
  const xpLocal = progress
    ? xpProgressInLevel(progress.xp_total)
    : { level: 1, xpInLevel: 0, xpForNext: 75 };

  return {
    userId,
    progress,
    xpInLevel: xpLocal.xpInLevel,
    xpForNext: xpLocal.xpForNext,
    level: progress?.level ?? xpLocal.level,
    surfaces: sq.data,
    quest: qq.data,
    challenges: cq.data ?? [],
    marks: mq.data ?? [],
    isLoading: results.some((r) => r.isLoading),
    refetchAll: () => results.forEach((r) => r.refetch()),
  };
}

export function useXpEvents(limit = 50) {
  const { user } = useAuth();
  const userId = user?.id;
  return useQueries({
    queries: [
      { queryKey: ["progress.xp_events", userId, limit], queryFn: () => getXpEvents(userId!, limit), enabled: !!userId },
      { queryKey: ["progress.history", userId], queryFn: () => getChallengeHistory(userId!), enabled: !!userId },
    ],
  });
}

export function useClaimChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => claimChallenge(challengeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
