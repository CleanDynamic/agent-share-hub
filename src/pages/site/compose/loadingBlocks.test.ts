// CA-24 P1 - the building blocks' numbers: the cell, the cycle, the colours, the wave, the order a block builds in.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  BLOCK_STEP_MS,
  BUILD_MS,
  BUILD_RISE,
  CELL_FONT,
  CELL_H,
  CELL_W,
  CYCLE_MS,
  FRAMES,
  FRAME_GLYPHS,
  GLYPHS,
  GLYPH_OPACITY,
  ROW_STEP_MS,
  buildDelay,
  columnsOf,
  PHASE_MS,
  framesOf,
  layersOf,
  lineOf,
  phaseOf,
  resetFirstShow,
  rowsOf,
  takeFirstShow,
  waveDelay,
} from "./loadingBlocks";

/** The four characters, by code point (the look rules keep pictographs out of the source). */
const [D, O, S, F] = ["\u00B7", "\u25AB", "\u25AA", "\u25A0"];

const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

/** The frames (0 to 9) in which a keyframe set shows its glyph, read off its percentages: each step holds until the next. */
function framesFromCss(name: string): { frames: number[]; opacity: number } {
  const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
  const stops = [...block.matchAll(/(\d+)%\s*\{\s*opacity:\s*([\d.]+);/g)].map((m) => ({ at: Number(m[1]), opacity: Number(m[2]) }));
  const frames: number[] = [];
  for (let frame = 0; frame < FRAMES; frame += 1) {
    const at = (frame * 100) / FRAMES;
    const held = [...stops].reverse().find((stop) => stop.at <= at);
    if (held && held.opacity > 0) frames.push(frame);
  }
  return { frames, opacity: Math.max(...stops.map((stop) => stop.opacity)) };
}

describe("the cell and the cycle", () => {
  it("is 8 by 12, in the data face at 11", () => {
    expect([CELL_W, CELL_H, CELL_FONT]).toEqual([8, 12, 11]);
  });

  it("steps through ten frames in 1,600 ms: dot, open, small, full, full, small, open, dot, dot, dot", () => {
    expect(CYCLE_MS).toBe(1600);
    expect(FRAMES).toBe(10);
    expect(FRAME_GLYPHS.map((glyph) => GLYPHS[glyph]).join(" ")).toBe([D, O, S, F, F, S, O, D, D, D].join(" "));
  });

  it("shows the dot and the open square at 62%, the small square at 80% and the full square at 100%", () => {
    expect([...GLYPH_OPACITY]).toEqual([0.62, 0.62, 0.8, 1]);
  });

  it("has keyframes in index.css that show each glyph in exactly its frames, at its opacity", () => {
    const names = ["bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull"];
    names.forEach((name, glyph) => {
      const read = framesFromCss(name);
      expect(read.frames, name).toEqual(framesOf(glyph));
      expect(read.opacity, name).toBe(GLYPH_OPACITY[glyph]);
    });
  });

  it("animates opacity and nothing else in the cycle", () => {
    for (const name of ["bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull"]) {
      const block = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
      expect(block.replace(/opacity:\s*[\d.]+;/g, "").replace(/[\d%\s{}]/g, ""), name).toBe("");
    }
  });
});

describe("the wave", () => {
  it("starts a cell at -(x / 8 * 22 + y / 12 * 70) mod 1600", () => {
    expect(waveDelay(0, 0)).toBe(0);
    expect(waveDelay(8, 0)).toBe(-22);
    expect(waveDelay(0, 12)).toBe(-70);
    expect(waveDelay(80, 24)).toBe(-(10 * 22 + 2 * 70));
    expect(waveDelay(8 * 100, 0)).toBe(-(2200 % 1600));
  });

  it("is a function of page position, so two blocks side by side continue one wave", () => {
    // A block at page x = 0 and its neighbour at x = 200 (25 cells on): the neighbour's first cell is where a 26th cell of the first would be.
    const second = waveDelay(200 + 0, 36);
    const continued = waveDelay(25 * CELL_W, 3 * CELL_H);
    expect(second).toBe(continued);
    expect(waveDelay(200 + CELL_W, 36) - second).toBe(-22);
  });

  it("keeps a block that mounts later in step, by the page's clock", () => {
    expect(waveDelay(0, 0, 400)).toBe(-400);
    expect(waveDelay(8, 12, 1590)).toBe(-((22 + 70 + 1590) % 1600));
  });

  it("is never positive and never a whole cycle", () => {
    for (const [x, y] of [[0, 0], [8000, 4000], [123, 456]]) {
      const delay = waveDelay(x, y, 999);
      expect(delay).toBeLessThanOrEqual(0);
      expect(delay).toBeGreaterThan(-CYCLE_MS);
    }
  });
});

describe("the box", () => {
  it("fills a width with whole cells, and a line is one row", () => {
    expect(columnsOf(180)).toBe(22);
    expect(columnsOf(7)).toBe(0);
    expect(rowsOf("line", 5)).toBe(1);
    expect(rowsOf("box", 3)).toBe(3);
  });
});

describe("building, on first show only", () => {
  beforeEach(resetFirstShow);

  it("rises 4 over 200 ms, bottom row first 60 ms apart, blocks 40 ms apart", () => {
    expect([BUILD_RISE, BUILD_MS, ROW_STEP_MS, BLOCK_STEP_MS]).toEqual([4, 200, 60, 40]);
    // A block of three rows: the bottom row starts at the block's turn, then each row above 60 later.
    expect([0, 1, 2].map((row) => buildDelay(0, row, 3))).toEqual([120, 60, 0]);
    // The next block in reading order starts 40 later.
    expect(buildDelay(1, 2, 3)).toBe(40);
    expect(buildDelay(5, 0, 3)).toBe(200 + 120);
  });

  it("builds once, and every later placeholder is simply there", () => {
    expect(takeFirstShow()).toBe(true);
    expect(takeFirstShow()).toBe(false);
  });
});

describe("layers", () => {
  it("rounds the wave to the nearest 160 ms (one frame), and never leaves the cycle", () => {
    expect(PHASE_MS).toBe(160);
    expect(phaseOf(0, 0)).toBe(0);
    // 22 ms is less than half of 160: the next cell across starts with this one; eight cells across are 176 ms: one step.
    expect(phaseOf(8, 0)).toBe(0);
    expect(phaseOf(64, 0)).toBe(160);
    expect(phaseOf(8 * 70, 0)).toBeLessThan(1600);
    expect(phaseOf(0, 12, 1599)).toBeLessThan(1600);
  });

  it("groups the cells of a block by start: each cell once, the starts in order, a delay never positive", () => {
    const layers = layersOf(30, 3, { x: 16, y: 8 });
    expect(layers.length).toBeLessThanOrEqual(1600 / PHASE_MS);
    const seen = new Set<string>();
    for (const layer of layers) {
      expect(layer.delay).toBeLessThanOrEqual(0);
      layer.rows.forEach((members, row) => {
        for (const col of members) {
          expect(seen.has(`${row}:${col}`)).toBe(false);
          seen.add(`${row}:${col}`);
          expect(layer.delay === 0 ? 0 : -layer.delay).toBe(phaseOf(16 + col * 8, 8 + row * 12));
        }
      });
    }
    expect(seen.size).toBe(90);
  });

  it("writes a row as text: the character at the cells that start here and a space at the rest", () => {
    expect(lineOf(6, [1, 4], "■")).toBe(" ■  ■ ");
    expect(lineOf(3, [], "·")).toBe("   ");
  });
});
