// MS-06 Part 7 — the editor shell: selection, the floating bar, removing a box, placing a tile, Numbers, keys.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REMOVED_TILE_ID, mapSandboxFixture } from "@/dev/fixtures/mapSandbox";
import { mapLayoutOf, type MapLayout } from "@/lib/build/mapLayout";

import { FLOATING_BAR } from "./canvasRecipes";
import { MAP_EDITOR_UI_COPY, MapEditor, useMapEditorFor } from "./MapEditor";
import { CANVAS_TOP } from "./MapCanvas";

function width(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return { matches: min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}
beforeEach(() => width(1280));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fixture = mapSandboxFixture("supportInbox");
const build = { steps: [...fixture.steps], groups: [...fixture.groups], files: [...fixture.files], making: fixture.making, results: fixture.results };

function Harness({ save }: { save: (layout: MapLayout) => Promise<unknown> }) {
  const editor = useMapEditorFor({ ...build, stored: null, save });
  return <MapEditor editor={editor} {...build} />;
}

function draw() {
  const save = vi.fn((_layout: MapLayout) => Promise.resolve({}));
  render(<Harness save={save} />);
  return { save };
}

const boxNamed = (name: string) => screen.getAllByTestId("map-box").find((box) => box.getAttribute("aria-label") === name) as HTMLElement;
const titleOf = (box: HTMLElement) => within(box).getAllByText(/./)[0].closest("p") as HTMLElement;
const tileRow = (id: string) => screen.getAllByTestId("map-source-tile").find((row) => row.dataset.key === id) as HTMLElement;
const badge = (id: string) => within(screen.getAllByTestId("map-tile").find((tile) => tile.dataset.tileId === id) as HTMLElement).getByTestId("step-card").textContent ?? "";

describe("MapEditor", () => {
  it("lays out On the map, then the canvas column with its toolbar", () => {
    draw();
    expect(screen.getByRole("heading", { name: MAP_EDITOR_UI_COPY.heading })).toBeTruthy();
    expect(screen.getByTestId("map-sources-count")).toHaveTextContent("9 of 9 placed");
    expect(screen.getByRole("toolbar", { name: MAP_EDITOR_UI_COPY.toolbar })).toBeTruthy();
    // Parts, sessions and tiles in build order; every tile placed.
    const rows = screen.getAllByTestId(/^map-source-(part|session|tile)$/).map((row) => `${row.dataset.testid?.slice(11)}:${row.dataset.key}`);
    expect(rows.filter((row) => row.startsWith("tile")).map((row) => row.slice(5))).toEqual(["p1", "f2", "p3", "p4", "c5", "k6", "a7", "t8", "r9"]);
    expect(rows[0].startsWith("part")).toBe(true);
    expect(within(tileRow("p4")).getByText(MAP_EDITOR_UI_COPY.placedRow)).toBeTruthy();
  });

  it("under 1024 wide, On the map folds into a toolbar button", () => {
    width(900);
    draw();
    expect(screen.queryByRole("heading", { name: MAP_EDITOR_UI_COPY.heading })).toBeNull();
    expect(within(screen.getByTestId("map-toolbar")).getByRole("button", { name: MAP_EDITOR_UI_COPY.heading })).toBeTruthy();
  });

  it("selection: a box's title selects it, Shift adds a box, a tile selects alone, the background clears", () => {
    draw();
    const refund = boxNamed("Refund rules, Session 2");
    const classify = boxNamed("Classify, Session 1");
    fireEvent.click(titleOf(refund));
    expect(refund.dataset.selected).toBe("true");
    expect(within(refund).getAllByTestId("map-box-handle")).toHaveLength(8);
    fireEvent.click(titleOf(classify), { shiftKey: true });
    expect(classify.dataset.selected).toBe("true");
    expect(refund.dataset.selected).toBe("true");
    expect(screen.queryAllByTestId("map-box-handle")).toHaveLength(0);
    expect(screen.getByTestId("map-floating-name")).toHaveTextContent("2 boxes");
    const tile = screen.getAllByTestId("map-tile").find((each) => each.dataset.tileId === "c5") as HTMLElement;
    fireEvent.click(within(tile).getByTestId("step-card"));
    expect(tile.dataset.selected).toBe("true");
    expect(refund.dataset.selected).toBeUndefined();
    expect(screen.getByTestId("map-floating-name")).toHaveTextContent("Tile 5");
    fireEvent.click(screen.getByTestId("map-canvas"));
    expect(screen.queryByTestId("map-floating-bar")).toBeNull();
  });

  it("the floating bar names the box and sits above its top-right corner, clear of it", () => {
    draw();
    const refund = boxNamed("Refund rules, Session 2");
    fireEvent.click(titleOf(refund));
    const bar = screen.getByTestId("map-floating-bar");
    expect(bar.getAttribute("role")).toBe("toolbar");
    expect(screen.getByTestId("map-floating-name")).toHaveTextContent("Box · S2");
    const boxTop = parseFloat(refund.style.top) + CANVAS_TOP;
    const canvasWidth = parseFloat(screen.getByTestId("map-canvas").style.width);
    if (bar.dataset.place === "above") expect(parseFloat(bar.style.top) + FLOATING_BAR.height).toBeLessThanOrEqual(boxTop);
    else expect(parseFloat(bar.style.top)).toBeGreaterThanOrEqual(boxTop + parseFloat(refund.style.height));
    expect(parseFloat(bar.style.right)).toBeCloseTo(canvasWidth - (parseFloat(refund.style.left) + parseFloat(refund.style.width)));
  });

  it("the floating bar is a toolbar: the arrow keys move between its buttons", () => {
    draw();
    fireEvent.click(titleOf(boxNamed("Refund rules, Session 2")));
    // MS-07: the shaping tools come first; Remove is last, and the arrows wrap.
    const remove = screen.getByTestId("map-remove-box");
    remove.focus();
    fireEvent.keyDown(remove, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByTestId("map-split"));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(remove);
  });

  it("removing a box asks first, then its tiles go back to On the map, unplaced; undo puts it back", async () => {
    const { save } = draw();
    fireEvent.click(titleOf(boxNamed("Refund rules, Session 2")));
    fireEvent.click(screen.getByTestId("map-remove-box"));
    const window = await screen.findByTestId("map-remove-box-window");
    expect(window).toHaveTextContent("Remove Box · S2?");
    fireEvent.click(within(window).getByTestId("map-remove-box-confirm"));
    await waitFor(() => expect(screen.queryByTestId("map-remove-box-window")).toBeNull());
    expect(boxNamed("Refund rules, Session 2")).toBeUndefined();
    expect(screen.getByTestId("map-sources-count")).toHaveTextContent("6 of 9 placed");
    expect(within(tileRow("p4")).queryByText(MAP_EDITOR_UI_COPY.placedRow)).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    // Ctrl Z in the canvas column brings it back.
    fireEvent.keyDown(screen.getByTestId("map-canvas-column"), { key: "z", ctrlKey: true, metaKey: true });
    expect(boxNamed("Refund rules, Session 2")).toBeTruthy();
    expect(screen.getByTestId("map-sources-count")).toHaveTextContent("9 of 9 placed");
  });

  it("Place on map puts an unplaced tile back on the canvas", async () => {
    draw();
    fireEvent.click(titleOf(boxNamed("Refund rules, Session 2")));
    fireEvent.click(screen.getByTestId("map-remove-box"));
    fireEvent.click(within(await screen.findByTestId("map-remove-box-window")).getByTestId("map-remove-box-confirm"));
    await waitFor(() => expect(screen.getByTestId("map-sources-count")).toHaveTextContent("6 of 9 placed"));
    const trigger = within(tileRow("p4")).getByTestId("map-source-menu");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByTestId("map-place-on-map"));
    await waitFor(() => expect(screen.getByTestId("map-sources-count")).toHaveTextContent("7 of 9 placed"));
    expect(screen.getAllByTestId("map-tile").some((tile) => tile.dataset.tileId === "p4")).toBe(true);
  });

  it("a tile the build no longer has shows as removed, with Remove, which takes it off the canvas", () => {
    const gone = mapSandboxFixture("removedTile");
    const own = { steps: [...gone.steps], groups: [...gone.groups], files: [...gone.files], making: gone.making, results: gone.results };
    const stored = mapLayoutOf(gone.making);
    function Removed() {
      const editor = useMapEditorFor({ ...own, stored, save: () => Promise.resolve() });
      return <MapEditor editor={editor} {...own} />;
    }
    render(<Removed />);
    const row = screen.getAllByTestId("map-source-removed").find((each) => each.dataset.key === REMOVED_TILE_ID) as HTMLElement;
    expect(row).toHaveTextContent(MAP_EDITOR_UI_COPY.removed);
    expect(screen.getByTestId("map-removed-tile")).toBeTruthy();
    fireEvent.click(within(row).getByTestId("map-source-remove"));
    expect(screen.queryByTestId("map-removed-tile")).toBeNull();
    expect(screen.queryAllByTestId("map-source-removed")).toHaveLength(0);
  });

  it("Numbers changes the badges", () => {
    draw();
    expect(badge("p4").startsWith("4")).toBe(true);
    fireEvent.click(within(screen.getByRole("group", { name: MAP_EDITOR_UI_COPY.numbers })).getByRole("button", { name: MAP_EDITOR_UI_COPY.numbersSession }));
    expect(badge("p4").startsWith("S2·1")).toBe(true);
  });

  it("keys: Tab moves through boxes in reading order, Enter enters a box, arrows move between tiles, Escape leaves then clears", () => {
    draw();
    const canvas = screen.getByTestId("map-canvas");
    // The tab order inside the canvas is the boxes, in reading order: the tiles' cards are left out of it.
    const stops = [...canvas.querySelectorAll<HTMLElement>('[tabindex="0"]')];
    expect(stops.map((stop) => stop.getAttribute("aria-label"))).toEqual(["Classify, Session 1", "Refund rules, Session 2", "Draft and send, Session 3", "Result, Session 3"]);
    const refund = boxNamed("Refund rules, Session 2");
    act(() => refund.focus());
    expect(refund.dataset.selected).toBe("true");
    fireEvent.keyDown(refund, { key: "Enter" });
    const tiles = within(refund).getAllByTestId("map-tile");
    expect(document.activeElement).toBe(tiles[0]);
    fireEvent.keyDown(tiles[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(tiles[1]);
    expect(tiles[1].dataset.selected).toBe("true");
    fireEvent.keyDown(tiles[1], { key: "Escape" });
    expect(document.activeElement).toBe(refund);
    fireEvent.keyDown(refund, { key: "Escape" });
    expect(screen.queryByTestId("map-floating-bar")).toBeNull();
  });

  it("Delete removes the selected box (asking first); the List's keys don't reach the page from the canvas", async () => {
    draw();
    const listener = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener("keydown", listener);
    const refund = boxNamed("Refund rules, Session 2");
    act(() => refund.focus());
    fireEvent.keyDown(refund, { key: "Delete" });
    expect(await screen.findByTestId("map-remove-box-window")).toBeTruthy();
    // The map answered Delete itself: the page's listener never sees it.
    expect(listener).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: MAP_EDITOR_UI_COPY.cancel }));
    // Duplicate is the List's: it reaches the page already handled, so the page's shortcuts skip it.
    fireEvent.keyDown(refund, { key: "d", ctrlKey: true, metaKey: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.results[0].value).toBe(true);
    document.removeEventListener("keydown", listener);
  });
});
