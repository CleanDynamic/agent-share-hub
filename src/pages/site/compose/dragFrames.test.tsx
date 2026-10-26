// SV-06 P6 - dragging once per frame: a move stores the pointer, the place is decided at most once a frame, from the animator's
// places at rest, so a move reads no layout; a scroll offsets those places; the listeners are passive.

import { act, fireEvent, within } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { done, mountList, pickUp, stubLayout, stubMedia } from "./ca21Harness";
import { restAfter, type Measure } from "./listMotion";

beforeEach(stubMedia);
afterEach(() => {
  vi.useRealTimers();
  done();
});

const tileIds = () => [...document.querySelectorAll('[data-skel-kind="tile"]')].map((el) => el.getAttribute("data-skel-id") as string);
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`) as HTMLElement;
const grip = (id: string) => within(tile(id)).getAllByTestId("drag-handle")[0];
const move = (x: number, y: number) => fireEvent(window, new MouseEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));

/** Picks the first tile up and lets the first decision (which takes the places once) happen. */
async function holding() {
  stubLayout();
  mountList();
  const [first] = tileIds();
  await pickUp(grip(first));
  vi.useFakeTimers();
  const box = tile(first).getBoundingClientRect();
  act(() => {
    move(120, box.y + 10);
    vi.advanceTimersToNextFrame();
  });
  return box;
}

describe("once per frame", () => {
  it("runs one decision for 200 pointer events in one frame", async () => {
    const box = await holding();
    const root = document.querySelector('[data-testid="build-list"]') as HTMLElement;
    const asks = vi.spyOn(root, "querySelectorAll");
    act(() => {
      move(120, box.y + 11);
      vi.advanceTimersToNextFrame();
    });
    const one = asks.mock.calls.length;
    expect(one).toBeGreaterThan(0);
    asks.mockClear();
    act(() => {
      for (let at = 0; at < 200; at += 1) move(120, box.y + 10 + (at % 5));
    });
    // Nothing is decided until the frame.
    expect(asks).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersToNextFrame());
    expect(asks.mock.calls.length).toBe(one);
  });

  it("reads no layout on a move: the boxes come from the animator's places", async () => {
    const box = await holding();
    const rects = vi.mocked(Element.prototype.getBoundingClientRect);
    rects.mockClear();
    const styles = vi.spyOn(window, "getComputedStyle");
    act(() => {
      for (let at = 0; at < 20; at += 1) {
        move(120, box.y + 10 + (at % 3));
        vi.advanceTimersToNextFrame();
      }
    });
    expect(rects).not.toHaveBeenCalled();
    expect(styles).not.toHaveBeenCalled();
  });
});

describe("scrolling while dragging", () => {
  it("offsets the places by the scroll and measures nothing again", () => {
    const before: Measure = new Map();
    const after: Measure = new Map();
    const element = document.createElement("div");
    before.set("tile:a", { element, x: 0, y: 100, w: 10, h: 10 });
    // Mid-slide: drawn at 100 while it stands at 120; the commit moves it down 50.
    after.set("tile:a", { element, x: 0, y: 150, w: 10, h: 10 });
    after.set("tile:b", { element, x: 0, y: 300, w: 10, h: 10 });
    const rest = restAfter(new Map([["tile:a", { x: 0, y: 120 + 40, w: 10, h: 10 }]]), before, after, { x: 0, y: 40 });
    // Kept in the page's coordinates: where it stood, moved by the commit; a new one where it is drawn, plus the scroll.
    expect(rest.get("tile:a")?.y).toBe(210);
    expect(rest.get("tile:b")?.y).toBe(340);
  });

  it("decides again on a scroll, at the frame, with no new measure", async () => {
    const box = await holding();
    const rects = vi.mocked(Element.prototype.getBoundingClientRect);
    rects.mockClear();
    act(() => {
      vi.stubGlobal("scrollY", 30);
      fireEvent.scroll(window);
      fireEvent.scroll(window);
      vi.advanceTimersToNextFrame();
    });
    expect(rects).not.toHaveBeenCalled();
    void box;
  });
});

describe("listeners", () => {
  it("listens to the pointer and the scroll passively while something is held", async () => {
    const adds = vi.spyOn(window, "addEventListener");
    await holding();
    const of = (type: string) => adds.mock.calls.filter(([name]) => name === type).map(([, , options]) => options);
    expect(of("pointermove").length).toBeGreaterThan(0);
    expect(of("pointermove").every((options) => typeof options === "object" && options?.passive === true)).toBe(true);
    expect(of("scroll").every((options) => typeof options === "object" && options?.passive === true)).toBe(true);
  });

  it("in the build page's code, a pointer, touch, wheel or scroll listener is passive unless it says why it calls preventDefault", () => {
    const dir = join(process.cwd(), "src/pages/site/compose");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))) {
      const lines = readFileSync(join(dir, file), "utf8").split("\n");
      lines.forEach((line, at) => {
        if (!/addEventListener\("(pointermove|pointerdown|touchstart|touchmove|wheel|scroll)"/.test(line)) return;
        if (/passive: true/.test(line)) return;
        if (lines.slice(Math.max(0, at - 3), at + 1).some((near) => /preventDefault/.test(near))) return;
        offenders.push(`${file}:${at + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
