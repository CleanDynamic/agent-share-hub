import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getChallengeHistory,
  getChallenges,
  getCreatorMarks,
  getQuestState,
  getUserProgress,
  getVisibleSurfaces,
  getXpEvents,
  getUserPerks,
  getPerksCatalogue,
  getStreakDays,
  getPendingRevealBadges,
  claimChallenge,
  markDepthRevealed,
  setUserTrack,
  respecTrack,
  recordDailyActivity,
  xpProgressInLevel,
  type TrackId,
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

export function useUserPerks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress.perks", user?.id],
    queryFn: () => getUserPerks(user!.id),
    enabled: !!user?.id,
  });
}

export function usePerksCatalogue() {
  return useQuery({
    queryKey: ["progress.perks.catalogue"],
    queryFn: () => getPerksCatalogue(),
    staleTime: 5 * 60_000,
  });
}

export function useHasPerk(slug: string) {
  const q = useUserPerks();
  return (q.data ?? []).some((p) => p.perk_slug === slug);
}

export function useStreakDays(sinceDays = 60) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress.streak_days", user?.id, sinceDays],
    queryFn: () => getStreakDays(user!.id, sinceDays),
    enabled: !!user?.id,
  });
}

export function usePendingRevealBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress.pending_reveal", user?.id],
    queryFn: () => getPendingRevealBadges(user!.id),
    enabled: !!user?.id,
  });
}

export function useMarkDepthRevealed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markDepthRevealed(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["progress.surfaces"] });
      qc.invalidateQueries({ queryKey: ["progress.pending_reveal"] });
    },
  });
}

export function useSetTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (track: TrackId) => setUserTrack(track),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["progress.surfaces"] });
    },
  });
}

export function useRespec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (track: TrackId) => respecTrack(track),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["progress.surfaces"] });
      qc.invalidateQueries({ queryKey: ["progress.perks"] });
    },
  });
}

export function useRecordDailyActivity() {
  return useMutation({ mutationFn: () => recordDailyActivity() });
}
