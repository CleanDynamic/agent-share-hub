// UX-02 P1: a file dropped on the List becomes a File step tile, and the List is told it is an add (`motion.expect`) with the new
// tile's id before the tile is drawn. The composer mounted for real on the CA-20 draft; only the network and the file store are faked.
// jsdom draws no boxes, so where the pointer is over is given by stubbing the boxes of the session, its head and its tiles.

import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.mock("@/lib/build/media", async (importOriginal) => {
  let n = 0;
  return { ...(await importOriginal<typeof import("@/lib/build/media")>()), uploadMedia: vi.fn(async () => ({ id: `0f0f0f0f-0000-4000-8000-${String(++n).padStart(12, "0")}` })) };
});

import { tableRows } from "@/lib/build/__audit__/fakeSupabase";

import { IDS, KEY_A, KEY_B, seedCa20 } from "./ca20Fixture";
import { DRAFT, harnessAfter, harnessBefore, mountCa20 } from "./ca20Harness";
import { MotionChannel } from "./listMotion";

type Rect = { x: number; y: number; w: number; h: number };

/** Boxes by what an element is: a session's run by its key, a head inside it, a tile's card by its node id. Everything else is empty. */
function stubBoxes(boxes: { sessions?: Record<string, Rect>; heads?: Record<string, Rect>; tiles?: Record<string, Rect> }) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const key = this.getAttribute("data-session-key");
    const node = this.getAttribute("data-node-id");
    const headOf = this.getAttribute("data-testid") === "session-head" ? this.closest("[data-session-key]")?.getAttribute("data-session-key") : null;
    const r = (key && boxes.sessions?.[key]) || (headOf && boxes.heads?.[headOf]) || (node && boxes.tiles?.[node]) || { x: 0, y: 0, w: 0, h: 0 };
    return { x: r.x, y: r.y, left: r.x, top: r.y, width: r.w, height: r.h, right: r.x + r.w, bottom: r.y + r.h, toJSON: () => r } as DOMRect;
  });
}

const fileTiles = () => tableRows("build_nodes").filter((row) => row.build_id === DRAFT && row.type === "document" && (row.payload as { step?: boolean }).step === true);

function drop(target: HTMLElement, at: { x: number; y: number }, name = "notes.md") {
  const file = new File(["# Notes\n\nWhat the poster says."], name, { type: "text/markdown" });
  // jsdom has no DragEvent, so the point is set on the event itself.
  const event = createEvent.drop(target, { dataTransfer: { types: ["Files"], files: [file], items: [], dropEffect: "copy" } });
  Object.defineProperties(event, { clientX: { value: at.x }, clientY: { value: at.y } });
  fireEvent(target, event);
}

/** The top-level steps of a session in their order as stored. */
const sessionOrder = (key: string) =>
  tableRows("build_nodes")
    .filter((row) => row.build_id === DRAFT && row.parent_id === null && (row.payload as { session?: string }).session === key)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.id);

beforeEach(() => {
  harnessBefore();
  // A computer with a mouse: the List takes dropped files.
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? 1600 >= Number(min[1]) : max ? 1600 <= Number(max[1]) : /pointer:\s*fine|hover:\s*hover/.test(query);
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
});
afterEach(harnessAfter);

describe("UX-02 P1 · a dropped file becomes a step tile", () => {
  it("dropped on the List outside every session: a File step tile at the end of the current session, labelled an add with its id", async () => {
    await mountCa20(seedCa20, { wide: true });
    const expect_ = vi.spyOn(MotionChannel.prototype, "expect");
    drop(screen.getByTestId("build-list"), { x: 5000, y: 5000 });
    await waitFor(() => expect(fileTiles()).toHaveLength(1), { timeout: 10_000 });
    const [tile] = fileTiles();
    expect(expect_).toHaveBeenCalledWith(expect.objectContaining({ kind: "add", keys: [tile.id] }));
    // Nothing chosen yet: the current session is the last one with a tile.
    expect((tile.payload as { session?: string }).session).toBeTruthy();
  });

  it("dropped on Session 2's head: a File step tile at the end of Session 2", async () => {
    await mountCa20(seedCa20, { wide: true });
    stubBoxes({ sessions: { [KEY_B]: { x: 0, y: 300, w: 600, h: 300 } }, heads: { [KEY_B]: { x: 0, y: 300, w: 600, h: 40 } } });
    const expect_ = vi.spyOn(MotionChannel.prototype, "expect");
    drop(screen.getByTestId("build-list"), { x: 20, y: 310 });
    await waitFor(() => expect(fileTiles()).toHaveLength(1), { timeout: 10_000 });
    const [tile] = fileTiles();
    expect((tile.payload as { session?: string }).session).toBe(KEY_B);
    await waitFor(() => expect(sessionOrder(KEY_B)).toEqual([IDS.team, IDS.p3, IDS.p4, tile.id]));
    expect(expect_).toHaveBeenCalledWith(expect.objectContaining({ kind: "add", keys: [tile.id] }));
  });

  it("dropped in the gap between Session 1's two tiles: a File step tile between them", async () => {
    await mountCa20(seedCa20, { wide: true });
    stubBoxes({
      sessions: { [KEY_A]: { x: 0, y: 0, w: 600, h: 240 } },
      heads: { [KEY_A]: { x: 0, y: 0, w: 600, h: 40 } },
      tiles: { [IDS.p1]: { x: 0, y: 50, w: 600, h: 60 }, [IDS.p2]: { x: 0, y: 120, w: 600, h: 60 } },
    });
    const expect_ = vi.spyOn(MotionChannel.prototype, "expect");
    drop(screen.getByTestId("build-list"), { x: 20, y: 115 });
    await waitFor(() => expect(fileTiles()).toHaveLength(1), { timeout: 10_000 });
    const [tile] = fileTiles();
    await waitFor(() => expect(sessionOrder(KEY_A)).toEqual([IDS.p1, tile.id, IDS.p2]));
    expect(expect_).toHaveBeenCalledWith(expect.objectContaining({ kind: "add", keys: [tile.id] }));
  });

  it("dropped on Sources: a source file, not a step tile, as before", async () => {
    await mountCa20(seedCa20, { wide: true });
    // UX-02 P8: the whole panel takes the drop.
    const zone = await screen.findByTestId("sources-panel", undefined, { timeout: 10_000 });
    drop(zone, { x: 0, y: 0 });
    await waitFor(() => expect(tableRows("build_nodes").filter((row) => row.build_id === DRAFT && row.type === "document" && (row.payload as { title?: string }).title === "notes.md")).toHaveLength(1), { timeout: 10_000 });
    expect(fileTiles()).toHaveLength(0);
  });
});
