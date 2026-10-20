// CA-06 P4 — where a colour is stored and read: a tile's `payload.colour`, a session's `sessions_meta[key].colour`.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));

import { buildSteps, sessionGroups, setNodeColour } from "./graph";
import { sessionsMetaOf } from "./making";
import type { BuildNode, NodeTree } from "./types";

const node = (id: string, payload: Record<string, unknown>, children: NodeTree[] = [], parent: string | null = null): NodeTree =>
  ({ id, build_id: "b", parent_id: parent, position: 1, type: "prompt", title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
});

describe("a tile's colour", () => {
  it("is read from payload.colour, as a colour, and never from its parent", () => {
    const inner = node("c", { text: "inner" }, [], "p");
    const [step] = buildSteps([node("p", { text: "outer", colour: "#7fa7d9" }, [inner])]);
    expect(step.colour).toBe("#7FA7D9");
    expect(step.sentWith?.[0].colour).toBeUndefined();
    expect(buildSteps([node("q", { text: "x", colour: "blue" })])[0].colour).toBeUndefined();
  });

  it("is written into payload.colour alone, and taken off with null; anything else in the payload is kept", async () => {
    const row = { ...node("p", { text: "outer", model: "Opus 5.5" }) } as unknown as BuildNode;
    await setNodeColour(row, "7fa");
    expect(upsertNode.mock.calls[0][0].payload).toEqual({ text: "outer", model: "Opus 5.5", colour: "#77FFAA" });
    await setNodeColour({ ...row, payload: { text: "outer", colour: "#77FFAA" } } as BuildNode, null);
    expect(upsertNode.mock.calls[1][0].payload).toEqual({ text: "outer" });
  });

  it("refuses something that is not a colour, and writes nothing", async () => {
    await expect(setNodeColour(node("p", { text: "x" }) as unknown as BuildNode, "#12")).rejects.toThrow("Use a code like #7FA7D9.");
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("a session's colour", () => {
  it("is kept from sessions_meta when it reads as a colour, and on its group", () => {
    const meta = sessionsMetaOf({ sessions_meta: { "typed-a": { tool: null, date: "2026-10-12", colour: "#c9a86b" }, "typed-b": { tool: null, date: "2026-10-13", colour: "teal" } } });
    expect(meta["typed-a"].colour).toBe("#C9A86B");
    expect(meta["typed-b"].colour).toBeUndefined();
    const steps = buildSteps([node("p", { text: "x", session: "typed-a" })]);
    expect(sessionGroups(steps, [], {}, meta)[0].colour).toBe("#C9A86B");
  });
});
