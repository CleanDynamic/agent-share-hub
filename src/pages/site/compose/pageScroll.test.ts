// SV-06 P7 - the build page's one scroll helper: the browser's smooth scroll, which yields to the maker.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { __resetPageScroll, scrollNeeded, scrollToShow, YIELD_MS } from "./pageScroll";

let scrolls: ScrollToOptions[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 800);
  __resetMotionMediaCache();
  __resetPageScroll();
  scrolls = [];
  window.scrollTo = ((options: ScrollToOptions) => void scrolls.push(options)) as never;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

const at = (top: number, height = 100) => {
  const element = document.body.appendChild(document.createElement("div"));
  element.getBoundingClientRect = () => ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON: () => ({}) });
  return element;
};

describe("where it scrolls", () => {
  it("does not scroll when the target is already in view", () => {
    const run = scrollToShow(at(300));
    expect(run.moved).toBe(false);
    expect(scrolls).toEqual([]);
    expect(scrollToShow(at(300), { align: "middle" }).moved).toBe(false);
  });

  it("scrolls by the least distance that brings it into view, or to the middle for Go to it", () => {
    expect(scrollNeeded({ top: 1000, bottom: 1100, height: 100 }, "nearest", 800)).toBe(300);
    expect(scrollNeeded({ top: -250, bottom: -150, height: 100 }, "nearest", 800)).toBe(-250);
    expect(scrollNeeded({ top: 1000, bottom: 1100, height: 100 }, "middle", 800)).toBe(650);
    scrollToShow(at(1000));
    expect(scrolls).toEqual([{ top: 300, behavior: "smooth" }]);
  });
});

describe("it yields to the maker", () => {
  it("stops the moment the maker turns the wheel", async () => {
    const run = scrollToShow(at(2000), { align: "middle" });
    expect(run.moved).toBe(true);
    let ended = false;
    void run.finished.then(() => (ended = true));
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ended).toBe(true);
    // It is stopped where it is: the maker's own scroll takes over.
    expect(scrolls.at(-1)).toEqual({ top: window.scrollY, behavior: "instant" });
  });

  it("stops on a key, a touch or a press on the scrollbar too", async () => {
    for (const event of [new KeyboardEvent("keydown", { key: "ArrowDown" }), new Event("touchstart"), new Event("pointerdown")]) {
      __resetPageScroll();
      vi.advanceTimersByTime(YIELD_MS);
      const run = scrollToShow(at(2000));
      let ended = false;
      void run.finished.then(() => (ended = true));
      window.dispatchEvent(event);
      await vi.advanceTimersByTimeAsync(0);
      expect(ended).toBe(true);
    }
  });

  it("does not start while the maker is scrolling, and does once they have stopped for 300 ms", () => {
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    scrollToShow(at(300)); // the helper listens from its first use
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    vi.advanceTimersByTime(YIELD_MS - 50);
    const during = scrollToShow(at(2000));
    expect(during.moved).toBe(false);
    expect(scrolls).toEqual([]);
    vi.advanceTimersByTime(60);
    expect(scrollToShow(at(2000)).moved).toBe(true);
  });

  it("jumps under reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    __resetMotionMediaCache();
    scrollToShow(at(2000));
    expect(scrolls).toEqual([{ top: 1300, behavior: "instant" }]);
  });
});
