// Prompt 6 G3: the skeleton behind a held tile stands on whole pixels, and its layer sits at a whole-pixel offset.

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MoveModel, MoveNames } from "@/lib/build/moveRules";
import type { Box } from "./flip";
import { measureSkeleton, type BoxOf } from "./useBuildSorting";
import { SkeletonLayer } from "./skeleton";

const names: MoveNames = { tile: (id) => id, session: (key) => key, part: (key) => key } as MoveNames;

/** A list root holding two sessions of tiles, drawn at fractional places. */
function page(boxes: Record<string, Box>) {
  const root = document.createElement("div");
  const add = (kind: string, id: string, container: string) => {
    const element = document.createElement("div");
    element.setAttribute("data-skel-kind", kind);
    element.setAttribute("data-skel-id", id);
    element.setAttribute("data-skel-container", container);
    element.appendChild(document.createElement("div"));
    root.appendChild(element);
  };
  add("session", "s1", "");
  add("tile", "a", "s1");
  add("tile", "b", "s1");
  add("session", "s2", "");
  add("tile", "c", "s2");
  document.body.appendChild(root);
  root.getBoundingClientRect = () => ({ ...boxes.root, left: boxes.root.x, top: boxes.root.y, width: boxes.root.w, height: boxes.root.h, right: boxes.root.x + boxes.root.w, bottom: boxes.root.y + boxes.root.h }) as unknown as DOMRect;
  const boxOf: BoxOf = (element) => boxes[element.getAttribute("data-skel-id") as string];
  return { root, boxOf };
}

const model: MoveModel = { parts: [{ key: "", sessions: ["s1", "s2"] }], hasParts: false, tiles: { s1: ["a", "b"], s2: ["c"] }, nested: {}, loose: [] } as unknown as MoveModel;

const whole = (value: number) => Math.abs(value - Math.round(value)) < 1e-9;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("G3: the measured boxes are whole pixels", () => {
  it("rounds every socket, lane, target and rail to whole numbers, relative to a whole-pixel origin", () => {
    const { root, boxOf } = page({
      root: { x: 328, y: 292.59, w: 680, h: 1589.41 },
      s1: { x: 341, y: 357.59, w: 654, h: 247.06 },
      a: { x: 341, y: 439.59, w: 654, h: 93 },
      b: { x: 341, y: 544.59, w: 654, h: 60.06 },
      s2: { x: 341, y: 636.66, w: 654, h: 200.34 },
      c: { x: 341, y: 718.66, w: 654, h: 118.34 },
    });
    const skeleton = measureSkeleton(root, { id: "a", type: "tile" }, model, model, names, 296, boxOf);
    const rects = [...skeleton.sockets.map((socket) => socket.rect), ...skeleton.lanes.map((lane) => lane.rect), ...(skeleton.target ? [skeleton.target.rect] : [])];
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) for (const value of [rect.x, rect.y, rect.w, rect.h]) expect(whole(value)).toBe(true);
    for (const rail of skeleton.rails) for (const value of [rail.x, rail.top, rail.bottom]) expect(whole(value)).toBe(true);
    // Page coordinates: the layer is moved to the origin's whole pixel, so a socket's page place is its tile's rounded place less 4.
    const a = skeleton.sockets.find((socket) => socket.id === "a") ?? skeleton.target;
    expect((a?.rect.y ?? 0) + Math.round(292.59)).toBe(Math.round(439.59) - 4);
    expect(skeleton.origin).toEqual({ x: 328, y: 292.59 });
  });
});

describe("G3: the layer sits at a whole-pixel offset", () => {
  it("is shifted by the fraction of its parent's place, so a whole coordinate inside it is whole on the page", () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    vi.spyOn(parent, "getBoundingClientRect").mockReturnValue({ x: 328, y: 292.59, left: 328, top: 292.59, width: 680, height: 900, right: 1008, bottom: 1192.59, toJSON: () => null } as DOMRect);
    const skeleton = { kind: "tile" as const, sockets: [], lanes: [], rails: [], target: null, origin: { x: 328, y: 292.59 } };
    const { getByTestId } = render(<SkeletonLayer skeleton={skeleton} shown />, { container: parent });
    const layer = getByTestId("skeleton-layer");
    const [, x, y] = /translate\((.+)px, (.+)px\)/.exec(layer.style.transform) ?? [];
    expect(Number(x)).toBe(0);
    expect(292.59 + Number(y)).toBeCloseTo(293, 9);
  });
});
