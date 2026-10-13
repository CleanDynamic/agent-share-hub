// UI-P75 — a dimmed Map box keeps its text readable: at least 3:1 against the frame, in both themes.

import { describe, expect, it } from "vitest";

import { aubergine, birch, lavender } from "@/lib/theme/primitives";

import { DIMMED } from "./BuildMap";

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as Rgb;
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb => fg.map((value, at) => alpha * value + (1 - alpha) * bg[at]) as Rgb;
const luminance = ([r, g, b]: Rgb) => {
  const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const THEMES = {
  Noon: { text: birch[950], text2: birch[600], frame: birch[40] },
  Dusk: { text: lavender[50], text2: lavender[200], frame: aubergine[940] },
} as const;

describe("DIMMED", () => {
  it.each(Object.entries(THEMES))("%s: text and secondary text on a dimmed box keep 3:1 against the frame", (_name, theme) => {
    for (const ink of [theme.text, theme.text2]) {
      expect(ratio(over(rgb(ink), rgb(theme.frame), DIMMED), rgb(theme.frame))).toBeGreaterThanOrEqual(3);
    }
  });

  it("is the lowest hundredth that passes", () => {
    const passes = (alpha: number) => Object.values(THEMES).every((theme) => [theme.text, theme.text2].every((ink) => ratio(over(rgb(ink), rgb(theme.frame), alpha), rgb(theme.frame)) >= 3));
    expect(passes(DIMMED)).toBe(true);
    expect(passes(Math.round((DIMMED - 0.01) * 100) / 100)).toBe(false);
  });
});
