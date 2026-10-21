// CA-13 P4: how sure, in words. One look everywhere (Decision answers, Classify helpers, Check cases), so one function.

import { UNSURE_BELOW } from "./decision";

export type CertaintySource = "run" | "maker" | "original";

/** "92% sure", or below 60% "unsure (54%)". Never a colour: the caller draws "unsure" in `t.label`. */
export function certaintyWords(share: number): { text: string; unsure: boolean } {
  const percent = Math.round(share * 100);
  return share < UNSURE_BELOW ? { text: `unsure (${percent}%)`, unsure: true } : { text: `${percent}% sure`, unsure: false };
}

/** "From the run", "Maker's figure". The site never states a vendor's figure as fact. */
export function certaintySource(source: CertaintySource | undefined): string | null {
  return source === "run" ? "From the run" : source === "maker" ? "Maker's figure" : source === "original" ? "The original's answer" : null;
}

/** What a screen reader hears: "billing, 92 percent sure, from the run". */
export function certaintySpoken(answer: string, share: number, source?: CertaintySource): string {
  const note = certaintySource(source);
  return `${answer}, ${share < UNSURE_BELOW ? "unsure, " : ""}${Math.round(share * 100)} percent sure${note ? `, ${note.charAt(0).toLowerCase()}${note.slice(1)}` : ""}`;
}

/** Every option with its share, high to low (ties keep their order). */
export function sortedShares(probabilities: Readonly<Record<string, number>>): { key: string; share: number }[] {
  return Object.entries(probabilities)
    .map(([key, share], index) => ({ key, share, index }))
    .sort((a, b) => b.share - a.share || a.index - b.index)
    .map(({ key, share }) => ({ key, share }));
}
