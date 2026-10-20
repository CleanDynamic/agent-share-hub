// CA-07 P3 — a crop shown without changing the file: where the whole picture sits in its cell.

import { describe, expect, it } from "vitest";

import { croppedRatio, cropStyle } from "./cropStyle";

const pct = (value: unknown) => Number(String(value).replace("%", ""));
/** The part of the original the cell shows, in fractions, read back from the style. */
function shown(style: ReturnType<typeof cropStyle>) {
  const w = 100 / pct(style.width);
  const h = 100 / pct(style.height);
  return { x: (-pct(style.left) / 100) * w, y: (-pct(style.top) / 100) * h, w, h };
}
const near = (value: { x: number; y: number; w: number; h: number }) => Object.fromEntries(Object.entries(value).map(([key, n]) => [key, Math.round(n * 1000) / 1000 + 0]));

describe("cropStyle", () => {
  it("shows the whole picture when the cell is its own shape and there is no crop", () => {
    const style = cropStyle({ w: 1600, h: 900, crop: null }, 16 / 9);
    expect(style).toMatchObject({ position: "absolute", width: "100%", height: "100%", left: "0%", top: "0%" });
  });

  it("cuts from the middle to fill a cell of another shape: one picture of two (8:9)", () => {
    expect(near(shown(cropStyle({ w: 1600, h: 900, crop: null }, 8 / 9)))).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 });
  });

  it("cuts a tall picture in a 16:9 cell, the third and fourth of a grid, from the middle", () => {
    expect(near(shown(cropStyle({ w: 900, h: 1600, crop: null }, 16 / 9)))).toEqual({ x: 0, y: 0.342, w: 1, h: 0.316 });
  });

  it("keeps the top when asked: a single picture taller than 3:4", () => {
    expect(near(shown(cropStyle({ w: 1170, h: 2532, crop: null }, 3 / 4, "top")))).toMatchObject({ x: 0, y: 0, w: 1 });
  });

  it("shows exactly a wide crop in a cell of its shape", () => {
    // A square picture cropped to its middle band, 16:9.
    const crop = { x: 0, y: 0.21875, w: 1, h: 0.5625 };
    expect(croppedRatio({ w: 1000, h: 1000, crop })).toBeCloseTo(16 / 9, 5);
    expect(near(shown(cropStyle({ w: 1000, h: 1000, crop }, 16 / 9)))).toEqual({ x: 0, y: 0.219, w: 1, h: 0.562 });
  });

  it("shows a square crop, then cuts it further for a 16:9 cell", () => {
    const crop = { x: 0.2, y: 0, w: 0.5625, h: 1 };
    expect(croppedRatio({ w: 1600, h: 900, crop })).toBeCloseTo(1, 5);
    const cut = near(shown(cropStyle({ w: 1600, h: 900, crop }, 16 / 9)));
    expect(cut.x).toBeCloseTo(0.2, 2);
    expect(cut.w).toBeCloseTo(0.5625, 2);
    expect(cut.h).toBeCloseTo(0.5625, 2);
    expect(cut.y).toBeCloseTo(0.219, 2);
  });

  it("keeps a crop at an edge at that edge", () => {
    const crop = { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
    expect(near(shown(cropStyle({ w: 1000, h: 1000, crop }, 1)))).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });

  it("takes 3:2 for a picture with no size", () => {
    expect(croppedRatio({ w: null, h: null, crop: null })).toBe(1.5);
    expect(cropStyle({ w: null, h: null, crop: null }, 1.5)).toMatchObject({ width: "100%", height: "100%" });
  });
});
