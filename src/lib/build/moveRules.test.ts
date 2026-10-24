// CA-21 P1: Move up and Move down always move.

import { describe, expect, it } from "vitest";

import { canMove, flatOrder, locate, moveBy, moveModelOf, movedLine, placeSession, placeTile, spotOf, writeOf, type MoveModel, type MoveNames } from "./moveRules";

/** Two parts: Part 1 holds Session 1 (three prompts and a team of two agents) and Session 2 (an agent, a tool, a decision, a manual step, a file). Part 2 is empty. */
const model = (): MoveModel => ({
  hasParts: true,
  parts: [
    { key: "pa", sessions: ["s1", "s2"] },
    { key: "pb", sessions: [] },
  ],
  tiles: { s1: ["p1", "p2", "p3", "team"], s2: ["agent", "tool", "decision", "manual", "file"] },
  nested: { team: ["a1", "a2"] },
  loose: [],
});

const names: MoveNames = { tile: (id) => id.toUpperCase(), session: (key) => `Session ${key.slice(1)}`, part: (key) => (key === "pa" ? "Part 1" : "Part 2") };

describe("a tile moves past the tile next to it, whatever either is", () => {
  it("swaps within its session for every kind of tile", () => {
    const start = model();
    for (const id of ["p1", "p2", "p3", "team", "agent", "tool", "decision", "manual", "file"]) {
      const spot = spotOf(start, id)!;
      for (const by of [-1, 1] as const) {
        const result = moveBy(start, id, by);
        const edge = by === -1 ? spot.index === 0 : spot.index === spot.count - 1;
        if (edge && ((by === -1 && spot.session === "s1") || (by === 1 && spot.session === "s2"))) {
          expect(result).toBeNull();
          continue;
        }
        expect(result, `${id} ${by}`).not.toBeNull();
        if (!edge) {
          expect(result!.move.crossed).toBe(false);
          expect(spotOf(result!.model, id)!.index).toBe(spot.index + by);
          expect(spotOf(result!.model, id)!.session).toBe(spot.session);
        }
      }
    }
  });

  it("goes to the end of the session above from the top, and the start of the session below from the bottom", () => {
    const up = moveBy(model(), "agent", -1)!;
    expect(up.move.crossed).toBe(true);
    expect(up.model.tiles.s1).toEqual(["p1", "p2", "p3", "team", "agent"]);
    expect(up.model.tiles.s2).toEqual(["tool", "decision", "manual", "file"]);
    const down = moveBy(model(), "team", 1)!;
    expect(down.model.tiles.s2).toEqual(["team", "agent", "tool", "decision", "manual", "file"]);
    expect(down.model.tiles.s1).toEqual(["p1", "p2", "p3"]);
  });

  it("crosses parts, skipping a part with no sessions", () => {
    const start = model();
    start.parts = [
      { key: "pa", sessions: ["s1"] },
      { key: "pb", sessions: [] },
      { key: "pc", sessions: ["s2"] },
    ];
    const down = moveBy(start, "team", 1)!;
    expect(down.model.tiles.s2[0]).toBe("team");
    expect(spotOf(down.model, "team")!.part).toBe("pc");
    expect(moveBy(start, "file", 1)).toBeNull();
    expect(moveBy(start, "p1", -1)).toBeNull();
  });

  it("is greyed only at the very first or last place in the build", () => {
    const start = model();
    const greyed = ["p1", "file"].filter((id) => !canMove(start, id, id === "p1" ? -1 : 1));
    expect(greyed).toEqual(["p1", "file"]);
    expect(canMove(start, "p1", 1)).toBe(true);
    expect(canMove(start, "file", -1)).toBe(true);
    expect(canMove(start, "team", 1)).toBe(true);
    expect(canMove(start, "agent", -1)).toBe(true);
  });

  it("keeps a nested tile among its siblings", () => {
    const start = model();
    const down = moveBy(start, "a1", 1)!;
    expect(down.model.nested.team).toEqual(["a2", "a1"]);
    expect(down.move.kind).toBe("nested");
    expect(moveBy(start, "a1", -1)).toBeNull();
    expect(moveBy(start, "a2", 1)).toBeNull();
    expect(down.model.tiles).toEqual(start.tiles);
  });

  it("swaps loose tiles with each other only", () => {
    const start: MoveModel = { ...model(), loose: ["x1", "x2"] };
    expect(moveBy(start, "x1", 1)!.model.loose).toEqual(["x2", "x1"]);
    expect(moveBy(start, "x1", -1)).toBeNull();
  });

  it("does not cross into an unsaved session", () => {
    const start = { ...model(), fixed: ["s2"] };
    expect(moveBy(start, "team", 1)).toBeNull();
    expect(moveBy(start, "agent", -1)!.model.tiles.s1.at(-1)).toBe("agent");
  });
});

describe("a session moves past its neighbour, then into the next part", () => {
  it("swaps in its part", () => {
    const result = moveBy(model(), "s1", 1)!;
    expect(flatOrder(result.model)).toEqual(["s2", "s1"]);
    expect(result.move.crossed).toBe(false);
  });

  it("goes to the empty part at the edge, at the end of the part above and the start of the part below", () => {
    const down = moveBy(model(), "s2", 1)!;
    expect(down.move.crossed).toBe(true);
    expect(down.model.parts[1].sessions).toEqual(["s2"]);
    expect(down.model.parts[0].sessions).toEqual(["s1"]);
    const back = moveBy(down.model, "s2", -1)!;
    expect(back.model.parts[0].sessions).toEqual(["s1", "s2"]);
    expect(moveBy(model(), "s1", -1)).toBeNull();
    expect(moveBy(down.model, "s2", 1)).toBeNull();
  });

  it("never moves out of the only part", () => {
    const one: MoveModel = { hasParts: false, parts: [{ key: "", sessions: ["s1", "s2"] }], tiles: { s1: ["a"], s2: ["b"] }, nested: {}, loose: [] };
    expect(moveBy(one, "s1", -1)).toBeNull();
    expect(moveBy(one, "s2", 1)).toBeNull();
    expect(moveBy(one, "s1", 1)).not.toBeNull();
  });
});

describe("a part moves past its neighbour", () => {
  it("swaps and stops at the ends", () => {
    expect(moveBy(model(), "pa", 1)!.model.parts.map((part) => part.key)).toEqual(["pb", "pa"]);
    expect(moveBy(model(), "pa", -1)).toBeNull();
    expect(moveBy(model(), "pb", 1)).toBeNull();
  });
});

describe("what to write", () => {
  it("a tile that crosses sessions is given the new session and the target's order", () => {
    const start = model();
    const result = moveBy(start, "agent", -1)!;
    expect(writeOf(start, result.model, "agent")).toMatchObject({ kind: "tile", reassign: { id: "agent", session: "s1" }, atEnd: ["p1", "p2", "p3", "team", "agent"], session: "s1" });
  });

  it("a tile that stays in its session is not reassigned", () => {
    const start = model();
    const write = writeOf(start, moveBy(start, "p1", 1)!.model, "p1")!;
    expect(write.reassign).toBeUndefined();
    expect(write.atEnd).toEqual(["p2", "p1", "p3", "team"]);
  });

  it("a session that crosses parts names the part and what it goes before", () => {
    const start = model();
    const write = writeOf(start, moveBy(start, "s2", 1)!.model, "s2")!;
    expect(write).toMatchObject({ kind: "session", toPart: "pb", order: ["s1", "s2"] });
    expect(write.before).toBeUndefined();
    const back = writeOf(moveBy(start, "s2", 1)!.model, start, "s2")!;
    expect(back.toPart).toBe("pa");
  });

  it("says nothing when nothing moved", () => {
    expect(writeOf(model(), model(), "p1")).toBeNull();
  });
});

describe("the status line", () => {
  it("says where a tile went", () => {
    const start = model();
    expect(movedLine(moveBy(start, "agent", -1)!.move, names)).toBe("Moved AGENT to Session 1.");
    expect(movedLine(moveBy(start, "p1", 1)!.move, names)).toBe("Moved P1 to 2 of 4 in Session 1.");
    expect(movedLine(moveBy(start, "s2", 1)!.move, names)).toBe("Moved Session 2 to Part 2.");
    expect(movedLine(moveBy(start, "pa", 1)!.move, names)).toBe("Moved Part 1 to 2 of 2.");
  });
});

describe("placing", () => {
  it("puts a tile in another session at an index, clamped", () => {
    const next = placeTile(model(), "p2", "s2", 2);
    expect(next.tiles.s2).toEqual(["agent", "tool", "p2", "decision", "manual", "file"]);
    expect(next.tiles.s1).toEqual(["p1", "p3", "team"]);
    expect(placeTile(model(), "p2", "s2", 99).tiles.s2.at(-1)).toBe("p2");
  });

  it("puts a session in an empty part", () => {
    const next = placeSession(model(), "s1", "pb", 0);
    expect(next.parts).toEqual([
      { key: "pa", sessions: ["s2"] },
      { key: "pb", sessions: ["s1"] },
    ]);
    expect(locate(next, "s1")).toEqual({ kind: "session", part: "pb", index: 0 });
  });
});

describe("the model of a list", () => {
  it("reads sessions, loose steps, empty sessions, nested tiles and parts", () => {
    const step = (id: string, number: string, more: Record<string, unknown> = {}) => ({ id, number, ...more });
    const steps = [step("x", "1"), step("a", "2"), step("b", "3", { sentWith: [step("c", "3.1")] }), step("d", "4", { children: [step("e", "4.1"), step("f", "4.2")] })];
    const heads = new Map([
      ["2", { key: "s1" }],
      ["4", { key: "typed-legacy-1" }],
    ]);
    const result = moveModelOf({ steps, heads, empties: [{ key: "s9", number: 9 }], parts: [{ key: "pa", sessions: ["s1", "typed-legacy-1"] }, { key: "pb", sessions: ["s9"] }] });
    expect(result.loose).toEqual(["x"]);
    expect(result.tiles).toEqual({ s1: ["a", "b"], "typed-legacy-1": ["d"], s9: [] });
    expect(result.nested).toEqual({ b: ["c"], d: ["e", "f"] });
    expect(result.fixed).toEqual(["typed-legacy-1"]);
    expect(result.parts).toEqual([{ key: "pa", sessions: ["s1", "typed-legacy-1"] }, { key: "pb", sessions: ["s9"] }]);
    expect(result.hasParts).toBe(true);
    const one = moveModelOf({ steps, heads, parts: null });
    expect(one.hasParts).toBe(false);
    expect(one.parts).toEqual([{ key: "", sessions: ["s1", "typed-legacy-1"] }]);
  });
});
