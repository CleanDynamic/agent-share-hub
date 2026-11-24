// CA-24 P1 - the component: the cell, the field it is drawn in (Part E), arriving, reduced motion, and what a screen reader
// meets.

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { LoadingRegion } from "@/components/brand/Skeleton";

import { LoadingBlocks, LoadingStatus } from "./LoadingBlocks";
import { resetFirstShow } from "./loadingBlocks";

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

describe("the cell", () => {
  it("keeps a box of 8 by 12 cells: 10 across and 3 down in 80 by 36, as a shape in the dot field (Synth 06)", () => {
    render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    expect(block.getAttribute("data-cols")).toBe("10");
    expect(block.getAttribute("data-rows")).toBe("3");
    expect(block.getAttribute("aria-hidden")).toBe("true");
  });

  it("draws no characters: the field paints the dots, so there is no text to read or to select", () => {
    const html = renderToStaticMarkup(<LoadingBlocks kind="line" width={8} />);
    expect(html).not.toContain("var(--font-data");
    expect(screen.queryAllByTestId("loading-blocks").every((block) => (block.textContent ?? "") === "")).toBe(true);
    expect(html).toContain("user-select:none");
  });

  it("makes a line one row whatever rows says", () => {
    render(<LoadingBlocks kind="line" rows={4} width={40} />);
    expect(blocks()[0].getAttribute("data-rows")).toBe("1");
    expect(blocks()[0].style.height).toBe("12px");
  });
});

/* Part E (Reference E): a block is a shape in a living dot field. Its box is the box it always had; it paints nothing in
   the DOM (no characters, no layers, nothing animated), and its shape is drawn on a canvas: the nearest LoadingRegion's,
   or, with none around it, its own. These replace the glyph layers', the wave's and the opacity fade's tests. */
describe("the field", () => {
  it("keeps its box and paints nothing itself: no characters, no layers, nothing animated", () => {
    render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const block = blocks()[0];
    expect([block.style.width, block.style.height]).toEqual(["80px", "36px"]);
    expect(block.textContent).toBe("");
    expect(block.querySelectorAll("span")).toHaveLength(0);
    expect(block.innerHTML).not.toContain("animation");
  });

  it("is its own region's shape when nothing holds it, and a shape in the LoadingRegion around it when one does", () => {
    render(<LoadingBlocks kind="line" width={80} />);
    expect(blocks()[0].querySelectorAll("canvas[data-fluid]")).toHaveLength(1);
    cleanup();
    render(
      <LoadingRegion what="the composer">
        <LoadingBlocks kind="line" width={80} />
        <LoadingBlocks kind="box" rows={3} width={80} />
      </LoadingRegion>,
    );
    for (const block of blocks()) expect(block.querySelector("canvas")).toBeNull();
    expect(document.querySelectorAll("canvas[data-fluid]")).toHaveLength(1);
  });

  it("takes every prop it took, and order, building and at change nothing in its box", () => {
    render(<LoadingBlocks kind="box" rows={3} width={80} order={4} building at={{ x: 10, y: 20 }} />);
    const block = blocks()[0];
    expect([block.style.width, block.style.height, block.getAttribute("data-rows"), block.getAttribute("data-cols")]).toEqual(["80px", "36px", "3", "10"]);
  });
});

describe("arriving", () => {
  it("is gone when the content is ready, in place, with its size unchanged", () => {
    const { rerender } = render(<LoadingBlocks kind="box" rows={3} width={80} />);
    const before = { width: blocks()[0].style.width, height: blocks()[0].style.height };
    expect(blocks()[0].hasAttribute("data-gone")).toBe(false);
    rerender(<LoadingBlocks kind="box" rows={3} width={80} gone />);
    const block = blocks()[0];
    expect(block.hasAttribute("data-gone")).toBe(true);
    expect({ width: block.style.width, height: block.style.height }).toEqual(before);
  });

  it("is outside the site's one rule against CSS motion, as its own element and what is inside it", () => {
    render(<LoadingBlocks kind="line" width={16} />);
    expect(blocks()[0].hasAttribute("data-loading-blocks")).toBe(true);
  });
});

describe("reduced motion", () => {
  it("is one still frame in the same shape: nothing animated, and nothing in the DOM moves when it goes", () => {
    reducedMotion(true);
    const { rerender } = render(<LoadingBlocks kind="box" rows={3} width={80} building order={3} />);
    const block = blocks()[0];
    expect(block.style.width).toBe("80px");
    expect(block.style.height).toBe("36px");
    expect(block.innerHTML).not.toContain("animation");
    rerender(<LoadingBlocks kind="box" rows={3} width={80} building order={3} gone />);
    expect(blocks()[0].style.opacity).toBe("");
    expect(blocks()[0].style.transition).toBe("");
  });
});

describe("what a screen reader meets", () => {
  it("hides every block and says what is loading once (G20: never a bare Loading)", () => {
    render(
      <LoadingStatus>
        <LoadingBlocks kind="line" width={80} />
        <LoadingBlocks kind="box" rows={3} width={80} />
      </LoadingStatus>,
    );
    for (const block of blocks()) expect(block.getAttribute("aria-hidden")).toBe("true");
    const status = screen.getByRole("status");
    expect(status.firstElementChild?.textContent).toBe("Loading the build");
    expect(screen.getAllByText("Loading the build")).toHaveLength(1);
    expect(screen.queryByText("Loading")).toBeNull();
  });
});
