import { describe, expect, it } from "vitest";

import { WORKSTREAM_MAX, hasMapKey, makerMapOf, mapOf, partLabelsOf, readerMapDirection, readerSeesMap, sessionMetaRefusal, sessionsMetaOf, storedWorkstreamsOf, workstreamsRefusal } from "./making";
import { stackBySessionMoves } from "./sessionLayout";
import {
  IMPLICIT_WORKSTREAM,
  addWorkstream,
  droppedWorkstream,
  moveSessionToWorkstream,
  moveWorkstream,
  orderByWorkstream,
  removeWorkstream,
  startsAfterChoices,
  withWorkstream,
  workstreamLabel,
  workstreamPatch,
  workstreamTitle,
  workstreamsOf,
} from "./workstreams";

const day = "2026-10-09";
const order = ["typed-1", "typed-2", "typed-3", "typed-4"];
const meta = (extra: Record<string, Record<string, unknown>> = {}) =>
  Object.fromEntries(order.map((key) => [key, { tool: null, date: day, ...(extra[key] ?? {}) }]));

const two = (extra: Record<string, Record<string, unknown>> = {}, parts: unknown[] = [{ key: "ws-a", name: "Tenant portal" }, { key: "ws-b" }]) => ({
  workstreams: parts,
  sessions_meta: meta(extra),
});

describe("the implicit part", () => {
  it("holds every session and is not stored", () => {
    const parts = workstreamsOf({ sessions_meta: meta() }, order);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ key: IMPLICIT_WORKSTREAM, implicit: true, sessions: order });
  });
  it("is what an empty list reads as", () => {
    expect(workstreamsOf({ workstreams: [] }, order)[0].implicit).toBe(true);
  });
});

describe("add a part", () => {
  it("from one writes two entries and nothing on the sessions", () => {
    const made = { sessions_meta: meta() };
    const change = addWorkstream(made, order);
    expect(change?.workstreams).toHaveLength(2);
    expect(change?.workstreams[1].key).toBe(change?.key);
    expect(change?.sessions).toEqual({});
    const patch = workstreamPatch(made, change!);
    expect(patch).not.toHaveProperty("sessions_meta");
    expect(workstreamsOf({ ...made, ...patch }, order).map((part) => part.sessions)).toEqual([order, []]);
  });
  it("from many adds one at the end", () => {
    const change = addWorkstream(two(), order);
    expect(change?.workstreams.map((part) => part.key).slice(0, 2)).toEqual(["ws-a", "ws-b"]);
    expect(change?.workstreams).toHaveLength(3);
  });
  it("stops at 26", () => {
    const parts = Array.from({ length: WORKSTREAM_MAX }, (_, at) => ({ key: `ws-${at}` }));
    expect(addWorkstream({ workstreams: parts }, order)).toBeNull();
    expect(storedWorkstreamsOf({ workstreams: [...parts, { key: "ws-extra" }] })).toHaveLength(WORKSTREAM_MAX);
    expect(workstreamsRefusal([...parts, { key: "ws-extra" }])).toMatch(/Parts: 26 max/);
  });
});

describe("labels", () => {
  it("letters and numbers", () => {
    expect(workstreamLabel(1, "letters")).toBe("Part B");
    expect(workstreamLabel(1, "numbers")).toBe("Part 2");
    expect(workstreamLabel(25, "letters")).toBe("Part Z");
    expect(workstreamTitle({ name: "Support agent" }, 1, "letters")).toBe("Part B · Support agent");
    expect(workstreamTitle({}, 0, "numbers")).toBe("Part 1");
  });
  it("read numbers unless the build says letters", () => {
    expect(partLabelsOf({})).toBe("numbers");
    expect(partLabelsOf({ part_labels: "letters" })).toBe("letters");
    expect(partLabelsOf({ part_labels: "roman" })).toBe("numbers");
  });
});

describe("moving a session to a part", () => {
  it("puts it at the end of that part, in the one order, and stops it sharing a stage", () => {
    const made = two({ "typed-2": { workstream: "ws-a", withAbove: true }, "typed-3": { workstream: "ws-a" }, "typed-4": { workstream: "ws-b" } });
    const change = moveSessionToWorkstream(made, order, "typed-2", "ws-b")!;
    expect(change.order).toEqual(["typed-1", "typed-3", "typed-4", "typed-2"]);
    expect(change.sessions["typed-2"]).toEqual({ workstream: "ws-b", withAbove: undefined });
    const patch = workstreamPatch(made, change);
    expect((patch.sessions_meta as Record<string, Record<string, unknown>>)["typed-2"]).toEqual({ tool: null, date: day, workstream: "ws-b" });
    expect(patch.session_order).toEqual(change.order);
  });
  it("can go before a session of that part", () => {
    const made = two({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-b" } });
    const change = moveSessionToWorkstream(made, ["typed-1", "typed-2", "typed-3", "typed-4"], "typed-1", "ws-b", "typed-4")!;
    expect(change.order).toEqual(["typed-2", "typed-3", "typed-1", "typed-4"]);
  });
  it("into an empty part lands right after the parts above it", () => {
    const made = two();
    const change = moveSessionToWorkstream(made, order, "typed-2", "ws-b")!;
    expect(change.order).toEqual(["typed-1", "typed-3", "typed-4", "typed-2"]);
  });
  it("restacks the tiles to the new order", () => {
    const made = two({ "typed-3": { workstream: "ws-b" } });
    const change = moveSessionToWorkstream(made, ["typed-1", "typed-2", "typed-3"], "typed-1", "ws-b")!;
    expect(change.order).toEqual(["typed-2", "typed-3", "typed-1"]);
    const tree = [
      { id: "n1", parent_id: null, position: 0, type: "prompt" },
      { id: "n2", parent_id: null, position: 1, type: "prompt" },
      { id: "n3", parent_id: null, position: 2, type: "prompt" },
    ];
    const steps = [
      { number: "1", id: "n1" },
      { number: "2", id: "n2" },
      { number: "3", id: "n3" },
    ] as never[];
    const groups = change.order.map((key, at) => ({ key, sessionId: key, number: at + 1, stepNumbers: [String(Number(key.slice(-1)))] })) as never[];
    const moves = stackBySessionMoves(tree as never[], steps, groups);
    expect(moves.map((move) => [move.id, move.position])).toEqual([["n2", 0], ["n3", 1], ["n1", 2]]);
  });
  it("does nothing for a part that is not there or a move that changes nothing", () => {
    expect(moveSessionToWorkstream(two(), order, "typed-1", "ws-nope")).toBeNull();
    expect(moveSessionToWorkstream(two(), order, "typed-4", "ws-a")).toBeNull();
  });
});

describe("remove a part", () => {
  const made = two({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-b" } }, [{ key: "ws-a" }, { key: "ws-b" }, { key: "ws-c" }]);
  it("a middle part's sessions join the part above", () => {
    const change = removeWorkstream(made, order, "ws-b")!;
    expect(change.joins).toBe("ws-a");
    expect(change.order).toEqual(order);
    const parts = workstreamsOf({ ...made, ...workstreamPatch(made, change) }, change.order);
    expect(parts.map((part) => part.key)).toEqual(["ws-a", "ws-c"]);
    expect(parts[0].sessions).toEqual(order);
  });
  it("the first part's sessions join the one below", () => {
    const change = removeWorkstream(two({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-b" } }), order, "ws-a")!;
    expect(change.joins).toBe("ws-b");
    const parts = workstreamsOf({ ...two(), ...workstreamPatch(two(), change) }, change.order);
    expect(parts).toHaveLength(1);
  });
  it("is not offered for the only part", () => {
    expect(removeWorkstream({ workstreams: [{ key: "ws-a" }] }, order, "ws-a")).toBeNull();
    expect(removeWorkstream({}, order, "ws-a")).toBeNull();
  });
  it("keeps a start-after that is still honest and drops one that is not", () => {
    const withStart = { ...made, workstreams: [{ key: "ws-a" }, { key: "ws-b" }, { key: "ws-c", startsAfter: "typed-3" }] };
    const keeps = removeWorkstream(withStart, order, "ws-b")!;
    expect(keeps.workstreams.find((part) => part.key === "ws-c")?.startsAfter).toBe("typed-3");
    const loop = { ...made, workstreams: [{ key: "ws-a" }, { key: "ws-b", startsAfter: "typed-1" }, { key: "ws-c" }] };
    const dropped = removeWorkstream(loop, order, "ws-a")!;
    expect(dropped.workstreams.find((part) => part.key === "ws-b")?.startsAfter).toBeUndefined();
  });
});

describe("move a part", () => {
  const made = two({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-b" } });
  it("takes its sessions with it", () => {
    const change = moveWorkstream(made, order, "ws-b", -1)!;
    expect(change.workstreams.map((part) => part.key)).toEqual(["ws-b", "ws-a"]);
    expect(change.order).toEqual(["typed-3", "typed-4", "typed-1", "typed-2"]);
  });
  it("cannot go past the ends", () => {
    expect(moveWorkstream(made, order, "ws-a", -1)).toBeNull();
    expect(moveWorkstream(made, order, "ws-b", 1)).toBeNull();
  });
  it("a drop on another part's head puts it there", () => {
    expect(droppedWorkstream(made, order, "ws-b", "ws-a")?.order).toEqual(["typed-3", "typed-4", "typed-1", "typed-2"]);
  });
});

describe("startsAfterChoices", () => {
  const parts = (startsA?: string, startsC?: string) =>
    workstreamsOf(
      {
        workstreams: [{ key: "ws-a", ...(startsA ? { startsAfter: startsA } : null) }, { key: "ws-b" }, { key: "ws-c", ...(startsC ? { startsAfter: startsC } : null) }],
        sessions_meta: meta({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-c" } }),
      },
      order,
    );
  it("offers the sessions of other parts only", () => {
    expect(startsAfterChoices("ws-b", parts())).toEqual(["typed-1", "typed-2", "typed-4"]);
  });
  it("refuses a part that starts after this one, directly or through others", () => {
    expect(startsAfterChoices("ws-a", parts(undefined, "typed-1"))).toEqual(["typed-3"]);
    // c starts after b; b starts after a? a may not start after b or c
    const chain = workstreamsOf(
      { workstreams: [{ key: "ws-a" }, { key: "ws-b", startsAfter: "typed-1" }, { key: "ws-c", startsAfter: "typed-3" }], sessions_meta: meta({ "typed-3": { workstream: "ws-b" }, "typed-4": { workstream: "ws-c" } }) },
      order,
    );
    expect(startsAfterChoices("ws-a", chain)).toEqual([]);
  });
});

describe("order by part", () => {
  it("groups keys by part and keeps the order inside one", () => {
    const stored = storedWorkstreamsOf(two());
    const entries = sessionsMetaOf(two({ "typed-1": { workstream: "ws-b" }, "typed-2": { workstream: "ws-a" } }));
    expect(orderByWorkstream(order, entries, stored)).toEqual(["typed-2", "typed-3", "typed-4", "typed-1"]);
  });
  it("leaves the order alone with no stored parts", () => {
    expect(orderByWorkstream(order, {}, [])).toEqual(order);
  });
});

describe("what is read", () => {
  it("skips bad values", () => {
    const parts = storedWorkstreamsOf({
      workstreams: [{ key: "ws-a", name: "  ", colour: "nope" }, { key: "ws-a" }, { name: "no key" }, "text", { key: "ws-b", name: "x".repeat(80), colour: "#7fa7d9", startsAfter: "typed-1", collapsed: true }],
    });
    expect(parts).toEqual([{ key: "ws-a" }, { key: "ws-b", name: "x".repeat(60), colour: "#7FA7D9", startsAfter: "typed-1", collapsed: true }]);
  });
  it("reads the session keys and refuses a bad one", () => {
    const entries = sessionsMetaOf({ sessions_meta: { "typed-1": { tool: null, date: day, workstream: " ws-b ", withAbove: true }, "typed-2": { tool: null, date: day, workstream: 4, withAbove: "yes" } } });
    expect(entries["typed-1"]).toMatchObject({ workstream: "ws-b", withAbove: true });
    expect(entries["typed-2"]).not.toHaveProperty("workstream");
    expect(entries["typed-2"]).not.toHaveProperty("withAbove");
    expect(sessionMetaRefusal("typed-1", { tool: null, date: day, workstream: " " })).toMatch(/part/);
  });
  it("reads the map", () => {
    expect(mapOf({})).toBeNull();
    expect(mapOf({ map: { on: true, direction: "vertical", onBuildPage: true } })).toEqual({ on: true, direction: "vertical", onBuildPage: true });
    expect(mapOf({ map: { on: true, direction: "sideways" } })).toEqual({ on: true, direction: "horizontal", onBuildPage: false });
    expect(mapOf({ map: { on: "yes" } })).toBeNull();
  });
  it("sets one part's own fields", () => {
    const next = withWorkstream([{ key: "a", name: "A", collapsed: true }], "a", { name: undefined, collapsed: false, colour: "#7FA7D9" });
    expect(next).toEqual([{ key: "a", colour: "#7FA7D9" }]);
  });
});

describe("the map is optional (CA-17 P6)", () => {
  const on = { map: { on: true, direction: "vertical", onBuildPage: true } };

  it("is the maker's to create: a draft with no map key has none yet", () => {
    expect(makerMapOf({}, false)).toBeNull();
    expect(hasMapKey({})).toBe(false);
  });

  it("shows a build from before the map to its maker as created, with Show on build page ticked, and writes nothing", () => {
    const old = { sessions: [], excluded_models: [] };
    expect(makerMapOf(old, true)).toEqual({ on: true, direction: "horizontal", onBuildPage: true });
    expect(old).not.toHaveProperty("map");
  });

  it("uses what is stored once there is a map key, even when the map is off", () => {
    expect(makerMapOf(on, true)).toEqual(on.map);
    expect(makerMapOf({ map: { on: false, direction: "vertical", onBuildPage: true } }, true)).toEqual({ on: false, direction: "vertical", onBuildPage: true });
    expect(makerMapOf({ map: { on: "no" } }, true)).toBeNull();
  });

  it("is seen by readers only when it is on and on the build page", () => {
    expect(readerSeesMap(on)).toBe(true);
    expect(readerSeesMap({ map: { on: true, direction: "horizontal", onBuildPage: false } })).toBe(false);
    expect(readerSeesMap({ map: { on: false, direction: "horizontal", onBuildPage: true } })).toBe(false);
    expect(readerSeesMap({ map: { on: true } })).toBe(false);
    expect(readerSeesMap({ map: "yes" })).toBe(false);
  });

  it("keeps showing its map to readers when the build has no map key at all, as it always did", () => {
    expect(readerSeesMap({})).toBe(true);
    expect(readerSeesMap({ sessions: [] })).toBe(true);
    expect(readerSeesMap(null)).toBe(true);
  });

  it("draws the maker's direction for readers, horizontal when none", () => {
    expect(readerMapDirection(on)).toBe("vertical");
    expect(readerMapDirection({})).toBe("horizontal");
  });
});
