// Acceptance cover for NS-P08.
//
// The behaviours a type checker cannot see: the depth rule refusing a drop and
// writing nothing, one drag producing exactly one reorderNodes call, positions
// coming back dense, the tray convention in both directions, and a parent that
// warns before its children go with it.

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const reorderNodes = vi.fn();
const upsertNode = vi.fn();
const deleteNodeFn = vi.fn();
vi.mock("@/lib/build", () => ({
  reorderNodes: (buildId: string, moves: unknown) => reorderNodes(buildId, moves),
  upsertNode: (node: unknown) => upsertNode(node),
  deleteNode: (id: string) => deleteNodeFn(id),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import type { BuildNode, NodeTree as NodeTreeShape } from "@/lib/build";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { GAP_RED } from "@/components/build/tokens";
import { TreeNode } from "./TreeNode";
import {
  MAX_DEPTH,
  TRAY_DROP_ID,
  gapDropId,
  insideDropId,
  planDelete,
  planMove,
  useNodeDrag,
  type NodeDrag,
} from "./useNodeDrag";

const BUILD_ID = "build-1";

function node(
  id: string,
  position: number | null,
  parentId: string | null,
  children: NodeTreeShape[] = []
): NodeTreeShape {
  return {
    id,
    build_id: BUILD_ID,
    parent_id: parentId,
    position,
    type: "note",
    title: id,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: `2026-01-01T00:00:0${id.length}Z`,
    children,
  };
}

/**
 *  A (0)                 C (1)          D (2)
 *    A1 (0)                C1 (0)
 *      A1a (0)
 */
function fixture(): NodeTreeShape[] {
  const a1a = node("A1a", 0, "A1");
  const a1 = node("A1", 0, "A", [a1a]);
  const c1 = node("C1", 0, "C");
  return [node("A", 0, null, [a1]), node("C", 1, null, [c1]), node("D", 2, null)];
}

const trayNode = (id: string): BuildNode => {
  const { children: _children, ...row } = node(id, null, null);
  return row;
};

const TRAY: BuildNode[] = [trayNode("T1")];

// --- the planner -------------------------------------------------------------

describe("planMove", () => {
  it(`refuses a drop that would put a node at level ${MAX_DEPTH + 1}`, () => {
    const result = planMove(fixture(), TRAY, "D", { kind: "inside", nodeId: "A1a" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(`stops at ${MAX_DEPTH} levels`);
  });

  it("refuses a drop that would put a node's own children past the limit", () => {
    // C is 2 levels tall, so nesting it under A1 (level 2) puts C1 at level 4.
    const result = planMove(fixture(), TRAY, "C", { kind: "inside", nodeId: "A1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("its own children at level 4");
  });

  it("refuses a drop of a node inside itself", () => {
    const result = planMove(fixture(), TRAY, "A", { kind: "inside", nodeId: "A1a" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inside itself");
  });

  it("allows a leaf at level 3 and nests it", () => {
    const result = planMove(fixture(), TRAY, "D", { kind: "inside", nodeId: "A1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.moves).toContainEqual({ id: "D", parent_id: "A1", position: 1 });
  });

  it("assigns a position at the drop point when a node leaves the tray", () => {
    const result = planMove(fixture(), TRAY, "T1", { kind: "gap", parentId: null, index: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.tray).toHaveLength(0);
    expect(result.plan.moves).toEqual(
      expect.arrayContaining([
        { id: "T1", parent_id: null, position: 1 },
        { id: "C", parent_id: null, position: 2 },
        { id: "D", parent_id: null, position: 3 },
      ])
    );
    // A did not move, so it is not in the write.
    expect(result.plan.moves.map((move) => move.id)).not.toContain("A");
  });

  it("nulls position and parent when a node goes to the tray, promoting its children", () => {
    const result = planMove(fixture(), TRAY, "C", { kind: "tray" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.toTray).toMatchObject({ id: "C", parent_id: null, position: null });
    expect(result.plan.tray.map((row) => row.id)).toContain("C");
    // C1 takes C's slot rather than being orphaned under an unplaced parent.
    expect(result.plan.moves).toContainEqual({ id: "C1", parent_id: null, position: 1 });
  });

  it("renumbers every sibling list densely", () => {
    const sparse = [node("X", 4, null), node("Y", 9, null)];
    const result = planMove(sparse, [], "Y", { kind: "gap", parentId: null, index: 0 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.moves).toEqual([
      { id: "Y", parent_id: null, position: 0 },
      { id: "X", parent_id: null, position: 1 },
    ]);
  });

  it("aims at the seat the creator saw when a node moves down its own list", () => {
    // A is at index 0; gap 2 is the seat between C and D as rendered.
    const result = planMove(fixture(), TRAY, "A", { kind: "gap", parentId: null, index: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.tree.map((row) => row.id)).toEqual(["C", "A", "D"]);
  });
});

describe("planDelete", () => {
  it("names the node and every descendant the cascade takes", () => {
    const plan = planDelete(fixture(), TRAY, "A");
    expect(plan?.removedIds).toEqual(["A", "A1", "A1a"]);
    expect(plan?.moves).toEqual([
      { id: "C", parent_id: null, position: 0 },
      { id: "D", parent_id: null, position: 1 },
    ]);
  });
});

// --- the hook ----------------------------------------------------------------

let drag: NodeDrag;

function Harness({ tree, tray }: { tree: NodeTreeShape[]; tray: BuildNode[] }) {
  drag = useNodeDrag({
    buildId: BUILD_ID,
    tree,
    tray,
    selectedNodeId: null,
    onSelect: () => {},
  });
  return null;
}

function renderHook(tree = fixture(), tray = TRAY) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(composeBuildQueryKey(BUILD_ID), {
    build: { id: BUILD_ID },
    tree,
    tray,
    events: [],
    nodeTypes: [],
  });
  return render(
    <QueryClientProvider client={client}>
      <DndContext>
        <Harness tree={tree} tray={tray} />
      </DndContext>
    </QueryClientProvider>
  );
}

const dropEvent = (activeId: string, overId: string) =>
  ({ active: { id: activeId }, over: { id: overId } }) as never;

describe("useNodeDrag", () => {
  beforeEach(() => {
    reorderNodes.mockReset().mockResolvedValue(undefined);
    upsertNode.mockReset().mockResolvedValue({});
    deleteNodeFn.mockReset().mockResolvedValue(undefined);
  });

  it("issues exactly one reorderNodes call for one drag", async () => {
    renderHook();
    await act(async () => {
      drag.onDragEnd(dropEvent("T1", gapDropId(null, 1)));
    });
    await waitFor(() => expect(reorderNodes).toHaveBeenCalledTimes(1));
    const [buildId, moves] = reorderNodes.mock.calls[0];
    expect(buildId).toBe(BUILD_ID);
    // Every row that moved is in that one call, not one call per row.
    expect(moves).toHaveLength(3);
  });

  it("writes nothing at all when the depth rule refuses the drop", async () => {
    renderHook();
    await act(async () => {
      drag.onDragEnd(dropEvent("D", insideDropId("A1a")));
    });
    expect(reorderNodes).not.toHaveBeenCalled();
    expect(upsertNode).not.toHaveBeenCalled();
    expect(drag.rejection).toContain(`stops at ${MAX_DEPTH} levels`);
  });

  it("unplaces through upsertNode, which is the only call that can write a null position", async () => {
    renderHook();
    await act(async () => {
      drag.onDragEnd(dropEvent("D", TRAY_DROP_ID));
    });
    await waitFor(() => expect(upsertNode).toHaveBeenCalledTimes(1));
    expect(upsertNode.mock.calls[0][0]).toMatchObject({
      id: "D",
      parent_id: null,
      position: null,
    });
  });

  it("reverts the tree when the write fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = fixture();
    const record = { build: { id: BUILD_ID }, tree, tray: TRAY, events: [], nodeTypes: [] };
    client.setQueryData(composeBuildQueryKey(BUILD_ID), record);
    reorderNodes.mockRejectedValue(new Error("offline"));

    render(
      <QueryClientProvider client={client}>
        <DndContext>
          <Harness tree={tree} tray={TRAY} />
        </DndContext>
      </QueryClientProvider>
    );

    await act(async () => {
      drag.onDragEnd(dropEvent("D", gapDropId(null, 0)));
    });

    await waitFor(() => {
      const current = client.getQueryData(composeBuildQueryKey(BUILD_ID)) as typeof record;
      expect(current.tree.map((row) => row.id)).toEqual(["A", "C", "D"]);
    });
  });

  it("deletes the node and closes the gap it left", async () => {
    renderHook();
    await act(async () => {
      drag.removeNode("A");
    });
    await waitFor(() => expect(deleteNodeFn).toHaveBeenCalledWith("A"));
    // One delete for the whole subtree: the FK cascade takes the descendants.
    expect(deleteNodeFn).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reorderNodes).toHaveBeenCalledTimes(1));
  });
});

// --- the row -----------------------------------------------------------------

describe("TreeNode", () => {
  beforeAll(() => {
    // Radix menus probe pointer capture, which jsdom does not implement.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  beforeEach(() => {
    reorderNodes.mockReset().mockResolvedValue(undefined);
    deleteNodeFn.mockReset().mockResolvedValue(undefined);
  });

  function renderRow(target: NodeTreeShape) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = fixture();
    client.setQueryData(composeBuildQueryKey(BUILD_ID), {
      build: { id: BUILD_ID },
      tree,
      tray: TRAY,
      events: [],
      nodeTypes: [],
    });
    function Row() {
      const rowDrag = useNodeDrag({
        buildId: BUILD_ID,
        tree,
        tray: TRAY,
        selectedNodeId: null,
        onSelect: () => {},
      });
      return (
        <TreeNode
          node={target}
          typesByKey={new Map()}
          isSelected={false}
          isExpanded
          onToggle={() => {}}
          onSelect={() => {}}
          drag={rowDrag}
        />
      );
    }
    return render(
      <QueryClientProvider client={client}>
        <DndContext>
          <Row />
        </DndContext>
      </QueryClientProvider>
    );
  }

  // Keyboard rather than pointer: jsdom has no PointerEvent, so the Radix
  // trigger never sees the button field its pointerdown handler checks.
  const openMenu = async (label: string) => {
    fireEvent.keyDown(screen.getByLabelText(label), { key: "Enter" });
    await screen.findByText("Delete");
  };

  it("warns before deleting a parent, says how many go with it, and deletes all three", async () => {
    const parent = fixture()[0];
    renderRow(parent);
    await openMenu("Actions for A");

    fireEvent.click(screen.getByText("Delete"));

    const warning = await screen.findByText(/nested under it/i);
    expect(warning.textContent).toContain("2 nodes");
    expect(warning.textContent).toContain("all 3 of them");
    expect(deleteNodeFn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Delete 3 nodes/ }));
    await waitFor(() => expect(deleteNodeFn).toHaveBeenCalledWith("A"));
  });

  it("deletes a leaf without a warning", async () => {
    renderRow(node("D", 2, null));
    await openMenu("Actions for D");

    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(deleteNodeFn).toHaveBeenCalledWith("D"));
    expect(screen.queryByText(/nested under it/i)).toBeNull();
  });

  // NS-P51's acceptance, from the tree's side: the inspector's toggle writes
  // is_gap, and the row it wrote it on has to look different. The accent is the
  // one this codebase already spends on holes — the same GAP_RED the public
  // build page rules a gap card with — so a creator meets one colour for one
  // meaning across the editor and the page.
  it("rules an unsolved row in the gap accent", () => {
    const plain = node("D", 2, null);
    const { unmount } = renderRow(plain);
    expect(document.querySelector('[data-node-id="D"]')).toHaveStyle({
      borderLeftColor: "transparent",
    });
    unmount();

    renderRow({ ...plain, is_gap: true });
    expect(document.querySelector('[data-node-id="D"]')).toHaveStyle({
      borderLeftColor: GAP_RED,
    });
  });
});

describe("a drop that changes nothing", () => {
  it("writes nothing when a tray node is dropped back on the tray", () => {
    const result = planMove(fixture(), TRAY, "T1", { kind: "tray" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.toTray).toBeNull();
    expect(result.plan.moves).toEqual([]);
    // The node is still in the tray rather than dropped from it.
    expect(result.plan.tray.map((row) => row.id)).toEqual(["T1"]);
  });

  it("writes nothing when a node is dropped back into its own seat", () => {
    const result = planMove(fixture(), TRAY, "C", { kind: "gap", parentId: null, index: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.moves).toEqual([]);
  });
});
