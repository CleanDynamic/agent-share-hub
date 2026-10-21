/* CA-11 — the lines of a piece of code, shared by the editor and the read-only view.

   PURE. A line break is "\r\n", "\r" or "\n", each one break. Text that ends in a break shows one more (empty) line,
   as an editor does; empty text is one empty line. */

import type { CSSProperties } from "react";

/** Font size and line height, in px: the same for the numbers and the code, so each number sits beside its line. */
export interface CodeMetrics {
  fontSize: number;
  lineHeight: number;
}

export const codeMetrics = (phone: boolean): CodeMetrics => (phone ? { fontSize: 16, lineHeight: 24 } : { fontSize: 13, lineHeight: 20 });

/** Padding above and below the code, inside the well. */
export const CODE_PAD_Y = 6;
/** The gutter: 12 before the numbers, 8 after, then the 1px line. */
export const GUTTER_PAD_LEFT = 12;
export const GUTTER_PAD_RIGHT = 8;

const BREAK = /\r\n|\r|\n/g;

/** How many numbered lines the text has: always at least 1. */
export function numberedLines(text: string): number {
  let n = 1;
  for (const _ of text.matchAll(BREAK)) n += 1;
  return n;
}

/** The text split into lines, by the same rule as `numberedLines`. */
export const splitLines = (text: string): string[] => text.split(BREAK);

/** The offset each line starts at. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (const hit of text.matchAll(BREAK)) starts.push((hit.index ?? 0) + hit[0].length);
  return starts;
}

/** The 1-based line holding the offset. */
export function lineAt(text: string, offset: number): number {
  let n = 1;
  for (const hit of text.slice(0, offset).matchAll(BREAK)) {
    // A "\r\n" cut in half by the offset is still one break not yet taken.
    if ((hit.index ?? 0) + hit[0].length <= offset) n += 1;
  }
  return n;
}

/** "1\n2\n3…": the numbers as one text block. */
export function gutterText(count: number): string {
  let out = "1";
  for (let i = 2; i <= count; i += 1) out += `\n${i}`;
  return out;
}

/** The gutter's width in digits: at least 2, 3 from line 100. */
export const gutterDigits = (count: number): number => Math.max(2, String(count).length);

/** The first `max` lines of the text, and how many lines it has. */
export function head(text: string, max: number): { shown: string; total: number } {
  const total = numberedLines(text);
  if (total <= max) return { shown: text, total };
  return { shown: splitLines(text).slice(0, max).join("\n"), total };
}

/** The style both columns share. */
export const codeFont = (font: string, m: CodeMetrics): CSSProperties => ({
  fontFamily: font,
  fontSize: m.fontSize,
  lineHeight: `${m.lineHeight}px`,
  fontVariantNumeric: "tabular-nums",
});
