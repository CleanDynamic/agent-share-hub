import { describe, expect, it } from "vitest";

import { dotsOf, PITCH } from "./fluid";

describe("the lattice", () => {
  it("is square at 4px", () => {
    expect(PITCH).toBe(4);
    const box = { x: 0, y: 0, width: 60, height: 60, radius: 8 };
    const dots = dotsOf(box, 0, 0);
    expect(dots.x.length).toBeGreaterThan(100);
    for (let i = 0; i < dots.x.length; i++) {
      expect(Math.abs(dots.x[i] % PITCH)).toBe(0);
      expect(Math.abs(dots.y[i] % PITCH)).toBe(0);
    }
  });

  it("keeps a dot only on or within two pixels of the shape", () => {
    const dots = dotsOf({ x: 0, y: 0, width: 80, height: 40, radius: 8 }, 0, 0);
    for (const sd of dots.sd) expect(sd).toBeLessThanOrEqual(2);
  });

  it("follows the page's lattice, not the region's", () => {
    const dots = dotsOf({ x: 0, y: 0, width: 60, height: 60, radius: 0 }, 2, 0);
    for (const x of dots.x) expect(Math.abs((x + 2) % PITCH)).toBe(0);
  });
});
