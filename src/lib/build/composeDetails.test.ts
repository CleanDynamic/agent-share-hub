// UI-P48 — More details: one breakage part and one gap part, made, changed and
// deleted as their fields fill and empty.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
const deleteNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  deleteNode: (...a: unknown[]) => deleteNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
}));

import { composerBreakage, detailTitle, saveBreakage } from "./composeDetails";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";

const node = (over: Partial<NodeTree>): NodeTree =>
  ({
    id: "n",
    build_id: BUILD,
    parent_id: null,
    position: 1,
    type: "breakage",
    title: null,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-07T09:00:00.000Z",
    children: [],
    ...over,
  }) as NodeTree;

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: Record<string, unknown>) => ({ id: "new", ...row }));
  deleteNode.mockReset();
  deleteNode.mockResolvedValue(undefined);
});

describe("finding the composer's parts", () => {
  it("takes the first breakage at the top level", () => {
    const tree = [node({ id: "b2", position: 4 }), node({ id: "b1", position: 2 })];
    expect(composerBreakage(tree)?.id).toBe("b1");
  });
});

describe("where it broke", () => {
  it("is made once What broke has words, placed after everything, titled by them", async () => {
    await saveBreakage({ buildId: BUILD, tree: [node({ type: "prompt", position: 3 })], current: null, symptom: "exiftool: command not found", resolution: "" });
    expect(upsertNode.mock.calls[0][0]).toEqual({
      build_id: BUILD,
      parent_id: null,
      position: 4,
      type: "breakage",
      title: "exiftool: command not found",
      payload: { symptom: "exiftool: command not found" },
    });
  });

  it("is changed in place, the fix with it", async () => {
    const current = node({ id: "b", position: 2, payload: { symptom: "old" } }) as BuildNode;
    await saveBreakage({ buildId: BUILD, tree: [], current, symptom: "exiftool: command not found", resolution: "Install it first with brew install exiftool." });
    expect(upsertNode.mock.calls[0][0]).toMatchObject({
      id: "b",
      position: 2,
      payload: { symptom: "exiftool: command not found", resolution: "Install it first with brew install exiftool." },
    });
  });

  it("is deleted when What broke is emptied, and nothing is made from a fix alone", async () => {
    const current = node({ id: "b" }) as BuildNode;
    expect(await saveBreakage({ buildId: BUILD, tree: [], current, symptom: "  ", resolution: "brew install" })).toBeNull();
    expect(deleteNode).toHaveBeenCalledWith("b");
    expect(await saveBreakage({ buildId: BUILD, tree: [], current: null, symptom: "", resolution: "brew install" })).toBeNull();
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("titles", () => {
  it("keeps a title to 80 characters", () => {
    expect(detailTitle(`  ${"a".repeat(100)}  `)).toBe("a".repeat(80));
  });
});
