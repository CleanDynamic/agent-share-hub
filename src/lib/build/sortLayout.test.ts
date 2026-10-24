// CA-21 P2: the skeleton's geometry for a tile, a session and a part held.

import { describe, expect, it } from "vitest";

import { LANE_RADIUS, RAIL_ROOM, placeLine, skeletonOf, socketReach, type SkeletonContainer, type SkeletonInput, type SkeletonItem } from "./sortLayout";

const item = (id: string, container: string, y: number, h = 100, radius = 12): SkeletonItem => ({ id, container, rect: { x: 100, y, w: 400, h }, radius });
const base = (over: Partial<SkeletonInput> = {}): SkeletonInput => ({
  kind: "tile",
  items: [item("a", "s1", 0), item("b", "s1", 112), item("c", "s1", 224), item("d", "s2", 400)],
  containers: [
    { id: "s1", rect: { x: 100, y: 0, w: 400, h: 324 }, items: ["a", "b", "c"], framed: false, name: "Session 1" },
    { id: "s2", rect: { x: 100, y: 400, w: 400, h: 100 }, items: ["d"], framed: false, name: "Session 2" },
  ],
  held: "b",
  moved: false,
  room: 60,
  ...over,
});

describe("sockets", () => {
  it("sit 4 outside every component, with radius plus 4", () => {
    const { sockets } = skeletonOf(base());
    const a = sockets.find((socket) => socket.id === "a")!;
    expect(a.rect).toEqual({ x: 96, y: -4, w: 408, h: 108 });
    expect(a.radius).toBe(16);
  });

  it("sit half the gap outside where the gap is under 8, so neighbours never overlap", () => {
    const items = [item("a", "s", 0), item("b", "s", 106), item("c", "s", 212)];
    const reach = socketReach(items);
    expect(reach.get("a")).toBe(3);
    expect(reach.get("b")).toBe(3);
    const { sockets } = skeletonOf(base({ items, containers: [{ id: "s", rect: { x: 100, y: 0, w: 400, h: 312 }, items: ["a", "b", "c"], framed: false, name: "S" }] }));
    for (let at = 0; at < sockets.length - 1; at += 1) expect(sockets[at].rect.y + sockets[at].rect.h).toBeLessThanOrEqual(sockets[at + 1].rect.y);
  });

  it("keep 4 where the gap is 8 or more", () => {
    expect(socketReach([item("a", "s", 0), item("b", "s", 108)]).get("a")).toBe(4);
  });
});

describe("lanes", () => {
  it("surround each container 8 outside, radius 14", () => {
    const { lanes } = skeletonOf(base());
    expect(lanes[0]).toEqual({ id: "s1", rect: { x: 92, y: -8, w: 416, h: 340 }, radius: LANE_RADIUS, outline: true });
  });

  it("draw no second outline round a part, which has its own frame", () => {
    const parts: SkeletonContainer[] = [{ id: "pa", rect: { x: 100, y: 0, w: 400, h: 300 }, items: ["s1"], framed: true, name: "Part 1" }];
    const { lanes } = skeletonOf({ kind: "session", items: [item("s1", "pa", 40, 200)], containers: parts, held: "s1", moved: false, room: 60 });
    expect(lanes[0].outline).toBe(false);
  });
});

describe("rail and numbers", () => {
  it("number each place within its container and tick tiles at their middle", () => {
    const { rails } = skeletonOf(base());
    expect(rails.map((rail) => rail.ticks.map((tick) => tick.n))).toEqual([[1, 2, 3], [1]]);
    expect(rails[0].x).toBe(76);
    expect(rails[0].ticks[0]).toMatchObject({ y: 50, tickFrom: 78, tickTo: 88, numberRight: 74 });
    expect(rails[0].top).toBe(6);
    expect(rails[0].bottom).toBe(318);
  });

  it("tick a session or a part 22 below its top", () => {
    const { rails } = skeletonOf({ kind: "session", items: [item("s1", "pa", 40, 200)], containers: [{ id: "pa", rect: { x: 100, y: 30, w: 400, h: 230 }, items: ["s1"], framed: true, name: "Part 1" }], held: "s1", moved: false, room: 60 });
    expect(rails[0].ticks[0].y).toBe(62);
  });

  it("follow the order the page draws now: the numbers change as things slide", () => {
    const { rails } = skeletonOf(base({ containers: [{ id: "s1", rect: { x: 100, y: 0, w: 400, h: 324 }, items: ["b", "a", "c"], framed: false, name: "Session 1" }, { id: "s2", rect: { x: 100, y: 400, w: 400, h: 100 }, items: ["d"], framed: false, name: "Session 2" }] }));
    expect(rails[0].ticks.map((tick) => [tick.id, tick.n])).toEqual([["b", 1], ["a", 2], ["c", 3]]);
  });

  it("are left out under 40 of room, with the sockets and lanes kept", () => {
    const out = skeletonOf(base({ room: RAIL_ROOM - 1 }));
    expect(out.rails).toEqual([]);
    expect(out.sockets).toHaveLength(4);
    expect(out.lanes).toHaveLength(2);
    expect(skeletonOf(base({ room: RAIL_ROOM })).rails).toHaveLength(2);
  });
});

describe("the target", () => {
  it("is the held thing's place, a plain socket with no words while it is over its start", () => {
    const { target } = skeletonOf(base());
    expect(target).toMatchObject({ id: "b", words: null });
  });

  it("says where it lands once it has moved", () => {
    const { target } = skeletonOf(base({ moved: true }));
    expect(target?.words).toEqual({ lead: "Lands here", place: "Session 1 · 2 of 3" });
    expect(placeLine("Part 2", 0, 1)).toBe("Part 2 · 1 of 1");
    expect(placeLine("Build", 2, 4)).toBe("Build · 3 of 4");
  });
});
