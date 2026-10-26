// SV-05 P4: loading blocks fill the whole socket, the first load's tile boxes are a tile's height, and an import's numbers
// stand inside their sockets.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { skeletonOf, SOCKET_NUMBER_IN } from "@/lib/build/sortLayout";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { ComposeSkeleton } from "./ComposeSkeleton";
import { SOCKET_INSET, SOCKET_NUMBER_ROOM } from "./ImportingPieces";
import { LoadingBlocks } from "./LoadingBlocks";
import { CELL_H, CELL_W, GLYPHS, fillOf, resetFirstShow, TILE_HEIGHT } from "./loadingBlocks";

function reducedMotion(on: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: on && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  __resetMotionMediaCache();
  resetFirstShow();
});

/** A parent of this size, as `LoadingBlocks` reads it. */
function sized(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("data-box") ? width : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("data-box") ? height : 0;
  });
}

describe("SV-05 P4 · the blocks fill the socket", () => {
  it.each([56, 64, 72])("cover a socket %i tall to within one cell on every side", (tall) => {
    const width = 600 - SOCKET_INSET - SOCKET_NUMBER_ROOM;
    const height = tall - 2 * SOCKET_INSET;
    const { cols, rows, left, top } = fillOf(width, height);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left).toBeLessThan(CELL_W);
    expect(width - (left + cols * CELL_W)).toBeLessThan(CELL_W);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(CELL_H);
    expect(height - (top + rows * CELL_H)).toBeLessThan(CELL_H);
  });

  it("draws as many rows and columns as fit its parent", () => {
    reducedMotion(false);
    sized(580, 44);
    render(
      <div data-box="1">
        <LoadingBlocks kind="box" width="fill" height="fill" />
      </div>,
    );
    const block = screen.getByTestId("loading-blocks");
    expect(block.getAttribute("data-rows")).toBe(String(Math.floor(44 / CELL_H)));
    expect(block.getAttribute("data-cols")).toBe(String(Math.floor(580 / CELL_W)));
    expect(block.style.height).toBe("100%");
  });

  it("shows a still fill under reduced motion", () => {
    reducedMotion(true);
    sized(80, 36);
    render(
      <div data-box="1">
        <LoadingBlocks kind="box" width="fill" height="fill" />
      </div>,
    );
    const block = screen.getByTestId("loading-blocks");
    expect(block.getAttribute("data-layers")).toBe("1");
    expect(block.textContent).toBe(GLYPHS[0].repeat(10 * 3));
    expect(block.innerHTML).not.toMatch(/animation/);
  });
});

describe("SV-05 P4 · the first load", () => {
  it("draws each tile box as tall as a tile, the height the List holds a socket at", () => {
    reducedMotion(false);
    render(<ComposeSkeleton />);
    const boxes = screen.getAllByTestId("loading-blocks").filter((block) => block.getAttribute("data-rows") === String(TILE_HEIGHT / CELL_H));
    expect(boxes).toHaveLength(5);
    for (const box of boxes) expect((box as HTMLElement).style.height).toBe(`${TILE_HEIGHT}px`);
  });
});

describe("SV-05 P4 · an import's numbers", () => {
  it("stand inside their sockets, 10 from the left edge, centred, with no rail outside the frame", () => {
    const items = [0, 1, 2].map((at) => ({ id: `s:wait:${at}`, container: "s", rect: { x: 40, y: 20 + at * 120, w: 500, h: 108 }, radius: 10 }));
    const skeleton = skeletonOf({ kind: "tile", items, containers: [{ id: "s", rect: { x: 30, y: 0, w: 520, h: 400 }, items: items.map((item) => item.id), framed: true, name: "Session 4" }], held: null, moved: false, room: 0, inside: true });
    const [rail] = skeleton.rails;
    expect(rail.inside).toBe(true);
    rail.ticks.forEach((tick, at) => {
      const socket = skeleton.sockets.find((entry) => entry.id === tick.id)!;
      expect(tick.numberLeft).toBe(socket.rect.x + SOCKET_NUMBER_IN);
      expect(tick.numberLeft!).toBeGreaterThan(socket.rect.x);
      // The blocks start past the number (two figures of the 11px data face, then 8).
      expect(SOCKET_NUMBER_IN + 14 + 8).toBeLessThanOrEqual(SOCKET_NUMBER_ROOM);
      expect(tick.y).toBe(items[at].rect.y + items[at].rect.h / 2);
    });
  });
});
