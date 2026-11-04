// UX-06 Part 4: Add to a draft. The step is copied through SV-18's insert path (insertSavedTile, written with writeNodeRows, as
// startBuildFromItems writes it), so it keeps its source and credits its maker as a saved step does. A published step is copied
// from the source as it is now; a step a reply carries is copied from its snapshot.

import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSavedTile = vi.fn();
const writeNodeRows = vi.fn();
const getNodeTree = vi.fn();
const currentSnapshotOf = vi.fn();
let me: string | null = "me";

vi.mock("@/lib/build/fromLibrary", () => ({ insertSavedTile: (...args: unknown[]) => insertSavedTile(...args) }));
vi.mock("@/lib/build/sessionEdit", () => ({ writeNodeRows: (rows: unknown) => writeNodeRows(rows), flatRows: (tree: { id: string }[]) => tree }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: (id: string) => getNodeTree(id) }));
vi.mock("@/lib/build/buildSnapshot", () => ({ snapshotOf: (tree: unknown[]) => ({ nodes: tree, making: {}, sessions: [] }) }));
vi.mock("@/lib/library/savedItems", () => ({ currentSnapshotOf: (item: unknown) => currentSnapshotOf(item) }));
vi.mock("@/lib/social/types", () => ({ currentUserId: async () => me, db: {} }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { addStepToDraft, stepSnapshotFor } from "./addToDraft";

const step = { type: "prompt", title: "Score", note: null, payload: { text: "Score each CV" }, source: { buildId: "b-kit", buildTitle: "Kit's", buildSlug: "kits", makerId: "kit", nodeId: "n9" } };

beforeEach(() => {
  me = "me";
  getNodeTree.mockReset().mockResolvedValue([{ id: "old", build_id: "d1", parent_id: null, position: 0 }]);
  insertSavedTile.mockReset().mockImplementation((snapshot: { nodes: unknown[] }, _item: unknown, _place: unknown, context: { buildId: string; newId: () => string }) => ({
    snapshot: { ...snapshot, nodes: [...snapshot.nodes, { id: "copy", build_id: context.buildId, parent_id: null, position: 1, type: "prompt", source_ref: { node_id: "n9", build_id: "b-kit", saved_item_id: "" }, contributor_id: "kit" }] },
    ids: ["copy"],
  }));
  writeNodeRows.mockReset().mockResolvedValue([]);
  currentSnapshotOf.mockReset().mockResolvedValue(step);
});

describe("Add to a draft", () => {
  it("copies the step through SV-18's insert path, at the draft's top level, as the reader", async () => {
    await addStepToDraft("d1", step);
    expect(insertSavedTile).toHaveBeenCalledTimes(1);
    const [snapshot, item, place, context] = insertSavedTile.mock.calls[0] as [{ nodes: unknown[] }, { kind: string; snapshot: unknown }, { kind: string }, { buildId: string; copierId: string }];
    expect(snapshot.nodes).toHaveLength(1);
    expect(item).toMatchObject({ kind: "step", snapshot: step });
    expect(place).toMatchObject({ kind: "top" });
    expect(context).toMatchObject({ buildId: "d1", copierId: "me" });
    // Only the new tile is written, keeping its source and its maker's credit; no saved item is named.
    expect(writeNodeRows).toHaveBeenCalledWith([expect.objectContaining({ id: "copy", contributor_id: "kit", source_ref: { node_id: "n9", build_id: "b-kit", saved_item_id: null } })]);
  });

  it("refuses a signed-out reader", async () => {
    me = null;
    await expect(addStepToDraft("d1", step)).rejects.toThrow();
    expect(writeNodeRows).not.toHaveBeenCalled();
  });

  it("reads a published step as it is now, and takes a copied step from its snapshot", async () => {
    expect(await stepSnapshotFor({ kind: "published", buildId: "b-kit", nodeId: "n9" })).toEqual(step);
    expect(currentSnapshotOf).toHaveBeenCalledWith({ kind: "step", buildId: "b-kit", ref: "n9" });
    currentSnapshotOf.mockClear();
    expect(await stepSnapshotFor({ kind: "copy", snapshot: step })).toEqual(step);
    expect(currentSnapshotOf).not.toHaveBeenCalled();
  });
});
