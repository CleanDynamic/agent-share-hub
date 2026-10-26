// CA-22 P5 - folding and unfolding: tiles rise 24 behind the head and fade, the space closes with everything below sliding up;
// unfolding opens the space and the tiles come down, 40 apart, together from the 8th. BuildList mounted for real; animations recorded.

import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { FOLD, FOLD_RISE, UNFOLD_SPREAD_MAX, UNFOLD_STAGGER } from "@/lib/build/buildMotion";
import { MotionChannel, MotionChannelContext, type MotionKind } from "./listMotion";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { staggerDelay } from "./buildMotion";
import { passes, stubAnimations } from "./motionStub";

/* SV-06: the page's channel, given to the List as the composer's page gives it; a step labels its change on it. */
const channel = new MotionChannel();
const announce = (kind: MotionKind, sentence?: string) => channel.expect({ kind, keys: [], sentence });
const resetIntent = () => channel.reset();

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
  ({ played } = stubAnimations());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  __resetMotionMediaCache();
  resetIntent();
});

const base = (): BuildListProps => ({ ...sandboxListProps("bakery"), onNest: async () => true, canNest: () => false, onToggleCollapsed: vi.fn() });
const keys = (props: BuildListProps) => [...props.dividers.values()].map((head) => head.key);
const mount = (props: BuildListProps) => {
  const wrap = (next: BuildListProps) => (
    <MemoryRouter>
      <MotionChannelContext.Provider value={channel}>
        <BuildList {...next} />
      </MotionChannelContext.Provider>
    </MemoryRouter>
  );
  const view = render(wrap(props));
  return { again: (next: BuildListProps) => view.rerender(wrap(next)) };
};
const tilesOf = (key: string) => document.getElementById(`session-tiles-${key}`) as HTMLElement;
const risers = () => played.filter((entry) => entry.keyframes.some((frame) => frame.transform === `translateY(-${FOLD_RISE}px)`));

describe("folding a session", () => {
  it("the tiles rise 24 behind the head and fade over 200 while the space is already gone; then it is drawn folded", async () => {
    const props = base();
    const [first] = keys(props);
    const { again } = mount(props);
    const inside = [...tilesOf(first).children];
    again({ ...props, collapsed: new Set([first]) });
    expect(tilesOf(first).hidden).toBe(false);
    expect(tilesOf(first).style.height).toBe("0px");
    const lifted = risers().filter((entry) => entry.keyframes[0].opacity === 1);
    expect(lifted.map((entry) => entry.element)).toEqual(inside);
    expect(lifted[0].options).toMatchObject({ duration: FOLD, fill: "both" });
    expect(played.some((entry) => entry.keyframes.some((frame) => frame.transform === "rotate(90deg)"))).toBe(true);
    await passes(FOLD);
    expect(tilesOf(first).hidden).toBe(true);
    expect(tilesOf(first).style.height).toBe("");
    expect(tilesOf(first).children).toHaveLength(0);
  });

  it("shows the folded session's count", () => {
    const props = base();
    const [first] = keys(props);
    const { again } = mount(props);
    again({ ...props, collapsed: new Set([first]) });
    expect(document.querySelector(`[data-session-key="${first}"] [data-testid="session-count"]`)?.textContent).toMatch(/tiles?$/);
  });
});

describe("unfolding a session", () => {
  it("the tiles come down from 24 above, top first, 40 apart", () => {
    const props = base();
    const [first] = keys(props);
    const { again } = mount({ ...props, collapsed: new Set([first]) });
    again(props);
    const down = played.filter((entry) => entry.keyframes[0]?.transform === `translateY(-${FOLD_RISE}px)`);
    const delays = down.map((entry) => Number(entry.options.delay ?? 0));
    expect(delays.length).toBeGreaterThan(1);
    expect(delays.slice(0, 3)).toEqual([0, UNFOLD_STAGGER, 2 * UNFOLD_STAGGER].slice(0, delays.length));
    expect(down[0].options.duration).toBe(FOLD);
    expect(down[0].keyframes[1]).toEqual({ opacity: 1, transform: "none" });
  });

  it("up to 8 keep 40 apart; more come closer together, so the last never starts past 280", () => {
    expect(staggerDelay(6, 8, UNFOLD_STAGGER, UNFOLD_SPREAD_MAX)).toBe(240);
    expect(staggerDelay(7, 8, UNFOLD_STAGGER, UNFOLD_SPREAD_MAX)).toBe(280);
    expect(staggerDelay(8, 9, UNFOLD_STAGGER, UNFOLD_SPREAD_MAX)).toBeLessThanOrEqual(280);
    expect(staggerDelay(29, 30, UNFOLD_STAGGER, UNFOLD_SPREAD_MAX)).toBeLessThanOrEqual(280);
  });
});

describe("Collapse all and Expand all", () => {
  it("every session folds at the same time, with no stagger between sessions", async () => {
    const props = base();
    const all = keys(props);
    const { again } = mount(props);
    again({ ...props, collapsed: new Set(all) });
    const starts = all.map((key) => risers().filter((entry) => tilesOf(key).contains(entry.element) || tilesOf(key) === entry.element.parentElement).map((entry) => Number(entry.options.delay ?? 0))[0]);
    expect(starts.every((start) => start === 0)).toBe(true);
    expect(all.every((key) => tilesOf(key).style.height === "0px")).toBe(true);
    await passes(FOLD);
    expect(all.every((key) => tilesOf(key).hidden)).toBe(true);
  });
});

describe("interrupting a fold", () => {
  it("unfolding at once finishes the fold, and the session ends open", async () => {
    const props = base();
    const [first] = keys(props);
    const { again } = mount(props);
    again({ ...props, collapsed: new Set([first]) });
    again(props);
    expect(tilesOf(first).hidden).toBe(false);
    expect(tilesOf(first).style.height).toBe("");
    expect(tilesOf(first).children.length).toBeGreaterThan(0);
    await passes(FOLD * 3);
    expect(tilesOf(first).hidden).toBe(false);
  });
});

describe("reduced motion", () => {
  it("folds and unfolds at once, with nothing moving", () => {
    reduced = true;
    __resetMotionMediaCache();
    const props = base();
    const [first] = keys(props);
    const { again } = mount(props);
    again({ ...props, collapsed: new Set([first]) });
    expect(tilesOf(first).hidden).toBe(true);
    expect(tilesOf(first).children).toHaveLength(0);
    again(props);
    expect(tilesOf(first).hidden).toBe(false);
    expect(played).toHaveLength(0);
  });
});

describe("folding a part", () => {
  it("its sessions rise 24 and fade, then the part is drawn folded", async () => {
    const props = base();
    const [a, b] = keys(props);
    const view = (key: string, label: string, collapsed = false) => ({ key, label, nameColour: "var(--text)", sessions: 1, collapsed });
    const parts = (collapsed: boolean): BuildListProps["parts"] => ({
      parts: [
        { title: "Part 1", sessions: [a], startsAfterChoices: [], view: view("ws-a", "Part 1", collapsed) },
        { title: "Part 2", sessions: [b], startsAfterChoices: [], view: view("ws-b", "Part 2") },
      ],
      ops: { onName: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onStartsAfter: vi.fn() },
      onToggle: vi.fn(),
    });
    const { again } = mount({ ...props, parts: parts(false) });
    announce("change");
    again({ ...props, parts: parts(true) });
    const body = document.getElementById("workstream-body-ws-a") as HTMLElement;
    expect(body.hidden).toBe(false);
    expect(body.style.height).toBe("0px");
    expect(risers().length).toBeGreaterThan(0);
    await passes(FOLD);
    expect(body.hidden).toBe(true);
  });
});
