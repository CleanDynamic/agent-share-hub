/* UI-P34 — Profile's view model: the shapes `ProfileView` takes, and the pure
   functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `ProfilePage` loads, these map, `ProfileView` draws; the
   dev compare page builds the same shapes from the sample data. */

import type { ReactNode } from "react";

import type { ActivityDay } from "@/components/brand/ActivityGrid";
import type { RankTier } from "@/components/brand/RankRung";
import { BADGES } from "@/components/trophies/badge-data";
import { levelFromXp, xpForLevel, xpProgressInLevel, type StreakDayRow, type TrackId } from "@/lib/progress";

/* ── numbers ── */

/** 1,284: `en-GB` grouping everywhere a count is printed. */
export const formatCount = (n: number): string => n.toLocaleString("en-GB");

/** £1,150: whole pounds. */
export const formatPounds = (n: number): string => `£${n.toLocaleString("en-GB")}`;

/* ── the banner ── */

/** "Feb 2026" from a timestamp; null for one that is not a date. */
export function sinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * "Maker · Leeds · since Feb 2026": the parts that exist, in order. The phone
 * banner leaves out the date.
 */
export function eyebrowLine(place: string | null | undefined, since: string | null | undefined, phone = false): string {
  const parts = ["Maker"];
  if (place?.trim()) parts.push(place.trim());
  if (!phone && since) parts.push(`since ${since}`);
  return parts.join(" · ");
}

/** "@maya · builds finance agents a person can check"; the handle alone without a bio. */
export function handleLine(handle: string, bio: string | null | undefined): string {
  const at = handle ? `@${handle}` : "";
  const line = bio?.trim();
  return line ? (at ? `${at} · ${line}` : line) : at;
}

/* ── the level panel ── */

export const TRACK_ITEMS: readonly { value: TrackId; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "curator", label: "Curator" },
  { value: "mentor", label: "Mentor" },
  { value: "explorer", label: "Explorer" },
];

export const trackLabel = (track: TrackId | null): string | null =>
  TRACK_ITEMS.find((item) => item.value === track)?.label ?? null;

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

export function remainingLine(view: LevelView): string | null {
  return view.remaining === null ? null : `${formatCount(view.remaining)} to level ${view.level + 1}`;
}

/** "12-day streak · best 31"; the phone's line is the first half. */
export function streakLine(view: LevelView, phone = false): string | null {
  if (!view.streakKnown) return null;
  if (view.streakDays <= 0) return "No streak yet";
  const now = `${view.streakDays}-day streak`;
  return phone || view.streakBest <= 0 ? now : `${now} · best ${view.streakBest}`;
}

/** The ring's one-line description: "Level 7, 77% of the way to level 8". */
export function ringLabel(view: LevelView): string {
  return view.xp === null
    ? `Level ${view.level}`
    : `Level ${view.level}, ${view.percent}% of the way to level ${view.level + 1}`;
}

/** "Level 7" is the figure; the caption under it is "level". */
export const RING_CAPTION = "level";

/* ── the stats ── */

export interface FiguresView {
  buildsHung: number;
  reproducedByOthers: number;
  rebuildsOfWork: number;
  bountiesSolved: number;
  bountyEarningsGbp: number;
  /**
   * How far each figure is to its next creator-mark threshold, 0 to 100, where
   * a threshold is defined. Absent for a figure with none: its Stat has no bar.
   */
  bars?: { reproduced?: number; rebuilds?: number; bounties?: number };
}

/* ── the works ── */

export type WorksTab = "builds" | "rebuilds" | "reproduced" | "collections";

export const WORKS_TABS: readonly { value: WorksTab; label: string }[] = [
  { value: "builds", label: "Builds" },
  { value: "rebuilds", label: "Rebuilds" },
  { value: "reproduced", label: "Reproduced" },
  { value: "collections", label: "Collections" },
];

/** "?tab=" as the page reads it; anything unknown (the old "solutions" among it) is Builds. */
export function worksTabOf(value: string | null | undefined): WorksTab {
  return WORKS_TABS.some((tab) => tab.value === value) ? (value as WorksTab) : "builds";
}

/** "Builds 14": the label and its count (the label alone while the count loads). */
export function tabLabel(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label} ${formatCount(count)}`;
}

/** One card in the works grid. The page and the compare page supply the drawing. */
export interface WorkCard {
  key: string;
  /** Desktop: cover 86, title 17. Phone: cover 90, title 17. */
  render: (variant: "desktop" | "phone") => ReactNode;
}

/** One collection in the Collections tab. */
export interface CollectionTileView {
  key: string;
  to: string;
  title: string;
  /** "4 builds". */
  count: string;
  /** The first four builds' pictures, as nodes filling their cell. */
  covers: readonly ReactNode[];
}

export const buildsCount = (n: number): string => `${formatCount(n)} ${n === 1 ? "build" : "builds"}`;

export interface WorksView {
  tab: WorksTab;
  onTab: (tab: WorksTab) => void;
  /** A tab's count; absent while it loads. */
  counts: Partial<Record<WorksTab, number>>;
  status: "loading" | "error" | "ready";
  /** `permission`: the read was refused, which is not an empty tab. */
  errorKind?: "error" | "permission";
  cards: readonly WorkCard[];
  collections: readonly CollectionTileView[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
}

/** One sentence for an empty tab, in the viewer's voice for their own profile. */
export function emptyLine(tab: WorksTab, own: boolean): string {
  switch (tab) {
    case "builds":
      return own ? "You haven't published a build yet." : "Nothing published yet.";
    case "rebuilds":
      return own ? "You haven't rebuilt anyone's work yet." : "No rebuilds yet.";
    case "reproduced":
      return own ? "You haven't reproduced a build yet." : "No builds reproduced yet.";
    case "collections":
      return own ? "You haven't made a collection yet." : "No public collections yet.";
  }
}

/* ── the activity grid ── */

/** 22 weeks of 7: what the grid draws on desktop and phone alike. */
export const ACTIVITY_DAYS = 154;

/**
 * The last `span` days ending today, oldest first, from the sparse ledger
 * `getStreakDays` returns. The ledger has no volume, so an active day counts 1
 * and the grid draws them all at its first step; a frozen day is hollow.
 */
export function activityDays(rows: readonly StreakDayRow[], today: Date, span = ACTIVITY_DAYS): ActivityDay[] {
  const kinds = new Map(rows.map((row) => [row.date, row.kind]));
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: ActivityDay[] = [];
  for (let back = span - 1; back >= 0; back -= 1) {
    const date = new Date(end - back * 86_400_000).toISOString().slice(0, 10);
    const kind = kinds.get(date);
    out.push({ count: kind === "active" ? 1 : 0, frozen: kind === "frozen", date });
  }
  return out;
}

/* ── the creator marks ── */

export interface MarkView {
  key: string;
  name: string;
  tier: RankTier;
}

const WEIGHT: Record<"common" | "rare" | "highest", number> = { common: 1, rare: 2, highest: 3 };

/**
 * The marks to draw, from the badge keys a maker holds: the five that weigh most
 * (ties in catalogue order), drawn lightest first — "Common · rare · highest".
 * Names and tiers are the client catalogue's (`badge-data`), the one source.
 */
export function marksView(held: ReadonlySet<string>, limit = 5): MarkView[] {
  const earned = BADGES.filter((badge) => held.has(badge.id));
  const top = [...earned].sort((a, b) => WEIGHT[b.tier] - WEIGHT[a.tier]).slice(0, limit);
  return top
    .sort((a, b) => WEIGHT[a.tier] - WEIGHT[b.tier])
    .map((badge) => ({ key: badge.id, name: badge.name, tier: badge.tier }));
}

/** The slugs the marks are read for. */
export const BADGE_SLUGS: readonly string[] = BADGES.map((badge) => badge.id);
