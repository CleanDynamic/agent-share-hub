// Node reads and writes for the build record.
//
// A node is placed (position is an integer) or in the tray (position is NULL).
// Tray nodes are unassigned material: never rendered publicly, never exported,
// never counted towards completeness. The two are always read separately so a
// caller cannot mix them up by accident.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  DEFAULT_LIMIT,
  type BuildNode,
  type BuildNodeInsert,
  type NodeTree,
} from "./types";

const NODE_COLUMNS =
  "id, build_id, parent_id, position, type, title, note, payload, source_ref, event_id, is_gap, created_at";

/** A target placement for one node in a reorder. */
export interface NodePlacement {
  id: string;
  parent_id: string | null;
  position: number | null;
}

export interface NodeQueryOptions {
  limit?: number;
}

// --- pure helpers ----------------------------------------------------------

function bySiblingOrder(a: BuildNode, b: BuildNode): number {
  const pa = a.position ?? 0;
  const pb = b.position ?? 0;
  if (pa !== pb) return pa - pb;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/**
 * Nests placed nodes by parent_id, sorted by position at every level.
 *
 * Only placed nodes take part. A placed node whose parent is not itself placed
 * is unreachable in the public tree, so it is dropped rather than promoted to
 * the top level — promoting it would surface a tray node's child as a root.
 */
export function buildTree(nodes: BuildNode[]): NodeTree[] {
  const placed = nodes.filter((n) => n.position !== null);
  const byId = new Map<string, NodeTree>();
  for (const node of placed) byId.set(node.id, { ...node, children: [] });

  const roots: NodeTree[] = [];
  for (const node of placed) {
    const entry = byId.get(node.id)!;
    if (node.parent_id === null) {
      roots.push(entry);
      continue;
    }
    const parent = byId.get(node.parent_id);
    if (parent) parent.children.push(entry);
  }

  const sortLevel = (level: NodeTree[]) => {
    level.sort(bySiblingOrder);
    for (const child of level) sortLevel(child.children);
  };
  sortLevel(roots);
  return roots;
}

/** Splits one fetch of a build's nodes into the placed tree and the tray. */
export function splitNodes(nodes: BuildNode[]): { tree: NodeTree[]; tray: BuildNode[] } {
  const tray = nodes
    .filter((n) => n.position === null)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  return { tree: buildTree(nodes), tray };
}

/** Total node count in a tree, for callers that need it without a re-walk. */
export function countTree(tree: NodeTree[]): number {
  return tree.reduce((total, node) => total + 1 + countTree(node.children), 0);
}

/** Depth of a tree, 0 for empty. */
export function treeDepth(tree: NodeTree[]): number {
  return tree.reduce((deepest, node) => Math.max(deepest, 1 + treeDepth(node.children)), 0);
}

// --- queries ---------------------------------------------------------------

/**
 * Every node of a build, placed and tray alike, in one round trip. The
 * composed record splits this locally rather than issuing two queries.
 */
export async function getBuildNodes(
  buildId: string,
  { limit = DEFAULT_LIMIT }: NodeQueryOptions = {}
): Promise<BuildNode[]> {
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw buildLayerError("getBuildNodes", error);
  return (data ?? []) as BuildNode[];
}

/** Placed nodes only, nested by parent_id and sorted by position. */
export async function getNodeTree(
  buildId: string,
  { limit = DEFAULT_LIMIT }: NodeQueryOptions = {}
): Promise<NodeTree[]> {
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .not("position", "is", null)
    .order("position", { ascending: true })
    .limit(limit);
  if (error) throw buildLayerError("getNodeTree", error);
  return buildTree((data ?? []) as BuildNode[]);
}

/** Tray nodes only — position IS NULL — oldest first. */
export async function getTray(
  buildId: string,
  { limit = DEFAULT_LIMIT }: NodeQueryOptions = {}
): Promise<BuildNode[]> {
  const { data, error } = await supabase
    .from("build_nodes")
    .select(NODE_COLUMNS)
    .eq("build_id", buildId)
    .is("position", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw buildLayerError("getTray", error);
  return (data ?? []) as BuildNode[];
}

// --- writes ----------------------------------------------------------------

/** Inserts a node, or updates it in place when the input carries an id. */
export async function upsertNode(node: BuildNodeInsert): Promise<BuildNode> {
  const { data, error } = await supabase
    .from("build_nodes")
    .upsert(node, { onConflict: "id" })
    .select(NODE_COLUMNS)
    .single();
  if (error) throw buildLayerError("upsertNode", error);
  return data as BuildNode;
}

/** Deletes one node. The parent_id cascade removes its descendants. */
export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from("build_nodes").delete().eq("id", id);
  if (error) throw buildLayerError("deleteNode", error);
}

/**
 * Moves a set of nodes to new parents and positions in one batched write.
 *
 * Done in two passes. The partial unique index on
 * (build_id, parent_id, position) is checked row by row, so writing the final
 * positions directly would fail the moment two siblings swap places. The first
 * pass parks every affected node on a negative position — unique within the
 * batch and never used by a real placement — and the second writes the targets.
 */
export async function reorderNodes(buildId: string, placements: NodePlacement[]): Promise<void> {
  if (placements.length === 0) return;

  const ids = placements.map((p) => p.id);
  const { data, error } = await supabase
    .from("build_nodes")
    .select("id, build_id, type")
    .eq("build_id", buildId)
    .in("id", ids)
    .limit(placements.length);
  if (error) throw buildLayerError("reorderNodes (load)", error);

  const known = new Map((data ?? []).map((row) => [row.id, row]));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw buildLayerError("reorderNodes", {
      message: `${missing.length} node(s) do not belong to build ${buildId}`,
    });
  }

  const rowsFor = (position: (p: NodePlacement, i: number) => number | null) =>
    placements.map((p, i) => ({
      ...known.get(p.id)!,
      parent_id: p.parent_id,
      position: position(p, i),
    }));

  const { error: parkError } = await supabase
    .from("build_nodes")
    .upsert(rowsFor((_p, i) => -(i + 1)), { onConflict: "id" });
  if (parkError) throw buildLayerError("reorderNodes (park)", parkError);

  const { error: placeError } = await supabase
    .from("build_nodes")
    .upsert(rowsFor((p) => p.position), { onConflict: "id" });
  if (placeError) throw buildLayerError("reorderNodes (place)", placeError);
}
