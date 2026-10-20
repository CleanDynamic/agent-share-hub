// CA-05 P1 — words a reader changes: the parts of a prompt that only fit the maker's project.
//
// Saved as character ranges in a prompt's `payload.changes` ([{ start, end }], end exclusive). PURE: nothing here reads
// or writes a node. A range that does not fit the text is skipped when read, so a stale key can never break a prompt.

export interface ChangeRange {
  start: number;
  end: number;
}

/** A piece of a prompt's text: plain, or words a reader changes. */
export interface ChangeSegment {
  text: string;
  change: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Ranges sorted, with overlaps and touching ranges joined, inside `length`, none empty. */
export function normalizeRanges(ranges: readonly ChangeRange[], length: number): ChangeRange[] {
  const fitted = ranges
    .map((range) => ({ start: Math.max(0, Math.floor(range.start)), end: Math.min(length, Math.floor(range.end)) }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: ChangeRange[] = [];
  for (const range of fitted) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else out.push({ ...range });
  }
  return out;
}

/** A prompt's stored `changes`, read defensively against its text. */
export function changesOf(payload: unknown, text: string): ChangeRange[] {
  const raw = isRecord(payload) ? payload.changes : undefined;
  if (!Array.isArray(raw)) return [];
  const ranges = raw.flatMap((entry) =>
    isRecord(entry) && typeof entry.start === "number" && typeof entry.end === "number" ? [{ start: entry.start, end: entry.end }] : [],
  );
  return normalizeRanges(ranges, text.length);
}

/** Mark a range as words a reader changes. */
export function addRange(ranges: readonly ChangeRange[], range: ChangeRange, length: number): ChangeRange[] {
  return normalizeRanges([...ranges, range], length);
}

/** Keep as written: every range the selection touches goes. */
export function removeRange(ranges: readonly ChangeRange[], range: ChangeRange): ChangeRange[] {
  const caret = range.start === range.end;
  return ranges.filter((other) => (caret ? !(range.start >= other.start && range.start <= other.end) : other.end <= range.start || other.start >= range.end));
}

/** The range a selection lies in or touches, or null. A caret counts when it is inside the range. */
export function rangeAt(ranges: readonly ChangeRange[], selection: ChangeRange): ChangeRange | null {
  const caret = selection.start === selection.end;
  return (
    ranges.find((range) => (caret ? selection.start > range.start && selection.start < range.end : selection.start < range.end && selection.end > range.start)) ?? null
  );
}

/**
 * Ranges after the text changed from `before` to `after`. The edit is found as the part between the longest shared
 * start and the longest shared end. A range before it stays, one after it moves, one the edit sits inside grows or
 * shrinks with it, and one the edit cuts across (or swallows) goes.
 */
export function shiftRanges(before: string, after: string, ranges: readonly ChangeRange[]): ChangeRange[] {
  if (before === after || ranges.length === 0) return normalizeRanges(ranges, after.length);
  let prefix = 0;
  const shortest = Math.min(before.length, after.length);
  while (prefix < shortest && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < shortest - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  const editStart = prefix;
  const editEnd = before.length - suffix;
  const delta = after.length - before.length;
  const next: ChangeRange[] = [];
  for (const range of ranges) {
    if (range.end <= editStart) next.push({ ...range });
    else if (range.start >= editEnd) next.push({ start: range.start + delta, end: range.end + delta });
    else if (range.start <= editStart && range.end >= editEnd) next.push({ start: range.start, end: range.end + delta });
  }
  return normalizeRanges(next, after.length);
}

/** The text cut into plain pieces and pieces a reader changes. */
export function segmentsOf(text: string, ranges: readonly ChangeRange[]): ChangeSegment[] {
  const fitted = normalizeRanges(ranges, text.length);
  const out: ChangeSegment[] = [];
  let at = 0;
  for (const range of fitted) {
    if (range.start > at) out.push({ text: text.slice(at, range.start), change: false });
    out.push({ text: text.slice(range.start, range.end), change: true });
    at = range.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), change: false });
  return out;
}

/** Copy's text: the words a reader changes in square brackets, "[your shop name]". */
export function bracketed(text: string, ranges: readonly ChangeRange[] | undefined): string {
  if (!ranges || ranges.length === 0) return text;
  return segmentsOf(text, ranges)
    .map((segment) => (segment.change ? `[${segment.text}]` : segment.text))
    .join("");
}

/** "2 words to change before you send it", or null when there are none. */
export function changesLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? "word" : "words"} to change before you send it`;
}
