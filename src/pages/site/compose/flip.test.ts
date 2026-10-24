// CA-22 P4 - a thing that grew opens down by clip-path over BASE, and what stood below it slides; nothing is stretched.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BASE } from "@/lib/theme/motion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { grow, play, SLIDE_ATTR, type Box } from "./flip";

const played: { element: Element; keyframes: Keyframe[]; options: KeyframeAnimationOptions }[] = [];

beforeEach(() => {
  played.length = 0;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    played.push({ element: this, keyframes, options });
    return { id: options.id ?? "", finished: Promise.resolve(), finish: () => undefined, cancel: () => undefined } as unknown as Animation;
  }) as never;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe("grow", () => {
  it("reveals the new part from the top down over BASE, with clip-path only", () => {
    const element = document.createElement("div");
    grow(element, 40);
    expect(played[0].keyframes).toEqual([{ clipPath: "inset(0 0 40px 0)" }, { clipPath: "inset(0 0 0 0)" }]);
    expect(played[0].options.duration).toBe(BASE);
  });

  it("play() grows what got taller and slides what moved", () => {
    const root = document.createElement("div");
    const tall = document.createElement("div");
    tall.setAttribute(SLIDE_ATTR, "tile:a");
    const below = document.createElement("div");
    below.setAttribute(SLIDE_ATTR, "tile:b");
    root.append(tall, below);
    const now = new Map([
      [tall, { left: 0, top: 0, width: 100, height: 140 }],
      [below, { left: 0, top: 150, width: 100, height: 50 }],
    ]);
    for (const [element, box] of now) element.getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => ({}) });
    const before = new Map<string, Box>([
      ["tile:a", { x: 0, y: 0, w: 100, h: 100 }],
      ["tile:b", { x: 0, y: 110, w: 100, h: 50 }],
    ]);
    play(root, before);
    const clip = played.filter((entry) => entry.keyframes.some((frame) => frame.clipPath));
    expect(clip.map((entry) => entry.element)).toEqual([tall]);
    expect(clip[0].keyframes[0].clipPath).toBe("inset(0 0 40px 0)");
    const slid = played.filter((entry) => entry.keyframes.some((frame) => frame.transform));
    expect(slid.map((entry) => entry.element)).toContain(below);
    expect(slid[0].keyframes.every((frame) => !("height" in frame) && !("width" in frame))).toBe(true);
  });
});
