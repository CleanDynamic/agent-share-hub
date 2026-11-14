// CA-21 P2: the skeleton's geometry for a tile, a session and a part held.

import { describe, expect, it } from "vitest";

import { LANE_RADIUS, RAIL_ROOM, RAIL_ROOM_ITEMS, placeLine, skeletonOf, socketReach, type SkeletonContainer, type SkeletonInput, type SkeletonItem } from "./sortLayout";

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

  it("wrap the sockets and nothing else: 4 outside the first and last socket, not round the session's header (G4)", () => {
    // The session's box starts 82 above its first tile (its header); the lane does not reach it.
    const { lanes, sockets } = skeletonOf(base({ containers: [{ id: "s1", rect: { x: 100, y: -82, w: 400, h: 406 }, items: ["a", "b", "c"], framed: false, name: "Session 1" }, { id: "s2", rect: { x: 100, y: 318, w: 400, h: 182 }, items: ["d"], framed: false, name: "Session 2" }] }));
    const mine = sockets.filter((socket) => ["a", "b", "c"].includes(socket.id));
    const top = Math.min(...mine.map((socket) => socket.rect.y));
    const bottom = Math.max(...mine.map((socket) => socket.rect.y + socket.rect.h));
    expect(lanes[0].rect).toEqual({ x: 92, y: top - 4, w: 416, h: bottom - top + 8 });
    expect(lanes[1].rect).toEqual({ x: 92, y: 392, w: 416, h: 116 });
  });

  it("keep a session with no tiles in its own place: 8 outside its box, as before (G4)", () => {
    const { lanes } = skeletonOf(base({ containers: [...base().containers, { id: "s3", rect: { x: 100, y: 600, w: 400, h: 60 }, items: [], framed: false, name: "Session 3" }] }));
    expect(lanes[2].rect).toEqual({ x: 92, y: 592, w: 416, h: 76 });
  });

  it("draw no second outline round a part, which has its own frame", () => {
    const parts: SkeletonContainer[] = [{ id: "pa", rect: { x: 100, y: 0, w: 400, h: 300 }, items: ["s1"], framed: true, name: "Part 1" }];
    const { lanes } = skeletonOf({ kind: "session", items: [item("s1", "pa", 40, 200)], containers: parts, held: "s1", moved: false, room: 60 });
    expect(lanes[0].outline).toBe(false);
  });
});

describe("rail and numbers", () => {
  it("number each place within its container and tick tiles 24 below the top of their socket (G5)", () => {
    const { rails } = skeletonOf(base());
    expect(rails.map((rail) => rail.ticks.map((tick) => tick.n))).toEqual([[1, 2, 3], [1]]);
    expect(rails[0].x).toBe(76);
    expect(rails[0].ticks[0]).toMatchObject({ y: 20, tickFrom: 78, tickTo: 88, numberRight: 74 });
    expect(rails[0].ticks[1].y).toBe(112 - 4 + 24);
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
    const out = skeletonOf(base({ room: RAIL_ROOM_ITEMS - 1 }));
    expect(out.rails).toEqual([]);
    expect(out.sockets).toHaveLength(4);
    expect(out.lanes).toHaveLength(2);
    expect(skeletonOf(base({ room: RAIL_ROOM_ITEMS })).rails).toHaveLength(2);
  });

  describe("a list tile held in a build with a part frame (G2)", () => {
    // The part frame stands 16 left of the tiles: frame 84, tiles 100.
    const framed = (over: Partial<SkeletonInput> = {}) => base({ frame: 84, room: 32, ...over });

    it("stand from the frame's left edge: rail 16 left, ticks 12 to 4 left, numbers ending 18 left", () => {
      const { rails } = skeletonOf(framed());
      expect(rails).toHaveLength(2);
      expect(rails[0].x).toBe(68);
      expect(rails[0].ticks[0]).toMatchObject({ tickFrom: 72, tickTo: 80, numberRight: 66 });
    });

    it("run from the first socket's top to the last socket's bottom, inside the lane", () => {
      const { rails, lanes } = skeletonOf(framed());
      expect([rails[0].top, rails[0].bottom]).toEqual([-4, 328]);
      expect(rails[0].top).toBeGreaterThanOrEqual(lanes[0].rect.y);
      expect(rails[0].bottom).toBeLessThanOrEqual(lanes[0].rect.y + lanes[0].rect.h);
    });

    it("need 32 of room left of the frame", () => {
      expect(RAIL_ROOM).toBe(32);
      expect(skeletonOf(framed({ room: 31 })).rails).toEqual([]);
      expect(skeletonOf(framed({ room: 32 })).rails).toHaveLength(2);
    });

    it("draw no rail for a container whose numbers reach three digits, so no number leaves the gutter", () => {
      const many = Array.from({ length: 100 }, (_, at) => item(`t${at}`, "s9", 1000 + at * 112));
      const out = skeletonOf(framed({ items: many, containers: [{ id: "s9", rect: { x: 100, y: 1000, w: 400, h: 11200 }, items: many.map((entry) => entry.id), framed: false, name: "Session 9" }], held: "t0" }));
      expect(out.rails).toEqual([]);
    });
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
