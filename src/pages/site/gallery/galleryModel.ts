/* UI-P28 — Gallery's view model: the shapes `GalleryView` takes, and the pure
   functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `GalleryPage` loads, these map, `GalleryView` draws; the
   dev compare page builds the same shapes from the sample data. */

import type { ReactNode } from "react";

import type { PanelFailure } from "@/components/brand/ErrorState";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { GalleryFeedRow, GalleryFeedSort, GalleryLens } from "@/lib/build/gallery";
import { plaqueBuildFor, type ModelProof } from "@/lib/build/signals";
import type { ModelVersion } from "@/lib/models/registry";

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
  /** This group's counts could not be read: it says so in its own place, and the other groups carry on. */
  failure?: PanelFailure;
  /** No counts is no group: a group with no rows is left out, not drawn as an apology. */
  rows: readonly FacetRowView[];
}

/** Rows each group shows before it has loaded: the page's own top-N, so the column is the height it will be. */
export const FACET_SKELETON_ROWS: Record<FacetGroupView["key"], number> = { "made-for": 4, "made-with": 4, shape: 6 };

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
  /** The real error behind `status: "error"`; logged once by the panel, never shown. */
  error?: unknown;
}

/* ── UI-P49: the feed ── */

/** The sort menu, in order: the label, and whether it reads " on {model}" when a model is chosen. */
export const FEED_SORT_ITEMS: readonly { value: GalleryFeedSort; label: string; perModel: boolean }[] = [
  { value: "newest", label: "Newest", perModel: false },
  { value: "reproduced", label: "Most reproduced", perModel: true },
  { value: "confirmed", label: "Recently confirmed", perModel: true },
  { value: "rebuilt", label: "Most rebuilt", perModel: false },
];

/** The words the count line ends on. */
export const SORT_WORDS: Record<GalleryFeedSort, string> = {
  newest: "newest first",
  reproduced: "most reproduced first",
  confirmed: "most recently confirmed first",
  rebuilt: "most rebuilt first",
};

/** The sort trigger's value: the label without its " on …". */
export const sortLabel = (sort: GalleryFeedSort): string =>
  FEED_SORT_ITEMS.find((item) => item.value === sort)?.label ?? "Newest";

/** A sort menu item: "Most reproduced on Sonnet 5.5" when a model is chosen. */
export function sortItemLabel(item: (typeof FEED_SORT_ITEMS)[number], modelName: string | null): string {
  return item.perModel && modelName ? `${item.label} on ${modelName}` : item.label;
}

const builds = (n: number) => `${formatCount(n)} ${n === 1 ? "build" : "builds"}`;

/**
 * The line under the heading: "128 builds, newest first", or with a model
 * "41 of 128 builds reproduced on Sonnet 5.5, most reproduced first". Null
 * while the numbers are not known.
 */
export function feedCountLine(
  sort: GalleryFeedSort,
  total: number | null,
  model: { name: string; reproduced: number } | null,
): string | null {
  if (total === null) return null;
  if (!model) return `${builds(total)}, ${SORT_WORDS[sort]}`;
  return `${formatCount(model.reproduced)} of ${builds(total)} reproduced on ${model.name}, ${SORT_WORDS[sort]}`;
}

/** The proof a build has on one model, or a zero one: "not yet reproduced" on it. */
export function proofOn(build: Pick<GalleryFeedRow, "proof">, model: ModelVersion): ModelProof {
  return (
    build.proof.find((proof) => proof.modelId === model.id) ?? {
      modelId: model.id,
      modelName: model.name,
      worked: 0,
      lastConfirmedAt: null,
    }
  );
}

/** A feed row and the record its plaque reads: the build's own figures, or the chosen model's. */
export function feedRowView(build: GalleryFeedRow, model: ModelVersion | null): { build: GalleryFeedRow; plaque: PlaqueBuild } {
  return { build, plaque: plaqueBuildFor(build, model ? proofOn(build, model) : null) };
}
