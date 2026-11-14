// CA-24 P1 - the building blocks' numbers: the cell a block's box is measured in, and the first show. (Part E drew the
// blocks as a dot field; the glyph cycle, the colours, the wave and the layers went with the character grid.)

import { beforeEach, describe, expect, it } from "vitest";

import { CELL_H, CELL_W, columnsOf, fillOf, resetFirstShow, rowsOf, takeFirstShow } from "./loadingBlocks";

describe("the box", () => {
  it("is measured in 8 by 12 cells", () => {
    expect([CELL_W, CELL_H]).toEqual([8, 12]);
    expect(fillOf(80, 36)).toEqual({ cols: 10, rows: 3, left: 0, top: 0 });
  });

  it("fills a width with whole cells, and a line is one row", () => {
    expect(columnsOf(180)).toBe(22);
    expect(columnsOf(7)).toBe(0);
    expect(rowsOf("line", 5)).toBe(1);
    expect(rowsOf("box", 3)).toBe(3);
  });
});

describe("building, on first show only", () => {
  beforeEach(resetFirstShow);

  it("builds once, and every later placeholder is simply there", () => {
    expect(takeFirstShow()).toBe(true);
    expect(takeFirstShow()).toBe(false);
  });
});
