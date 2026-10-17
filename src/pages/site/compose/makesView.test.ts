// TF-08 — a file a step makes, from the build's nodes to what Details and Sources show. The build is the one in the
// brief: step 2 makes brand-guide.md, and step 4 may use it.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build/nodes", () => ({ upsertNode: vi.fn(), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));
vi.mock("@/lib/build/nodeTypes", () => ({ getNodeType: vi.fn() }));

import { buildSteps, sessionGroups } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";


import { makesRows } from "./detailsModel";
import { pieces, resolveView } from "./detailsView";
import { sourceFiles } from "./sourcesModel";

const node = (id: string, over: Partial<NodeTree>): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const prompt = (id: string, position: number, uses: { kind: string; node_id: string }[] = []) => node(id, { position, payload: { text: `Prompt ${position} text`, uses } });
const made = (id: string, position: number, title: string, madeBy: string | null, extra: object = {}) =>
  node(id, { position, type: "document", payload: { title, ...(madeBy ? { made_by: madeBy } : null), ...extra } });

const tree: NodeTree[] = [
  prompt("p1", 1),
  prompt("p2", 2),
  prompt("p3", 3),
  prompt("p4", 4, [{ kind: "file", node_id: "bg" }]),
  made("bg", 5, "brand-guide.md", "p2"),
  made("menu", 6, "menu.pdf", null, { media_id: "m1" }),
];

function context(selectedId: string | null) {
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, [], {});
  const files = sourceFiles(tree, groups, steps);
  return { selectedId, steps, groups, tree, sources: [], sourceFiles: files, promptsState: () => ({ prompts: undefined, error: false }), intoResult: new Set<string>(), media: () => ({ name: "menu.pdf", bytes: 2048 }) };
}

describe("a file a step makes", () => {
  it("lists in Sources as made in step 2", () => {
    const { sourceFiles: files } = context(null);
    expect(files.find((file) => file.id === "bg")).toMatchObject({ name: "brand-guide.md", note: "made in step 2" });
    expect(files.find((file) => file.id === "menu")?.note).toBe("added by you");
  });

  it("lists in the Makes of the step that makes it, and no other", () => {
    expect(makesRows("p2", tree)).toEqual([{ id: "bg", name: "brand-guide.md" }]);
    expect(makesRows("p1", tree)).toEqual([]);
    expect(makesRows("p4", tree)).toEqual([]);
  });

  it("is offered in step 4's Add an input and not in step 1's", () => {
    // Step 4 has not taken it yet: what it already lists is not offered again.
    const open: NodeTree[] = tree.map((entry) => (entry.id === "p4" ? prompt("p4", 4) : entry));
    const keys = (id: string) => (resolveView({ ...context(id), tree: open, steps: buildSteps(open) }) as unknown as { options: { key: string }[] }).options.map((option) => option.key);
    expect(keys("p4")).toContain("file:bg");
    expect(keys("p3")).toContain("file:bg");
    expect(keys("p1")).not.toContain("file:bg");
    expect(keys("p2")).not.toContain("file:bg");
    const view = resolveView({ ...context("p4"), tree: open, steps: buildSteps(open) }) as unknown as { options: { key: string; sub: string }[] };
    expect(view.options.find((option) => option.key === "file:bg")?.sub).toBe("made in step 2");
  });

  it("opens in Details as made in step 2, with the steps that use it, and no Download", () => {
    const view = resolveView(context("bg"));
    expect(view).toMatchObject({ kind: "file", name: "brand-guide.md", from: "Made in step 2", canDownload: false });
    expect((view as unknown as { usedBy: { id: string }[] }).usedBy.map((row) => row.id)).toEqual(["p4"]);
  });

  it("offers no Download even when the file holds a link, and still offers it for a file that was added", () => {
    const linked: NodeTree[] = tree.map((entry) => (entry.id === "bg" ? made("bg", 5, "brand-guide.md", "p2", { url: "https://example.com/x" }) : entry));
    expect(resolveView({ ...context("bg"), tree: linked })).toMatchObject({ canDownload: false });
    expect(resolveView(context("menu"))).toMatchObject({ kind: "file", from: "added by you", canDownload: true });
  });

  it("is a file of the pieces a step may use, named", () => {
    expect(pieces(tree, sourceFiles(tree, [], buildSteps(tree))).byId.bg.name).toBe("brand-guide.md");
  });
});
