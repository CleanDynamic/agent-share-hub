// Synth 13 Part B: the sign-in water's numbers, held to the prompt's formulas.

import { describe, expect, it } from "vitest";

import { SPLASH_MS } from "@/lib/theme/motion";

import {
  GLYPHS,
  PUSH,
  REACH,
  SPLASH_AMPLITUDES,
  SPLASH_GAP_S,
  WATER_PITCH,
  glyphOf,
  hollowToneAt,
  pushAt,
  ringShape,
  splashRings,
  splashSwell,
  wakeAmplitude,
} from "./signinWater";

describe("the pointer's hollow", () => {
  it("pushes a dot by 26 · e^(−r² / (2 · (0.55 · 220)²)) within 220px, and not at all beyond", () => {
    expect(pushAt(0)).toBe(PUSH);
    const sigma = 0.55 * REACH;
    expect(pushAt(100)).toBeCloseTo(26 * Math.exp(-(100 * 100) / (2 * sigma * sigma)), 6);
    expect(pushAt(REACH)).toBe(0);
    expect(pushAt(400)).toBe(0);
  });

  it("is dark at the centre and bright along its edge at 165px", () => {
    expect(hollowToneAt(0)).toBeCloseTo(-0.35 + 0.32 * Math.exp(-(165 * 165) / (2 * 40 * 40)), 6);
    expect(hollowToneAt(165)).toBeCloseTo(0.32 - 0.35 * Math.exp(-(165 * 165) / (2 * 88 * 88)), 6);
    expect(hollowToneAt(165)).toBeGreaterThan(0.25);
    expect(hollowToneAt(600)).toBe(0);
  });
});

describe("the wake", () => {
  it("is clamp(speed / 1400, 0.25, 0.9) strong", () => {
    expect(wakeAmplitude(100)).toBe(0.25);
    expect(wakeAmplitude(700)).toBeCloseTo(0.5, 6);
    expect(wakeAmplitude(5000)).toBe(0.9);
  });

  it("spreads with front 210 · age^0.75, envelope 26 + 34 · age, wavelength 34 + 26 · age, fading with e^(−1.4 · age)", () => {
    const shape = ringShape({ x: 0, y: 0, at: 0, amplitude: 0.5, kind: "wake" }, 1)!;
    expect(shape.front).toBeCloseTo(210, 6);
    expect(shape.envelope).toBe(60);
    expect(shape.wavelength).toBe(60);
    expect(shape.strength).toBeCloseTo(0.5 * Math.exp(-1.4), 6);
  });
});

describe("a splash", () => {
  it("sends two rings, 0.35s apart, at 1.4 and 0.9", () => {
    const rings = splashRings(10, 20, 5);
    expect(rings.map((ring) => ring.amplitude)).toEqual([...SPLASH_AMPLITUDES]);
    expect(rings[1].at - rings[0].at).toBeCloseTo(SPLASH_GAP_S, 6);
  });

  it("spreads with front 260 · age^0.75 and fades with e^(−0.9 · age), gone after SPLASH_MS", () => {
    const ring = { x: 0, y: 0, at: 0, amplitude: 1.4, kind: "splash" as const };
    const shape = ringShape(ring, 1)!;
    expect(shape.front).toBeCloseTo(260, 6);
    expect(shape.strength).toBeCloseTo(1.4 * Math.exp(-0.9), 6);
    expect(ringShape(ring, SPLASH_MS / 1000 + 0.01)).toBeNull();
  });

  it("turns the cells under its ring to code, and leaves the water far from it alone", () => {
    const rings = splashRings(0, 0, 0);
    expect(splashSwell(rings, 260, 0, 1)).toBeGreaterThan(0.3);
    expect(splashSwell(rings, 1200, 0, 1)).toBeLessThan(0.01);
  });

  it("draws characters from the code set, the same within a step and changing across steps", () => {
    const a = glyphOf(3, 4, 1.0);
    expect(GLYPHS).toContain(a);
    expect(glyphOf(3, 4, 1.001)).toBe(a);
    const seen = new Set(Array.from({ length: 40 }, (_, step) => glyphOf(3, 4, step * 0.11 + 0.001)));
    expect(seen.size).toBeGreaterThan(3);
  });
});

it("keeps a 6px lattice at every screen size", () => {
  expect(WATER_PITCH).toBe(6);
});
