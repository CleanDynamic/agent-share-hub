// Prompt 6 G7: a list tile's held copy keeps to the column it was picked up from; it moves up and down only.

import { describe, expect, it } from "vitest";

import { keepToStartOf } from "./listNest";

const rect = (left: number, top: number) => ({ left, top, width: 648, height: 128, right: left + 648, bottom: top + 128 }) as never;
const args = (transform: { x: number; y: number }, active: { left: number; top: number }) =>
  ({ transform: { ...transform, scaleX: 1, scaleY: 1 }, activeNodeRect: rect(active.left, active.top) }) as unknown as Parameters<ReturnType<typeof keepToStartOf>>[0];

describe("G7: the held copy keeps to its column", () => {
  it("drops the pointer's sideways travel for a list tile: the copy's left stays where it was picked up", () => {
    const modifier = keepToStartOf({ left: 344, top: 540, column: true }, null);
    const out = modifier(args({ x: 57, y: 120 }, { left: 344, top: 540 }));
    expect(344 + out.x).toBe(344);
    expect(540 + out.y).toBe(660);
  });

  it("stays on the column while the tile's own place slides, and lands on a whole pixel", () => {
    // dnd-kit draws the overlay at the rect the tile had at pick-up (`initial`) plus the modifier's x.
    const modifier = keepToStartOf({ left: 380.4, top: 540, column: true }, null);
    const out = modifier(args({ x: -30, y: 10 }, { left: 384.4, top: 500 }));
    expect(380.4 + out.x).toBeCloseTo(380, 9);
    expect(500 + out.y).toBe(550);
  });

  it("still follows the pointer both ways for what is not a list tile (a session, a part, a row from Sources)", () => {
    const modifier = keepToStartOf({ left: 344, top: 540 }, null);
    const out = modifier(args({ x: 57, y: 120 }, { left: 344, top: 540 }));
    expect(out.x).toBe(57);
  });
});
