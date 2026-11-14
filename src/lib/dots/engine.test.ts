// G16: the engine's noise is Reference B's formulas. A second implementation, written here straight from the
// definitions and sharing no code with engine.ts, is compared with the engine's at sixteen fixed points.
import { describe, expect, it } from "vitest";

import { bayer, CoarseGrid, ease, fbm3, PERM, pn, unturn } from "./engine";

/* ── the reference, from the definitions ── */

function referencePerm(): number[] {
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i >= 1; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return [...p, ...p];
}
const P = referencePerm();

function referencePn(x: number, y: number): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const gradient = (ix: number, iy: number) => {
    const k = P[P[ix & 255] + (iy & 255)] & 15;
    const a = (k + 0.5) * 22.5 * (Math.PI / 180);
    return [Math.cos(a), Math.sin(a)];
  };
  const dot = (ix: number, iy: number) => {
    const [gx, gy] = gradient(ix, iy);
    return gx * (x - ix) + gy * (y - iy);
  };
  const q = (t: number) => Math.pow(t, 3) * (t * (6 * t - 15) + 10);
  const u = q(x - X);
  const v = q(y - Y);
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const n = lerp(lerp(dot(X, Y), dot(X + 1, Y), u), lerp(dot(X, Y + 1), dot(X + 1, Y + 1), u), v);
  return 0.5 + 0.7 * n;
}

const referenceFbm3 = (x: number, y: number) =>
  0.6 * referencePn(x, y) + 0.28 * referencePn(2.03 * x + 17.1, 2.03 * y - 9.3) + 0.12 * referencePn(4.07 * x - 31.4, 4.07 * y + 5.7);

const POINTS: [number, number][] = [
  [0, 0], [0.5, 0.5], [1, 1], [0.25, 0.75], [3.1, -1.7], [-6.3, 2.9], [11.7, -4.2], [12.345, 67.891],
  [-0.001, 0.999], [255.5, 255.5], [256.25, -256.75], [1000.1, 2000.2], [-31.4, 5.7], [17.1, -9.3], [0.7, 0.3], [-3.333, -7.777],
];

describe("the noise is Reference B's", () => {
  it("shuffles the table from seed 1337 and duplicates it to 512", () => {
    expect(Array.from(PERM)).toEqual(P);
    expect(new Set(Array.from(PERM.slice(0, 256))).size).toBe(256);
  });

  it.each(POINTS)("pn(%f, %f) matches the reference", (x, y) => {
    expect(pn(x, y)).toBeCloseTo(referencePn(x, y), 12);
  });

  it.each(POINTS)("fbm3(%f, %f) matches the reference", (x, y) => {
    expect(fbm3(x, y)).toBeCloseTo(referenceFbm3(x, y), 12);
  });

  it("is 0.5 at every lattice point, where each corner's offset is zero", () => {
    for (const [x, y] of [[0, 0], [3, -2], [100, 7]]) expect(pn(x, y)).toBeCloseTo(0.5, 12);
  });

  it("stays within 0.5 ± 0.7·√2/2", () => {
    for (let i = 0; i < 2000; i++) {
      const v = pn(i * 0.137 - 50, i * 0.291 + 13);
      expect(Math.abs(v - 0.5)).toBeLessThanOrEqual(0.7 * Math.SQRT1_2 + 1e-9);
    }
  });
});

describe("the helpers", () => {
  it("Bayer thresholds are (B + 0.5) / 16 over the 4 by 4 matrix", () => {
    expect(bayer(0, 0)).toBe(0.5 / 16);
    expect(bayer(1, 0)).toBe(8.5 / 16);
    expect(bayer(3, 3)).toBe(5.5 / 16);
    expect(bayer(4, 4)).toBe(bayer(0, 0));
  });

  it("eases exponentially: x + (target − x)(1 − e^(−r·dt))", () => {
    expect(ease(0, 1, 3, 0.1)).toBeCloseTo(1 - Math.exp(-0.3), 12);
  });

  it("turns the pattern clockwise on screen by sampling the other way", () => {
    // A point to the right of centre, after a quarter turn of the pattern, samples what was straight above it.
    const [x, y] = unturn(1, 0, Math.PI / 2);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(-1, 12);
  });

  it("blends the four nearest grid nodes", () => {
    const grid = new CoarseGrid(1);
    grid.resize(0, 0, 100, 100);
    grid.fill((x, y, out) => (out[0] = x + 2 * y));
    const at = new Float64Array(3);
    grid.locate(30, 50, at);
    expect(grid.sample(0, at)).toBeCloseTo(30 + 100, 9);
  });
});
