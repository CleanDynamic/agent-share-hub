// SV-05 P1: a session's number is its place in the List, counted from the top. Read the way the page reads it: the groups
// from `sessionGroups`, the heads from `dividers`, the sessions with no tiles from `sourceSessions`, and the runs the List
// draws from `listRuns`.

import { describe, expect, it } from "vitest";

import { buildSteps, groupKey, sessionGroups, shownGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { orderKeys, stackBySessionMoves } from "@/lib/build/sessionLayout";

import { dividers } from "./buildListModel";
import { listRuns } from "./buildRuns";
import { sourceSessions } from "./sourcesModel";
import { numberSlot } from "./SessionHead";

type Node = Record<string, unknown>;
const prompt = (id: string, position: number, session: string): Node => ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "" });
const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;
const typed = (keys: string[], extra: Record<string, Record<string, unknown>> = {}) =>
  Object.fromEntries(keys.map((key, at) => [key, { tool: "claude", date: day(10 + at), ...(extra[key] ?? {}) }]));

/** What the List draws, top to bottom: each session head's number. */
function listNumbers(steps: Step[], groups: SessionGroup[]): number[] {
  const empties = sourceSessions(groups, steps).filter((row) => (groups.find((group) => groupKey(group) === row.key)?.stepNumbers.length ?? 0) === 0);
  return listRuns(steps, dividers(steps, groups), empties).flatMap((run) => (run.head ? [run.head.number] : []));
}

describe("SV-05 P1 · one order, one numbering", () => {
  it("Part 1 holding sessions numbered 3, 1, 2, 4 from top to bottom reads 1, 2, 3, 4", () => {
    // The tiles stand a, b, c, d; the stored order (a move whose tiles were never stacked) says b, c, a, d.
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b"), prompt("n3", 2, "typed-c"), prompt("n4", 3, "typed-d")];
    const steps = buildSteps(tree as never[]);
    const groups = sessionGroups(steps, [], {}, typed(["typed-a", "typed-b", "typed-c", "typed-d"]), ["typed-b", "typed-c", "typed-a", "typed-d"]);
    expect(listNumbers(steps, groups)).toEqual([1, 2, 3, 4]);
  });

  it("numbers a session with no tiles, imported or made here, and counts it", () => {
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b")];
    const steps = buildSteps(tree as never[]);
    // "imp-1" is an imported session with no tiles: the order holds it (its build_sessions row), between a and b.
    const groups = sessionGroups(steps, [], {}, typed(["typed-a", "typed-b"]), ["typed-a", "imp-1", "typed-b"]);
    expect(orderKeys(groups)).toEqual(["typed-a", "imp-1", "typed-b"]);
    expect(shownGroups(groups).map((group) => group.number)).toEqual([1, 2, 3]);
    expect(shownGroups(groups)).toHaveLength(3);
    expect(listNumbers(steps, groups)).toEqual([1, 2, 3]);
  });

  it("moving Session 3 to the top makes it 1 and shifts the others down by one", () => {
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b"), prompt("n3", 2, "typed-c")];
    const steps = buildSteps(tree as never[]);
    const meta = typed(["typed-a", "typed-b", "typed-c"]);
    const before = sessionGroups(steps, [], {}, meta, ["typed-a", "typed-b", "typed-c"]);
    expect(before.map((group) => [groupKey(group), group.number])).toEqual([["typed-a", 1], ["typed-b", 2], ["typed-c", 3]]);
    const after = sessionGroups(steps, [], {}, meta, ["typed-c", "typed-a", "typed-b"]);
    expect(after.map((group) => [groupKey(group), group.number])).toEqual([["typed-c", 1], ["typed-a", 2], ["typed-b", 3]]);
    expect(listNumbers(steps, after)).toEqual([1, 2, 3]);
  });

  it("Move to part renumbers: parts in their order, then each part's sessions", () => {
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b"), prompt("n3", 2, "typed-c")];
    const steps = buildSteps(tree as never[]);
    const workstreams = [{ key: "ws-1" }, { key: "ws-2" }];
    // a goes to Part 2: b and c are now first.
    const meta = typed(["typed-a", "typed-b", "typed-c"], { "typed-a": { workstream: "ws-2" }, "typed-b": { workstream: "ws-1" }, "typed-c": { workstream: "ws-1" } });
    const groups = sessionGroups(steps, [], {}, meta, ["typed-a", "typed-b", "typed-c"], workstreams);
    expect(groups.map((group) => [groupKey(group), group.number])).toEqual([["typed-b", 1], ["typed-c", 2], ["typed-a", 3]]);
  });

  it("tiles follow: stacked by the new order, tile numbers run down the List without gaps", () => {
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-a"), prompt("n3", 2, "typed-b")];
    const steps = buildSteps(tree as never[]);
    const groups = sessionGroups(steps, [], {}, typed(["typed-a", "typed-b"]), ["typed-b", "typed-a"]);
    const moves = stackBySessionMoves(tree as never[], steps, groups);
    const placed = tree.map((node) => ({ ...node, id: node.id as string, position: moves.find((move) => move.id === node.id)?.position ?? node.position })).sort((a, b) => Number(a.position) - Number(b.position));
    expect(placed.map((node) => node.id)).toEqual(["n3", "n1", "n2"]);
    const restacked = buildSteps(placed as never[]);
    expect(restacked.map((step) => step.number)).toEqual(["1", "2", "3"]);
    const again = sessionGroups(restacked, [], {}, typed(["typed-a", "typed-b"]), ["typed-b", "typed-a"]);
    expect(again.map((group) => [groupKey(group), group.number, group.stepNumbers])).toEqual([["typed-b", 1, ["1"]], ["typed-a", 2, ["2", "3"]]]);
  });
});

describe("SV-05 P1 · Undo and the number's slot", () => {
  it("Undo (the order put back) puts the old numbers back", () => {
    const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b"), prompt("n3", 2, "typed-c")];
    const steps = buildSteps(tree as never[]);
    const meta = typed(["typed-a", "typed-b", "typed-c"]);
    const numbersOf = (order: string[]) => sessionGroups(steps, [], {}, meta, order).map((group) => [groupKey(group), group.number]);
    const was = numbersOf(["typed-a", "typed-b", "typed-c"]);
    expect(numbersOf(["typed-c", "typed-a", "typed-b"])).not.toEqual(was);
    expect(numbersOf(["typed-a", "typed-b", "typed-c"])).toEqual(was);
  });

  it("keeps the slot as wide as the build's widest number, so 9 becoming 10 moves nothing beside it", () => {
    expect(numberSlot(2)).toEqual({ display: "inline-block", minWidth: "2ch", fontVariantNumeric: "tabular-nums" });
    expect(numberSlot(0).minWidth).toBe("1ch");
  });
});
