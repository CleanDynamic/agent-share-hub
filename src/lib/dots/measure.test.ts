import { describe, expect, it } from "vitest";

import { BAR, dotsOf, TAIL, type Shape } from "./fluid";
import { barOf, linesOf, paints } from "./measure";

describe("measuring a layout into dot shapes", () => {
  it("joins the rects of one line and keeps separate lines apart, top to bottom", () => {
    const lines = linesOf([
      { left: 0, top: 20, width: 40, height: 16 },
      { left: 40, top: 21, width: 30, height: 16 },
      { left: 0, top: 0, width: 90, height: 16 },
      { left: 0, top: 50, width: 0, height: 16 },
    ]);
    expect(lines).toEqual([
      { left: 0, top: 0, width: 90, height: 16 },
      { left: 0, top: 20, width: 70, height: 16 },
    ]);
  });

  it("draws a text line as a bar as wide as the line and BAR of the font size tall, centred on it", () => {
    const bar = barOf({ left: 10, top: 100, width: 200, height: 20 }, 15, false);
    expect(bar.kind).toBe("bar");
    expect(bar.width).toBe(200);
    expect(bar.height).toBe(Math.round(15 * BAR));
    expect(bar.y + bar.height / 2).toBe(110);
    expect(barOf({ left: 0, top: 0, width: 50, height: 20 }, 15, true).tail).toBe(true);
  });

  it("says whether a colour paints anything", () => {
    expect(paints("rgba(0, 0, 0, 0)")).toBe(false);
    expect(paints("transparent")).toBe(false);
    expect(paints("")).toBe(false);
    expect(paints("rgb(18, 21, 19)")).toBe(true);
    expect(paints("rgba(18, 21, 19, 0.5)")).toBe(true);
  });
});

describe("the dots of each kind", () => {
  const box: Shape = { x: 0, y: 0, width: 160, height: 40, radius: 12 };
  it("a fill is faint, a block is solid", () => {
    expect(Math.max(...dotsOf({ ...box, kind: "fill" }, 0, 0).w)).toBeLessThan(1);
    expect(Math.min(...dotsOf({ ...box, kind: "block" }, 0, 0).w)).toBe(1);
  });
  it("an outline keeps only the rim, and fewer dots than a block", () => {
    const outline = dotsOf({ ...box, kind: "outline" }, 0, 0);
    const block = dotsOf({ ...box, kind: "block" }, 0, 0);
    expect(outline.x.length).toBeGreaterThan(0);
    expect(outline.x.length).toBeLessThan(block.x.length / 2);
  });
  it("only the last line of a paragraph thins, over its final 32%", () => {
    const text: Shape = { x: 0, y: 0, width: 200, height: 48, radius: 2, kind: "lines", rows: 3 };
    const dots = dotsOf(text, 0, 0);
    const thinning = dots.x.filter((_, i) => dots.tail[i] >= 0);
    expect(thinning.length).toBeGreaterThan(0);
    for (const x of thinning) expect(x).toBeGreaterThanOrEqual(200 * (1 - TAIL) - 4);
    const rowsOfThinning = new Set(dots.y.filter((_, i) => dots.tail[i] >= 0));
    expect(Math.min(...rowsOfThinning)).toBeGreaterThan(32 - 1);
    expect(Math.max(...dots.w)).toBe(1);
    expect(Math.min(...dots.w)).toBeLessThan(0.5);
  });
  it("a single bar does not thin unless it is the end of a paragraph", () => {
    const one = dotsOf({ x: 0, y: 0, width: 200, height: 10, radius: 2, kind: "bar" }, 0, 0);
    expect(one.tail.every((value) => value === -1)).toBe(true);
    const end = dotsOf({ x: 0, y: 0, width: 200, height: 10, radius: 2, kind: "bar", tail: true }, 0, 0);
    expect(end.tail.some((value) => value >= 0)).toBe(true);
  });
});
