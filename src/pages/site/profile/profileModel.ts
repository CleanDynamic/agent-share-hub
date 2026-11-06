/* UI-P34, trimmed by UX-10: what Your progress draws: the four tracks, the level, the XP line and the streak.

   NOTHING HERE FETCHES. UX-10 Part 10 retired the banner's eyebrow, the level ring, the stat boxes, the works tabs, the activity
   grid and the marks' tiers, and the functions only they used. */

import { levelFromXp, xpForLevel, xpProgressInLevel, type TrackId } from "@/lib/progress";

/** 1,284: `en-GB` grouping everywhere a count is printed. */
export const formatCount = (n: number): string => n.toLocaleString("en-GB");

/* ── the level panel ── */

export const TRACK_ITEMS: readonly { value: TrackId; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "curator", label: "Curator" },
  { value: "mentor", label: "Mentor" },
  { value: "explorer", label: "Explorer" },
];

export interface LevelView {
  level: number;
  /** The ring: how far through this level, 0 to 100. */
  percent: number;
  /** Total XP; null when the reader may not read it. The panel then says nothing about XP. */
  xp: number | null;
  /** The XP at which the next level starts. */
  xpNext: number | null;
  /** XP still to earn for the next level. */
  remaining: number | null;
  track: TrackId | null;
  streakDays: number;
  streakBest: number;
  /** Whether the streak is known at all (it is not for somebody else). */
  streakKnown: boolean;
}

/** The level panel for one maker, from the progress read and the curve in `@/lib/progress`. */
export function levelView(progress: {
  level: number;
  xpTotal: number | null;
  track: TrackId | null;
  streakDays: number;
  streakBest: number;
}): LevelView {
  const { xpTotal } = progress;
  if (xpTotal === null) {
    return {
      level: Math.max(1, progress.level),
      percent: 0,
      xp: null,
      xpNext: null,
      remaining: null,
      track: progress.track,
      streakDays: 0,
      streakBest: 0,
      streakKnown: false,
    };
  }
  const { level, xpInLevel, xpForNext } = xpProgressInLevel(xpTotal);
  const next = xpForLevel(level + 1);
  return {
    level: Math.max(level, levelFromXp(xpTotal)),
    percent: Math.min(100, Math.round((xpInLevel / xpForNext) * 100)),
    xp: xpTotal,
    xpNext: next,
    remaining: Math.max(0, next - xpTotal),
    track: progress.track,
    streakDays: progress.streakDays,
    streakBest: Math.max(progress.streakBest, progress.streakDays),
    streakKnown: true,
  };
}

/** "1,840 / 2,400 xp · 560 to level 8" (the phone's line stops at "xp"). */
export function xpLine(view: LevelView): string | null {
  if (view.xp === null || view.xpNext === null) return null;
  return `${formatCount(view.xp)} / ${formatCount(view.xpNext)} xp`;
}

/** "12-day streak · best 31"; the phone's line is the first half. */
export function streakLine(view: LevelView, phone = false): string | null {
  if (!view.streakKnown) return null;
  if (view.streakDays <= 0) return "No streak yet";
  const now = `${view.streakDays}-day streak`;
  return phone || view.streakBest <= 0 ? now : `${now} · best ${view.streakBest}`;
}
