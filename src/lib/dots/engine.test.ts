// G16: the engine's noise is Reference B's formulas. A second implementation, written here straight from the
// definitions and sharing no code with engine.ts, is compared with the engine's at sixteen fixed points.
import { describe, expect, it } from "vitest";

import { WATER_DROPS, WATER_PHRASE_MS } from "@/lib/theme/motion";

import { bayer, CoarseGrid, DROP_POINTS, dropRings, ease, fbm3, hash2, PERM, PHONE_DROP_POINTS, PHONE_RINGS, pn, RING_LIFE_S, ringsOf, swell, unturn, valueNoise, waveAt } from "./engine";

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

describe("the water", () => {
  it("hashes a lattice point the same way every time, within 0 and 1", () => {
    expect(hash2(12, -7)).toBe(hash2(12, -7));
    expect(hash2(12, -7)).not.toBe(hash2(7, 12));
    for (let i = 0; i < 500; i++) {
      const h = hash2(i, i * 3 - 40);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it("value noise is the hash at a lattice point and stays within 0 and 1 between them", () => {
    expect(valueNoise(3, 5)).toBeCloseTo(hash2(3, 5), 12);
    for (let i = 0; i < 500; i++) {
      const v = valueNoise(i * 0.37, i * 0.91 - 20);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("swells by 0.22 sin(x 0.011 + y 0.007 - 0.8 t) + 0.1 sin(x 0.023 - y 0.017 + 1.3 t)", () => {
    expect(swell(0, 0, 0)).toBe(0);
    expect(swell(100, 50, 2)).toBeCloseTo(0.22 * Math.sin(1.1 + 0.35 - 1.6) + 0.1 * Math.sin(2.3 - 0.85 + 2.6), 12);
  });

  it("has WATER_DROPS drop points inside one phrase, in order", () => {
    expect(DROP_POINTS).toHaveLength(WATER_DROPS);
    expect(DROP_POINTS.map((d) => d[2])).toEqual([0, 1.2, 1.8, 3.0, 3.6, 4.2]);
    for (const [fx, fy, at] of DROP_POINTS) {
      expect(fx).toBeGreaterThan(0);
      expect(fx).toBeLessThan(1);
      expect(fy).toBeGreaterThan(0);
      expect(fy).toBeLessThan(1);
      expect(at).toBeLessThan(WATER_PHRASE_MS / 1000);
    }
  });

  it("sends rings out at 150 age^0.8, widening and lengthening with age", () => {
    const rings = ringsOf(10, 20, 2);
    expect(rings).not.toBeNull();
    expect(rings!.front).toBeCloseTo(150 * 2 ** 0.8, 9);
    expect(rings!.width).toBe(100);
    expect(rings!.wavelength).toBe(78);
    expect(rings!.amplitude).toBeCloseTo((1 - Math.exp(-10)) * Math.exp(-1) * 1.25, 9);
  });

  it("has no rings before a drop falls or after RING_LIFE_S", () => {
    expect(ringsOf(0, 0, -0.01)).toBeNull();
    expect(ringsOf(0, 0, RING_LIFE_S + 0.01)).toBeNull();
    expect(ringsOf(0, 0, RING_LIFE_S)).not.toBeNull();
  });

  it("keeps a drop's rings from the last phrase alive while the next arrive", () => {
    const phrase = WATER_PHRASE_MS / 1000;
    // 0.5s into the second phrase: the first phrase's 4.2s drop is 1.1s old and its rings are still out.
    const alive = dropRings(phrase + 0.5, 400, 300, phrase);
    expect(alive.some((r) => r.x === 0.05 * 400 && r.y === 0.55 * 300)).toBe(true);
  });

  it("calms to nothing far from every ring and is finite near one", () => {
    const rings = [ringsOf(0, 0, 1)!];
    expect(waveAt(rings, 5000, 5000)).toBe(0);
    const near = waveAt(rings, rings[0].front, 0);
    expect(Number.isFinite(near)).toBe(true);
    expect(near).toBeGreaterThan(0);
  });
});

describe("the water on a phone (mobile 28 F)", () => {
  it("drops at the phone's six places, at the desktop's moments in the phrase", () => {
    expect(PHONE_DROP_POINTS.map(([x, y]) => [x, y])).toEqual([
      [0.18, 0.16],
      [0.78, 0.36],
      [0.3, 0.62],
      [0.88, 0.08],
      [0.6, 0.9],
      [0.06, 0.45],
    ]);
    expect(PHONE_DROP_POINTS.map(([, , at]) => at)).toEqual(DROP_POINTS.map(([, , at]) => at));
    const rings = dropRings(0.5, 390, 800, 4.8, true);
    expect(rings[0].x).toBeCloseTo(0.18 * 390);
    expect(rings[0].y).toBeCloseTo(0.16 * 800);
  });

  it("spreads at 120 × age^0.8, width 34 + 26 × age, wavelength 32 + 18 × age, fading over 260", () => {
    const ring = ringsOf(0, 0, 2, RING_LIFE_S, PHONE_RINGS);
    expect(ring?.front).toBeCloseTo(120 * Math.pow(2, 0.8));
    expect(ring?.width).toBe(34 + 26 * 2);
    expect(ring?.wavelength).toBe(32 + 18 * 2);
    expect(ring?.falloff).toBe(260);
    const desk = ringsOf(0, 0, 2);
    expect(desk?.front).toBeCloseTo(150 * Math.pow(2, 0.8));
    expect(desk?.falloff).toBeUndefined();
  });
});
