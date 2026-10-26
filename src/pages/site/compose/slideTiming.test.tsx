/* SV-06 P5: a slide takes as long as its distance asks, one plan has one duration, and a stagger's spread never grows with the count. */

import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PROMPT_SPREAD_MAX, PROMPT_STEP_MS, promptStart, SLIDE_MAX, SLIDE_MIN, slideMs, STAGGER, STAGGER_SPREAD_MAX, staggerStep } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { dropIn, liftOut } from "./buildMotion";
import { SLIDE_ATTR } from "./flip";
import { MotionBoundary, useListMotion } from "./listMotion";
import { stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let restore = () => undefined;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 2000);
  __resetMotionMediaCache();
  ({ played, restore } = stubAnimations());
});
afterEach(() => {
  cleanup();
  restore();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

describe("duration by distance", () => {
  it("is 150 for no distance, 200 for 200 px and 300 for 600 px or more", () => {
    expect([SLIDE_MIN, SLIDE_MAX]).toEqual([150, 300]);
    expect(slideMs(0)).toBe(150);
    expect(slideMs(200)).toBe(200);
    expect(slideMs(600)).toBe(300);
    expect(slideMs(5000)).toBe(300);
  });

  it("gives every slide in one plan the duration of its longest move", () => {
    const proto = Element.prototype as { getBoundingClientRect: () => DOMRect };
    const was = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function (this: Element) {
      const top = Number(this.getAttribute("data-top") ?? 0);
      return { left: 0, top, width: 100, height: 40, right: 100, bottom: top + 40, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    };
    function Column({ order }: { order: string[] }) {
      const ref = useRef<HTMLDivElement>(null);
      const motion = useListMotion(ref);
      return (
        <MotionBoundary motion={motion} slide={{}}>
          <div ref={ref}>
            {order.map((id, at) => (
              <div key={id} {...{ [SLIDE_ATTR]: id }} data-top={at * 50} />
            ))}
          </div>
        </MotionBoundary>
      );
    }
    const view = render(<Column order={["a", "b", "c", "d", "e"]} />);
    // a goes from the top to the bottom (200 px); b to e each move up 50.
    view.rerender(<Column order={["b", "c", "d", "e", "a"]} />);
    const slides = played.filter((entry) => entry.options.id === "bm:slide");
    expect(slides).toHaveLength(5);
    expect(new Set(slides.map((entry) => entry.options.duration))).toEqual(new Set([slideMs(200)]));
    proto.getBoundingClientRect = was;
  });
});

describe("stagger by count", () => {
  const spread = (count: number, step: number, max: number) => (count - 1) * staggerStep(count, step, max);

  it("has no stagger for one item", () => {
    expect(staggerStep(1, PROMPT_STEP_MS, PROMPT_SPREAD_MAX)).toBe(0);
    expect(staggerStep(1, STAGGER, STAGGER_SPREAD_MAX)).toBe(0);
  });

  it("keeps 2 to 4 prompts 110 ms apart, and starts the last of 8 or 18 within 330 ms of the first", () => {
    for (const count of [2, 3, 4]) expect(staggerStep(count, PROMPT_STEP_MS, PROMPT_SPREAD_MAX)).toBe(110);
    for (const count of [8, 18]) {
      expect(spread(count, PROMPT_STEP_MS, PROMPT_SPREAD_MAX)).toBeLessThanOrEqual(330);
      expect(promptStart(count - 1, count) - promptStart(0, count)).toBeLessThanOrEqual(330);
    }
  });

  it("keeps 2 to 6 list items 60 ms apart, and spreads 12 or 40 over no more than 300 ms", () => {
    for (const count of [2, 3, 4, 5, 6]) expect(staggerStep(count, STAGGER, STAGGER_SPREAD_MAX)).toBe(60);
    for (const count of [12, 40]) expect(spread(count, STAGGER, STAGGER_SPREAD_MAX)).toBeLessThanOrEqual(300);
  });

  it("drops and lifts 40 items with the last starting no later than 300 ms after the first", () => {
    const items = () => Array.from({ length: 40 }, () => document.body.appendChild(document.createElement("div")));
    dropIn(items(), { stagger: STAGGER });
    liftOut(items(), { stagger: STAGGER });
    const delays = (id: string) => played.filter((entry) => entry.options.id === id).map((entry) => Number(entry.options.delay ?? 0));
    expect(Math.max(...delays("bm:drop"))).toBeLessThanOrEqual(300);
    expect(Math.max(...delays("bm:lift"))).toBeLessThanOrEqual(300);
  });
});
