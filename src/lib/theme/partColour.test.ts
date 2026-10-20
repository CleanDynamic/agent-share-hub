// CA-06 P4 — the one helper a maker's colour goes through.

import { describe, expect, it } from "vitest";

import { contrast, over } from "./luminance";
import {
  borderFor,
  HIGHLIGHT_HOVER_MAX,
  HIGHLIGHT_MAX,
  HIGHLIGHT_MIN,
  highlightFor,
  normaliseHex,
  outlineFor,
  SUGGESTED_COLOURS,
  textContrastOn,
  withAlpha,
} from "./partColour";
import { resolveToken } from "./resolve";

describe("normaliseHex", () => {
  it("takes #RGB, RGB, #RRGGBB and RRGGBB in any case, trimmed, and gives #RRGGBB in upper case", () => {
    expect(normaliseHex("#7fa")).toBe("#77FFAA");
    expect(normaliseHex("7FA")).toBe("#77FFAA");
    expect(normaliseHex("#7fa7d9")).toBe("#7FA7D9");
    expect(normaliseHex("  7Fa7D9 ")).toBe("#7FA7D9");
  });

  it("gives null for anything else", () => {
    for (const bad of ["", "#", "#7fa7d", "#7fa7d9a", "##7fa7d9", "blue", "#ggg", "rgb(1,2,3)", "7f a7 d9", null, undefined, 42, {}]) expect(normaliseHex(bad)).toBeNull();
  });
});

describe("borderFor and outlineFor", () => {
  it("draws a tile's 1px border in its colour, with the colour at 35% inside it", () => {
    expect(borderFor("#7FA7D9")).toEqual({ borderColor: "#7FA7D9", boxShadow: "inset 0 0 0 1px rgba(127,167,217,0.35)" });
  });

  it("draws a session's 1px line, radius 12", () => {
    expect(outlineFor("#7FA7D9")).toEqual({ border: "1px solid #7FA7D9", borderRadius: 12 });
  });

  it("writes an alpha as rgba", () => {
    expect(withAlpha("#C9A86B", 0.2)).toBe("rgba(201,168,107,0.2)");
  });
});

describe("highlightFor", () => {
  for (const theme of ["noon", "dusk"] as const) {
    it(`keeps --text at 4.5:1 on every suggested colour in ${theme}, between 0.16 and 0.34`, () => {
      for (const hex of SUGGESTED_COLOURS) {
        const { alpha, hoverAlpha, fill } = highlightFor(hex, theme);
        expect(alpha).toBeGreaterThanOrEqual(HIGHLIGHT_MIN);
        expect(alpha).toBeLessThanOrEqual(HIGHLIGHT_MAX);
        expect(hoverAlpha).toBeCloseTo(Math.min(HIGHLIGHT_HOVER_MAX, alpha + 0.12), 5);
        expect(contrast(resolveToken(theme, "text"), over(fill, resolveToken(theme, "surface")))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("takes the strongest alpha that still keeps the text readable", () => {
    const { alpha } = highlightFor("#7FA7D9", "noon");
    expect(textContrastOn("#7FA7D9", alpha, "noon")).toBeGreaterThanOrEqual(4.5);
    if (alpha < HIGHLIGHT_MAX) expect(textContrastOn("#7FA7D9", alpha + 0.01, "noon")).toBeLessThan(4.5);
  });

  it("holds black and white too: readable, or the weakest fill when nothing is, and hover never past 0.46", () => {
    for (const theme of ["noon", "dusk"] as const) {
      for (const hex of ["#000000", "#FFFFFF"]) {
        const { alpha, hoverAlpha } = highlightFor(hex, theme);
        expect(alpha === HIGHLIGHT_MIN || textContrastOn(hex, alpha, theme) >= 4.5).toBe(true);
        expect(hoverAlpha).toBeLessThanOrEqual(HIGHLIGHT_HOVER_MAX);
      }
    }
  });
});
