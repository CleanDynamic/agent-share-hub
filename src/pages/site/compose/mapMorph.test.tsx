// CA-22 P7 - List to Map: the tiles fold behind their heads, each head morphs into its box, the lines draw in; and back. Many sessions
// (or boxes that do not fit) crossfade instead. A harness stands in for the two views; their places are read from `data-rect`.

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useCallback, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FOLD_RISE, MAP_FOLD, MAP_LINES, MAP_LINES_BACK, MAP_MORPH, UNFOLD_STAGGER } from "@/lib/build/buildMotion";
import { FAST, __resetMotionMediaCache } from "@/lib/theme/motion";

import { useLensMorph } from "./mapMorph";
import type { SandboxLens } from "./SandboxView";
import { passes, stubAnimations } from "./motionStub";

interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}
let played: Played[] = [];
let reduced = false;
const rect = (box: string) => {
  const [left, top, width, height] = box.split(",").map(Number);
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
};

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  played = [];
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  ({ played } = stubAnimations());
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rect(this.getAttribute("data-rect") ?? "0,0,0,0");
  };
  (SVGElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 100;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
  __resetMotionMediaCache();
});

function Harness({ sessions, fitsOnScreen = true }: { sessions: string[]; fitsOnScreen?: boolean }) {
  const [lens, setLens] = useState<SandboxLens>("list");
  const root = useRef<HTMLDivElement | null>(null);
  const morph = useLensMorph({ lens, onLens: setLens, getRoot: useCallback(() => root.current, []) });
  return (
    <div ref={root}>
      <button data-testid="to-map" onClick={() => morph.switchTo("map")} />
      <button data-testid="to-list" onClick={() => morph.switchTo("list")} />
      {lens === "list" ? (
        <div data-testid="build-list">
          {sessions.map((key, at) => (
            <div key={key} data-session-key={key}>
              <div data-testid="session-head" data-rect={`10,${at * 200},400,44`}>
                Head {key}
              </div>
              <div data-testid="session-tiles">
                <p>one</p>
                <p>two</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="map-view">
          <svg>
            <path data-testid="map-line-stroke" d="M0 0" />
          </svg>
          <span data-testid="map-part-label" />
          {sessions.map((key, at) => (
            <div key={key} data-testid="map-box" data-session-key={key} data-rect={fitsOnScreen ? `${500 + at * 20},${at * 100},180,60` : `${3000 + at * 20},${at * 100},180,60`}>
              Box {key}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const layer = () => document.querySelector('[data-testid="map-morph-layer"]');
const flights = () => played.filter((entry) => entry.options.id === "bm:morph");

describe("List to Map", () => {
  it("folds the tiles up behind the heads, then the heads morph into the boxes, then the lines draw", async () => {
    render(<Harness sessions={["a", "b"]} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    // 1. The tiles rise 24 and fade over MAP_FOLD; the list is still the list.
    const lifted = played.filter((entry) => entry.keyframes.some((frame) => frame.transform === `translateY(-${FOLD_RISE}px)`));
    expect(lifted).toHaveLength(4);
    expect(lifted.every((entry) => entry.options.duration === MAP_FOLD)).toBe(true);
    expect(document.querySelector('[data-testid="map-view"]')).toBeNull();
    // 2. The map is drawn, unseen, while copies fly from each head to its box.
    await passes(MAP_FOLD);
    const map = document.querySelector('[data-testid="map-view"]') as HTMLElement;
    expect(map.style.visibility).toBe("hidden");
    expect(layer()).not.toBeNull();
    expect(flights()).toHaveLength(4);
    const first = flights()[0];
    expect(first.keyframes[1]).toMatchObject({ transform: "translate(490px, 0px) scale(0.45, 1.3636363636363635)" });
    expect(first.options.duration).toBe(MAP_MORPH);
    expect(flights().map((entry) => [entry.keyframes[0].opacity, entry.keyframes[1].opacity])).toEqual([[1, 0], [0, 1], [1, 0], [0, 1]]);
    // 3. They land: the real map is shown, the lines draw in and the labels fade in.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAP_MORPH);
    });
    expect(layer()).toBeNull();
    expect(map.style.visibility).toBe("");
    const lines = played.filter((entry) => entry.options.id === "bm:lines");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].keyframes).toEqual([{ strokeDasharray: "100", strokeDashoffset: 100 }, { strokeDasharray: "100", strokeDashoffset: 0 }]);
    expect(lines[0].options.duration).toBe(MAP_LINES);
    expect(played.some((entry) => (entry.element as HTMLElement).getAttribute("data-testid") === "map-part-label")).toBe(true);
  });

  it("with more than 30 sessions the new view fades in over FAST instead", () => {
    render(<Harness sessions={Array.from({ length: 31 }, (_, at) => `s${at}`)} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    expect(document.querySelector('[data-testid="map-view"]')).not.toBeNull();
    expect(layer()).toBeNull();
    const fade = played.find((entry) => entry.element === document.querySelector('[data-testid="map-view"]'));
    expect(fade?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fade?.options.duration).toBe(FAST);
  });

  it("when the boxes do not fit on screen it crossfades too", async () => {
    render(<Harness sessions={["a", "b"]} fitsOnScreen={false} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    await passes(MAP_FOLD);
    expect(layer()).toBeNull();
    expect(flights()).toHaveLength(0);
    expect(played.some((entry) => entry.element === document.querySelector('[data-testid="map-view"]') && entry.options.duration === FAST)).toBe(true);
  });

  it("under reduced motion the view just changes", async () => {
    reduced = true;
    __resetMotionMediaCache();
    render(<Harness sessions={["a", "b"]} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    expect(document.querySelector('[data-testid="map-view"]')).not.toBeNull();
    expect(played).toHaveLength(0);
  });
});

describe("Map to List", () => {
  it("the lines retract in 100, the boxes morph back into heads, and the tiles unfold", async () => {
    reduced = false;
    render(<Harness sessions={["a", "b"]} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAP_FOLD + MAP_MORPH);
    });
    played.length = 0;
    fireEvent.click(document.querySelector('[data-testid="to-list"]') as HTMLElement);
    const back = played.filter((entry) => entry.options.id === "bm:lines");
    expect(back[0].keyframes).toEqual([{ strokeDasharray: "100", strokeDashoffset: 0 }, { strokeDasharray: "100", strokeDashoffset: 100 }]);
    expect(back[0].options.duration).toBe(MAP_LINES_BACK);
    expect(document.querySelector('[data-testid="build-list"]')).toBeNull();
    await passes(MAP_LINES_BACK);
    expect(document.querySelector('[data-testid="build-list"]')).not.toBeNull();
    expect(flights()).toHaveLength(4);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAP_MORPH);
    });
    expect(layer()).toBeNull();
    const down = played.filter((entry) => entry.keyframes[0]?.transform === `translateY(-${FOLD_RISE}px)`);
    expect(down.map((entry) => Number(entry.options.delay ?? 0))).toEqual([0, UNFOLD_STAGGER, 0, UNFOLD_STAGGER]);
  });
});

describe("a second switch while one runs", () => {
  it("ends the first at once: nothing is left half drawn", async () => {
    render(<Harness sessions={["a", "b"]} />);
    fireEvent.click(document.querySelector('[data-testid="to-map"]') as HTMLElement);
    await passes(MAP_FOLD);
    expect(layer()).not.toBeNull();
    fireEvent.click(document.querySelector('[data-testid="to-list"]') as HTMLElement);
    expect(layer()).toBeNull();
    expect((document.querySelector('[data-testid="map-view"]') as HTMLElement | null)?.style.visibility ?? "").toBe("");
  });
});
