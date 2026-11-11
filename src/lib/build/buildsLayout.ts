// SV-24 P2: the Builds page's layout, kept per viewer.
//
// WHAT IT HOLDS: the table's columns (null: the default twelve) and the footer's calculations. BF-07 took out the filters' order,
// the filters opened and a checklist's height: the filters have fixed places in their groups now. A layout stored before keeps
// those keys until its next write; `parseLayout` drops them, as it drops anything it does not know, so the key stays
// `builds:layout:v1`. Pure: reading and tidying. The page decides where it is kept:
// in the open filter set's own `query.layout` when one is open and the viewer owns it, in `localStorage` otherwise.
//
// `client-localstorage-schema`: one versioned key, every read and write in try/catch, and a stored value is never trusted (an old
// shape, another person's edit or a full disk all read as "no layout"). A set's layout is checked the same way, since a public set
// is readable by anyone and writable by its owner alone but its JSON is still just JSON.

export const LAYOUT_KEY = "builds:layout:v1";

export type CalcKind = "sum" | "median" | "common";
export const CALC_KINDS: readonly CalcKind[] = ["sum", "median", "common"];

export interface Calculation {
  column: string;
  kind: CalcKind;
}

export interface BuildsLayout {
  /** The table's columns; null is the default. */
  columns: string[] | null;
  calculations: Calculation[];
}

export const EMPTY_LAYOUT: BuildsLayout = { columns: null, calculations: [] };

const MAX_LIST = 64;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0 && entry.length <= 40))].slice(0, MAX_LIST) : [];

/** Whatever was stored, as a layout: what is valid is kept and the rest is dropped. */
export function parseLayout(raw: unknown): BuildsLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_LAYOUT;
  const value = raw as Record<string, unknown>;
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
  return layout.columns === null && layout.calculations.length === 0;
}

/* ── the layout, changed ── */

export const withColumns = (layout: BuildsLayout, columns: readonly string[] | null): BuildsLayout => ({ ...layout, columns: columns === null ? null : [...columns] });

export function withCalculation(layout: BuildsLayout, calculation: Calculation, on: boolean): BuildsLayout {
  const others = layout.calculations.filter((entry) => !(entry.column === calculation.column && entry.kind === calculation.kind));
  return { ...layout, calculations: on ? [...others, calculation] : others };
}
