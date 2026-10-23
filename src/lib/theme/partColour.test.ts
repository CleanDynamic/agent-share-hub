// CA-06 P4 — the one helper a maker's colour goes through.

import { describe, expect, it } from "vitest";

import { contrast, over } from "./luminance";
import {
  borderFor,
  HIGHLIGHT_HOVER_MAX,
  HIGHLIGHT_MAX,
  HIGHLIGHT_MIN,
  highlightFor,
  nameColourFor,
  swatchFor,
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

describe("nameColourFor (CA-17 P5)", () => {
  const surface = (theme: "noon" | "dusk") => over(resolveToken(theme, "surface"), resolveToken(theme, "frame"));
  const ground = (theme: "noon" | "dusk") => (resolveToken(theme, "surface").startsWith("#") ? resolveToken(theme, "surface") : surface(theme));

  it("keeps every suggested colour that already reads, and brings the rest to 4.5:1, in both themes", () => {
    for (const theme of ["noon", "dusk"] as const) {
      for (const hex of SUGGESTED_COLOURS) {
        const name = nameColourFor(hex, theme);
        expect(contrast(name, ground(theme)), `${hex} in ${theme} came out ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("returns the colour itself when it already reaches 4.5:1", () => {
    expect(nameColourFor("#7FA7D9", "dusk")).toBe("#7FA7D9");
    expect(nameColourFor("#7fa7d9", "dusk")).toBe("#7FA7D9");
  });

  it("makes #7A3434 lighter in Dusk, to about #BE6666, and reaches 4.5:1", () => {
    const name = nameColourFor("#7A3434", "dusk");
    expect(name).not.toBe("#7A3434");
    expect(contrast(name, ground("dusk"))).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(parseInt(name.slice(1, 3), 16) - 0xbe)).toBeLessThanOrEqual(8);
    expect(Math.abs(parseInt(name.slice(3, 5), 16) - 0x66)).toBeLessThanOrEqual(8);
  });

  it("makes a light colour darker in Noon, and stops at the first lightness that reaches 4.5:1", () => {
    const name = nameColourFor("#8FBFB8", "noon");
    expect(name).not.toBe("#8FBFB8");
    expect(contrast(name, ground("noon"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#8FBFB8", ground("noon"))).toBeLessThan(4.5);
    const [r, g, b] = [1, 3, 5].map((at) => parseInt(name.slice(at, at + 2), 16));
    const [r0, g0, b0] = [1, 3, 5].map((at) => parseInt("#8FBFB8".slice(at, at + 2), 16));
    expect(r + g + b).toBeLessThan(r0 + g0 + b0);
  });

  it("keeps the hue: only lightness moves", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const [hex, theme] of [["#7A3434", "dusk"], ["#C9A86B", "noon"], ["#B79AD6", "noon"]] as const) {
      const name = nameColourFor(hex, theme);
      expect(Math.abs(hue(name) - hue(hex)), `${hex} ${theme}`).toBeLessThan(4);
    }
  });

  it("never changes the stored colour and leaves what is not a colour alone", () => {
    const stored = "#7A3434";
    nameColourFor(stored, "dusk");
    expect(stored).toBe("#7A3434");
    expect(nameColourFor("blue", "dusk")).toBe("blue");
  });
});

describe("swatchFor", () => {
  it("is the fill and nothing else", () => {
    expect(swatchFor("#7FA7D9")).toEqual({ background: "#7FA7D9" });
  });
});
