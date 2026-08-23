// The compose workspace's node write path: drag state, depth validation, and
// the position recomputation that follows every move.
//
// One hook owns every mutation of build_nodes made from the workspace — drag,
// add, delete, move to tray — because they all share the same three concerns:
// an optimistic tree that moves before the server has agreed, a revert that is
// visible when the write fails, and dense positions afterwards. Splitting them
// across components would mean four copies of the revert.
//
// The planning half is pure and exported: planMove and planDelete take a tree
// and return the next tree plus the exact set of rows that moved, so the depth
// rule and the renumbering can be tested without a DOM or a drag.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteNode, reorderNodes, upsertNode } from "@/lib/build";
import type { BuildNode, BuildRecord, NodeMove, NodeTree } from "@/lib/build";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";

/** Root is level 1. A node at level 3 can hold no children. */
export const MAX_DEPTH = 3;

/** How long a refused drop stays on screen before it clears itself. */
const REJECTION_MS = 7000;

/**
 * Where a dragged node is being dropped.
 *
 * A "gap" is one insertion point in one sibling list: gap i is simultaneously
 * after the node above it and before the node below it. Modelling the two as a
 * single target rather than a separate "before" and "after" means each place a
 * node can land has exactly one droppable, so two zones never overlap and the
 * collision detection never has to choose between them.
 */
export type DropTarget =
  | { kind: "gap"; parentId: string | null; index: number }
  | { kind: "inside"; nodeId: string }
  | { kind: "tray" };

const SEP = "::";
const ROOT = "root";
export const TRAY_DROP_ID = "tray";

export function gapDropId(parentId: string | null, index: number): string {
  return `gap${SEP}${parentId ?? ROOT}${SEP}${index}`;
}

export function insideDropId(nodeId: string): string {
  return `inside${SEP}${nodeId}`;
}

/** Node ids are uuids and never contain the separator, so a draggable id can
 *  never be mistaken for a droppable one. */
export function decodeDropId(raw: string): DropTarget | null {
  if (raw === TRAY_DROP_ID) return { kind: "tray" };
  const parts = raw.split(SEP);
  if (parts[0] === "gap" && parts.length === 3) {
    const index = Number(parts[2]);
    if (!Number.isInteger(index) || index < 0) return null;
    return { kind: "gap", parentId: parts[1] === ROOT ? null : parts[1], index };
  }
  if (parts[0] === "inside" && parts.length === 2 && parts[1]) {
    return { kind: "inside", nodeId: parts[1] };
  }
  return null;
}

// --- pure tree helpers -------------------------------------------------------

function cloneTree(nodes: NodeTree[]): NodeTree[] {
  return nodes.map((node) => ({ ...node, children: cloneTree(node.children) }));
}

export function findNode(nodes: NodeTree[], id: string): NodeTree | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}

/** The sibling list under `parentId`, or null when that parent is not placed. */
function listFor(nodes: NodeTree[], parentId: string | null): NodeTree[] | null {
  if (parentId === null) return nodes;
  return findNode(nodes, parentId)?.children ?? null;
}

/** 1 for a root, 2 for its child, 3 for its grandchild. Null when not placed. */
function depthOf(nodes: NodeTree[], id: string, depth = 1): number | null {
  for (const node of nodes) {
    if (node.id === id) return depth;
    const hit = depthOf(node.children, id, depth + 1);
    if (hit !== null) return hit;
  }
  return null;
}

/** 1 for a leaf, 2 for a node with children, 3 for one with grandchildren. */
function subtreeHeight(node: NodeTree): number {
  if (node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(subtreeHeight));
}

function containsId(node: NodeTree, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some((child) => containsId(child, id));
}

/** Every descendant of a node, at every level. */
export function descendantIds(node: NodeTree): string[] {
  return node.children.flatMap((child) => [child.id, ...descendantIds(child)]);
}

/**
 * Pull one node out of a tree, mutating it.
 *
 * `promoteChildren` lifts its children into the slot it vacated. That is what
 * moving a parent to the tray does: the tray is flat, and a placed child whose
 * parent is unplaced is exactly the orphan state nestNodes warns the compose UI
 * must prevent. Promoting keeps the children placed and can only reduce their
 * depth, so it can never break the depth rule.
 */
function detach(
  nodes: NodeTree[],
  id: string,
  promoteChildren: boolean
): NodeTree | null {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    const [removed] = nodes.splice(index, 1);
    if (promoteChildren) nodes.splice(index, 0, ...removed.children);
    return removed;
  }
  for (const node of nodes) {
    const hit = detach(node.children, id, promoteChildren);
    if (hit) return hit;
  }
  return null;
}

interface Placement {
  parent_id: string | null;
  position: number | null;
}

/** Where every node sits right now, tray nodes included as (null, null). */
function indexPlacements(tree: NodeTree[], tray: BuildNode[]): Map<string, Placement> {
  const map = new Map<string, Placement>();
  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      map.set(node.id, {
        parent_id: node.parent_id ?? null,
        position: node.position ?? null,
      });
      walk(node.children);
    }
  };
  walk(tree);
  for (const node of tray) map.set(node.id, { parent_id: null, position: null });
  return map;
}

/**
 * Renumber every sibling list as 0..n-1, writing the result onto the tree, and
 * return only the rows whose parent or position actually changed.
 *
 * Renumbering the whole tree rather than the two lists a move touched is what
 * keeps positions from drifting sparse: a list that was already dense produces
 * no moves, so the cost of being thorough is nothing on the wire.
 */
function densify(tree: NodeTree[], before: Map<string, Placement>): NodeMove[] {
  const moves: NodeMove[] = [];
  const walk = (nodes: NodeTree[], parentId: string | null) => {
    nodes.forEach((node, index) => {
      node.parent_id = parentId;
      node.position = index;
      const prior = before.get(node.id);
      if (!prior || prior.parent_id !== parentId || prior.position !== index) {
        moves.push({ id: node.id, parent_id: parentId, position: index });
      }
      walk(node.children, node.id);
    });
  };
  walk(tree, null);
  return moves;
}

function stripChildren(node: NodeTree): BuildNode {
  const { children: _children, ...row } = node;
  return row;
}

/** getTray orders by created_at, so the optimistic tray must too. */
function insertByCreatedAt(tray: BuildNode[], row: BuildNode): BuildNode[] {
  const next = [...tray, row];
  next.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return next;
}

function labelOf(node: { title: string | null; type: string }): string {
  return node.title?.trim() || node.type;
}

// --- planning ----------------------------------------------------------------

export interface MovePlan {
  tree: NodeTree[];
  tray: BuildNode[];
  /** Every row whose parent_id or position changed. One reorderNodes call. */
  moves: NodeMove[];
  /**
   * Set when the node left the tree for the tray.
   *
   * reorderNodes types position as a number, so it cannot express position
   * NULL. upsertNode can and is documented to — "omitting position puts the
   * node in the tray" — so an unplacement is one upsertNode followed by the
   * one reorderNodes call that closes the gap it left behind.
   */
  toTray: BuildNode | null;
}

export type PlanResult =
  | { ok: true; plan: MovePlan }
  | { ok: false; reason: string };

/**
 * Why a drop cannot happen, or null when it can.
 *
 * Called on hover as well as on drop, so the reason is on screen before the
 * creator lets go rather than only after.
 */
export function validateMove(
  tree: NodeTree[],
  tray: BuildNode[],
  nodeId: string,
  target: DropTarget
): string | null {
  const placed = findNode(tree, nodeId);
  const trayed = tray.find((node) => node.id === nodeId) ?? null;
  if (!placed && !trayed) return "That node is no longer part of this build.";
  if (target.kind === "tray") return null;

  const parentId = target.kind === "gap" ? target.parentId : target.nodeId;
  const moving: NodeTree = placed ?? { ...(trayed as BuildNode), children: [] };
  const label = labelOf(moving);

  if (parentId !== null && placed && containsId(placed, parentId)) {
    return `“${label}” cannot be dropped inside itself.`;
  }

  let targetDepth = 1;
  if (parentId !== null) {
    const parentDepth = depthOf(tree, parentId);
    if (parentDepth === null) return "That place is no longer in the tree.";
    targetDepth = parentDepth + 1;
  }

  const height = subtreeHeight(moving);
  const deepest = targetDepth + height - 1;
  if (deepest > MAX_DEPTH) {
    return height === 1
      ? `The tree stops at ${MAX_DEPTH} levels. “${label}” would land at level ${targetDepth}.`
      : `The tree stops at ${MAX_DEPTH} levels. “${label}” would land at level ${targetDepth}, putting its own children at level ${deepest}.`;
  }

  return null;
}

/** The whole move, computed before anything is written. */
export function planMove(
  tree: NodeTree[],
  tray: BuildNode[],
  nodeId: string,
  target: DropTarget
): PlanResult {
  const reason = validateMove(tree, tray, nodeId, target);
  if (reason) return { ok: false, reason };

  const before = indexPlacements(tree, tray);
  const next = cloneTree(tree);
  const originalParent = findNode(tree, nodeId)?.parent_id ?? null;
  const originalIndex = listFor(tree, originalParent)?.findIndex((n) => n.id === nodeId);
  const trayed = tray.find((node) => node.id === nodeId) ?? null;

  const detached = detach(next, nodeId, target.kind === "tray");
  const moving: NodeTree = detached ?? { ...(trayed as BuildNode), children: [] };
  const nextTray = tray.filter((node) => node.id !== nodeId);

  if (target.kind === "tray") {
    // Already unplaced: the drop changed nothing, so it writes nothing.
    if (!detached) return { ok: true, plan: { tree, tray, moves: [], toTray: null } };

    // The children were promoted into its slot by detach; the node itself goes
    // to the tray on its own, carrying nothing.
    const row: BuildNode = { ...stripChildren(moving), parent_id: null, position: null };
    const moves = densify(next, before);
    return {
      ok: true,
      plan: { tree: next, tray: insertByCreatedAt(nextTray, row), moves, toTray: row },
    };
  }

  if (target.kind === "inside") {
    const parent = findNode(next, target.nodeId);
    if (!parent) return { ok: false, reason: "That place is no longer in the tree." };
    parent.children.push(moving);
  } else {
    const list = listFor(next, target.parentId);
    if (!list) return { ok: false, reason: "That place is no longer in the tree." };
    // Removing the node first shifts every later index in its own list down by
    // one, so a drop below its old seat aims one slot too low without this.
    let index = target.index;
    if (detached && originalParent === target.parentId && originalIndex !== undefined) {
      if (originalIndex < target.index) index -= 1;
    }
    list.splice(Math.max(0, Math.min(index, list.length)), 0, moving);
  }

  return { ok: true, plan: { tree: next, tray: nextTray, moves: densify(next, before), toTray: null } };
}

export interface DeletePlan {
  tree: NodeTree[];
  moves: NodeMove[];
  /** The node and every descendant, all of which the FK cascade removes. */
  removedIds: string[];
}

export function planDelete(
  tree: NodeTree[],
  tray: BuildNode[],
  nodeId: string
): DeletePlan | null {
  const target = findNode(tree, nodeId);
  if (!target) return null;
  const before = indexPlacements(tree, tray);
  const next = cloneTree(tree);
  detach(next, nodeId, false);
  return {
    tree: next,
    moves: densify(next, before),
    removedIds: [nodeId, ...descendantIds(target)],
  };
}

// --- the hook ----------------------------------------------------------------

export interface UseNodeDragArgs {
  buildId: string;
  tree: NodeTree[];
  tray: BuildNode[];
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
}

export interface NodeDrag {
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: CollisionDetection;
  /** The node under the cursor right now, tree or tray. */
  activeNode: BuildNode | null;
  activeId: string | null;
  overTarget: DropTarget | null;
  /** Why the target under the cursor would refuse this node, live. */
  hoverRejection: string | null;
  /** Why the last attempted drop was refused. Clears itself. */
  rejection: string | null;
  dismissRejection: () => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragCancel: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  /** Appends a node of `typeKey` at the end of the selected node's level. */
  addNode: (typeKey: string) => void;
  isAdding: boolean;
  moveToTray: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
}

export function useNodeDrag({
  buildId,
  tree,
  tray,
  selectedNodeId,
  onSelect,
}: UseNodeDragArgs): NodeDrag {
  const queryClient = useQueryClient();
  const queryKey = composeBuildQueryKey(buildId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<DropTarget | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  /** Writes run one at a time: two overlapping reorderNodes calls would race
   *  each other's park-and-place passes over the same rows. */
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const rejectionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(rejectionTimer.current);
    };
  }, []);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on a row still
    // selects it and the row menu still opens.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  /** Gap strips are thin and rows are tall, and they never overlap, so the
   *  pointer is inside exactly one. Rect intersection covers the keyboard
   *  sensor, which has no pointer. */
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
  }, []);

  const showRejection = useCallback((reason: string) => {
    setRejection(reason);
    clearTimeout(rejectionTimer.current);
    rejectionTimer.current = setTimeout(() => {
      if (mountedRef.current) setRejection(null);
    }, REJECTION_MS);
  }, []);

  const dismissRejection = useCallback(() => {
    clearTimeout(rejectionTimer.current);
    setRejection(null);
  }, []);

  /**
   * Move the tree now, write it after, put it back if the write fails.
   *
   * The snapshot is the whole record rather than the tree alone: reverting by
   * replaying an inverse move would have to be right about every row the
   * densify touched, and the snapshot is right by construction.
   */
  const write = useCallback(
    (
      next: { tree: NodeTree[]; tray: BuildNode[] },
      run: () => Promise<void>,
      failure: string
    ) => {
      const snapshot = queryClient.getQueryData<BuildRecord | null>(queryKey);
      if (!snapshot) return;

      queryClient.setQueryData<BuildRecord | null>(queryKey, {
        ...snapshot,
        tree: next.tree,
        tray: next.tray,
      });

      chainRef.current = chainRef.current.then(run).then(undefined, (cause: unknown) => {
        queryClient.setQueryData<BuildRecord | null>(queryKey, snapshot);
        toast.error(failure, {
          description: cause instanceof Error ? cause.message : String(cause),
        });
        // The snapshot restores what the creator saw; the refetch restores what
        // the server actually holds, in case an earlier write in the chain had
        // already landed.
        void queryClient.invalidateQueries({ queryKey });
      });
    },
    [queryClient, queryKey]
  );

  const commitMove = useCallback(
    (plan: MovePlan) => {
      if (plan.moves.length === 0 && !plan.toTray) return;
      const promoted = plan.toTray
        ? (findNode(tree, plan.toTray.id)?.children.length ?? 0)
        : 0;

      write(
        plan,
        async () => {
          // Unplacing first frees that (build_id, parent_id, position) slot, so
          // the reorder that closes the gap cannot collide with the row leaving.
          if (plan.toTray) {
            await upsertNode({ ...plan.toTray, parent_id: null, position: null });
          }
          if (plan.moves.length > 0) await reorderNodes(buildId, plan.moves);
        },
        "That move could not be saved"
      );

      if (promoted > 0) {
        toast(`Moved to the tray. Its ${promoted === 1 ? "child" : `${promoted} children`} moved up into its place.`);
      }
    },
    [buildId, tree, write]
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
      setOverTarget(null);
      dismissRejection();
    },
    [dismissRejection]
  );

  const onDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    setOverTarget(overId === undefined ? null : decodeDropId(String(overId)));
  }, []);

  const onDragCancel = useCallback(() => {
    setActiveId(null);
    setOverTarget(null);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverTarget(null);

      const overId = event.over?.id;
      if (overId === undefined) return;
      const target = decodeDropId(String(overId));
      if (!target) return;

      const result = planMove(tree, tray, String(event.active.id), target);
      // A refused drop writes nothing at all — it stops here, before write.
      if (!result.ok) {
        showRejection(result.reason);
        return;
      }
      commitMove(result.plan);
    },
    [commitMove, showRejection, tray, tree]
  );

  const moveToTray = useCallback(
    (nodeId: string) => {
      const result = planMove(tree, tray, nodeId, { kind: "tray" });
      if (!result.ok) {
        showRejection(result.reason);
        return;
      }
      if (selectedNodeId === nodeId) onSelect(null);
      commitMove(result.plan);
    },
    [commitMove, onSelect, selectedNodeId, showRejection, tray, tree]
  );

  const removeNode = useCallback(
    (nodeId: string) => {
      const plan = planDelete(tree, tray, nodeId);
      if (!plan) return;
      if (selectedNodeId && plan.removedIds.includes(selectedNodeId)) onSelect(null);

      write(
        { tree: plan.tree, tray },
        async () => {
          // The FK cascades, so the descendants go with the parent in one
          // statement; the reorder only closes the gap it left.
          await deleteNode(nodeId);
          if (plan.moves.length > 0) await reorderNodes(buildId, plan.moves);
        },
        "That node could not be deleted"
      );
    },
    [buildId, onSelect, selectedNodeId, tray, tree, write]
  );

  const addNode = useCallback(
    (typeKey: string) => {
      setIsAdding(true);
      chainRef.current = chainRef.current.then(async () => {
        try {
          // Read the tree as it stands now rather than as it stood when the
          // menu was opened: a reorder may have run ahead of this in the queue,
          // and a position computed from the older tree could collide.
          const current = queryClient.getQueryData<BuildRecord | null>(queryKey);
          const currentTree = current?.tree ?? [];

          // The current level is the selected node's own level, so adding after
          // selecting a child adds a sibling of that child, not a new root.
          const selected = selectedNodeId ? findNode(currentTree, selectedNodeId) : null;
          const parentId = selected?.parent_id ?? null;
          const position = (listFor(currentTree, parentId) ?? currentTree).length;

          // Not optimistic: the row's id is assigned by the database, and a
          // placeholder id would have to be reconciled into the tree anyway.
          const created = await upsertNode({
            build_id: buildId,
            type: typeKey,
            parent_id: parentId,
            position,
          });
          if (!mountedRef.current) return;

          queryClient.setQueryData<BuildRecord | null>(queryKey, (record) => {
            if (!record) return record;
            const next = cloneTree(record.tree);
            const list = listFor(next, parentId);
            if (!list) return record;
            list.push({ ...created, children: [] });
            return { ...record, tree: next };
          });
          onSelect(created.id);
        } catch (cause) {
          toast.error("That node could not be added", {
            description: cause instanceof Error ? cause.message : String(cause),
          });
        } finally {
          if (mountedRef.current) setIsAdding(false);
        }
      });
    },
    [buildId, onSelect, queryClient, queryKey, selectedNodeId]
  );

  const activeNode = useMemo<BuildNode | null>(() => {
    if (!activeId) return null;
    const placed = findNode(tree, activeId);
    if (placed) return stripChildren(placed);
    return tray.find((node) => node.id === activeId) ?? null;
  }, [activeId, tray, tree]);

  const hoverRejection = useMemo(() => {
    if (!activeId || !overTarget) return null;
    return validateMove(tree, tray, activeId, overTarget);
  }, [activeId, overTarget, tray, tree]);

  return {
    sensors,
    collisionDetection,
    activeNode,
    activeId,
    overTarget,
    hoverRejection,
    rejection,
    dismissRejection,
    onDragStart,
    onDragOver,
    onDragCancel,
    onDragEnd,
    addNode,
    isAdding,
    moveToTray,
    removeNode,
  };
}
