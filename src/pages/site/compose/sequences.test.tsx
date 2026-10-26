// SV-06 P3 - sequences follow the animations: each step waits on the one before it ending, not on a timer, so a busy main thread
// cannot put them out of order; an interrupted sequence ends in the right state; nothing runs past the 1.2 s cap.

import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { LIFT, SEQUENCE_CAP, SLIDE } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { stubLayout } from "./ca21Harness";
import { MotionChannel, MotionChannelContext } from "./listMotion";
import { passes, stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let restore = () => undefined;
let channel = new MotionChannel();
/** The animations the test holds: they end only when it says (`end()`), however much time passes. */
let holding: (entry: Played) => boolean = () => false;

beforeEach(() => {
  vi.useFakeTimers();
  channel = new MotionChannel();
  holding = () => false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 4000);
  __resetMotionMediaCache();
  ({ played, restore } = stubAnimations({ hold: (entry) => holding(entry) }));
  stubLayout();
});
afterEach(() => {
  cleanup();
  restore();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

const base = (): BuildListProps => ({ ...sandboxListProps("bakery"), onNest: async () => true, canNest: () => false, onToggleCollapsed: vi.fn() });
const without = (props: BuildListProps, ...ids: string[]): BuildListProps => ({ ...props, steps: props.steps.filter((step) => !ids.includes(step.id)) });
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`);
const layer = () => document.querySelector<HTMLElement>('[data-testid="skeleton-layer"]');
const of = (id: string) => played.filter((entry) => entry.options.id === id);

function mount(props: BuildListProps) {
  const wrap = (next: BuildListProps) => (
    <MemoryRouter>
      <MotionChannelContext.Provider value={channel}>
        <BuildList {...next} />
      </MotionChannelContext.Provider>
    </MemoryRouter>
  );
  const view = render(wrap(props));
  return (next: BuildListProps) => view.rerender(wrap(next));
}

describe("each step waits on the one before", () => {
  it("with the main thread blocked 300 ms mid-lift, the tile is let go only when its lift has ended, and the slide follows", async () => {
    holding = (entry) => entry.options.id === "bm:lift";
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    expect(of("bm:lift")).toHaveLength(1);
    // Time passes well beyond the lift's 200 ms, but the lift has not reached its end: nothing is let go on a guess.
    await passes(LIFT + 300);
    expect(tile("p2")).not.toBeNull();
    expect(of("bm:slide")).toHaveLength(0);
    // The lift ends: then, in that order, the tile goes and what stood below slides up.
    of("bm:lift")[0].end();
    await passes(0);
    expect(tile("p2")).toBeNull();
    expect(of("bm:slide").length).toBeGreaterThan(0);
  });

  it("the skeleton never fades before the slides it frames have ended", async () => {
    holding = (entry) => entry.options.id === "bm:slide";
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    await passes(LIFT);
    expect(of("bm:slide").length).toBeGreaterThan(0);
    // The slides are held: the skeleton stays, shown, however long they take (short of the cap).
    await passes(SLIDE + 600);
    expect(layer()?.style.opacity).toBe("1");
    for (const slide of of("bm:slide")) slide.end();
    await passes(0);
    expect(layer()?.style.opacity).toBe("0");
    await passes(1000);
    expect(layer()).toBeNull();
  });
});

describe("interrupted, and capped", () => {
  it("a second removal mid-lift: the first is drawn as it ended, the second lifts from there, and both end gone", async () => {
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    await passes(LIFT / 2);
    channel.expect({ kind: "remove", keys: ["p4"] });
    again(without(props, "p2", "p4"));
    // The first removal's tile is gone at once (its change was overtaken); the second lifts what it removes.
    expect(tile("p2")).toBeNull();
    expect(of("bm:lift")).toHaveLength(2);
    await passes(SEQUENCE_CAP);
    expect(tile("p4")).toBeNull();
    expect(layer()).toBeNull();
    expect(tile("p1")).not.toBeNull();
  });

  it("past 1.2 s a sequence goes to its end state, whatever is still running", async () => {
    holding = (entry) => entry.options.id === "bm:lift";
    const props = base();
    const again = mount(props);
    channel.expect({ kind: "remove", keys: ["p2"] });
    again(without(props, "p2"));
    await passes(SEQUENCE_CAP - 1);
    expect(tile("p2")).not.toBeNull();
    await passes(1);
    expect(tile("p2")).toBeNull();
    expect(of("bm:lift")[0].finished).toBe(true);
  });
});
