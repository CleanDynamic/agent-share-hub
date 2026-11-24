/* UI-P34, trimmed by UX-10: what Your progress draws: the four tracks and the streak.

   NOTHING HERE FETCHES. UX-10 Part 10 retired the banner's eyebrow, the level ring, the stat boxes, the works tabs, the activity
   grid and the marks' tiers, and the functions only they used. The level and the XP line went with XP. */

import type { TrackId } from "@/lib/progress";

/** 1,284: `en-GB` grouping everywhere a count is printed. */
export const formatCount = (n: number): string => n.toLocaleString("en-GB");

export const TRACK_ITEMS: readonly { value: TrackId; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "curator", label: "Curator" },
  { value: "mentor", label: "Mentor" },
  { value: "explorer", label: "Explorer" },
];

export interface ProgressFacts {
  track: TrackId | null;
  streakDays: number;
  streakBest: number;
  /** Whether the streak is known at all (it is not for somebody else). */
  streakKnown: boolean;
}

/** The track and the streak for one maker, from the progress read. */
export function progressFacts(progress: { track: TrackId | null; streakDays: number; streakBest: number }): ProgressFacts {
  return {
    track: progress.track,
    streakDays: progress.streakDays,
    streakBest: Math.max(progress.streakBest, progress.streakDays),
    streakKnown: true,
  };
}

/** "12-day streak · best 31"; the phone's line is the first half. */
export function streakLine(view: ProgressFacts, phone = false): string | null {
  if (!view.streakKnown) return null;
  if (view.streakDays <= 0) return "No streak yet";
  const now = `${view.streakDays}-day streak`;
  return phone || view.streakBest <= 0 ? now : `${now} · best ${view.streakBest}`;
}
