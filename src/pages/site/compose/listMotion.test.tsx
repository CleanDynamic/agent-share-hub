// SV-06 P1 - the List's one animator: one plan per commit, a slide that carries on from where the element is drawn, nothing
// cancelled, no skipped tile measured, and no session drawn again because its first tile went. jsdom, with `animate` recorded.

import { cleanup, render } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { BuildList, type BuildListProps } from "./BuildList";
import { SLIDE_ATTR } from "./flip";
import { measureDrawn, MotionBoundary, useListMotion, type ListMotion, type SlideOptions } from "./listMotion";
import { stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let restore = () => undefined;
let reduced = false;
/** The offset a running slide adds to where an element is drawn. Where it stands is its `data-top`, which each render draws. */
const offset = new Map<string, number>();

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  offset.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 900);
  __resetMotionMediaCache();
  ({ played, restore } = stubAnimations());
});
afterEach(() => {
  cleanup();
  restore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

/** jsdom has no layout: an element with a slide id is drawn at its `data-top` plus `offset`, 100 wide and 40 tall. */
function layout(): () => void {
  const proto = Element.prototype as { getBoundingClientRect: () => DOMRect };
  const was = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (this: Element) {
    const id = this.getAttribute(SLIDE_ATTR) ?? "";
    const top = Number(this.getAttribute("data-top") ?? 0) + (offset.get(id) ?? 0);
    return { left: 0, top, width: 100, height: 40, right: 100, bottom: top + 40, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
  return () => {
    proto.getBoundingClientRect = was;
  };
}

function Column({ order, slide = {}, onMotion }: { order: string[]; slide?: SlideOptions; onMotion?: (motion: ListMotion) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useListMotion(ref);
  onMotion?.(motion);
  return (
    <MotionBoundary motion={motion} slide={slide}>
      <div ref={ref}>
        {order.map((id, at) => (
          <div key={id} {...{ [SLIDE_ATTR]: id }} data-top={at * 50} />
        ))}
      </div>
    </MotionBoundary>
  );
}

const slides = () => played.filter((entry) => entry.options.id === "bm:slide");

describe("one plan per commit", () => {
  it("two changes in one commit make one plan, and its slides share one duration", () => {
    const undo = layout();
    let motion: ListMotion | null = null;
    const view = render(<Column order={["a", "b", "c"]} onMotion={(m) => (motion = m)} />);
    // c moves to the top, and a to the bottom: two changes, one commit.
    view.rerender(<Column order={["c", "b", "a"]} onMotion={(m) => (motion = m)} />);
    expect(slides()).toHaveLength(2);
    expect(new Set(slides().map((entry) => entry.options.duration)).size).toBe(1);
    expect((motion as ListMotion | null)?.plan().id).toBe(1);
    expect((motion as ListMotion | null)?.plan().moved.sort()).toEqual(["a", "c"]);
    undo();
  });

  it("a change with nothing that moved makes no plan", () => {
    const undo = layout();
    let motion: ListMotion | null = null;
    const view = render(<Column order={["a", "b"]} onMotion={(m) => (motion = m)} />);
    view.rerender(<Column order={["a", "b"]} onMotion={(m) => (motion = m)} />);
    expect(slides()).toHaveLength(0);
    expect((motion as ListMotion | null)?.plan().id).toBe(0);
    undo();
  });
});

describe("never cancel, always continue", () => {
  it("a change during a slide starts from where the element is drawn, and the running slide is not cancelled", () => {
    const undo = layout();
    const view = render(<Column order={["a", "b"]} />);
    // b moves up 50: it slides from 50 below.
    view.rerender(<Column order={["b", "a"]} />);
    const first = slides().find((entry) => entry.element.getAttribute(SLIDE_ATTR) === "b");
    expect(first?.keyframes[0]).toEqual({ transform: "translate(0px, 50px)" });
    // Halfway, the running slide draws b 20 below its place. Then it moves back down 50.
    offset.set("b", 20);
    view.rerender(<Column order={["a", "b"]} />);
    const second = slides().filter((entry) => entry.element.getAttribute(SLIDE_ATTR) === "b").at(-1);
    // Drawn at 20 before, at 50 + 20 now (the first slide still runs under it): the new one makes up the difference, added to it.
    expect(second?.keyframes[0]).toEqual({ transform: "translate(0px, -50px)" });
    expect(second?.options.composite).toBe("add");
    expect(first?.cancelled).toBe(false);
    expect(first?.finished).toBe(false);
    undo();
  });

  it("an element inside one that slides moves only by its own part of the change", () => {
    const undo = layout();
    function Nested({ shift }: { shift: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const motion = useListMotion(ref);
      return (
        <MotionBoundary motion={motion} slide={{}}>
          <div ref={ref}>
            <div {...{ [SLIDE_ATTR]: "session:s" }} data-top={shift ? 100 : 0}>
              <div {...{ [SLIDE_ATTR]: "tile:t" }} data-top={shift ? 120 : 20} />
            </div>
          </div>
        </MotionBoundary>
      );
    }
    const view = render(<Nested shift={false} />);
    // The session moves down 100 and carries its tile with it.
    view.rerender(<Nested shift />);
    expect(slides().map((entry) => entry.element.getAttribute(SLIDE_ATTR))).toEqual(["session:s"]);
    undo();
  });

  it("nothing slides under reduced motion", () => {
    reduced = true;
    __resetMotionMediaCache();
    const undo = layout();
    const view = render(<Column order={["a", "b"]} />);
    view.rerender(<Column order={["b", "a"]} />);
    expect(played).toHaveLength(0);
    undo();
  });
});

describe("windowed tiles", () => {
  it("a session the browser skips is read as one box: none of its tiles is measured", () => {
    const root = document.createElement("div");
    const session = document.createElement("div");
    session.setAttribute(SLIDE_ATTR, "session:far");
    const list = document.createElement("div");
    list.setAttribute("data-testid", "session-tiles");
    list.style.contentVisibility = "auto";
    list.getBoundingClientRect = () => ({ left: 0, top: 6000, width: 600, height: 4000, right: 600, bottom: 10000, x: 0, y: 6000, toJSON: () => ({}) }) as DOMRect;
    session.getBoundingClientRect = () => ({ left: 0, top: 5960, width: 600, height: 4040, right: 600, bottom: 10000, x: 0, y: 5960, toJSON: () => ({}) }) as DOMRect;
    const tiles = Array.from({ length: 40 }, (_, at) => {
      const tile = document.createElement("div");
      tile.setAttribute(SLIDE_ATTR, `tile:t${at}`);
      tile.getBoundingClientRect = vi.fn(() => ({ left: 0, top: 6000 + at * 100, width: 600, height: 90, right: 600, bottom: 6090 + at * 100, x: 0, y: 6000 + at * 100, toJSON: () => ({}) }) as DOMRect);
      list.append(tile);
      return tile;
    });
    session.append(list);
    root.append(session);
    const drawn = measureDrawn(root);
    expect(drawn.has("session:far")).toBe(true);
    for (const tile of tiles) expect(tile.getBoundingClientRect).not.toHaveBeenCalled();
  });
});

describe("one animator", () => {
  const dir = join(process.cwd(), "src/pages/site/compose");
  const sources = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && name !== "motionStub.ts");
  /** Outside the list: the map morph's flying copies and its lines (a layer in the body, and the Map), and the phone's Details. */
  const OUTSIDE = new Set(["mapMorph.tsx", "DetailsOverlay.tsx"]);

  it("only listMotion.ts calls element.animate in the build list", () => {
    const callers = sources.filter((name) => /\.animate\(/.test(readFileSync(join(dir, name), "utf8")));
    expect(callers.filter((name) => !OUTSIDE.has(name)).sort()).toEqual(["listMotion.ts"]);
  });

  it("flip.ts measures and nothing else: no play, no settle, no cancel", () => {
    const flip = readFileSync(join(dir, "flip.ts"), "utf8");
    expect(flip).not.toMatch(/\.animate\(|\.cancel\(|function play|function settle|finishSlides/);
  });

  it("no module ends another's animations: nothing calls finish() or cancel() on what an element is running", () => {
    for (const name of ["buildDirector.tsx", "foldMotion.tsx", "useBuildSorting.ts", "arrival.tsx", "BuildList.tsx", "mapMorph.tsx"]) {
      const text = readFileSync(join(dir, name), "utf8");
      expect(text, name).not.toMatch(/getAnimations\(\)|finishRunning|finishSlides|settle\(root\)/);
    }
  });
});

describe("remounts", () => {
  const base = (): BuildListProps => ({ ...sandboxListProps("bakery"), onNest: async () => true, canNest: () => false });

  it("removing a session's first tile does not draw the session again", () => {
    const props = base();
    const head = [...props.dividers.entries()][0];
    const first = props.steps.find((step) => step.number === head[0]);
    expect(first).toBeDefined();
    const wrap = (next: BuildListProps) => (
      <MemoryRouter>
        <BuildList {...next} />
      </MemoryRouter>
    );
    const view = render(wrap(props));
    const session = () => document.querySelector(`[data-skel-kind="session"][data-skel-id="${head[1].key}"]`);
    const before = session();
    expect(before).not.toBeNull();
    const rest = props.steps.filter((step) => step !== first);
    const next = rest.find((step) => step.number > (first?.number ?? 0));
    const dividers = new Map([...props.dividers].map(([number, value]) => [number === head[0] && next ? next.number : number, value]));
    view.rerender(wrap({ ...props, steps: rest, dividers }));
    expect(session()).toBe(before);
  });
});
