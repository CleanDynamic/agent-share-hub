import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getChallengeHistory,
  getProgressFigures,
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

/**
 * The reader's level and XP, from one read of two columns (RC-P27).
 *
 * The frame's progress chip, the phone drawer's and the progress page all
 * spend this under one cache key, so a page showing all three asks once. It
 * used to read four more things alongside, for panels of the old product:
 * the surfaces and quest functions, creator_marks, and today's daily
 * challenge, which it tried to insert when there was none. The frame mounts
 * the chip on every page, so every page paid for panels only /analytics drew;
 * RC-P27 unmounted those panels and their reads went with them.
 */
export function useProgress() {
  const { user } = useAuth();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["progress", userId],
    queryFn: () => getProgressFigures(userId!),
    enabled: !!userId,
  });

  const progress = query.data ?? null;
  const xpLocal = progress
    ? xpProgressInLevel(progress.xp_total)
    : { level: 1, xpInLevel: 0, xpForNext: 75 };

  return {
    userId,
    progress,
    xpInLevel: xpLocal.xpInLevel,
    xpForNext: xpLocal.xpForNext,
    level: progress?.level ?? xpLocal.level,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
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
