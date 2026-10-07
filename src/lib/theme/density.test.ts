// UI-P53 — the density table, held to the script that tightened the kit.
//
// The golden rows below are `fs`, `sp` and `ht` from
// design/scripts/tighten-reference.py for every whole pixel from 0 to 140. If
// the app's table drifted from the script's by one value, a component mapping
// a drawn size would land a pixel off the reference it is compared against.

import { describe, expect, it } from "vitest";

import { TOUCH_MIN, denseFont, denseHeight, densePx, denseSpace, roundHalfEven } from "./density";

const FONT = [
  10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 12, 12, 13, 14, 15, 16, 15, 16, 17, 18, 19, 20, 20, 21, 22, 23, 21,
  22, 22, 23, 24, 25, 26, 26, 27, 28, 28, 29, 30, 31, 32, 32, 33, 34, 34, 35, 36, 37, 38, 38, 39, 40, 40, 41, 42, 43,
  44, 44, 45, 46, 46, 47, 48, 49, 50, 50, 51, 52, 52, 53, 54, 55, 56, 56, 57, 58, 58, 59, 60, 61, 62, 62, 63, 64, 64,
  65, 66, 67, 68, 68, 69, 70, 70, 71, 72, 73, 74, 74, 75, 76, 76, 77, 78, 79, 80, 80, 81, 82, 82, 83, 84, 85, 86, 86,
  87, 88, 88, 89, 90, 91, 92, 92, 93, 94, 94, 95, 96, 97, 98, 98, 99, 100, 100, 101, 102, 103, 104, 104, 105,
];

const SPACE = [
  0, 1, 2, 3, 4, 5, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 14, 15, 16, 17, 17, 18, 19, 19, 20, 21, 22, 22, 23,
  24, 24, 25, 26, 27, 27, 28, 29, 30, 30, 31, 32, 32, 33, 34, 35, 35, 36, 37, 37, 38, 39, 40, 40, 41, 42, 42, 43, 44,
  45, 45, 46, 47, 48, 48, 49, 50, 50, 51, 52, 53, 53, 54, 55, 55, 56, 57, 58, 58, 59, 60, 60, 61, 62, 63, 63, 64, 65,
  66, 66, 67, 68, 68, 69, 70, 71, 71, 72, 73, 73, 74, 75, 76, 76, 77, 78, 78, 79, 80, 81, 81, 82, 83, 84, 84, 85, 86,
  86, 87, 88, 89, 89, 90, 91, 91, 92, 93, 94, 94, 95, 96, 96, 97, 98, 99, 99, 100, 101,
];

/** Heights 20 to 64 are mapped; everything else is kept, so only that band is listed. */
const HEIGHT_20_TO_64 = [
  16, 17, 18, 19, 20, 20, 21, 22, 23, 24, 25, 25, 26, 27, 28, 29, 30, 30, 31, 32, 33, 34, 34, 35, 36, 37, 38, 39, 39,
  40, 41, 42, 43, 43, 44, 45, 46, 47, 48, 48, 49, 50, 51, 52, 52,
];

describe("the density table matches the script that tightened the kit", () => {
  it("maps every font size from 0 to 140 as the script does", () => {
    expect(FONT.map((_, px) => denseFont(px))).toEqual(FONT);
  });

  it("maps every padding, margin and gap from 0 to 140 as the script does", () => {
    expect(SPACE.map((_, px) => denseSpace(px))).toEqual(SPACE);
  });

  it("maps heights 20 to 64 and keeps every other height", () => {
    for (let px = 0; px <= 140; px++) {
      const expected = px >= 20 && px <= 64 ? HEIGHT_20_TO_64[px - 20] : px;
      expect(denseHeight(px), `height ${px}`).toBe(expected);
    }
  });

  it("keeps a phone control that was 44px or taller at 44, and nothing shorter", () => {
    for (let px = 0; px <= 140; px++) {
      const desktop = denseHeight(px);
      const expected = px >= TOUCH_MIN && px <= 64 ? Math.max(desktop, TOUCH_MIN) : desktop;
      expect(denseHeight(px, { touch: true }), `touch height ${px}`).toBe(expected);
    }
    expect(denseHeight(48, { touch: true })).toBe(44);
    expect(denseHeight(40, { touch: true })).toBe(33);
  });
});

describe("the table's common results (design/prompts/README-density.md)", () => {
  it("gives the type results", () => {
    const pairs = [[40, 30], [30, 22], [22, 19], [21, 18], [20, 17], [16, 15], [14, 13], [13, 12], [12, 12], [9, 10]];
    for (const [from, to] of pairs) expect(denseFont(from), `font ${from}`).toBe(to);
  });

  it("gives the spacing results", () => {
    const pairs = [[28, 20], [24, 17], [22, 16], [20, 14], [16, 12], [14, 10], [12, 9], [10, 7], [8, 6], [5, 5]];
    for (const [from, to] of pairs) expect(denseSpace(from), `space ${from}`).toBe(to);
  });

  it("gives the height results", () => {
    const pairs = [[64, 52], [56, 46], [48, 39], [40, 33], [38, 31], [36, 30], [34, 28], [32, 26], [30, 25], [24, 20]];
    for (const [from, to] of pairs) expect(denseHeight(from), `height ${from}`).toBe(to);
  });
});

describe("rounding and units", () => {
  it("rounds ties to even, as Python does", () => {
    expect([roundHalfEven(22.5), roundHalfEven(25.5), roundHalfEven(20.5), roundHalfEven(20.4)]).toEqual([22, 26, 20, 20]);
    expect(denseFont(30)).toBe(22);
    expect(denseHeight(25)).toBe(20);
  });

  it("passes fractional values through", () => {
    expect(denseFont(13.5)).toBe(13.5);
    expect(denseSpace(7.5)).toBe(7.5);
    expect(denseHeight(30.5)).toBe(30.5);
  });

  it("maps every whole px in a CSS value and leaves the rest", () => {
    expect(densePx("16px 18px", denseSpace)).toBe("12px 13px");
    expect(densePx("28px 20px", denseSpace)).toBe("20px 14px");
    expect(densePx("0 14px", denseSpace)).toBe("0 10px");
    expect(densePx("1.5px dashed", denseSpace)).toBe("1.5px dashed");
    expect(densePx("-8px", denseSpace)).toBe("-8px");
    expect(densePx("calc(100% - 24px)", denseSpace)).toBe("calc(100% - 17px)");
  });
});
