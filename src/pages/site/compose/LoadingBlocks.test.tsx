// CA-24 P1 - the component: the cell, the layers, the delays from page position, building, arriving, reduced motion, and what
// a screen reader meets.

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { LoadingBlocks, LoadingStatus } from "./LoadingBlocks";
import { resetFirstShow, waveDelay } from "./loadingBlocks";

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
const cellsOf = (block: HTMLElement) => Array.from(block.querySelectorAll<HTMLElement>(":scope > div > span"));

describe("the cell", () => {
  it("fills a box with 8 by 12 cells of the data face at 11, in the disabled text colour", () => {
    render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    const cells = cellsOf(block);
    expect(cells).toHaveLength(30);
    const cell = cells[0];
    expect(cell.style.width).toBe("8px");
    expect(cell.style.height).toBe("12px");
    expect(cell.style.fontSize).toBe("11px");
    // jsdom drops a var() colour from the DOM, so the colour is read from the markup.
    expect(renderToStaticMarkup(<LoadingBlocks kind="line" width={8} />)).toContain("color:var(--text-disabled)");
    expect(cell.getAttribute("style")).toContain("--font-data");
  });

  it("draws the four characters stacked, each changing opacity only, step-end over 1,600 ms", () => {
    render(<LoadingBlocks kind="line" width={8} />);
    const layers = Array.from(cellsOf(blocks()[0])[0].children) as HTMLElement[];
    expect(layers.map((layer) => layer.textContent)).toEqual(["\u00B7", "\u25AB", "\u25AA", "\u25A0"]);
    expect(layers.map((layer) => layer.style.animation.split(" ")[0])).toEqual(["bgLoadDot", "bgLoadOpen", "bgLoadSmall", "bgLoadFull"]);
    for (const layer of layers) {
      expect(layer.style.animation).toContain("1600ms");
      expect(layer.style.animation).toContain("step-end");
      expect(layer.style.animation).toContain("infinite");
      expect(layer.style.transform).toBe("");
    }
  });

  it("makes a line one row whatever rows says", () => {
    render(<LoadingBlocks kind="line" rows={4} width={40} />);
    expect(blocks()[0].getAttribute("data-rows")).toBe("1");
    expect(blocks()[0].style.height).toBe("12px");
  });
});

describe("the wave comes from the page, not the block", () => {
  it("gives each cell the delay of its place on the page, as an inline variable", () => {
    render(<LoadingBlocks kind="box" rows={2} width={24} at={{ x: 100, y: 48 }} />);
    const cells = cellsOf(blocks()[0]);
    expect(cells[0].style.getPropertyValue("--bd")).toBe(`${waveDelay(100, 48)}ms`);
    expect(cells[1].style.getPropertyValue("--bd")).toBe(`${waveDelay(108, 48)}ms`);
    expect(cells[3].style.getPropertyValue("--bd")).toBe(`${waveDelay(100, 60)}ms`);
  });

  it("continues one wave across two blocks side by side", () => {
    render(
      <>
        <LoadingBlocks kind="line" width={80} at={{ x: 0, y: 0 }} />
        <LoadingBlocks kind="line" width={80} at={{ x: 80, y: 0 }} />
      </>,
    );
    const [left, right] = blocks();
    const last = cellsOf(left).at(-1) as HTMLElement;
    const first = cellsOf(right)[0];
    // The right block's first cell is the next cell along the same row.
    expect(Number.parseFloat(first.style.getPropertyValue("--bd"))).toBe(Number.parseFloat(last.style.getPropertyValue("--bd")) - 22);
  });

  it("uses no timers and no state per cell: the cells are plain spans", () => {
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
        <LoadingBlocks kind="box" rows={3} width={16} order={0} building />
        <LoadingBlocks kind="box" rows={3} width={16} order={2} building />
      </>,
    );
    const rows = (block: HTMLElement) => Array.from(block.children) as HTMLElement[];
    const [first, second] = blocks();
    expect(rows(first).map((row) => row.style.animationDelay)).toEqual(["120ms", "60ms", "0ms"]);
    expect(rows(second).map((row) => row.style.animationDelay)).toEqual(["200ms", "140ms", "80ms"]);
    expect(rows(first)[0].style.animation).toContain("bgLoadRise 200ms");
  });

  it("does not build when it is not the first show", () => {
    render(<LoadingBlocks kind="box" rows={2} width={16} />);
    expect((blocks()[0].children[0] as HTMLElement).style.animation).toBe("");
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
});

describe("reduced motion", () => {
  it("is a still · fill in the same shape: no animation, no wave, no building, an instant swap", () => {
    reducedMotion(true);
    const { rerender } = render(<LoadingBlocks kind="box" rows={3} width={80} building order={3} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    const cells = cellsOf(block);
    expect(cells).toHaveLength(30);
    for (const cell of cells) {
      expect(cell.textContent).toBe("\u00B7");
      expect(cell.style.getPropertyValue("--bd")).toBe("");
    }
    expect(block.innerHTML).not.toContain("animation");
    expect((block.children[0] as HTMLElement).style.animation).toBe("");
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
