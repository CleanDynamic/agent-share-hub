// UX-02 P1: where a file dropped on the List lands, and where a new tile stands among its session's tiles. Pure.

import { describe, expect, it } from "vitest";

import { afterForIndex, fileDropPlace, type DropSession } from "./fileDrop";

const box = (y: number, h: number) => ({ x: 0, y, w: 600, h });

/** Session 1 (head 0..40, tiles a 50..110, b 120..180, box 0..230), Session 2 (head 250..290, tile c 300..360, box 250..410). */
const sessions: DropSession[] = [
  { key: "s1", box: box(0, 230), head: box(0, 40), tiles: [{ id: "a", box: box(50, 60) }, { id: "b", box: box(120, 60) }] },
  { key: "s2", box: box(250, 160), head: box(250, 40), tiles: [{ id: "c", box: box(300, 60) }] },
];

describe("UX-02 P1 · fileDropPlace", () => {
  it("a drop on a session's head is a new tile at that session's end", () => {
    expect(fileDropPlace({ x: 10, y: 260 }, sessions)).toEqual({ session: "s2", index: 1 });
  });
  it("a drop in the gap after a session's last tile is a new tile there", () => {
    expect(fileDropPlace({ x: 10, y: 200 }, sessions)).toEqual({ session: "s1", index: 2 });
  });
  it("a drop in the gap between two tiles is a new tile between them", () => {
    expect(fileDropPlace({ x: 10, y: 115 }, sessions)).toEqual({ session: "s1", index: 1 });
  });
  it("a drop on the upper half of a tile goes before it, on the lower half after it", () => {
    expect(fileDropPlace({ x: 10, y: 60 }, sessions)).toEqual({ session: "s1", index: 0 });
    expect(fileDropPlace({ x: 10, y: 100 }, sessions)).toEqual({ session: "s1", index: 1 });
  });
  it("a drop outside every session is no place: the page puts it at the end of the current session", () => {
    expect(fileDropPlace({ x: 10, y: 240 }, sessions)).toBeNull();
    expect(fileDropPlace({ x: 10, y: 900 }, sessions)).toBeNull();
  });
});

describe("UX-02 P1 · afterForIndex", () => {
  const top = ["a", "b", "c", "d"];
  it("at the end of the session: nothing to move (a new tile is placed last)", () => {
    expect(afterForIndex(top, ["c", "d"], 2)).toBeUndefined();
  });
  it("after the tile before the gap", () => {
    expect(afterForIndex(top, ["c", "d"], 1)).toBe("c");
  });
  it("first in a session: after the step that stands before the session's first tile", () => {
    expect(afterForIndex(top, ["c", "d"], 0)).toBe("b");
  });
  it("first in the first session: at the start", () => {
    expect(afterForIndex(top, ["a", "b"], 0)).toBeNull();
  });
  it("an empty session: at the end", () => {
    expect(afterForIndex(top, [], 0)).toBeUndefined();
  });
});
