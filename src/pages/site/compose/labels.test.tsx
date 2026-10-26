// SV-06 P2 - a change carries its own label (`motion.expect({ kind, keys })`), used by the first commit that touches those keys and
// spent there, never by time; a change with none still slides; nothing is read while rendering. BuildList mounted for real.

import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { LIFT } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { stubLayout } from "./ca21Harness";
import { MotionChannel, MotionChannelContext } from "./listMotion";
import { stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let restore = () => undefined;
let channel = new MotionChannel();
/** True between the first and the last thing React renders for a commit: a layout read then is a read in render. */
let rendering = false;
let readsInRender = 0;

beforeEach(() => {
  vi.useFakeTimers();
  channel = new MotionChannel();
  rendering = false;
  readsInRender = 0;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 4000);
  __resetMotionMediaCache();
  ({ played, restore } = stubAnimations());
  stubLayout();
  // Counted on top of the layout stub: any box or style read while React renders.
  const spy = vi.mocked(Element.prototype.getBoundingClientRect);
  const box = spy.getMockImplementation() as (this: Element) => DOMRect;
  spy.mockImplementation(function (this: Element) {
    if (rendering) readsInRender += 1;
    return box.call(this);
  });
  const style = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element, pseudo?: string | null) => {
    if (rendering) readsInRender += 1;
    return style(element, pseudo);
  });
});
afterEach(() => {
  cleanup();
  restore();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

/** Rendered first and last round the List: React renders them in order, so what happens between is the List's render. */
function Start() {
  rendering = true;
  return null;
}
function End() {
  rendering = false;
  return null;
}

const base = (): BuildListProps => ({ ...sandboxListProps("bakery"), onNest: async () => true, canNest: () => false, onToggleCollapsed: vi.fn() });
const without = (props: BuildListProps, ...ids: string[]): BuildListProps => ({ ...props, steps: props.steps.filter((step) => !ids.includes(step.id)) });
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`);
const lifts = () => played.filter((entry) => entry.options.id === "bm:lift");
const slides = () => played.filter((entry) => entry.options.id === "bm:slide");

function mount(props: BuildListProps) {
  const wrap = (next: BuildListProps) => (
    <MemoryRouter>
      <MotionChannelContext.Provider value={channel}>
        <Start />
        <BuildList {...next} />
        <End />
      </MotionChannelContext.Provider>
    </MemoryRouter>
  );
  const view = render(wrap(props));
  return (next: BuildListProps) => view.rerender(wrap(next));
}

describe("the channel", () => {
  it("a label is spent by the change that touches its keys, and only by that one", () => {
    channel.expect({ kind: "remove", keys: ["p2"] });
    expect(channel.take(["p3"])).toBeNull();
    expect(channel.take(["p2"])?.kind).toBe("remove");
    expect(channel.take(["p2"])).toBeNull();
  });

  it("a label with no keys is used by the first change that touches anything", () => {
    channel.expect({ kind: "undo", keys: [] });
    expect(channel.take([])).toBeNull();
    expect(channel.take(["p1"])?.kind).toBe("undo");
  });

  it("a label for keys that never arrive is dropped when the next labelled action starts", () => {
    channel.expect({ kind: "remove", keys: ["never"] });
    channel.expect({ kind: "duplicate", keys: ["p2"] });
    expect(channel.peek(["never"])).toBeNull();
    expect(channel.take(["p2"])?.kind).toBe("duplicate");
  });
});

describe("labels on the List", () => {
  it("a labelled remove lifts the tile, then lets it go and what was below slides up", () => {
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"], sentence: "Removed Prompt 2" });
    again(without(props, "p2"));
    expect(lifts().map((entry) => entry.element)).toEqual([tile("p2")]);
    expect(slides()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(LIFT));
    expect(tile("p2")).toBeNull();
    expect(slides().length).toBeGreaterThan(0);
    expect(slides().every((entry) => entry.element !== null)).toBe(true);
  });

  it("an unlabelled change lifts nothing, and what moved still slides: it never snaps", () => {
    const props = base();
    const again = mount(props);
    again(without(props, "p2"));
    expect(tile("p2")).toBeNull();
    expect(lifts()).toHaveLength(0);
    expect(slides().length).toBeGreaterThan(0);
  });

  it("a label waits for a slow write: five seconds later it is still used", () => {
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    act(() => vi.advanceTimersByTime(5000));
    again(without(props, "p2"));
    expect(lifts().map((entry) => entry.element)).toEqual([tile("p2")]);
    expect(channel.waiting()).toBeNull();
  });

  it("a label for keys that never arrive is dropped when the next labelled action starts, and the next one is used", () => {
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["somewhere-else"] });
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    expect(lifts().map((entry) => entry.element)).toEqual([tile("p2")]);
  });

  it("nothing is measured while rendering: not a lift, a slide, a reorder, a number or a fold", () => {
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    act(() => vi.advanceTimersByTime(LIFT + 1000));
    again({ ...props, steps: [...props.steps].reverse() });
    // A number that changes (SV-05's crossfade): its old words are taken by the animator's measure, not by the render.
    again({ ...props, steps: props.steps.map((step) => (step.id === "p2" ? { ...step, number: "9" } : step)) });
    const first = [...props.dividers.values()][0].key;
    again({ ...props, collapsed: new Set([first]) });
    act(() => vi.advanceTimersByTime(1000));
    again({ ...props, collapsed: new Set() });
    expect(readsInRender).toBe(0);
  });
});
