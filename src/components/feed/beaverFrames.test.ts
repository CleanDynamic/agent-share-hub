// Prompt 29a Part D: the beaver engine with a fake clock: offset and frame index at given times, the logo hidden while running and
// shown at rest, at most two drawImage calls a frame, and the loop stopping at rest.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ARM, HOLD, makeBeaver, pullOffset, type Beaver } from "./beaverFrames";

const FRAME = 16;

let draws: number[];
let ctx: Record<string, unknown>;

function setup(): { beaver: Beaver; img: HTMLImageElement; offsets: number[]; frames: number[]; rested: () => number } {
  draws = [];
  let tickDraws = 0;
  ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(() => {
      draws.push(tickDraws);
      tickDraws = 0;
    }),
    drawImage: vi.fn(() => {
      tickDraws += 1;
    }),
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    imageSmoothingQuality: "low",
  };
  const cv = document.createElement("canvas");
  vi.spyOn(cv, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const img = document.createElement("img");
  Object.defineProperty(img, "naturalWidth", { value: 192 });
  Object.defineProperty(img, "naturalHeight", { value: 125 });
  const atlas = document.createElement("img");
  const offsets: number[] = [];
  const frames: number[] = [];
  let rests = 0;
  const beaver = makeBeaver(cv, img, atlas, { cx: 195, cy: 30, w: 46, barBottom: 52, width: 390, height: 320 }, {
    offset: (px) => offsets.push(px),
    frame: (index) => frames.push(index),
    rest: () => {
      rests += 1;
    },
  });
  return { beaver, img, offsets, frames, rested: () => rests };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout", "Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("beaverFrames", () => {
  it("follows the formula while pulling: offset = 125 × (1 − e^(−drag / 170)), frames 1 to 4 with the finger", () => {
    const { beaver, offsets, frames } = setup();
    beaver.pull(170);
    vi.advanceTimersByTime(FRAME);
    expect(offsets.at(-1)).toBeCloseTo(125 * (1 - Math.exp(-1)), 5);
    expect(pullOffset(170)).toBeCloseTo(79.02, 1);
    beaver.pull(1000);
    vi.advanceTimersByTime(FRAME);
    expect(offsets.at(-1)).toBeGreaterThan(ARM);
    expect(frames.at(-1)).toBeCloseTo(3, 5);
    expect(beaver.busy()).toBe(false);
  });

  it("hides the logo while running and shows it at rest; the loop stops at rest", () => {
    const { beaver, img, rested } = setup();
    beaver.pull(400);
    vi.advanceTimersByTime(FRAME);
    expect(img.style.opacity).toBe("0");
    expect(beaver.release()).toBe(true);
    beaver.done();
    vi.advanceTimersByTime(3000);
    expect(beaver.state().mode).toBe("idle");
    expect(img.style.opacity).toBe("1");
    expect(rested()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns over 200ms when released before 80", () => {
    const { beaver, offsets } = setup();
    beaver.pull(100);
    vi.advanceTimersByTime(FRAME);
    expect(offsets.at(-1)).toBeLessThan(ARM);
    expect(beaver.release()).toBe(false);
    expect(beaver.busy()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(beaver.state().mode).toBe("back");
    vi.advanceTimersByTime(140);
    expect(beaver.state().mode).toBe("idle");
    expect(offsets.at(-1)).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dives to 112, loops under at least 350ms after done, then rises with the feed closing in step", () => {
    const { beaver, offsets, frames } = setup();
    beaver.pull(400);
    vi.advanceTimersByTime(FRAME);
    beaver.release();
    vi.advanceTimersByTime(220);
    expect(offsets.at(-1)).toBeCloseTo(HOLD, 0);
    vi.advanceTimersByTime(200);
    // The dunk has ended at frame 9 (index 8) and the loop has started.
    expect(beaver.state().mode).toBe("under");
    expect(frames.at(-1)).toBeGreaterThanOrEqual(8);
    expect(frames.at(-1)).toBeLessThanOrEqual(10);
    beaver.done();
    // Under at least 350ms, and only from the loop's upper half.
    let under = 0;
    while (beaver.state().mode === "under" && under < 2000) {
      vi.advanceTimersByTime(FRAME);
      under += FRAME;
    }
    // done came about 40ms into the loop, so the rest of the 350ms is at least 300 more.
    expect(under).toBeGreaterThanOrEqual(300);
    expect(beaver.state().mode).toBe("rise");
    expect(beaver.state().frame).toBeGreaterThan(9.6);
    vi.advanceTimersByTime(320);
    // Halfway up the feed is halfway closed: one curve for both.
    expect(offsets.at(-1)!).toBeLessThan(HOLD * 0.6);
    expect(offsets.at(-1)!).toBeGreaterThan(HOLD * 0.4);
    vi.advanceTimersByTime(400);
    expect(beaver.state().mode).toBe("idle");
    expect(Math.max(...frames)).toBeCloseTo(15, 0);
    expect(offsets.at(-1)).toBe(0);
  });

  it("keeps looping under until done is called", () => {
    const { beaver } = setup();
    beaver.pull(400);
    vi.advanceTimersByTime(FRAME);
    beaver.release();
    vi.advanceTimersByTime(4000);
    expect(beaver.state().mode).toBe("under");
    beaver.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("draws at most two frames a tick, blended with lighter", () => {
    const { beaver } = setup();
    beaver.pull(400);
    vi.advanceTimersByTime(FRAME);
    beaver.release();
    beaver.done();
    vi.advanceTimersByTime(2500);
    expect(draws.length).toBeGreaterThan(10);
    expect(Math.max(...draws)).toBeLessThanOrEqual(2);
    expect(ctx.globalCompositeOperation).toBe("source-over");
  });
});
