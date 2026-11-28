// MS-07 Part 6 — the shaping tools in the editor, on the support inbox and the 50-tile build: each happy path is one undo
// step, each refusal says why and changes nothing, previews appear and clear, and every layout a tool leaves passes the
// stored shape's check and the build's order.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mapSandboxFixture, type MapSandboxName } from "@/dev/fixtures/mapSandbox";
import { geometryOf, MAP_GRID, minBoxWidth, type SharedEdge } from "@/lib/build/mapGeometry";
import { boxes, MAP_LAYOUT_COPY, mapLayoutRefusal, nodeById, type MapLayout, type MapSplit } from "@/lib/build/mapLayout";
import { orderFacts, orderRefusal } from "@/lib/build/mapOrder";

import { BuildAnnouncer } from "./BuildAnnouncer";
import { MapEditor, useMapEditorFor } from "./MapEditor";
import { MAP_SHAPING_COPY } from "./mapShaping";
import type { MapEditor as MapEditorState } from "./useMapEditor";

function width(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return { matches: min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}
/** jsdom has no PointerEvent: pointer events would arrive without their position. */
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
beforeEach(() => {
  width(1280);
  vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ── the editor on a fixture, with its state in reach ── */

function draw(name: MapSandboxName = "supportInbox") {
  const fixture = mapSandboxFixture(name);
  const build = { steps: [...fixture.steps], groups: [...fixture.groups], files: [...fixture.files], making: fixture.making, results: fixture.results };
  const facts = orderFacts(build.steps, build.groups, build.files, build.results);
  const save = vi.fn((_layout: MapLayout) => Promise.resolve({}));
  const held: { editor: MapEditorState } = { editor: null as unknown as MapEditorState };
  function Harness() {
    const editor = useMapEditorFor({ ...build, stored: null, save });
    held.editor = editor;
    return <MapEditor editor={editor} {...build} />;
  }
  render(
    <BuildAnnouncer>
      <Harness />
    </BuildAnnouncer>,
  );
  const start = held.editor.layout;
  return {
    save,
    facts,
    start,
    get editor() {
      return held.editor;
    },
    get layout() {
      return held.editor.layout;
    },
    /** The layout passes the stored shape's check and reads in build order. */
    sound() {
      const { layout, measure } = held.editor;
      expect(mapLayoutRefusal(layout)).toBeNull();
      expect(orderRefusal(layout, geometryOf(layout, measure as NonNullable<typeof measure>), facts)).toBeNull();
    },
    /** The step just taken is exactly one: one undo brings back `before` and leaves nothing to undo. */
    oneStep(before: MapLayout) {
      expect(held.editor.canUndo).toBe(true);
      act(() => held.editor.undo());
      expect(held.editor.layout).toEqual(before);
      act(() => held.editor.redo());
    },
  };
}

const boxEl = (id: string) => document.querySelector<HTMLElement>(`[data-testid="map-box"][data-box-id="${id}"]`) as HTMLElement;
const select = (id: string, add = false) => fireEvent.click(boxEl(id), { shiftKey: add });
const column = () => screen.getByTestId("map-canvas-column");
const press = (key: string, init: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.activeElement && column().contains(document.activeElement) ? document.activeElement : column(), { key, ...init });
const refusal = () => screen.queryByTestId("map-refusal")?.textContent ?? null;
const edgeEl = (split: string, index: number, axis: SharedEdge["axis"] = "width") =>
  screen.getAllByTestId("map-edge").find((el) => el.dataset.split === split && el.dataset.index === String(index) && el.dataset.axis === axis) as HTMLElement;
/** Either kind of edge, with every place a test reads. */
type AnyEdge = SharedEdge & { x: number; top: number; bottom: number; y: number; left: number; right: number };
const edgeOf = (state: MapEditorState, split: string, index: number, axis: SharedEdge["axis"] = "width") =>
  state.geometry?.edges.find((edge) => edge.splitId === split && edge.index === index && edge.axis === axis) as AnyEdge;
const sizesOf = (layout: MapLayout, id: string) => (nodeById(layout, id) as MapSplit).sizes;
const S1 = "m-box-typed-s1";
const S2 = "m-box-typed-s2";
const ROW = "m-ws-a-row-0";

async function openSplit(choice: "across" | "down") {
  press("s");
  fireEvent.click(await screen.findByTestId(choice === "across" ? "map-split-across" : "map-split-down"));
}

/* ── Part 1: Split ── */

describe("Split", () => {
  it("S opens Side by side and Top and bottom; the cut shows at the middle with a preview; Enter splits, one undo step", async () => {
    const map = draw();
    const before = map.layout;
    act(() => boxEl(S2).focus());
    await openSplit("across");
    const rect = map.editor.geometry?.nodes[S2] as NonNullable<MapEditorState["geometry"]>["nodes"][string];
    const cut = Number(screen.getByTestId("map-split-cut").dataset.cut);
    expect(Math.abs(cut - (rect.x + rect.width / 2))).toBeLessThan(MAP_GRID.snap + 1);
    expect(screen.getAllByTestId("map-preview-box").length).toBe(boxes(before).length + 1);
    expect(map.layout).toBe(before);
    press("Enter");
    expect(boxes(map.layout).length).toBe(boxes(before).length + 1);
    // The new half is empty, selected, and shows the maker where its tiles come from.
    const fresh = boxes(map.layout).find((box) => !boxes(before).some((was) => was.id === box.id));
    expect(fresh?.tiles).toEqual([]);
    expect(map.editor.selected).toEqual([fresh?.id]);
    expect(within(boxEl(fresh?.id as string)).getByTestId("map-empty-hint")).toHaveTextContent("Drop tiles from Session 2 here");
    expect(screen.queryByTestId("map-preview")).toBeNull();
    map.sound();
    map.oneStep(before);
  });

  it("the line under a new half is the maker's: never saved", async () => {
    const map = draw();
    select(S2);
    await openSplit("across");
    press("Enter");
    await waitFor(() => expect(map.save).toHaveBeenCalled());
    expect(JSON.stringify(map.save.mock.calls.at(-1)?.[0])).not.toContain("Drop tiles");
  });

  it("dragging the cut moves it and snaps; a click splits there", async () => {
    const map = draw();
    select(S2);
    await openSplit("across");
    const area = screen.getByTestId("map-split-area");
    const rect = map.editor.geometry?.nodes[S2] as { x: number; width: number };
    const line = (map.editor.geometry?.columnLines ?? []).filter((_, at) => at % 2 === 1).find((x) => x > rect.x + 200 && x < rect.x + rect.width - 200) as number;
    fireEvent.pointerDown(area, { clientX: rect.x + 40, clientY: 50, pointerId: 1 });
    // Pointer at the gutter's middle, 3px off a grid column's edge: the cut snaps onto it.
    fireEvent.pointerMove(area, { clientX: line + 3 + MAP_GRID.gutter / 2, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    expect(screen.getByTestId("map-snap-guide")).toBeTruthy();
    expect(Number(screen.getByTestId("map-split-cut").dataset.cut)).toBe(Math.round(line + MAP_GRID.gutter / 2));
    const before = map.layout;
    fireEvent.pointerDown(area, { clientX: 10, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    const left = map.editor.geometry?.nodes[S2] as { x: number; width: number };
    expect(left.x + left.width).toBe(line);
    map.sound();
    map.oneStep(before);
  });

  it("the arrows step the cut; Escape cancels and changes nothing", async () => {
    const map = draw();
    const before = map.layout;
    select(S2);
    await openSplit("across");
    const first = Number(screen.getByTestId("map-split-cut").dataset.cut);
    press("ArrowRight");
    expect(Number(screen.getByTestId("map-split-cut").dataset.cut)).toBeGreaterThan(first);
    press("Escape");
    expect(screen.queryByTestId("map-split-cut")).toBeNull();
    expect(screen.queryByTestId("map-preview")).toBeNull();
    expect(map.layout).toBe(before);
    expect(map.editor.selected).toEqual([S2]);
  });

  it("Top and bottom keeps the contents in the first half and never cuts above them", async () => {
    const map = draw();
    const before = map.layout;
    select(S2);
    await openSplit("down");
    press("ArrowUp");
    press("ArrowUp");
    press("Enter");
    const kept = nodeById(map.layout, S2);
    expect(kept?.kind === "box" && kept.tiles).toEqual(["p4", "c5", "k6"]);
    map.sound();
    map.oneStep(before);
  });

  it("refuses a box too narrow to split, with the px it needs, and changes nothing", async () => {
    const map = draw();
    select(S2);
    await openSplit("across");
    press("Enter");
    const half = map.editor.selected[0];
    const before = map.layout;
    const rect = map.editor.geometry?.nodes[half] as { width: number };
    const needs = Math.ceil(2 * minBoxWidth(map.layout.width) + MAP_GRID.gutter - rect.width);
    await openSplit("across");
    expect(refusal()).toBe(MAP_SHAPING_COPY.needsRoom(needs));
    expect(screen.queryByTestId("map-split-cut")).toBeNull();
    expect(map.layout).toBe(before);
  });
});

/* ── Part 2: Merge ── */

/** A tool's button: unavailable (with its reason as title and accessible description) or not. */
function why(testId: string): string | null {
  const button = screen.getByTestId(testId);
  if (button.getAttribute("aria-disabled") !== "true") return null;
  expect(button.getAttribute("title")).toBeTruthy();
  expect(button).toHaveAccessibleDescription(button.getAttribute("title") as string);
  return button.getAttribute("title");
}

describe("Merge", () => {
  it("joins two halves of one session back into one box, tiles in build order, as one undo step", async () => {
    const map = draw();
    select(S2);
    await openSplit("across");
    press("Enter");
    const half = map.editor.selected[0];
    const before = map.layout;
    select(S2);
    select(half, true);
    expect(why("map-merge")).toBeNull();
    fireEvent.click(screen.getByTestId("map-merge"));
    expect(nodeById(map.layout, half)).toBeNull();
    const merged = nodeById(map.layout, S2);
    expect(merged?.kind === "box" && merged.tiles).toEqual(["p4", "c5", "k6"]);
    map.sound();
    map.oneStep(before);
  });

  it("is unavailable for two sessions, and for boxes that don't share an edge, saying why; pressing it changes nothing", async () => {
    const map = draw();
    const before = map.layout;
    select(S1);
    select(S2, true);
    expect(why("map-merge")).toBe(MAP_LAYOUT_COPY.differentSessions);
    fireEvent.click(screen.getByTestId("map-merge"));
    expect(refusal()).toBe(MAP_LAYOUT_COPY.differentSessions);
    expect(map.layout).toBe(before);
    // S2 split top and bottom twice: its first box and the last new one are a box apart.
    select(S2);
    await openSplit("down");
    press("Enter");
    const last = map.editor.selected[0];
    select(S2);
    await openSplit("down");
    press("Enter");
    const after = map.layout;
    select(S2);
    select(last, true);
    expect(why("map-merge")).toBe(MAP_LAYOUT_COPY.notNeighbours);
    fireEvent.click(screen.getByTestId("map-merge"));
    expect(map.layout).toBe(after);
  });
});

/* ── Part 3: Shared edge ── */

/** Drag an edge's hit area by `by` px along its axis (Alt with `alt`), checking along the way, then let go. */
function drag(el: HTMLElement, edge: SharedEdge, by: number, { alt = false, during }: { alt?: boolean; during?: () => void } = {}) {
  const from = edge.axis === "width" ? { clientX: edge.x + MAP_GRID.gutter / 2, clientY: (edge.top + edge.bottom) / 2 } : { clientX: (edge.left + edge.right) / 2, clientY: edge.y + MAP_GRID.gutter / 2 };
  const to = edge.axis === "width" ? { ...from, clientX: from.clientX + by } : { ...from, clientY: from.clientY + by };
  fireEvent.pointerDown(el, { ...from, altKey: alt, pointerId: 1 });
  fireEvent.pointerMove(el, { ...to, altKey: alt, pointerId: 1 });
  during?.();
  fireEvent.pointerUp(el, { ...to, pointerId: 1 });
}

describe("Shared edge", () => {
  it("hovering a gutter shows the edge; edges are for the pointer only, and the keyboard way is in each box's description", () => {
    draw();
    const el = edgeEl(ROW, 0);
    expect(el.style.cursor).toBe("col-resize");
    expect(screen.getByTestId("map-shaping-layer").getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByTestId("map-edge-line")).toBeNull();
    fireEvent.pointerEnter(el);
    expect(screen.getByTestId("map-edge-line").style.width).toBe("2px");
    fireEvent.pointerLeave(el);
    expect(screen.queryByTestId("map-edge-line")).toBeNull();
    expect(boxEl(S1)).toHaveAccessibleDescription(MAP_SHAPING_COPY.resizeKeys);
  });

  it("dragging moves the edge with moveEdge, previews it with both widths, snaps to the grid, and is one undo step", () => {
    const map = draw();
    const before = map.layout;
    const edge = edgeOf(map.editor, ROW, 0);
    const line = (map.editor.geometry?.columnLines ?? []).filter((_, at) => at % 2 === 1).find((x) => x > edge.x + 60) as number;
    drag(edgeEl(ROW, 0), edge, line - edge.x + 4, {
      during: () => {
        expect(screen.getByTestId("map-preview")).toBeTruthy();
        expect(screen.getByTestId("map-edge-readout").textContent).toMatch(/^\d+ px · \d+ px/);
        expect(screen.getByTestId("map-snap-guide")).toBeTruthy();
      },
    });
    expect(screen.queryByTestId("map-preview")).toBeNull();
    expect(edgeOf(map.editor, ROW, 0).x).toBe(line);
    expect(sizesOf(map.layout, ROW)[0]).toBeGreaterThan(sizesOf(before, ROW)[0]);
    map.sound();
    map.oneStep(before);
  });

  it("a height edge drags the box's extra height, never shorter than its contents", () => {
    const map = draw();
    const before = map.layout;
    const edge = edgeOf(map.editor, "m-root", 0, "height");
    drag(edgeEl("m-root", 0, "height"), edge, 40);
    expect(sizesOf(map.layout, "m-root")[0]).toBe(40);
    map.sound();
    map.oneStep(before);
    // Up past its contents: it stops at them, and with nothing changed there is no step.
    act(() => map.editor.undo());
    const plain = map.layout;
    drag(edgeEl("m-root", 0, "height"), edgeOf(map.editor, "m-root", 0, "height"), -80);
    expect(map.layout).toBe(plain);
  });

  it("Alt drags one box's edge where a single box faces it; otherwise it says so once and moves the shared edge", async () => {
    const map = draw();
    const said = screen.getByTestId("build-announcer");
    drag(edgeEl(ROW, 0), edgeOf(map.editor, ROW, 0), 60, { alt: true, during: () => expect(screen.getByTestId("map-edge-readout").textContent).not.toContain(MAP_SHAPING_COPY.altFallback) });
    expect(sizesOf(map.layout, ROW)[0]).toBeGreaterThan(0.5);
    // S2 split top and bottom: two boxes face S1 across the edge now.
    select(S2);
    await openSplit("down");
    press("Enter");
    const before = map.layout;
    drag(edgeEl(ROW, 0), edgeOf(map.editor, ROW, 0), -60, { alt: true, during: () => expect(screen.getByTestId("map-edge-readout").textContent).toContain(MAP_SHAPING_COPY.altFallback) });
    await waitFor(() => expect(said).toHaveTextContent(/Edge moved/));
    expect(sizesOf(map.layout, ROW)[0]).toBeLessThan(sizesOf(before, ROW)[0]);
    map.sound();
    map.oneStep(before);
  });

  it("edges in line move together, through frames; Alt moves only the row's own", async () => {
    const map = draw("fiftyTiles");
    const ROW_A = "m-ws-a-row-0";
    const F3 = "m-box-typed-f3";
    // Part A: S1 and S2 side by side, S3 across below. Split S3 with its cut under S1 and S2's edge: they line up.
    const x = edgeOf(map.editor, ROW_A, 0).x;
    select(F3);
    await openSplit("across");
    const area = screen.getByTestId("map-split-area");
    fireEvent.pointerDown(area, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: x + MAP_GRID.gutter / 2, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    fireEvent.pointerDown(area, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });
    const under = (map.editor.geometry?.edges ?? []).find((edge) => edge.axis === "width" && edge.splitId !== ROW_A && Math.abs((edge as AnyEdge).x - x) < 1) as AnyEdge;
    expect(under).toBeTruthy();
    // Part B's row lines up below it too, with nothing across the line: hovering one shows all three, dragging moves them.
    fireEvent.pointerEnter(edgeEl(ROW_A, 0));
    expect(screen.getAllByTestId("map-edge-line")).toHaveLength(3);
    fireEvent.pointerLeave(edgeEl(ROW_A, 0));
    const lined = map.layout;
    drag(edgeEl(ROW_A, 0), edgeOf(map.editor, ROW_A, 0), 82);
    const moved = edgeOf(map.editor, ROW_A, 0).x;
    expect(moved).toBeGreaterThan(x + 40);
    expect(edgeOf(map.editor, under.splitId, under.index).x).toBeCloseTo(moved, 0);
    expect(edgeOf(map.editor, "m-ws-b-row-0", 0).x).toBeCloseTo(moved, 0);
    map.sound();
    map.oneStep(lined);
    // With Alt, S1 and S2 face each other along the whole edge: only their row moves.
    act(() => map.editor.undo());
    drag(edgeEl(ROW_A, 0), edgeOf(map.editor, ROW_A, 0), 82, { alt: true });
    expect(edgeOf(map.editor, ROW_A, 0).x).toBeGreaterThan(x + 40);
    expect(edgeOf(map.editor, under.splitId, under.index).x).toBeCloseTo(x, 0);
    map.sound();
  });

  it("edges in line with a box across the line between them are not one edge", () => {
    const map = draw("fiftyTiles");
    // Part A's and Part B's rows line up, but Part A's S3 spans between them.
    expect(Math.abs(edgeOf(map.editor, "m-ws-a-row-0", 0).x - edgeOf(map.editor, "m-ws-b-row-0", 0).x)).toBeLessThan(1);
    fireEvent.pointerEnter(edgeEl("m-ws-a-row-0", 0));
    expect(screen.getAllByTestId("map-edge-line")).toHaveLength(1);
  });

  it("Ctrl or Cmd and the arrows move a box's edges a grid step; where it has no such edge, it says so", () => {
    const map = draw();
    select(S1);
    act(() => boxEl(S1).focus());
    const before = map.layout;
    const x = edgeOf(map.editor, ROW, 0).x;
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    const moved = edgeOf(map.editor, ROW, 0).x;
    expect(moved).toBeGreaterThan(x);
    expect((map.editor.geometry?.columnLines ?? []).includes(moved)).toBe(true);
    map.sound();
    map.oneStep(before);
    // S1 has no left edge: nothing changes.
    const now = map.layout;
    press("ArrowLeft", { ctrlKey: true, metaKey: true });
    expect(refusal()).toBe(MAP_SHAPING_COPY.cantMove);
    expect(map.layout).toBe(now);
    // Down grows S1's row by the 8px rhythm; Up on S2 (whose row is the first) has no top edge.
    press("ArrowDown", { ctrlKey: true, metaKey: true });
    expect(sizesOf(map.layout, "m-root")[0]).toBe(MAP_GRID.rhythm);
  });
});

/* ── Part 4: Span, Even out, Match ── */

const F = (n: number) => `m-box-typed-f${n}`;

describe("Span", () => {
  it("stretches a box across its row inside its frame, its row-mates below, as one undo step", () => {
    const map = draw();
    const before = map.layout;
    select(S2);
    expect(why("map-span")).toBeNull();
    fireEvent.click(screen.getByTestId("map-span"));
    const s1 = map.editor.geometry?.nodes[S1] as { y: number };
    const s2 = map.editor.geometry?.nodes[S2] as { y: number; width: number };
    expect(s2.y).toBeLessThan(s1.y);
    expect(s2.width).toBeGreaterThan((map.editor.geometry?.width ?? 0) / 2 + 100);
    map.sound();
    map.oneStep(before);
  });

  it("is unavailable where the row-mates moving down would break the order, naming the tiles, and where the box already spans", () => {
    const map = draw();
    const before = map.layout;
    select(S1);
    // S2 below S1 would put Prompt 4 after Prompt 3, which uses it.
    const fact = map.facts.facts.find((each) => each.before === "p4" && each.after === "p3");
    expect(why("map-span")).toBe(fact?.sentence);
    fireEvent.click(screen.getByTestId("map-span"));
    expect(refusal()).toBe(fact?.sentence);
    expect(map.layout).toBe(before);
    select("m-result-r9");
    expect(why("map-span")).toBe(MAP_LAYOUT_COPY.alreadySpans);
  });
});

describe("Even out", () => {
  it("one box evens its whole row; already even, it says so", () => {
    const map = draw("fiftyTiles");
    select(F(1));
    expect(why("map-even-out")).toBe(MAP_SHAPING_COPY.alreadyEven);
    act(() => boxEl(F(1)).focus());
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    const before = map.layout;
    expect(why("map-even-out")).toBeNull();
    fireEvent.click(screen.getByTestId("map-even-out"));
    expect(sizesOf(map.layout, "m-ws-a-row-0")).toEqual([0.5, 0.5]);
    map.sound();
    map.oneStep(before);
  });

  it("is offered for boxes of one split, not for boxes of two", () => {
    draw("fiftyTiles");
    select(F(1));
    select(F(2), true);
    expect(screen.getByTestId("map-even-out")).toBeTruthy();
    select(F(1));
    select(F(4), true);
    expect(screen.queryByTestId("map-even-out")).toBeNull();
  });
});

describe("Match", () => {
  it("gives the boxes the first one's width, as one undo step; already matching, it says so", () => {
    const map = draw("fiftyTiles");
    select(F(1));
    select(F(4), true);
    expect(why("map-match-width")).toBe(MAP_SHAPING_COPY.alreadyMatch);
    select(F(1));
    act(() => boxEl(F(1)).focus());
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    const before = map.layout;
    select(F(1));
    select(F(4), true);
    expect(why("map-match-width")).toBeNull();
    fireEvent.click(screen.getByTestId("map-match-width"));
    const width = (id: string) => map.editor.geometry?.nodes[id].width as number;
    expect(width(F(4))).toBeCloseTo(width(F(1)), 0);
    map.sound();
    map.oneStep(before);
  });

  it("refuses with the box in the way, and a box whose split runs the other way; nothing changes", async () => {
    const map = draw("fiftyTiles");
    select(F(1));
    select(F(4), true);
    expect(why("map-match-height")).toBe(MAP_LAYOUT_COPY.cantMatch("Box · S1", "height"));
    // S5 in two halves needs more room than S1's width leaves beside S4.
    select(F(5));
    await openSplit("across");
    press("Enter");
    select(F(1));
    act(() => boxEl(F(1)).focus());
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    const before = map.layout;
    select(F(1));
    select(F(4), true);
    expect(why("map-match-width")).toBe(MAP_SHAPING_COPY.inTheWay("Box · S5", Math.ceil(minBoxWidth(map.layout.width))));
    fireEvent.click(screen.getByTestId("map-match-width"));
    expect(map.layout).toBe(before);
  });
});

/* ── Part 5: previews ── */

describe("previews", () => {
  it("Span, Even out and Match show their result at 60% on hover or focus, and leaving clears it; nothing changes", () => {
    const map = draw("fiftyTiles");
    const before = map.layout;
    select(F(1));
    act(() => boxEl(F(1)).focus());
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    const uneven = map.layout;
    for (const testId of ["map-span", "map-even-out"]) {
      const button = screen.getByTestId(testId);
      fireEvent.mouseEnter(button);
      const preview = screen.getByTestId("map-preview");
      expect(preview.style.opacity).toBe("0.6");
      expect(preview.getAttribute("aria-hidden")).toBe("true");
      fireEvent.mouseLeave(button);
      expect(screen.queryByTestId("map-preview")).toBeNull();
      act(() => button.focus());
      expect(screen.getByTestId("map-preview")).toBeTruthy();
      act(() => button.blur());
      expect(screen.queryByTestId("map-preview")).toBeNull();
    }
    select(F(1));
    select(F(4), true);
    fireEvent.mouseEnter(screen.getByTestId("map-match-width"));
    expect(screen.getByTestId("map-preview")).toBeTruthy();
    fireEvent.mouseLeave(screen.getByTestId("map-match-width"));
    expect(screen.queryByTestId("map-preview")).toBeNull();
    expect(map.layout).toBe(uneven);
    expect(uneven).not.toBe(before);
  });

  it("an unavailable tool shows no preview; a new selection clears one", () => {
    draw();
    select(S1);
    fireEvent.mouseEnter(screen.getByTestId("map-span"));
    expect(screen.queryByTestId("map-preview")).toBeNull();
    select(S2);
    fireEvent.mouseEnter(screen.getByTestId("map-span"));
    expect(screen.getByTestId("map-preview")).toBeTruthy();
    select(S1);
    expect(screen.queryByTestId("map-preview")).toBeNull();
  });
});

/* ── Part 6: every tool leaves a sound map ── */

describe("after every tool", () => {
  it.each([
    ["supportInbox", { first: S1, second: S2, row: ROW }],
    ["fiftyTiles", { first: F(1), second: F(2), row: "m-ws-a-row-0" }],
  ] as const)("%s: the layout passes mapLayoutRefusal and orderRefusal", async (name, { first, second, row }) => {
    const map = draw(name);
    map.sound();
    let steps = 0;
    const changed = (before: MapLayout) => {
      expect(map.layout).not.toBe(before);
      map.sound();
      steps += 1;
    };
    let before = map.layout;
    // Split side by side, then top and bottom.
    select(second);
    await openSplit("across");
    press("Enter");
    changed(before);
    before = map.layout;
    select(second);
    await openSplit("down");
    press("Enter");
    changed(before);
    // Merge the side-by-side half back.
    before = map.layout;
    const lower = map.editor.selected[0];
    select(second);
    select(lower, true);
    fireEvent.click(screen.getByTestId("map-merge"));
    changed(before);
    // A shared edge, a height, and the keys.
    before = map.layout;
    drag(edgeEl(row, 0), edgeOf(map.editor, row, 0), 60);
    changed(before);
    before = map.layout;
    drag(edgeEl("m-root", 0, "height"), edgeOf(map.editor, "m-root", 0, "height"), 32);
    changed(before);
    before = map.layout;
    select(first);
    act(() => boxEl(first).focus());
    press("ArrowRight", { ctrlKey: true, metaKey: true });
    changed(before);
    // Even out the row, match two boxes, span one.
    before = map.layout;
    select(first);
    fireEvent.click(screen.getByTestId("map-even-out"));
    changed(before);
    // The first box takes the width of the second, now half of its old width.
    before = map.layout;
    select(second);
    select(first, true);
    fireEvent.click(screen.getByTestId("map-match-width"));
    changed(before);
    before = map.layout;
    select(second);
    fireEvent.click(screen.getByTestId("map-span"));
    changed(before);
    expect(steps).toBe(9);
    // Each was one step: nine undos bring back the plain arrangement.
    for (let at = 0; at < steps; at += 1) act(() => map.editor.undo());
    expect(map.layout).toEqual(map.start);
    expect(map.editor.canUndo).toBe(false);
  });
});
