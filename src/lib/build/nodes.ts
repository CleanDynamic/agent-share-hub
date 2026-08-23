// build_nodes: the nested tree of typed nodes, and the tray of unplaced ones.
//
// position carries meaning. A node with position IS NOT NULL is placed — it is
// in the tree, it renders publicly, it counts towards completeness. A node with
// position IS NULL is sitting in the compose tray and is none of those things.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type BuildNode,
  type BuildNodeInsert,
  type NodeTree,
} from "./types";

export const NODE_COLUMNS =
  "id, build_id, parent_id, position, type, title, note, payload, source_ref, event_id, is_gap, created_at";

/** A build far past this is a data problem, not a page worth rendering. */
const NODE_LIMIT = 2000;

/** Parking offset used while reordering. See reorderNodes. */
const PARK_OFFSET = -100000;

export interface NodeMove {
  id: string;
  parent_id: string | null;
  position: number;
}

/**
 * Insert or update one node. Pass `id` to update, omit it to insert.
 *
 * Omitting `position` (or passing null) puts the node in the tray.
 */
export async function upsertNode(node: BuildNodeInsert): Promise<BuildNode> {
  const { data, error } = await supabase
    .from("build_nodes")
    .upsert(node, { onConflict: "id" })
    .select(NODE_COLUMNS)
    .single();

  if (error) throw buildLayerError("upsertNode", error);
  return data as BuildNode;
}

/**
 * Move a set of nodes to new parents and positions in one batched write.
 *
 * Two passes rather than one, because build_nodes carries a *non-deferrable*
 * partial unique index on (build_id, parent_id, position) for placed nodes.
 * A single statement that swaps two siblings would collide on the intermediate
 * state, so the moved rows are first parked at unique negative positions —
 * which the index permits and no reader ever sees ordered above real ones —
 * and then written to their final positions.
 *
 * Both passes are batched: three round trips total, regardless of how many
 * nodes moved.
 */
export async function reorderNodes(
  buildId: string,
  moves: NodeMove[]
): Promise<void> {
  if (moves.length === 0) return;

  // PostgREST upsert is INSERT ... ON CONFLICT, so every NOT NULL column
  // without a default has to be present. Read the rows being moved once.
  const ids = moves.map((m) => m.id);
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .in("id", ids)
    .limit(NODE_LIMIT);

  if (error) throw buildLayerError("reorderNodes (read)", error);

  const existing = new Map((data as BuildNode[] | null ?? []).map((n) => [n.id, n]));
  const missing = ids.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    throw buildLayerError(
      "reorderNodes",
      new Error(`nodes not found in build ${buildId}: ${missing.join(", ")}`)
    );
  }

  const rows = moves.map((move, index) => {
    const node = existing.get(move.id) as BuildNode;
    return { ...node, parent_id: move.parent_id, position: move.position, index };
  });

  const parked = rows.map(({ index, ...row }) => ({
    ...row,
    position: PARK_OFFSET - index,
  }));
  const { error: parkError } = await supabase
    .from("build_nodes")
    .upsert(parked, { onConflict: "id" });
  if (parkError) throw buildLayerError("reorderNodes (park)", parkError);

  const placed = rows.map(({ index, ...row }) => row);
  const { error: placeError } = await supabase
    .from("build_nodes")
    .upsert(placed, { onConflict: "id" });
  if (placeError) throw buildLayerError("reorderNodes (place)", placeError);
}

/** Delete one node. Descendants go with it — the FK cascades. */
export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from("build_nodes").delete().eq("id", id);
  if (error) throw buildLayerError("deleteNode", error);
}

/**
 * The placed nodes of a build, nested by parent_id and ordered by position.
 *
 * Tray nodes are excluded in the query, not filtered out afterwards, so a
 * build with a large tray costs nothing extra to render.
 */
export async function getNodeTree(buildId: string): Promise<NodeTree[]> {
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .not("position", "is", null)
    .order("position", { ascending: true })
    .limit(NODE_LIMIT);

  if (error) throw buildLayerError("getNodeTree", error);
  return nestNodes((data ?? []) as BuildNode[]);
}

/**
 * The tray: everything in the build that has not been placed yet, oldest
 * first. Never rendered publicly, never exported.
 */
export async function getTray(buildId: string): Promise<BuildNode[]> {
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .is("position", null)
    .order("created_at", { ascending: true })
    .limit(NODE_LIMIT);

  if (error) throw buildLayerError("getTray", error);
  return (data ?? []) as BuildNode[];
}

/**
 * Nest a flat, position-ordered list of placed nodes.
 *
 * A node whose parent is absent from the list — a placed child of a node that
 * is itself in the tray, which the compose UI should prevent but the schema
 * does not — is treated as a root rather than dropped. Losing a creator's node
 * silently is worse than showing it at the top level.
 */
export function nestNodes(rows: BuildNode[]): NodeTree[] {
  const byId = new Map<string, NodeTree>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });

  const roots: NodeTree[] = [];
  for (const row of rows) {
    const node = byId.get(row.id) as NodeTree;
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // The query already ordered by position, so siblings arrive in order at
  // every depth. Sorting again keeps the guarantee explicit and local.
  const sortByPosition = (nodes: NodeTree[]) => {
    nodes.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const node of nodes) sortByPosition(node.children);
  };
  sortByPosition(roots);

  return roots;
}
