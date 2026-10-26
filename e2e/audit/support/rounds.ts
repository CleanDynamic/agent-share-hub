// SV-03: the request rounds of a page, for audit:pages.

/** The longest chain of spans where each starts after the one before it ended. */
export function roundsOf(spans: readonly { start: number; end: number }[]): number {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const best: number[] = [];
  let longest = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    best[i] = 1;
    for (let j = 0; j < i; j += 1) if (sorted[j].end <= sorted[i].start) best[i] = Math.max(best[i], best[j] + 1);
    longest = Math.max(longest, best[i]);
  }
  return longest;
}
