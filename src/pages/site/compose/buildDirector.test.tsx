// CA-22 P2, P3 - leaving and arriving on the List: what goes is held and lifted, then the rest slides; what comes drops in.
// BuildList mounted for real on a fixture; animations are recorded, not played; timers are fake.

import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { DROP, FADE_AFTER_MS, LIFT, SKELETON_IN, SKELETON_OUT, SLIDE, STAGGER } from "@/lib/build/buildMotion";
import { announce, resetIntent } from "@/lib/build/motionIntent";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { diffLayout, layoutOf } from "./buildDirector";

interface Played {
  element: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  finished: boolean;
}
let played: Played[] = [];
let reduced = false;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  played = [];
  resetIntent();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  Element.prototype.animate = vi.fn(function (this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    const entry: Played = { element: this, keyframes, options, finished: false };
    played.push(entry);
    return { id: options.id ?? "", finished: Promise.resolve(), finish: () => (entry.finished = true), cancel: () => undefined } as unknown as Animation;
  }) as never;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
  __resetMotionMediaCache();
  resetIntent();
});

const base = (): BuildListProps => ({ ...sandboxListProps("bakery"), onNest: async () => true, canNest: () => false, onToggleCollapsed: vi.fn() });
const without = (props: BuildListProps, ...ids: string[]): BuildListProps => ({ ...props, steps: props.steps.filter((step) => !ids.includes(step.id)) });
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`);
const mount = (props: BuildListProps) => {
  const view = render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  const again = (next: BuildListProps) =>
    view.rerender(
      <MemoryRouter>
        <BuildList {...next} />
      </MemoryRouter>,
    );
  return { view, again };
};
const lifts = () => played.filter((entry) => entry.keyframes.some((frame) => frame.transform === "translateY(-8px)"));
const drops = () => played.filter((entry) => entry.keyframes[0]?.transform === "translateY(-20px)");

describe("what changed", () => {
  it("reads which tiles, sessions and parts went and came", () => {
    const props = base();
    const change = diffLayout(layoutOf(props), layoutOf(without(props, "p2")));
    expect(change.removedTiles).toEqual(["p2"]);
    expect(change.addedTiles).toEqual([]);
    expect(diffLayout(layoutOf(without(props, "p2")), layoutOf(props)).addedTiles).toEqual(["p2"]);
  });
});

describe("removing a tile", () => {
  it("holds it on screen while it lifts out (fades, rises 8 over 200), then lets it go", () => {
    const props = base();
    const { again } = mount(props);
    expect(tile("p2")).not.toBeNull();
    announce("remove", "Removed Prompt 2");
    again(without(props, "p2"));
    expect(tile("p2")).not.toBeNull();
    expect(lifts()).toHaveLength(1);
    expect(lifts()[0].element).toBe(tile("p2"));
    expect(lifts()[0].keyframes).toEqual([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }]);
    expect(lifts()[0].options).toMatchObject({ duration: LIFT, fill: "both" });
    act(() => vi.advanceTimersByTime(LIFT - 1));
    expect(tile("p2")).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(tile("p2")).toBeNull();
  });

  it("shows the skeleton of that tile's session while it lifts, and fades it out 200 ms after the slide", () => {
    const props = base();
    const { again } = mount(props);
    announce("remove");
    again(without(props, "p2"));
    const layer = () => document.querySelector('[data-testid="skeleton-layer"]') as HTMLElement | null;
    expect(layer()).not.toBeNull();
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(LIFT));
    expect(layer()).not.toBeNull();
    act(() => vi.advanceTimersByTime(SLIDE + FADE_AFTER_MS));
    expect(layer()?.style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(SKELETON_OUT));
    expect(layer()).toBeNull();
  });

  it("nothing else is touched while it lifts: every other tile is still drawn", () => {
    const props = base();
    const { again } = mount(props);
    announce("remove");
    again(without(props, "p2"));
    for (const id of ["p1", "p3", "p4"]) expect(tile(id)).not.toBeNull();
    expect(lifts().map((entry) => entry.element)).toEqual([tile("p2")]);
  });

  it("does nothing without an announced change: a build swapped for another just appears", () => {
    const props = base();
    const { again } = mount(props);
    again(without(props, "p2"));
    expect(tile("p2")).toBeNull();
    expect(played).toHaveLength(0);
  });

  it("under reduced motion the tile is gone at once, with no lift", () => {
    reduced = true;
    __resetMotionMediaCache();
    const props = base();
    const { again } = mount(props);
    announce("remove");
    again(without(props, "p2"));
    expect(tile("p2")).toBeNull();
    expect(lifts()).toHaveLength(0);
  });

  it("a second change while it lifts ends the first at once", () => {
    const props = base();
    const { again } = mount(props);
    announce("remove");
    again(without(props, "p2"));
    announce("remove");
    again(without(props, "p2", "p3"));
    expect(tile("p2")).toBeNull();
    expect(tile("p3")).not.toBeNull();
  });
});

describe("clearing the build", () => {
  it("lifts every tile from the last to the first, 60 apart, and then the build is empty", () => {
    const props = base();
    const { again } = mount(props);
    const box = { left: 0, top: 10, width: 100, height: 40, right: 100, bottom: 50, x: 0, y: 10, toJSON: () => ({}) } as DOMRect;
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => box;
    announce("clear", "Cleared the build");
    again({ ...props, steps: [], dividers: new Map(), emptySessions: [] });
    const order = lifts().map((entry) => entry.element.getAttribute("data-skel-id") ?? entry.element.getAttribute("data-testid"));
    const tiles = order.filter((id) => ["p1", "p2", "p3", "p4", "a5"].includes(String(id)));
    expect(tiles).toEqual(["a5", "p4", "p3", "p2", "p1"].filter((id) => tiles.includes(id)));
    const delays = lifts().map((entry) => Number(entry.options.delay ?? 0));
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(delays[1] - delays[0]).toBe(STAGGER);
    act(() => vi.advanceTimersByTime(Math.max(...delays) + LIFT));
    expect(tile("p1")).toBeNull();
    Element.prototype.getBoundingClientRect = rect;
  });
});

describe("a tile coming", () => {
  it("is drawn at once but waits, see-through, while the gap opens, then drops in over 240", () => {
    const props = base();
    const { again } = mount(without(props, "p2"));
    announce("add");
    again(props);
    expect(tile("p2")).not.toBeNull();
    expect(drops()).toHaveLength(1);
    expect(drops()[0].element).toBe(tile("p2"));
    expect(drops()[0].keyframes).toEqual([{ opacity: 0, transform: "translateY(-20px)" }, { opacity: 1, transform: "none" }]);
    expect(drops()[0].options).toMatchObject({ duration: DROP, delay: SLIDE, fill: "backwards" });
    expect(document.querySelector('[data-testid="skeleton-layer"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(SLIDE + DROP + FADE_AFTER_MS + SKELETON_OUT));
    expect(document.querySelector('[data-testid="skeleton-layer"]')).toBeNull();
  });

  it("a whole build coming back waits for the skeleton to fade in, then drops in from the first to the last, 60 apart", () => {
    const props = base();
    const { again } = mount({ ...props, steps: [], dividers: new Map(), emptySessions: [] });
    announce("undo");
    again(props);
    const delays = drops().map((entry) => Number(entry.options.delay ?? 0));
    expect(delays.length).toBeGreaterThan(1);
    expect(delays[0]).toBe(SKELETON_IN);
    expect(delays[1] - delays[0]).toBe(STAGGER);
  });

  it("a copy slides out from under its original", () => {
    const props = base();
    const { again } = mount(without(props, "p2"));
    announce("duplicate");
    again(props);
    const copy = played.find((entry) => entry.element === tile("p2"));
    expect(copy?.keyframes[0].opacity).toBe(0);
    expect(String(copy?.keyframes[0].transform)).toContain("translate(");
    expect(copy?.options.duration).toBe(DROP);
  });

  it("under reduced motion nothing drops", () => {
    reduced = true;
    __resetMotionMediaCache();
    const props = base();
    const { again } = mount(without(props, "p2"));
    announce("add");
    again(props);
    expect(tile("p2")).not.toBeNull();
    expect(drops()).toHaveLength(0);
  });
});

const sessionKeys = (props: BuildListProps) => [...props.dividers.values()].map((head) => head.key);
const lastLifted = () => lifts().map((entry) => entry.element);

describe("removing a session", () => {
  it("Remove all: its head and tiles lift out together, as one block", () => {
    const props = base();
    const [first] = sessionKeys(props);
    const inFirst = props.steps.filter((step) => step.sessionId === "s1").map((step) => step.id);
    const { again } = mount(props);
    announce("remove");
    const dividers = new Map([...props.dividers].filter(([, head]) => head.key !== first));
    again({ ...props, steps: props.steps.filter((step) => !inFirst.includes(step.id)), dividers });
    const block = document.querySelector(`[data-skel-kind="session"][data-skel-id="${first}"]`);
    expect(block).not.toBeNull();
    expect(lastLifted()).toEqual([block]);
    act(() => vi.advanceTimersByTime(LIFT));
    expect(document.querySelector(`[data-skel-kind="session"][data-skel-id="${first}"]`)).toBeNull();
  });

  it("Keep the tiles (and a merge): only the head lifts; its tiles stay and slide into the session above", () => {
    const props = base();
    const [, second] = sessionKeys(props);
    const { again } = mount(props);
    announce("merge");
    const dividers = new Map([...props.dividers].filter(([, head]) => head.key !== second));
    again({ ...props, dividers });
    const head = document.querySelector(`[data-skel-kind="session"][data-skel-id="${second}"] [data-testid="session-head"]`);
    expect(head).not.toBeNull();
    expect(lastLifted()).toEqual([head]);
    for (const step of props.steps) expect(tile(step.id)).not.toBeNull();
  });
});

describe("the stagger cap", () => {
  it("staggers at most 12 and sends the rest with the 12th", async () => {
    const { planLift } = await import("./buildDirector");
    const root = document.createElement("div");
    for (let at = 0; at < 20; at += 1) {
      const el = document.createElement("div");
      el.setAttribute("data-skel-kind", "tile");
      el.setAttribute("data-skel-id", `t${at}`);
      el.getBoundingClientRect = () => ({ top: 10, bottom: 40, left: 0, right: 10, width: 10, height: 30, x: 0, y: 10, toJSON: () => ({}) });
      root.appendChild(el);
    }
    document.body.appendChild(root);
    const before = { tiles: new Map(Array.from({ length: 20 }, (_, at) => [`t${at}`, "s"])), sessions: new Map([["s", ""]]), parts: new Set<string>() };
    const plan = planLift(root, { removedTiles: [...before.tiles.keys()], addedTiles: [], removedSessions: ["s"], addedSessions: [], removedParts: [], addedParts: [] }, before, "clear");
    expect(plan.elements[0].getAttribute("data-skel-id")).toBe("t19");
    expect(plan.delays.slice(0, 13)).toEqual([0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 660]);
    expect(Math.max(...plan.delays)).toBe(660);
    expect(plan.span).toBe(660 + LIFT);
    root.remove();
  });
});

describe("adding a part", () => {
  it("from one part to two: both heads drop in, the new frame opens from the top", () => {
    const props = base();
    const keys = sessionKeys(props);
    const view = (key: string, label: string) => ({ key, label, nameColour: "var(--text)", sessions: 1, collapsed: false });
    const two: BuildListProps = {
      ...props,
      parts: {
        parts: [
          { title: "Part 1", sessions: [keys[0]], startsAfterChoices: [], view: view("ws-a", "Part 1") },
          { title: "Part 2", sessions: [keys[1]], startsAfterChoices: [], view: view("ws-b", "Part 2") },
        ],
        ops: { onName: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onStartsAfter: vi.fn() },
      },
    };
    const { again } = mount(props);
    announce("part");
    again(two);
    const heads = played.filter((entry) => entry.keyframes[0]?.transform === "translateY(-20px)").map((entry) => (entry.element as HTMLElement).getAttribute("data-testid"));
    expect(heads).toEqual(["workstream-head", "workstream-head"]);
    const clip = played.filter((entry) => entry.keyframes.some((frame) => frame.clipPath));
    expect(clip).toHaveLength(2);
    expect(clip[0].keyframes).toEqual([{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }]);
  });
});
