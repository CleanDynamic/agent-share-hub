// Find in build (CA-27 P1): the words a find looks through, and how it matches them. PURE: text in, ranges and ids out.
//
// A search ignores case and treats what is typed as plain text (a "(" or a "." is a letter). One match is one tile, session or part,
// however many of its fields hold the words; the count reads "2 of 5" in those. The page draws the words found in a tile's title and
// preview with `FindHit`; this module only says which targets match and where in a string.

/** How long typing must stop before the results move. */
export const FIND_DELAY = 120;

/** What a find reads. */
export type FindField = "title" | "prompt" | "file" | "session" | "app" | "part" | "details";

export interface FindTarget {
  /** A tile's id, a session's key or a part's key. */
  id: string;
  kind: "tile" | "session" | "part";
  /** The session a tile or session stands in, and the part a session stands in; null where there is none. */
  session: string | null;
  part: string | null;
  fields: readonly { field: FindField; text: string }[];
}

export const FIND_COPY = {
  button: "Find in build",
  placeholder: "Find in build",
  previous: "Previous match",
  next: "Next match",
  close: "Close find",
  none: "No matches",
  count: (at: number, of: number) => `${at} of ${of}`,
} as const;

/** The query as it is searched: trimmed. Empty means no search. */
export const normaliseFind = (raw: string): string => raw.trim();

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where `query` stands in `text`, ignoring case, as [start, end) pairs that do not overlap. */
export function findRanges(text: string, query: string): [number, number][] {
  const needle = normaliseFind(query);
  if (!needle || !text) return [];
  const pattern = new RegExp(escape(needle), "gi");
  const out: [number, number][] = [];
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    out.push([match.index, match.index + match[0].length]);
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  return out;
}

/** Whether a string holds the words. */
export const holds = (text: string | null | undefined, query: string): boolean => Boolean(text) && findRanges(text as string, query).length > 0;

/** The targets that hold the query, in the order they stand on the page. One pattern serves every field. */
export function findMatches(targets: readonly FindTarget[], query: string): FindTarget[] {
  const needle = normaliseFind(query);
  if (!needle) return [];
  const pattern = new RegExp(escape(needle), "i");
  return targets.filter((target) => target.fields.some((field) => pattern.test(field.text)));
}

/** "2 of 5", or "No matches" when nothing matches. `at` is the 0-based position of the current match. */
export const countWords = (at: number, total: number): string => (total === 0 ? FIND_COPY.none : FIND_COPY.count(at + 1, total));

/** The next match after `at`, wrapping; `by` is 1 or -1. */
export const stepMatch = (at: number, total: number, by: 1 | -1): number => (total === 0 ? 0 : (at + by + total) % total);
