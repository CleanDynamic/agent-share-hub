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
const edgeOf = (state: MapEditorState, split: string, index: number, axis: SharedEdge["axis"] = "width") =>
  state.geometry?.edges.find((edge) => edge.splitId === split && edge.index === index && edge.axis === axis) as SharedEdge;
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
