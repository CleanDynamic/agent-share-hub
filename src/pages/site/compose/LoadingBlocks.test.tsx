// CA-24 P1 - the component: the cell, the layers, the delays from page position, building, arriving, reduced motion, and what
// a screen reader meets.

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { LoadingBlocks, LoadingStatus } from "./LoadingBlocks";
import { GLYPHS, PHASE_MS, phaseOf, resetFirstShow } from "./loadingBlocks";

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
}

beforeEach(() => {
  reducedMotion(false);
  resetFirstShow();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

const blocks = () => screen.getAllByTestId("loading-blocks");
const layersOf = (block: HTMLElement) => Array.from(block.children) as HTMLElement[];
/** A layer's rows as text. */
const linesOf = (layer: HTMLElement) => Array.from(layer.children).map((row) => row.textContent ?? "");
/** The delay a layer's animation starts at, in ms. */
const delayOf = (layer: HTMLElement) => Number.parseFloat(/step-end\s+(-?[\d.]+)ms/.exec(layer.style.animation)?.[1] ?? "NaN");

describe("the cell", () => {
  it("fills a box with 8 by 12 cells: 10 across and 3 down in 80 by 36", () => {
    render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    expect(block.getAttribute("data-cols")).toBe("10");
    expect(block.getAttribute("data-rows")).toBe("3");
    // Every layer is three lines of ten characters, eight to the cell.
    for (const layer of layersOf(block)) {
      expect(linesOf(layer)).toHaveLength(3);
      for (const line of linesOf(layer)) expect(line).toHaveLength(10);
      expect(layer.style.lineHeight).toBe("12px");
      expect(layer.style.fontSize).toBe("11px");
      expect(layer.getAttribute("style")).toContain("letter-spacing: calc(8px - 1ch)");
    }
  });

  it("is in the data face at 11 in the disabled text colour", () => {
    // jsdom drops a var() colour from the DOM, so the paint is read from the markup.
    const html = renderToStaticMarkup(<LoadingBlocks kind="line" width={8} />);
    expect(html).toContain("color:var(--text-disabled)");
    expect(html).toContain("var(--font-data");
    expect(html).toContain("font-size:11px");
  });

  it("makes a line one row whatever rows says", () => {
    render(<LoadingBlocks kind="line" rows={4} width={40} />);
    expect(blocks()[0].getAttribute("data-rows")).toBe("1");
    expect(blocks()[0].style.height).toBe("12px");
  });
});

describe("the layers and the cycle", () => {
  it("has a layer for each character at each start, each changing opacity only, step-end over 1,600 ms", () => {
    render(<LoadingBlocks kind="box" rows={2} width={64} at={{ x: 0, y: 0 }} />);
    const layers = layersOf(blocks()[0]);
    expect(layers.length % 4).toBe(0);
    for (const layer of layers) {
      expect(layer.style.animation).toMatch(/^bgLoad(Dot|Open|Small|Full) 1600ms step-end -?[\d.]+ms infinite$/);
      expect(layer.style.opacity).toBe("0");
      expect(layer.style.transform).toBe("");
    }
    const names = layers.slice(0, 4).map((layer) => layer.style.animation.split(" ")[0]);
    expect(names).toEqual(["bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull"]);
    // The four layers of one start hold the four characters, and nothing else, at the same cells.
    const [dot, open, small, full] = layers.slice(0, 4).map(linesOf);
    expect(dot).toEqual(open.map((line) => line.split(GLYPHS[1]).join(GLYPHS[0])));
    expect(full).toEqual(dot.map((line) => line.split(GLYPHS[0]).join(GLYPHS[3])));
    expect(small).toEqual(dot.map((line) => line.split(GLYPHS[0]).join(GLYPHS[2])));
  });

  it("draws every cell once in each character, so no cell is left out or doubled", () => {
    render(<LoadingBlocks kind="box" rows={3} width={200} at={{ x: 40, y: 24 }} />);
    const layers = layersOf(blocks()[0]);
    for (let glyph = 0; glyph < 4; glyph += 1) {
      const mine = layers.filter((layer) => layer.textContent?.includes(GLYPHS[glyph]) && !GLYPHS.filter((_, at) => at !== glyph).some((other) => layer.textContent?.includes(other)));
      const count = mine.reduce((sum, layer) => sum + (layer.textContent ?? "").split(" ").join("").length, 0);
      expect(count, GLYPHS[glyph]).toBe(25 * 3);
    }
  });

  it("is a few dozen layers however big the box is", () => {
    render(<LoadingBlocks kind="box" rows={3} width={760} at={{ x: 0, y: 0 }} />);
    expect(Number(blocks()[0].getAttribute("data-layers"))).toBeLessThanOrEqual((1600 / PHASE_MS) * 4);
    expect(PHASE_MS).toBe(160);
    expect(layersOf(blocks()[0]).length).toBeLessThan(40 * 3);
  });
});

describe("the wave comes from the page, not the block", () => {
  it("starts each cell at its page position: the layer holding a cell starts where phaseOf says", () => {
    render(<LoadingBlocks kind="box" rows={2} width={24} at={{ x: 100, y: 48 }} />);
    const dots = layersOf(blocks()[0]).filter((layer) => layer.textContent?.includes(GLYPHS[0]));
    for (const layer of dots) {
      const lines = linesOf(layer);
      lines.forEach((line, row) => {
        [...line].forEach((char, col) => {
          if (char === " ") return;
          const phase = phaseOf(100 + col * 8, 48 + row * 12);
          expect(delayOf(layer) === 0 ? 0 : -delayOf(layer)).toBe(phase);
        });
      });
    }
  });

  it("continues one wave across two blocks side by side", () => {
    render(
      <>
        <LoadingBlocks kind="line" width={80} at={{ x: 0, y: 0 }} />
        <LoadingBlocks kind="line" width={80} at={{ x: 80, y: 0 }} />
      </>,
    );
    const startsOf = (block: HTMLElement) => {
      const out = new Map<number, number>();
      for (const layer of layersOf(block).filter((candidate) => candidate.textContent?.includes(GLYPHS[0]))) {
        [...(layer.textContent ?? "")].forEach((char, col) => {
          if (char !== " ") out.set(col, delayOf(layer) === 0 ? 0 : -delayOf(layer));
        });
      }
      return out;
    };
    const [left, right] = blocks();
    // Where one block's cell 10 would be, the other block's cell 0 is.
    expect(startsOf(right).get(0)).toBe(phaseOf(80, 0));
    expect(startsOf(left).get(9)).toBe(phaseOf(72, 0));
  });

  it("uses no timers and no state per cell", () => {
    const timers = vi.spyOn(window, "setTimeout");
    const intervals = vi.spyOn(window, "setInterval");
    render(<LoadingBlocks kind="box" rows={3} width={400} />);
    expect(timers).not.toHaveBeenCalled();
    expect(intervals).not.toHaveBeenCalled();
  });
});

describe("building, on first show", () => {
  it("raises each row over 200 ms, bottom row first, and starts blocks 40 ms apart in reading order", () => {
    render(
      <>
        <LoadingBlocks kind="box" rows={3} width={16} order={0} building at={{ x: 0, y: 0 }} />
        <LoadingBlocks kind="box" rows={3} width={16} order={2} building at={{ x: 0, y: 100 }} />
      </>,
    );
    const rows = (block: HTMLElement) => Array.from(layersOf(block)[0].children) as HTMLElement[];
    const [first, second] = blocks();
    expect(rows(first).map((row) => row.style.animationDelay)).toEqual(["120ms", "60ms", "0ms"]);
    expect(rows(second).map((row) => row.style.animationDelay)).toEqual(["200ms", "140ms", "80ms"]);
    expect(rows(first)[0].style.animation).toContain("bgLoadRise 200ms");
  });

  it("does not build when it is not the first show", () => {
    render(<LoadingBlocks kind="box" rows={2} width={16} />);
    expect((layersOf(blocks()[0])[0].children[0] as HTMLElement).style.animation).toBe("");
  });
});

describe("arriving", () => {
  it("fades out over 200 ms in place when the content is ready, with its size unchanged", () => {
    const { rerender } = render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const before = { width: blocks()[0].style.width, height: blocks()[0].style.height };
    rerender(<LoadingBlocks kind="box" rows={3} width={80} gone />);
    const block = blocks()[0];
    expect(block.style.opacity).toBe("0");
    expect(block.style.transition).toContain("opacity 200ms");
    expect({ width: block.style.width, height: block.style.height }).toEqual(before);
  });

  it("is outside the site's one rule against CSS motion, as its own element and what is inside it", () => {
    render(<LoadingBlocks kind="line" width={16} />);
    expect(blocks()[0].hasAttribute("data-loading-blocks")).toBe(true);
  });
});

describe("reduced motion", () => {
  it("is a still dot fill in the same shape: no animation, no wave, no building, an instant swap", () => {
    reducedMotion(true);
    const { rerender } = render(<LoadingBlocks kind="box" rows={3} width={80} building order={3} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    const layers = layersOf(block);
    expect(layers).toHaveLength(1);
    expect(linesOf(layers[0])).toEqual(Array(3).fill(GLYPHS[0].repeat(10)));
    expect(block.innerHTML).not.toContain("animation");
    rerender(<LoadingBlocks kind="box" rows={3} width={80} building order={3} gone />);
    expect(blocks()[0].style.opacity).toBe("1");
    expect(blocks()[0].style.transition).toBe("");
  });
});

describe("what a screen reader meets", () => {
  it("hides every block and says Loading once", () => {
    render(
      <LoadingStatus>
        <LoadingBlocks kind="line" width={80} />
        <LoadingBlocks kind="box" rows={3} width={80} />
      </LoadingStatus>,
    );
    for (const block of blocks()) expect(block.getAttribute("aria-hidden")).toBe("true");
    const status = screen.getByRole("status");
    expect(status.firstElementChild?.textContent).toBe("Loading");
    expect(screen.getAllByText("Loading")).toHaveLength(1);
  });
});
