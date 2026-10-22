import { describe, expect, it } from "vitest";

import { buildSteps, groupKey } from "./graph";
import type { NodeTree } from "./types";
import { dayOfNode, flatRows, insertedAfter, mergeTitleNote, mergedTitle, orderOfTree, planLayout, reassigned, splitPlan, tilesOfSession, withSession, withoutKey } from "./sessionEdit";

const node = (id: string, position: number, session: string, over: Record<string, unknown> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "2026-10-20T10:00:00Z", children: [], ...over }) as unknown as NodeTree;

const meta = {
  "typed-a": { tool: "claude", date: "2026-10-20" },
  "typed-b": { tool: "chatgpt", date: "2026-10-21" },
  "typed-c": { tool: null, date: "2026-10-22" },
};
const tree = [node("n1", 0, "typed-a"), node("n2", 1, "typed-a"), node("n3", 2, "typed-a"), node("n4", 3, "typed-b"), node("n5", 4, "typed-b")];

describe("reassigned", () => {
  it("sets a top-level tile's session and leaves the rest as the same objects", () => {
    const next = reassigned(tree, new Map([["n2", "typed-b"]]));
    expect((next[1].payload as { session: string }).session).toBe("typed-b");
    expect(next[0]).toBe(tree[0]);
    expect((tree[1].payload as { session: string }).session).toBe("typed-a");
  });
});

describe("planLayout", () => {
  it("has nothing to move when the tiles already sit together in the order", () => {
    expect(planLayout(tree, { sessions_meta: meta }, meta, ["typed-a", "typed-b"]).moves).toEqual([]);
  });

  it("moves a tile to the end of the session it was given, ahead of the sessions after it", () => {
    const moved = reassigned(tree, new Map([["n1", "typed-b"]]));
    const plan = planLayout(moved, { sessions_meta: meta }, meta, ["typed-a", "typed-b"], ["n1"]);
    // n2 and n3 stay in A; n1 now ends B.
    expect(plan.moves.map((move) => move.id)).toEqual(["n2", "n3", "n4", "n5", "n1"].filter((id) => plan.moves.some((m) => m.id === id)));
    const order = [...tree].map((n) => ({ id: n.id, position: n.position as number }));
    for (const move of plan.moves) order.find((entry) => entry.id === move.id)!.position = move.position;
    expect(order.sort((a, b) => a.position - b.position).map((entry) => entry.id)).toEqual(["n2", "n3", "n4", "n5", "n1"]);
  });

  it("follows a new session order, numbers by it, and keeps an empty session in the numbering", () => {
    const plan = planLayout(tree, { sessions_meta: meta }, meta, ["typed-b", "typed-a"]);
    expect(plan.groups.filter((group) => !group.implicit).map((group) => [groupKey(group), group.number])).toEqual([["typed-b", 1], ["typed-a", 2], ["typed-c", 3]]);
    const order = tree.map((n) => ({ id: n.id, position: n.position as number }));
    for (const move of plan.moves) order.find((entry) => entry.id === move.id)!.position = move.position;
    expect(order.sort((a, b) => a.position - b.position).map((entry) => entry.id)).toEqual(["n4", "n5", "n1", "n2", "n3"]);
  });
});

describe("splitPlan", () => {
  const steps = buildSteps(tree);
  const groups = planLayout(tree, { sessions_meta: meta }, meta, ["typed-a", "typed-b", "typed-c"]).groups;

  it("takes the tile and every tile after it in its session", () => {
    expect(splitPlan(steps, groups, "n2")).toMatchObject({ from: "typed-a" });
    expect(splitPlan(steps, groups, "n2")?.tail.map((step) => step.id)).toEqual(["n2", "n3"]);
  });

  it("says no for the first tile of a session, and for a tile that is nowhere", () => {
    expect(splitPlan(steps, groups, "n1")).toBeNull();
    expect(splitPlan(steps, groups, "n4")).toBeNull();
    expect(splitPlan(steps, groups, "ghost")).toBeNull();
  });

  it("reads the tiles of a session, and none for an empty one", () => {
    expect(tilesOfSession(steps, groups, "typed-b").map((step) => step.id)).toEqual(["n4", "n5"]);
    expect(tilesOfSession(steps, groups, "typed-c")).toEqual([]);
  });
});

describe("the small rules", () => {
  it("keeps the upper title and says which went", () => {
    expect(mergedTitle("Planning", "Router")).toBe("Planning");
    expect(mergedTitle(undefined, "Router")).toBe("Router");
    expect(mergeTitleNote("Planning", "Router")).toBe("Kept 'Planning'. 'Router' was removed.");
    expect(mergeTitleNote("Planning", undefined)).toBeNull();
    expect(mergeTitleNote(undefined, "Router")).toBeNull();
  });

  it("puts a session after another in the order, and takes one out", () => {
    expect(insertedAfter(["a", "b", "c"], "x", "a")).toEqual(["a", "x", "b", "c"]);
    expect(insertedAfter(["a", "b"], "x", "ghost")).toEqual(["a", "b", "x"]);
    expect(withoutKey(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("dates a split by the tile's own day, else today", () => {
    expect(dayOfNode({ created_at: "2026-10-12T08:00:00Z" }, "2026-10-22")).toBe("2026-10-12");
    expect(dayOfNode({ created_at: "" }, "2026-10-22")).toBe("2026-10-22");
    expect(dayOfNode(undefined, "2026-10-22")).toBe("2026-10-22");
  });

  it("gives rows a session without touching the rows it was given, and flattens a subtree parents first", () => {
    const rows = flatRows([node("p", 0, "typed-a", { children: [node("c", 0, "typed-a", { parent_id: "p" })] })]);
    expect(rows.map((row) => row.id)).toEqual(["p", "c"]);
    const written = withSession(rows, "typed-b");
    expect(written.every((row) => (row.payload as { session: string }).session === "typed-b")).toBe(true);
    expect((rows[0].payload as { session: string }).session).toBe("typed-a");
  });

  it("reads the order the sessions are drawn in", () => {
    expect(orderOfTree(tree, { sessions_meta: meta }, ["typed-b", "typed-a"])).toEqual(["typed-b", "typed-a", "typed-c"]);
  });
});
