// UX-02 P3 Stage C: the List takes items from outside. A row of Sources held over the List is placed by the same pointer and box logic
// as a moved tile; let go, it is handed to the page as an add; off the List or on Escape, nothing is written. jsdom draws no boxes, so
// the List's boxes are stubbed by what each element is.

import { act, renderHook } from "@testing-library/react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MoveModel } from "@/lib/build/moveRules";

import { useBuildSorting, type IncomingAdd, type SortingOptions } from "./useBuildSorting";

type Rect = { x: number; y: number; w: number; h: number };

/** Session s1 (tiles a, b) and s2 (tile c), as the List draws them. */
const model: MoveModel = { parts: [{ key: "", sessions: ["s1", "s2"] }], hasParts: false, tiles: { s1: ["a", "b"], s2: ["c"] }, nested: {}, loose: [] };
const boxes: Record<string, Rect> = {
  list: { x: 300, y: 0, w: 600, h: 800 },
  s1: { x: 300, y: 0, w: 600, h: 300 },
  s2: { x: 300, y: 320, w: 600, h: 200 },
  a: { x: 300, y: 50, w: 600, h: 100 },
  b: { x: 300, y: 170, w: 600, h: 100 },
  c: { x: 300, y: 370, w: 600, h: 100 },
  row: { x: 0, y: 0, w: 280, h: 48 },
};

function drawList(): HTMLDivElement {
  const root = document.createElement("div");
  root.dataset.box = "list";
  const session = (key: string, tiles: string[]) => {
    const el = document.createElement("div");
    Object.assign(el.dataset, { skelKind: "session", skelId: key, skelContainer: "", box: key });
    for (const id of tiles) {
      const tile = document.createElement("div");
      Object.assign(tile.dataset, { skelKind: "tile", skelId: id, skelContainer: key, box: id });
      el.append(tile);
    }
    root.append(el);
  };
  session("s1", ["a", "b"]);
  session("s2", ["c"]);
  document.body.append(root);
  for (const id of ["src-file:F", "src-session:L"]) {
    const row = document.createElement("div");
    row.setAttribute("data-source-drag", id);
    row.dataset.box = "row";
    row.textContent = id;
    document.body.append(row);
  }
  return root;
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const r = boxes[(this as HTMLElement).dataset?.box ?? ""] ?? { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x, y: r.y, left: r.x, top: r.y, width: r.w, height: r.h, right: r.x + r.w, bottom: r.y + r.h, toJSON: () => r } as DOMRect;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function setup(over: Partial<SortingOptions> = {}) {
  const add = vi.fn(async (_add: IncomingAdd) => true);
  const options: SortingOptions = {
    model,
    phone: false,
    names: { tile: (id) => `Tile ${id}`, session: (key) => `Session ${key}`, part: () => "Part" },
    canTake: () => false,
    commit: vi.fn(),
    send: vi.fn(async () => true),
    sentLine: () => "",
    say: vi.fn(),
    add,
    takesFile: (id) => id === "a",
    addedLine: () => "Added.",
    ...over,
  };
  const hook = renderHook(() => useBuildSorting(options));
  const root = drawList();
  hook.result.current.rootRef.current = root;
  return { hook, add, options };
}

const start = (id: string) =>
  ({ active: { id, data: { current: { source: id.startsWith("src-file:") ? "file" : "session", id: id.split(":")[1] } }, rect: { current: { initial: null, translated: null } } }, activatorEvent: new MouseEvent("pointerdown", { clientX: 100, clientY: 20 }) }) as unknown as DragStartEvent;

/** The pointer moves; the place is decided on the next frame. */
const moveTo = async (x: number, y: number) => {
  act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y })));
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
};

describe("UX-02 P3 · the List takes a file from Sources", () => {
  it("held over the gap between a and b and let go: an add of a File tile at that place", async () => {
    const { hook, add } = setup();
    act(() => hook.result.current.onDragStart(start("src-file:F")));
    expect(hook.result.current.incoming?.source).toBe("file");
    // A row of Sources does not fly back to its row when let go.
    expect(hook.result.current.settles).toBe(false);
    await moveTo(400, 160);
    expect(hook.result.current.live?.tiles.s1).toEqual(["a", "incoming-file:F", "b"]);
    await act(async () => hook.result.current.onDragEnd({} as DragEndEvent));
    expect(add).toHaveBeenCalledWith({ kind: "add-file", fileId: "F", session: "s1", index: 1 });
  });

  it("held over the middle of a tile that takes files for the dwell: attached inside that step", async () => {
    const { hook, add } = setup();
    act(() => hook.result.current.onDragStart(start("src-file:F")));
    await moveTo(400, 100);
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(hook.result.current.send).toBe("a");
    await act(async () => hook.result.current.onDragEnd({} as DragEndEvent));
    expect(add).toHaveBeenCalledWith({ kind: "attach-file", fileId: "F", into: "a" });
  });

  it("let go off the List: nothing is written, and the slot is gone at once", async () => {
    const { hook, add } = setup();
    act(() => hook.result.current.onDragStart(start("src-file:F")));
    await moveTo(400, 160);
    await moveTo(100, 160);
    expect(hook.result.current.live?.tiles.s1).toEqual(["a", "b"]);
    await act(async () => hook.result.current.onDragEnd({} as DragEndEvent));
    expect(add).not.toHaveBeenCalled();
    expect(hook.result.current.skeleton).toBeNull();
    expect(hook.result.current.incoming).toBeNull();
  });

  it("Escape: nothing is written, and the slot is gone at once", async () => {
    const { hook, add } = setup();
    act(() => hook.result.current.onDragStart(start("src-file:F")));
    await moveTo(400, 160);
    act(() => hook.result.current.onDragCancel());
    expect(add).not.toHaveBeenCalled();
    expect(hook.result.current.live).toBeNull();
    expect(hook.result.current.skeleton).toBeNull();
  });

  it("a session held between s1 and s2 and let go: added before s2", async () => {
    const { hook, add } = setup();
    act(() => hook.result.current.onDragStart(start("src-session:L")));
    await moveTo(400, 310);
    expect(hook.result.current.live?.parts[0].sessions).toEqual(["s1", "L", "s2"]);
    await act(async () => hook.result.current.onDragEnd({} as DragEndEvent));
    expect(add).toHaveBeenCalledWith({ kind: "add-session", libraryId: "L", part: "", before: "s2" });
  });

  it("a write that does not land puts the List back as it was", async () => {
    const { hook } = setup({ add: vi.fn(async () => false) });
    act(() => hook.result.current.onDragStart(start("src-file:F")));
    await moveTo(400, 160);
    await act(async () => hook.result.current.onDragEnd({} as DragEndEvent));
    // Back on the build as the data draws it: no live order with the slot in it.
    expect(hook.result.current.live?.tiles.s1 ?? model.tiles.s1).toEqual(["a", "b"]);
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(hook.result.current.incoming).toBeNull();
  });
});
