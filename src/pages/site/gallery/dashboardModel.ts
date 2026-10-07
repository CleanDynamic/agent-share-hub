/* UI-P50 — the Gallery dashboard's view model: the pure functions behind the
   Builds table. NOTHING HERE FETCHES. `GalleryDashboardPage` loads, these fold
   and sort, `GalleryDashboardView` draws; the dev compare page runs the same
   functions over the fixture. */

import type { MakerRow, ModelRow } from "@/lib/build/dashboardAggregates";
import type { DashboardRow } from "@/lib/build/gallery";
import type { DashboardActive, DashboardReport, DashboardSort } from "@/lib/build/galleryParams";
import { MODEL_VERSIONS, normaliseModel, type Lab } from "@/lib/models/registry";

/* ── the sort ── */

export const DASHBOARD_SORT_ITEMS: readonly { value: DashboardSort; label: string }[] = [
  { value: "engagement", label: "Engagement" },
  { value: "prompts", label: "Prompts" },
  { value: "sessions", label: "Sessions" },
  { value: "turns", label: "AI turns" },
  { value: "models", label: "AI models" },
  { value: "activity", label: "Last activity" },
  { value: "name", label: "Build name" },
];

export const ACTIVE_ITEMS: readonly { value: DashboardActive | null; label: string }[] = [
  { value: null, label: "Any time" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const time = (iso: string | null | undefined): number => (iso ? Date.parse(iso) || 0 : 0);

/** The distinct model names a build used, spellings merged, in the order first seen. */
export function modelNamesOf(row: Pick<DashboardRow, "modelsUsed">): string[] {
  const seen = new Set<string>();
  for (const used of row.modelsUsed) {
    const name = normaliseModel(used)?.name ?? used.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * The rows in the order the sort names, largest first (name: A to Z), the
 * build name and then the id breaking every tie so a re-sort never shuffles.
 */
export function sortDashboardRows(rows: readonly DashboardRow[], sort: DashboardSort): DashboardRow[] {
  const number = (row: DashboardRow): number => {
    switch (sort) {
      case "prompts":
        return row.promptCount;
      case "sessions":
        return row.sessionCount;
      case "turns":
        return row.aiTurnCount;
      case "models":
        return modelNamesOf(row).length;
      case "activity":
        return time(row.lastActivity.at);
      case "name":
        return 0;
      default:
        return row.engagement.total;
    }
  };
  return [...rows].sort((a, b) => {
    if (sort !== "name") {
      const diff = number(b) - number(a);
      if (diff !== 0) return diff;
    }
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

/* ── the filters, in memory ── */

export interface DashboardFilters {
  model?: string | null;
  lab?: Lab | null;
  audience?: string | null;
  active?: DashboardActive | null;
  report?: DashboardReport | null;
  q?: string | null;
}

/**
 * The same rules `listGalleryDashboard` applies, over rows already in hand: the
 * dev page filters the fixture with it, and the sidebar's counts are folds of it.
 */
export function filterDashboardRows(
  rows: readonly DashboardRow[],
  filters: DashboardFilters,
  now: number = Date.now(),
): DashboardRow[] {
  const version = filters.model ? (MODEL_VERSIONS.find((entry) => entry.id === filters.model) ?? null) : null;
  const windows = [filters.active ?? undefined, filters.report === "month" ? 30 : undefined].filter(
    (days): days is number => typeof days === "number",
  );
  const within = windows.length ? Math.min(...windows) : null;
  const cutoff = within === null ? 0 : now - within * 86_400_000;
  const needle = filters.q?.trim().toLowerCase() || null;

  return rows.filter((row) => {
    if (version && !row.modelsUsed.some((name) => normaliseModel(name)?.id === version.id)) return false;
    if (filters.lab && !row.modelsUsed.some((name) => normaliseModel(name)?.lab === filters.lab)) return false;
    if (filters.audience && !row.madeFor.includes(filters.audience)) return false;
    if (filters.report === "multi" && row.sessionCount < 3) return false;
    if (within !== null && time(row.lastActivity.at) < cutoff) return false;
    if (
      needle &&
      ![row.title, row.creator.handle, ...row.madeFor, ...row.modelsUsed].some((text) => text.toLowerCase().includes(needle))
    ) {
      return false;
    }
    return true;
  });
}

/* ── the sidebar's counts ── */

export interface DashboardCounts {
  builds: number;
  makers: number;
  byLab: Record<Lab, number>;
  activeThisMonth: number;
  multiSession: number;
}

/** Counts over every gallery build, not over the filtered table. */
export function dashboardCounts(rows: readonly DashboardRow[], labs: readonly Lab[], now: number = Date.now()): DashboardCounts {
  const byLab = Object.fromEntries(labs.map((lab) => [lab, 0])) as Record<Lab, number>;
  const monthAgo = now - 30 * 86_400_000;
  let activeThisMonth = 0;
  let multiSession = 0;
  for (const row of rows) {
    const used = new Set<Lab>();
    for (const name of row.modelsUsed) {
      const lab = normaliseModel(name)?.lab;
      if (lab) used.add(lab);
    }
    for (const lab of used) if (lab in byLab) byLab[lab] += 1;
    if (time(row.lastActivity.at) >= monthAgo) activeThisMonth += 1;
    if (row.sessionCount >= 3) multiSession += 1;
  }
  return {
    builds: rows.length,
    makers: new Set(rows.map((row) => row.creator.id)).size,
    byLab,
    activeThisMonth,
    multiSession,
  };
}

/** The "Made for" menu: every audience in the rows with its count, most builds first. */
export function audienceCounts(rows: readonly DashboardRow[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) for (const value of new Set(row.madeFor)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/* ── the pill ── */

/** "Made with Opus 5.5", "Google models" or "All models". */
export function pillText(model: string | null, lab: Lab | null): string {
  if (model) return `Made with ${MODEL_VERSIONS.find((entry) => entry.id === model)?.name ?? model}`;
  if (lab) return `${lab} models`;
  return "All models";
}

/* ── cells ── */

/** "Oct 5": UTC, so the reader's zone cannot move a date. An empty timestamp is a dash. */
export function shortDate(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "—";
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The row's weeks scaled to 0–1 for `Sparkline`: by the row's highest week, and never by less than 2. */
export function sparkValues(series: readonly number[]): number[] {
  const top = Math.max(2, ...series);
  return series.map((value) => value / top);
}

export const seriesTotal = (series: readonly number[]): number => series.reduce((sum, value) => sum + value, 0);

/** The Engagement cell's title: "{runs} runs · {rebuilds} rebuilds · {comments} comments · {saves} saves". */
export function engagementTitle(engagement: DashboardRow["engagement"]): string {
  return `${engagement.runs} runs · ${engagement.rebuilds} rebuilds · ${engagement.comments} comments · ${engagement.saves} saves`;
}

/* ── the calculations in the footer ── */

export const sumOfPrompts = (rows: readonly DashboardRow[]): number => rows.reduce((sum, row) => sum + row.promptCount, 0);

/** Average sessions per build to one decimal place; "0.0" for no rows. */
export function averageSessions(rows: readonly DashboardRow[]): string {
  if (rows.length === 0) return "0.0";
  return (rows.reduce((sum, row) => sum + row.sessionCount, 0) / rows.length).toFixed(1);
}

/* ── the export ── */

export const CSV_HEADER = ["Title", "Maker", "Models", "Sessions", "Prompts", "AI turns", "Engagement", "Last activity"] as const;

/**
 * One cell. Quoted when it holds a comma, quote or line break, with quotes
 * doubled. A title is typed by a maker, so a cell a spreadsheet would read as a
 * formula (= + - @, or a tab or return first) is prefixed with an apostrophe.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The rows as CSV, header first, CRLF between lines, the maker's handle without its @, models joined with "; ". */
export function buildCsv(rows: readonly DashboardRow[]): string {
  const lines = rows.map((row) =>
    [
      row.title,
      row.creator.handle,
      modelNamesOf(row).join("; "),
      row.sessionCount,
      row.promptCount,
      row.aiTurnCount,
      row.engagement.total,
      row.lastActivity.at ? `${shortDate(row.lastActivity.at)} — ${row.lastActivity.what}` : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}

/** Hands text to the browser as a file. Browser only. */
export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ── the Models and Makers tabs (UI-P51) ── */

/**
 * The Models tab's rows: the Labs filter applied (an unlisted model has no lab,
 * so a chosen lab leaves it out), then by prompts, then builds, largest first.
 * A model the registry does not know comes last, under its own name.
 */
export function sortModelRows(rows: readonly ModelRow[], lab: Lab | null): ModelRow[] {
  return rows
    .filter((row) => !lab || row.lab === lab)
    .sort((a, b) => {
      const known = Number(b.modelId !== null) - Number(a.modelId !== null);
      return known || b.prompts - a.prompts || b.builds - a.builds || a.modelName.localeCompare(b.modelName);
    });
}

/** The Makers tab's rows: most engagement first, then handle. */
export function sortMakerRows(rows: readonly MakerRow[]): MakerRow[] {
  return [...rows].sort((a, b) => b.engagement.total - a.engagement.total || a.creator.handle.localeCompare(b.creator.handle));
}

/* ── the detail sheet ── */

export type EngagementWindow = 7 | 30 | 90;
export const ENGAGEMENT_WINDOWS: readonly EngagementWindow[] = [7, 30, 90];

/**
 * The engagement in the last `days` days, from the 14 weekly values (newest
 * last): the newest round(days / 7) weeks, so 7 is 1 week, 30 is 4 and 90 is 13.
 */
export function windowTotal(series: readonly number[], days: EngagementWindow): number {
  return seriesTotal(series.slice(-Math.min(series.length, Math.round(days / 7))));
}

/** Each model's share of a build's prompts, 0 to 1, over its sessions; the model most used first. */
export function modelShares(row: Pick<DashboardRow, "making">): { name: string; lab: Lab | null; prompts: number; share: number }[] {
  const byName = new Map<string, { name: string; lab: Lab | null; prompts: number }>();
  for (const session of row.making.sessions) {
    const version = normaliseModel(session.model);
    const raw = session.model?.trim() ?? "";
    const name = version?.name ?? (raw || "Unknown model");
    const entry = byName.get(name) ?? { name, lab: version?.lab ?? null, prompts: 0 };
    entry.prompts += session.prompts;
    byName.set(name, entry);
  }
  const total = [...byName.values()].reduce((sum, entry) => sum + entry.prompts, 0);
  return [...byName.values()]
    .sort((a, b) => b.prompts - a.prompts || a.name.localeCompare(b.name))
    .map((entry) => ({ ...entry, share: total > 0 ? entry.prompts / total : 0 }));
}
