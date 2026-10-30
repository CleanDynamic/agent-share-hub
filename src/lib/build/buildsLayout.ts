// SV-24 P2: the Builds page's layout, kept per viewer.
//
// WHAT IT HOLDS: the filters' order, the filters opened beyond those open by default, a checklist's height, the table's columns
// (null: the default twelve) and the footer's calculations. Pure: reading, tidying, ordering. The page decides where it is kept:
// in the open filter set's own `query.layout` when one is open and the viewer owns it, in `localStorage` otherwise.
//
// `client-localstorage-schema`: one versioned key, every read and write in try/catch, and a stored value is never trusted (an old
// shape, another person's edit or a full disk all read as "no layout"). A set's layout is checked the same way, since a public set
// is readable by anyone and writable by its owner alone but its JSON is still just JSON.

export const LAYOUT_KEY = "builds:layout:v1";

/** A checklist's height: its list scrolls inside it. The keys move it by one step. */
export const HEIGHT_MIN = 96;
export const HEIGHT_MAX = 480;
export const HEIGHT_STEP = 24;

export type CalcKind = "sum" | "median" | "common";
export const CALC_KINDS: readonly CalcKind[] = ["sum", "median", "common"];

export interface Calculation {
  column: string;
  kind: CalcKind;
}

export interface BuildsLayout {
  /** Filter ids in the order drawn; an id not named here follows in the default order. */
  order: string[];
  /** Filters opened beyond those open by default and those holding a value. */
  opened: string[];
  /** A checklist's height in px. */
  heights: Record<string, number>;
  /** The table's columns; null is the default. */
  columns: string[] | null;
  calculations: Calculation[];
}

export const EMPTY_LAYOUT: BuildsLayout = { order: [], opened: [], heights: {}, columns: null, calculations: [] };

const MAX_LIST = 64;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && entry.length <= 40))].slice(0, MAX_LIST) : [];

export const clampHeight = (px: number): number => Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, Math.round(px)));

/** Whatever was stored, as a layout: what is valid is kept and the rest is dropped. */
export function parseLayout(raw: unknown): BuildsLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_LAYOUT;
  const value = raw as Record<string, unknown>;
  const heights: Record<string, number> = {};
  if (value.heights && typeof value.heights === "object" && !Array.isArray(value.heights)) {
    for (const [id, px] of Object.entries(value.heights as Record<string, unknown>).slice(0, MAX_LIST)) {
      if (typeof px === "number" && Number.isFinite(px)) heights[id] = clampHeight(px);
    }
  }
  const calculations: Calculation[] = [];
  if (Array.isArray(value.calculations)) {
    for (const entry of value.calculations.slice(0, MAX_LIST)) {
      const { column, kind } = (entry ?? {}) as Record<string, unknown>;
      if (typeof column === "string" && CALC_KINDS.includes(kind as CalcKind) && !calculations.some((have) => have.column === column && have.kind === kind)) {
        calculations.push({ column, kind: kind as CalcKind });
      }
    }
  }
  return {
    order: strings(value.order),
    opened: strings(value.opened),
    heights,
    columns: Array.isArray(value.columns) ? strings(value.columns) : null,
    calculations,
  };
}

/** The layout kept in this browser, or none. */
export function readStoredLayout(): BuildsLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? parseLayout(JSON.parse(raw)) : EMPTY_LAYOUT;
  } catch {
    return EMPTY_LAYOUT;
  }
}

export function writeStoredLayout(layout: BuildsLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* A private window or a full disk: the layout holds for this visit only. */
  }
}

/** The layout holds nothing: a set without one saves no `layout` key. */
export function isEmptyLayout(layout: BuildsLayout): boolean {
  return layout.order.length === 0 && layout.opened.length === 0 && Object.keys(layout.heights).length === 0 && layout.columns === null && layout.calculations.length === 0;
}

/* ── ordering ── */

/** Every id once: those the order names (that still exist), then the rest in the order they came. */
export function effectiveOrder(ids: readonly string[], order: readonly string[]): string[] {
  const known = new Set(ids);
  const named = [...new Set(order)].filter((id) => known.has(id));
  const taken = new Set(named);
  return [...named, ...ids.filter((id) => !taken.has(id))];
}

/** The items in the layout's order. */
export function orderedBy<T extends { id: string }>(items: readonly T[], order: readonly string[]): T[] {
  const at = new Map(effectiveOrder(items.map((item) => item.id), order).map((id, index) => [id, index]));
  return [...items].sort((a, b) => (at.get(a.id) ?? 0) - (at.get(b.id) ?? 0));
}

/**
 * The order with `id` placed at `index` among the filters that are drawn open (`visible`, in the order drawn). The filters that
 * are not drawn open keep their places: each slot that held a drawn filter is refilled from the new drawn order.
 */
export function placed(effective: readonly string[], visible: readonly string[], id: string, index: number): string[] {
  if (!visible.includes(id)) return [...effective];
  const rest = visible.filter((entry) => entry !== id);
  const at = Math.min(rest.length, Math.max(0, index));
  const next = [...rest.slice(0, at), id, ...rest.slice(at)];
  const shown = new Set(visible);
  let take = 0;
  return effective.map((entry) => (shown.has(entry) ? next[take++] : entry));
}

/** Move Up or Move Down: one place among the filters drawn open; at the end of the list it does nothing. */
export function moved(effective: readonly string[], visible: readonly string[], id: string, direction: "up" | "down"): string[] {
  const from = visible.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= visible.length) return [...effective];
  return placed(effective, visible, id, to);
}

/**
 * Where a dragged filter lands: its centre, moved by the pointer, against the centres of the others (all measured when the drag
 * began). It goes after every filter whose centre it has passed.
 */
export function dropIndex(centres: readonly { id: string; centre: number }[], draggedId: string, centre: number): number {
  return centres.filter((entry) => entry.id !== draggedId && entry.centre < centre).length;
}

/* ── the layout, changed ── */

export const withOrder = (layout: BuildsLayout, order: readonly string[]): BuildsLayout => ({ ...layout, order: [...order] });

export const withOpened = (layout: BuildsLayout, id: string): BuildsLayout =>
  layout.opened.includes(id) ? layout : { ...layout, opened: [...layout.opened, id] };

export const withHeight = (layout: BuildsLayout, id: string, px: number): BuildsLayout => ({ ...layout, heights: { ...layout.heights, [id]: clampHeight(px) } });

export const withColumns = (layout: BuildsLayout, columns: readonly string[] | null): BuildsLayout => ({ ...layout, columns: columns === null ? null : [...columns] });

export function withCalculation(layout: BuildsLayout, calculation: Calculation, on: boolean): BuildsLayout {
  const others = layout.calculations.filter((entry) => !(entry.column === calculation.column && entry.kind === calculation.kind));
  return { ...layout, calculations: on ? [...others, calculation] : others };
}
