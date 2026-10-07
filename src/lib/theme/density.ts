// buildgallery.ai — the density table (UI-P52 to UI-P58).
//
// The "tighter, organised like the example" pass, as arithmetic. The same table
// is `design/prompts/README-density.md` in words and
// `design/scripts/tighten-reference.py` in Python, which is what tightened the
// reference kit. This is it for the app: a component that takes a size the
// boards drew before the pass maps it here, so its callers keep compiling and
// tighten without each one being edited.
//
// IT IS THE SCRIPT'S TABLE EXACTLY, QUIRKS INCLUDED. The bands meet unevenly —
// a 17px font becomes 16 and an 18px one 15, a 19px height is kept and a 20px
// one becomes 16 — and the app copies that rather than smoothing it, because
// the kit it is compared against was made by the script. `density.test.ts`
// holds every value from 0 to 140 to the script's output.
//
// ROUNDING IS HALF TO EVEN, because Python's `round()` is: 30px type becomes 22
// and a 25px height becomes 20, where `Math.round` would give 23 and 21 and
// leave the app a pixel off the reference.
//
// ONLY WHOLE PIXELS ARE MAPPED. A fractional value (1.5px) passes through
// unchanged, as it does in the script.

/** A control that was at least this tall keeps it below 768px: the touch target. */
export const TOUCH_MIN = 44;

/** Round to the nearest integer, ties to the even one — Python's `round()`. */
export function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const rest = x - floor;
  if (rest > 0.5) return floor + 1;
  if (rest < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

const whole = (px: number) => Number.isInteger(px);

/**
 * font-size and a px line-height: 28 and up ×0.75; 18–27 ×0.85; 14–17 −1;
 * 13 → 12; 10–12 kept; under 10 → 10 (no text under 10px).
 */
export function denseFont(px: number): number {
  if (!whole(px)) return px;
  if (px >= 28) return roundHalfEven(px * 0.75);
  if (px >= 18) return roundHalfEven(px * 0.85);
  if (px >= 14) return px - 1;
  if (px === 13) return 12;
  if (px < 10) return 10;
  return px;
}

/** padding, margin and gap: under 6 kept; otherwise round(×0.72), never below 4. */
export function denseSpace(px: number): number {
  if (!whole(px) || px < 6) return px;
  return Math.max(4, roundHalfEven(px * 0.72));
}

export interface DenseHeightOptions {
  /**
   * The value belongs to a control on a phone (below 768px). A control that
   * was 44px or taller stays at least 44px there: the touch target.
   */
  touch?: boolean;
}

/**
 * height, min-height, and the side of a square control: 20–64 → round(×0.82);
 * under 20 and over 64 kept. With `touch`, a control that was 44px or taller
 * keeps 44.
 */
export function denseHeight(px: number, { touch = false }: DenseHeightOptions = {}): number {
  if (!whole(px) || px < 20 || px > 64) return px;
  const dense = roundHalfEven(px * 0.82);
  return touch && px >= TOUCH_MIN ? Math.max(dense, TOUCH_MIN) : dense;
}

/** A whole pixel value in CSS text, as the script finds it: not part of a word, a decimal or a negative. */
const PX = /(?<![\w.#-])(\d+(?:\.\d+)?)px/g;

/**
 * Every whole `Npx` in a CSS value mapped through `fn`, the rest left alone:
 * `densePx("16px 18px", denseSpace)` is `"12px 13px"`.
 */
export function densePx(value: string, fn: (px: number) => number): string {
  return value.replace(PX, (match, n: string) => (whole(Number(n)) ? `${fn(Number(n))}px` : match));
}
