// RC-P27 — the progress page's own reads, beside useProgress.
//
// A MODULE OF THEIR OWN so the frame does not carry them: AppShell imports
// useProgress for the progress chip on every page, and anything in that file
// ships in the main bundle. These two are read only on /analytics, whose route
// is lazy, so they, the badge catalogue and its icons load with that chunk.

import { useQuery } from "@tanstack/react-query";

import { BADGES } from "@/components/trophies/badge-data";
import { useAuth } from "@/contexts/AuthContext";
import { getMyBadgeKeys } from "@/lib/progress/badges";
import { getMyWeekEvents } from "@/lib/progress/weekly";

/** This week's ledger rows for the three weekly challenges: one request. */
export function useMyWeek() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress.week", user?.id],
    queryFn: () => getMyWeekEvents(user!.id),
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
  });
}

/** Which of the ten badges the reader holds: one request, the ten slugs only. */
export function useMyBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["progress.badges", user?.id],
    queryFn: () => getMyBadgeKeys(user!.id, BADGES.map((badge) => badge.id)),
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
  });
}
