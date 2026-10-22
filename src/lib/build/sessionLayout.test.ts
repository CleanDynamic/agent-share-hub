import { beforeEach, describe, expect, it, vi } from "vitest";

const buildSessions = vi.hoisted(() => ({
  rows: [] as { buildId: string; sessionKey: string; importId: string | null; position: number; collapsed: boolean }[],
  missing: false,
  reordered: [] as string[][],
  inserted: [] as string[],
  collapsed: [] as [string, boolean][],
}));
const making = vi.hoisted(() => ({ value: {} as Record<string, unknown>, patches: [] as Record<string, unknown>[] }));

vi.mock("./buildSessions", async () => {
  const actual = await vi.importActual<typeof import("./buildSessions")>("./buildSessions");
  const missing = () => ({ code: "42P01" });
  return {
    ...actual,
    listBuildSessionRows: async () => {
      if (buildSessions.missing) return [];
      return buildSessions.rows;
    },
    insertBuildSession: async (row: { sessionKey: string }) => {
      if (buildSessions.missing) throw missing();
      buildSessions.inserted.push(row.sessionKey);
    },
    reorderBuildSessions: async (_id: string, keys: string[]) => {
      if (buildSessions.missing) throw missing();
      buildSessions.reordered.push([...keys]);
    },
    setSessionCollapsed: async (_id: string, key: string, value: boolean) => {
      if (buildSessions.missing) return;
      buildSessions.collapsed.push([key, value]);
    },
  };
});
vi.mock("./making", async () => {
  const actual = await vi.importActual<typeof import("./making")>("./making");
  return {
    ...actual,
    readMaking: async () => making.value,
    patchMaking: async (_id: string, patch: Record<string, unknown>) => {
      making.patches.push(patch);
      making.value = { ...making.value, ...patch };
      return making.value;
    },
  };
});

import { collapsedKeys, droppedKey, getSessionOrder, isCollapsed, movedKey, orderKeys, setCollapsed, setSessionOrder, stackBySessionMoves } from "./sessionLayout";
import { buildSteps, sessionGroups } from "./graph";

const row = (sessionKey: string, position: number, collapsed = false) => ({ buildId: "b", sessionKey, importId: null, position, collapsed });

beforeEach(() => {
  buildSessions.rows = [];
  buildSessions.missing = false;
  buildSessions.reordered = [];
  buildSessions.inserted = [];
  buildSessions.collapsed = [];
  making.value = {};
  making.patches = [];
});

describe("getSessionOrder and isCollapsed", () => {
  it("read the table when it has rows", () => {
    const rows = [row("b", 1), row("a", 0, true)];
    expect(getSessionOrder({ session_order: ["x"] }, rows)).toEqual(["a", "b"]);
    expect(isCollapsed({}, rows, "a")).toBe(true);
    expect(isCollapsed({ sessions_collapsed: ["b"] }, rows, "b")).toBe(false);
  });
  it("fall back to making when the table has no rows", () => {
    const made = { session_order: ["b", "a", "b", 3], sessions_collapsed: ["a"] };
    expect(getSessionOrder(made, [])).toEqual(["b", "a"]);
    expect(isCollapsed(made, [], "a")).toBe(true);
    expect(isCollapsed(made, [], "b")).toBe(false);
    expect([...collapsedKeys(made, [], ["a", "b"])]).toEqual(["a"]);
  });
  it("read nothing as nothing", () => {
    expect(getSessionOrder(null, [])).toEqual([]);
    expect(isCollapsed(undefined, [], "a")).toBe(false);
  });
});

describe("setSessionOrder", () => {
  it("writes the table and keeps making in step when the table is live", async () => {
    buildSessions.rows = [row("a", 0), row("b", 1)];
    await setSessionOrder("b", ["b", "a", "c"]);
    expect(buildSessions.inserted).toEqual(["c"]);
    expect(buildSessions.reordered).toEqual([["b", "a", "c"]]);
    expect(making.patches).toEqual([{ session_order: ["b", "a", "c"] }]);
  });
  it("writes only making when the table is not there", async () => {
    buildSessions.missing = true;
    await setSessionOrder("b", ["b", "a"]);
    expect(buildSessions.reordered).toEqual([]);
    expect(making.patches).toEqual([{ session_order: ["b", "a"] }]);
  });
  it("writes only making for a draft with no rows", async () => {
    await setSessionOrder("b", ["b", "a"]);
    expect(buildSessions.reordered).toEqual([]);
    expect(making.value.session_order).toEqual(["b", "a"]);
  });
});

describe("setCollapsed", () => {
  it("writes the row and making", async () => {
    await setCollapsed("b", "a", true);
    expect(buildSessions.collapsed).toEqual([["a", true]]);
    expect(making.value.sessions_collapsed).toEqual(["a"]);
    await setCollapsed("b", "c", true);
    await setCollapsed("b", "a", false);
    expect(making.value.sessions_collapsed).toEqual(["c"]);
  });
  it("still keeps making when the table is not there", async () => {
    buildSessions.missing = true;
    await setCollapsed("b", "a", true, {});
    expect(buildSessions.collapsed).toEqual([]);
    expect(making.value.sessions_collapsed).toEqual(["a"]);
  });
});

describe("movedKey and droppedKey", () => {
  it("move one place and stop at the ends", () => {
    expect(movedKey(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(movedKey(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(movedKey(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
  it("drop onto another head", () => {
    expect(droppedKey(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(droppedKey(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(droppedKey(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});

describe("stackBySessionMoves and numbering by order", () => {
  const prompt = (id: string, position: number, session: string) => ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: id, session }, source_ref: null, is_gap: false, event_id: null, created_at: "" });
  const tree = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-a"), prompt("n3", 2, "typed-b"), prompt("n4", 3, "typed-a")] as never[];
  const meta = { "typed-a": { tool: "claude", date: "2026-10-20" }, "typed-b": { tool: null, date: "2026-10-21" }, "typed-c": { tool: null, date: "2026-10-22" } };

  it("puts a late tile with its own session", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, meta);
    const moves = stackBySessionMoves(tree, steps, groups);
    expect(moves).toEqual([
      { id: "n4", parent_id: null, position: 2 },
      { id: "n3", parent_id: null, position: 3 },
    ]);
  });
  it("follows a new order, and numbers sessions by it", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, meta, ["typed-c", "typed-b", "typed-a"]);
    expect(orderKeys(groups)).toEqual(["typed-c", "typed-b", "typed-a"]);
    expect(groups.filter((g) => !g.implicit).map((g) => g.number)).toEqual([1, 2, 3]);
    const moves = stackBySessionMoves(tree, steps, groups);
    // b's tile first, then a's three, each keeping the slots they held.
    expect(moves.map((m) => m.id).sort()).toEqual(["n1", "n2", "n3"]);
    expect(moves.find((m) => m.id === "n3")?.position).toBe(0);
  });
  it("has no moves when the tiles already sit that way", () => {
    const flat = [prompt("n1", 0, "typed-a"), prompt("n2", 1, "typed-b")] as never[];
    const steps = buildSteps(flat);
    expect(stackBySessionMoves(flat, steps, sessionGroups(steps, [], {}, meta))).toEqual([]);
  });
  it("draws an empty session in the order", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, meta);
    expect(orderKeys(groups)).toContain("typed-c");
    expect(groups.find((g) => g.key === "typed-c")?.stepNumbers).toEqual([]);
  });
});
