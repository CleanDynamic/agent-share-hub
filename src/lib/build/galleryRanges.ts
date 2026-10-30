// SV-23: the Builds table's number filters. Each is a range on one stored column of `builds`, written in the address as
// `steps=5-30` (from 5 to 30), `steps=5-` (5 or more) or `steps=-30` (up to 30). A value at the cap means "or more": the panel's
// slider ends there.

export const RANGE_FILTERS = {
  steps: { column: "step_count", cap: 60, name: "Steps" },
  sessions: { column: "session_count", cap: 20, name: "Sessions" },
  // SV-23 P2: the proof, on columns every build has.
  reproductions: { column: "reproduction_count", cap: 50, name: "Reproductions" },
  rebuilds: { column: "rebuild_count", cap: 20, name: "Rebuilds" },
  likes: { column: "like_count", cap: 50, name: "Likes" },
} as const;

export type RangeKey = keyof typeof RANGE_FILTERS;
export const RANGE_KEYS = Object.keys(RANGE_FILTERS) as RangeKey[];

export interface NumberRange {
  min?: number;
  max?: number;
}

/** `5-30`, `5-`, `-30`; anything else, an empty range or one that ends before it starts is none. */
export function parseRange(raw: string | null | undefined): NumberRange | null {
  const found = /^(\d{1,4})?-(\d{1,4})?$/.exec((raw ?? "").trim());
  if (!found) return null;
  const min = found[1] === undefined ? undefined : Number(found[1]);
  const max = found[2] === undefined ? undefined : Number(found[2]);
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && max !== undefined && min > max) return null;
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

export function formatRange(range: NumberRange | null | undefined): string | null {
  if (!range || (range.min === undefined && range.max === undefined)) return null;
  return `${range.min ?? ""}-${range.max ?? ""}`;
}

/** The range in words: "3 or more", "up to 30", "5 to 30", "exactly 4". */
export function rangeWords(range: NumberRange): string {
  const { min, max } = range;
  if (min !== undefined && max !== undefined) return min === max ? `exactly ${min}` : `${min} to ${max}`;
  if (min !== undefined) return `${min} or more`;
  return `up to ${max}`;
}
