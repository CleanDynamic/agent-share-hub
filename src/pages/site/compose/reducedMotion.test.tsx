// CA-22 P8 - reduced motion: every moment of Parts 2 to 7 arrives at its end state at once, with nothing animated and nothing left
// half faded or offset; and a change that comes while another runs ends the first at once, with the right end state.

import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFacts, tileView } from "@/dev/fixtures/detailsKinds";
import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { announce, resetIntent, type MotionKind } from "@/lib/build/motionIntent";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { goToIt } from "./buildMotion";
import { DetailsPanel } from "./DetailsPanel";
import { ReferenceNotice } from "./referencePieces";
import { SelectionBar } from "./removePieces";

let animated = 0;
let reduced = true;

beforeEach(() => {
  vi.useFakeTimers();
  reduced = true;
  animated = 0;
  resetIntent();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  Element.prototype.animate = vi.fn(function () {
    animated += 1;
    return { id: "", finished: Promise.resolve(), finish: () => undefined, cancel: () => undefined } as unknown as Animation;
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
const tile = (id: string) => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`);
const heads = (props: BuildListProps) => [...props.dividers.values()].map((head) => head.key);
const mount = (props: BuildListProps) => {
  const wrap = (next: BuildListProps) => (
    <MemoryRouter>
      <BuildList {...next} />
    </MemoryRouter>
  );
  const view = render(wrap(props));
  return (next: BuildListProps) => view.rerender(wrap(next));
};
const without = (props: BuildListProps, ...ids: string[]): BuildListProps => ({ ...props, steps: props.steps.filter((step) => !ids.includes(step.id)) });
const empty = (props: BuildListProps): BuildListProps => ({ ...props, steps: [], dividers: new Map(), emptySessions: [] });

/** What nothing may be left as: half faded, offset, clipped, or a copy of something in the body. */
const clean = () => {
  expect(document.querySelectorAll('[data-testid="crossfade-old"], [data-testid="map-morph-layer"], [data-testid="outline-once"]')).toHaveLength(0);
  for (const element of document.querySelectorAll<HTMLElement>("[data-skel-kind]")) {
    expect(element.style.opacity).toBe("");
    expect(element.style.transform).toBe("");
    expect(element.style.clipPath).toBe("");
    expect(element.style.height).toBe("");
  }
};

describe("the sixteen moments, under reduced motion", () => {
  const cases: [string, MotionKind, (props: BuildListProps) => [BuildListProps, BuildListProps], (props: BuildListProps) => void][] = [
    ["removing a tile", "remove", (props) => [props, without(props, "p2")], () => expect(tile("p2")).toBeNull()],
    ["undo of a removal", "undo", (props) => [without(props, "p2"), props], () => expect(tile("p2")).not.toBeNull()],
    ["removing a session (Remove all)", "remove", (props) => [props, { ...without(props, "p1", "p2"), dividers: new Map([...props.dividers].filter(([, head]) => head.key !== heads(props)[0])) }], (props) => expect(document.querySelector(`[data-skel-id="${heads(props)[0]}"]`)).toBeNull()],
    ["clearing the build", "clear", (props) => [props, empty(props)], () => expect(tile("p1")).toBeNull()],
    ["undo of clearing the build", "undo", (props) => [empty(props), props], () => expect(tile("p1")).not.toBeNull()],
    ["merge with the session above", "merge", (props) => [props, { ...props, dividers: new Map([...props.dividers].filter(([, head]) => head.key !== heads(props)[1])) }], (props) => expect(document.querySelector(`[data-skel-id="${heads(props)[1]}"]`)).toBeNull()],
    ["adding a tile", "add", (props) => [without(props, "p4"), props], () => expect(tile("p4")).not.toBeNull()],
    ["duplicate", "duplicate", (props) => [without(props, "p4"), props], () => expect(tile("p4")).not.toBeNull()],
    ["split session here", "split", (props) => [props, props], () => expect(tile("p3")).not.toBeNull()],
    ["undo of a move", "undo", (props) => [props, { ...props, steps: [...props.steps.slice(0, -2), props.steps[props.steps.length - 1], props.steps[props.steps.length - 2]] }], () => expect(tile("p4")).not.toBeNull()],
    ["convert", "convert", (props) => [props, { ...props, steps: props.steps.map((step) => (step.id === "p3" ? { ...step, title: "Changed" } : step)) }], () => expect(tile("p3")).not.toBeNull()],
  ];
  it.each(cases)("%s", (_name, kind, make, end) => {
    const props = base();
    const [from, to] = make(props);
    const again = mount(from);
    announce(kind);
    again(to);
    act(() => vi.advanceTimersByTime(0));
    end(props);
    expect(animated).toBe(0);
    clean();
    // And nothing is still waiting to happen.
    act(() => vi.advanceTimersByTime(5000));
    end(props);
    clean();
  });

  it("fold and unfold", () => {
    const props = base();
    const [first] = heads(props);
    const again = mount(props);
    again({ ...props, collapsed: new Set([first]) });
    expect(document.getElementById(`session-tiles-${first}`)?.hidden).toBe(true);
    again(props);
    expect(document.getElementById(`session-tiles-${first}`)?.hidden).toBe(false);
    expect(animated).toBe(0);
    clean();
  });

  it("the selection bar, the notice and Details", () => {
    const bar = { phone: false, count: 2, moveTo: { sessions: [], parts: [] }, holds: { tiles: 2, sessions: 0 }, onMoveToSession: vi.fn(), onMoveToPart: vi.fn(), onRemove: vi.fn(), onClear: vi.fn() };
    const first = render(<SelectionBar {...bar} />);
    first.rerender(<SelectionBar {...bar} count={3} />);
    expect(document.querySelector('[data-testid="selection-count"]')?.textContent).toBe("3 selected");
    cleanup();
    const notice = render(<ReferenceNotice notice={{ sentence: "Removed Prompt 2", n: 1 }} onUndo={() => undefined} onDone={() => undefined} />);
    expect(document.querySelector('[data-testid="reference-notice"]')).not.toBeNull();
    notice.rerender(<ReferenceNotice notice={null} onUndo={() => undefined} onDone={() => undefined} />);
    expect(document.querySelector('[data-testid="reference-notice"]')).toBeNull();
    cleanup();
    const props = { phone: false, build: buildFacts, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onSelect: vi.fn(), onEdit: vi.fn() };
    const details = render(<DetailsPanel {...props} view={tileView("prompt", "full")} />);
    details.rerender(<DetailsPanel {...props} view={tileView("agent", "full")} />);
    expect(document.querySelector('[data-testid="details-panel"]')?.getAttribute("data-kind")).toBe("agent");
    expect(animated).toBe(0);
  });

  it("Go to it jumps, and the ring is there for the hold without a fade", async () => {
    const el = document.body.appendChild(document.createElement("div"));
    el.getBoundingClientRect = () => ({ top: 3000, bottom: 3100, left: 0, right: 10, width: 10, height: 100, x: 0, y: 3000, toJSON: () => ({}) });
    window.scrollTo = vi.fn() as never;
    goToIt(el, "#7FA7D9");
    await vi.advanceTimersByTimeAsync(0);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="outline-once"]')).not.toBeNull();
    expect(animated).toBe(0);
  });
});

describe("a change while another is running", () => {
  beforeEach(() => {
    reduced = false;
    __resetMotionMediaCache();
  });

  it("a removal, then Undo straight away: the removal ends, the undo runs, the tile is back once", () => {
    const props = base();
    const again = mount(props);
    announce("remove");
    again(without(props, "p2"));
    expect(tile("p2")).not.toBeNull();
    announce("undo");
    again(props);
    expect(document.querySelectorAll('[data-skel-kind="tile"][data-skel-id="p2"]')).toHaveLength(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(document.querySelectorAll('[data-skel-kind="tile"][data-skel-id="p2"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="skeleton-layer"]')).toBeNull();
  });

  it("a fold, then an unfold at once: the session ends open, with nothing left collapsed", () => {
    const props = base();
    const [first] = heads(props);
    const again = mount(props);
    again({ ...props, collapsed: new Set([first]) });
    again(props);
    act(() => vi.advanceTimersByTime(1000));
    const tiles = document.getElementById(`session-tiles-${first}`) as HTMLElement;
    expect(tiles.hidden).toBe(false);
    expect(tiles.style.height).toBe("");
    expect(tiles.style.marginTop).toBe("10px"); // the run's own, put back
  });

  it("an unfold, then a fold at once: the session ends folded", () => {
    const props = base();
    const [first] = heads(props);
    const again = mount({ ...props, collapsed: new Set([first]) });
    again(props);
    again({ ...props, collapsed: new Set([first]) });
    act(() => vi.advanceTimersByTime(1000));
    const tiles = document.getElementById(`session-tiles-${first}`) as HTMLElement;
    expect(tiles.hidden).toBe(true);
    expect(tiles.style.height).toBe("");
  });
});
