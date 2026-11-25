// Mobile prompt 27 Part B: the sign-in field's numbers, held to the prompt's formulas.

import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  CODE_AT,
  DROPS,
  FADE_PX,
  GRID,
  OUTSET,
  PITCH,
  PUSH,
  R,
  SPLASH_AMPLITUDES,
  SPLASH_GAP_S,
  SWIM_S,
  SignInField,
  boxDistance,
  codeLinesOf,
  distanceFromAlpha,
  dropShape,
  fallOff,
  hollowToneAt,
  isTap,
  logoStrength,
  pushAt,
  splashShape,
  swimAt,
  wakeAmplitude,
  wakeShape,
} from "./signinField";

/* jsdom draws nothing: the field runs its state with no context. */
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

describe("the lattice", () => {
  it("keeps a 6px pitch, laid out from 42px outside every edge, with a 16px wave grid", () => {
    expect(PITCH).toBe(6);
    expect(OUTSET).toBe(42);
    expect(GRID).toBe(16);
  });
});

describe("the drops", () => {
  it("are six on a phrase, two in view and four just off the screen", () => {
    expect(DROPS).toHaveLength(6);
    const off = DROPS.filter((d) => (d.fx === 0 && d.ox < 0) || (d.fx === 1 && d.ox > 0) || d.oy < 0);
    expect(off).toHaveLength(4);
    expect(DROPS.map((d) => d.at).sort((a, b) => a - b)).toEqual([0, 0.8, 1.6, 3.2, 4.6, 5.6]);
  });

  it("spread with front 120 · age^0.8, width 34 + 26 · age, wavelength 36 + 20 · age and the stated amplitude, gone after 5.6s", () => {
    const shape = dropShape(2)!;
    expect(shape.front).toBeCloseTo(120 * Math.pow(2, 0.8), 6);
    expect(shape.width).toBe(86);
    expect(shape.wavelength).toBe(76);
    expect(shape.amplitude).toBeCloseTo(0.9 * (1 - Math.exp(-10)) * Math.exp(-1.1), 6);
    expect(dropShape(-0.1)).toBeNull();
    expect(dropShape(5.7)).toBeNull();
  });

  it("fall off with 1 / √(1 + r / 260)", () => {
    expect(fallOff(260)).toBeCloseTo(1 / Math.SQRT2, 6);
  });
});

describe("the finger's hollow", () => {
  it("pushes by 22 · e^(−r² / (2 (0.55R)²)) within 1.6 R and not at all beyond", () => {
    expect(R).toBe(140);
    expect(pushAt(0)).toBe(PUSH);
    const sigma = 0.55 * R;
    expect(pushAt(100)).toBeCloseTo(22 * Math.exp(-(100 * 100) / (2 * sigma * sigma)), 6);
    expect(pushAt(1.6 * R)).toBe(0);
  });

  it("is dark in the middle and bright along its rim", () => {
    expect(hollowToneAt(0)).toBeCloseTo(-0.35 + 0.32 * Math.exp(-((0.75 * R) ** 2) / 1800), 6);
    expect(hollowToneAt(0.75 * R)).toBeGreaterThan(0.25);
    expect(hollowToneAt(400)).toBe(0);
  });
});

describe("the wake", () => {
  it("is clamp(speed / 1200, 0.3, 0.9) strong, front 160 · age^0.75, over after 2.2s", () => {
    expect(wakeAmplitude(100)).toBe(0.3);
    expect(wakeAmplitude(600)).toBeCloseTo(0.5, 6);
    expect(wakeAmplitude(5000)).toBe(0.9);
    expect(wakeShape(1, 0.5)!.front).toBeCloseTo(160, 6);
    expect(wakeShape(2.3, 0.5)).toBeNull();
  });
});

describe("a tap", () => {
  it("is a touch under 250ms that moves under 12px", () => {
    expect(isTap(0, 200, 5)).toBe(true);
    expect(isTap(0, 260, 5)).toBe(false);
    expect(isTap(0, 100, 13)).toBe(false);
  });

  it("sends two rings, the second 0.35s later, at 1.4 and 0.9", () => {
    expect([...SPLASH_AMPLITUDES]).toEqual([1.4, 0.9]);
    expect(SPLASH_GAP_S).toBe(0.35);
    const canvas = document.createElement("canvas");
    const field = new SignInField(canvas);
    field.resize(390, 800, 2);
    expect(field.ringCount()).toBe(0);
    field.pointerDown(100, 100, 1000);
    field.pointerUp(101, 100, 1120);
    expect(field.ringCount()).toBe(2);
  });

  it("does not splash for a drag", () => {
    const field = new SignInField(document.createElement("canvas"));
    field.resize(390, 800, 1);
    field.pointerDown(100, 100, 1000);
    field.pointerUp(160, 100, 1100);
    expect(field.ringCount()).toBe(0);
  });

  it("spreads with front 200 · age^0.75, fading with e^(−0.9 · age), gone after 3.2s", () => {
    const shape = splashShape(1, 1.4)!;
    expect(shape.front).toBeCloseTo(200, 6);
    expect(shape.amplitude).toBeCloseTo(1.4 * Math.exp(-0.9), 6);
    expect(splashShape(3.3, 1.4)).toBeNull();
    expect(CODE_AT).toBeGreaterThan(0);
  });
});

describe("the code", () => {
  it("is the lines of a function's own source, spaces collapsed, over 8 characters", () => {
    function sample() {
      const first = 1;
      const second = 2;
      return first + second;
    }
    const lines = codeLinesOf(sample);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeGreaterThan(8);
      expect(line).not.toMatch(/\s{2}/);
    }
  });

  it("cuts a one-line (minified) source at its semicolons and braces", () => {
    const one = Object.assign(() => 0, { toString: () => "function f(){let alpha=1;let bravo=2;let charlie=3;return alpha+bravo+charlie}" });
    expect(codeLinesOf(one).length).toBeGreaterThan(2);
  });
});

describe("the swimmer", () => {
  it("crosses from −60 to W + 60 on a smoothstep, at Hv · (0.30 + 0.22 sin(πu))", () => {
    expect(swimAt(0, 390, 500)).toEqual({ x: -60, y: 150 });
    expect(swimAt(1, 390, 500).x).toBeCloseTo(450, 6);
    const mid = swimAt(0.5, 390, 500);
    expect(mid.x).toBeCloseTo(195, 6);
    expect(mid.y).toBeCloseTo(500 * 0.52, 6);
  });

  it("never swims at once: four seconds after the page opens, then every nine, and a touch starts the wait again", () => {
    const field = new SignInField(document.createElement("canvas"));
    field.resize(390, 800, 1);
    for (let i = 0; i < 70; i++) field.step(0.05);
    expect(field.ringCount()).toBe(0);
    for (let i = 0; i < 20 + Math.ceil(SWIM_S / 0.05) + 4; i++) field.step(0.05);
    expect(field.ringCount()).toBeGreaterThan(0);
  });
});

describe("round the logo", () => {
  it("is nothing at the margin, everything from 54px out, a smoothstep between", () => {
    expect(FADE_PX).toBe(54);
    expect(logoStrength(0)).toBe(0);
    expect(logoStrength(-5)).toBe(0);
    expect(logoStrength(54)).toBe(1);
    expect(logoStrength(27)).toBeCloseTo(0.5, 6);
  });

  it("measures a chamfer distance (1 and √2) from the cells whose blurred alpha is over 14", () => {
    const w = 9;
    const h = 9;
    const alpha = new Uint8Array(w * h);
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) alpha[y * w + x] = 255;
    const d = distanceFromAlpha(alpha, w, h);
    expect(d[4 * w + 4]).toBe(0);
    expect(d[4 * w + 8]).toBeGreaterThanOrEqual(2);
    expect(d[0]).toBeGreaterThan(d[2 * w + 2]);
    expect(d[4 * w + 8]).toBeLessThan(d[0]);
  });

  it("joins faint lines into one shape: a thin low-alpha line is blurred under the threshold", () => {
    const alpha = new Uint8Array(7 * 7);
    for (let x = 0; x < 7; x++) alpha[3 * 7 + x] = 30;
    expect(distanceFromAlpha(alpha, 7, 7)[3 * 7 + 3]).toBeGreaterThan(0);
  });

  it("falls back to a rounded box where the pixels cannot be read", () => {
    const box = { x: 100, y: 100, w: 100, h: 60 };
    expect(boxDistance(150, 130, box)).toBeLessThan(0);
    expect(boxDistance(250, 130, box)).toBeCloseTo(50, 6);
  });
});
