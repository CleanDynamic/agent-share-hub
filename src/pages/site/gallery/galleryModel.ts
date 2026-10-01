/* UI-P28 — Gallery's view model: the shapes `GalleryView` takes, and the pure
   functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `GalleryPage` loads, these map, `GalleryView` draws; the
   dev compare page builds the same shapes from the sample data. */

import type { ReactNode } from "react";

import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { GalleryLens } from "@/lib/build/gallery";

/* ── numbers ── */

/** 1,284: `en-GB` grouping everywhere a count is printed. */
export const formatCount = (n: number): string => n.toLocaleString("en-GB");

/** £4,250: whole pounds. */
export const formatPounds = (n: number): string => `£${n.toLocaleString("en-GB")}`;

/** A percentage of a whole, rounded and held to 0–100. A zero whole is no bar. */
export function percentOf(part: number, whole: number | null | undefined): number {
  if (!whole || whole <= 0 || !Number.isFinite(part)) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

/* ── lenses ── */

export const LENS_ITEMS: readonly { value: GalleryLens; label: string }[] = [
  { value: "all", label: "All" },
  { value: "proven", label: "Proven" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "unsolved", label: "Unsolved" },
];

/** "All" then an en space (U+2002) then "1,284": the label and its count (the label alone while it loads). */
export function lensLabel(label: string, count: number | undefined): string {
  return count === undefined ? label : `${label}\u2002${formatCount(count)}`;
}

/* ── the stats wall label ── */

export interface GalleryStatsView {
  inGallery: number;
  reproducedThisWeek: number;
  /** An editorial target; null while none is set. */
  weeklyGoal: number | null;
  /** Last week's whole count, for the bar while there is no goal. Null while unknown. */
  reproducedLastWeek: number | null;
  freshPct: number;
  /** Whole pounds on offer across open asks. */
  poolGbp: number;
  /** Gallery builds carrying an open ask. */
  open: number;
  /** Open bounties that have at least one solution. */
  withSolutions: number;
}

/**
 * The "Reproduced this week" bar: against the goal when one is set, else this
 * week against last week, held to 100. No goal and no last week to compare with
 * is no bar at all (null), never a bar that says something it does not know.
 */
export function weekBar(stats: Pick<GalleryStatsView, "reproducedThisWeek" | "weeklyGoal" | "reproducedLastWeek">): {
  value: number;
  of: number | null;
} | null {
  if (stats.weeklyGoal) return { value: percentOf(stats.reproducedThisWeek, stats.weeklyGoal), of: stats.weeklyGoal };
  if (stats.reproducedLastWeek === null) return null;
  if (stats.reproducedLastWeek === 0) return { value: stats.reproducedThisWeek > 0 ? 100 : 0, of: null };
  return { value: percentOf(stats.reproducedThisWeek, stats.reproducedLastWeek), of: null };
}

/* ── facets ── */

export interface FacetRowView {
  value: string;
  label: string;
  count: number;
  selected: boolean;
  onToggle: () => void;
}

export interface FacetGroupView {
  key: "made-for" | "made-with" | "shape";
  label: string;
  loading: boolean;
  emptyText: string;
  rows: readonly FacetRowView[];
}

/**
 * The most-used `limit` options, by count — and any selected option that falls
 * outside them, so a filter that is on can always be turned off.
 */
export function topOptions<T extends { value: string; count: number }>(
  options: readonly T[],
  limit: number,
  selected: readonly string[],
): T[] {
  const ranked = [...options].sort((a, b) => b.count - a.count);
  const top = ranked.slice(0, limit);
  const extra = ranked.slice(limit).filter((option) => selected.includes(option.value));
  return [...top, ...extra];
}

/* ── the wall ── */

/** One card on the wall. The page and the compare page supply the drawing. */
export interface WallCard {
  key: string;
  /** Desktop: cover 92, title 19. Phone: cover 96, title 18. */
  render: (variant: "desktop" | "phone") => ReactNode;
}

export interface FeaturedView {
  to: string;
  title: string;
  outcome: string;
  /** The one record the lamp and the plaque both read. */
  build: PlaqueBuild;
  /** The cover's picture, filling its box. */
  cover: ReactNode;
}

export interface GalleryWallState {
  status: "loading" | "error" | "ready";
  /** `permission`: the read was refused, which is not an empty gallery. */
  errorKind?: "error" | "permission";
  cards: readonly WallCard[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
}
