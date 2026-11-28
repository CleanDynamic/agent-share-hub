// MS-06 Part 1 — the pure pieces the editor adds: `unplaceTile`, `sortTiles`, and legacy keys kept out of storage.

import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";
import { boxOfTile, boxes, mapLayoutRefusal, placedTiles, sortTiles, unplaceTile, type MapNode } from "./mapLayout";
import { forStorage, fromStorage, startFromBuild } from "./mapStart";

const plainOf = (name: Parameters<typeof mapSandboxFixture>[0]) => {
  const fixture = mapSandboxFixture(name);
  return { fixture, plain: startFromBuild(fixture.steps, fixture.groups, fixture.making, fixture.results) };
};

const sessionKeys = (node: MapNode): string[] =>
  node.kind === "box" ? [] : node.kind === "split" ? node.children.flatMap(sessionKeys) : ["session" in node.of ? [node.of.session] : [], sessionKeys(node.child)].flat();

describe("unplaceTile", () => {
  it("takes a tile out of its box, and the box with its last tile", () => {
    const { plain } = plainOf("supportInbox");
    const out = unplaceTile(plain, "p3");
    expect(out.ok && boxOfTile(out.layout, "p3")).toBe(null);
    expect(out.ok && placedTiles(out.layout)).toHaveLength(placedTiles(plain).length - 1);
    const lone = boxes(plain).find((box) => box.tiles.length === 1) as { id: string; tiles: string[] };
    const gone = unplaceTile(plain, lone.tiles[0]);
    expect(gone.ok && boxes(gone.layout).some((box) => box.id === lone.id)).toBe(false);
    expect(gone.ok && mapLayoutRefusal(gone.layout)).toBeNull();
  });

  it("refuses a tile that isn't placed, and keeps the last box empty", () => {
    const { plain } = plainOf("oneSession");
    expect(unplaceTile(plain, "nope").ok).toBe(false);
    let layout = plain;
    for (const tile of placedTiles(plain)) {
      const out = unplaceTile(layout, tile);
      expect(out.ok).toBe(true);
      if (out.ok) layout = out.layout;
    }
    expect(boxes(layout)).toHaveLength(1);
    expect(boxes(layout)[0].tiles).toEqual([]);
  });
});

describe("sortTiles", () => {
  it("puts every box's tiles in build order, and leaves a sorted layout as it is", () => {
    const { plain } = plainOf("supportInbox");
    const box = boxes(plain).find((each) => each.tiles.length > 1) as { id: string; tiles: string[] };
    const order = (tile: string) => box.tiles.length - box.tiles.indexOf(tile);
    const sorted = sortTiles(plain, order);
    expect(sorted.ok && boxes(sorted.layout).find((each) => each.id === box.id)?.tiles).toEqual([...box.tiles].reverse());
    const again = sortTiles(plain, (tile) => placedTiles(plain).indexOf(tile));
    expect(again.ok && again.layout).toBe(plain);
  });
});

describe("legacy keys", () => {
  it("are never written: a legacy session's region is stored by its first tile's id and read back by its key", () => {
    const { fixture, plain } = plainOf("legacy");
    const stored = forStorage(plain, fixture.steps, fixture.groups);
    // Keys, not ids: an id made from a key (`m-session-typed-legacy-1`) is only a name.
    expect([...sessionKeys(stored.root), ...stored.outlines].some((key) => key.startsWith("typed-legacy-"))).toBe(false);
    expect(sessionKeys(plain.root).some((key) => key.startsWith("typed-legacy-"))).toBe(true);
    expect(sessionKeys(stored.root).every((key) => fixture.steps.some((step) => step.id === key))).toBe(true);
    expect(fromStorage(stored, fixture.steps, fixture.groups)).toEqual(plain);
  });

  it("leave a build without legacy sessions alone", () => {
    const { fixture, plain } = plainOf("supportInbox");
    expect(forStorage(plain, fixture.steps, fixture.groups)).toBe(plain);
  });
});
