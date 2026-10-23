// removeNodes: taking tiles and files out of the build (CA-20 P2).
//
// A tile goes with everything inside it (the foreign key takes the nested rows), and with the files it makes: a file made by
// a tile that goes, or by a tile inside one, goes too, and comes out of every tile that used it, so no tile is left naming a
// file that is gone. `goingWith` says what will go, so the references to it can be let go first; `dropNodes` writes it.
//
// Both read the tree as the composer's node queue holds it, and `dropNodes` is called inside that queue.

import { subtreeIds } from "./buildSnapshot";
import { madeFilesOf, removeUse, usesOf, type Use } from "./graph";
import { deleteNode } from "./nodes";
import { flatRows } from "./sessionEdit";
import type { BuildNode, NodeTree } from "./types";

/** What removing needs of the composer's node queue. */
export interface RemovableNodes {
  current: () => NodeTree[];
  record: (id: string, node: BuildNode | null) => void;
}

const rowOf = (node: NodeTree): BuildNode => {
  const { children: _children, ...row } = node;
  return row;
};

/** Every id that goes when these go: each node, what is inside it, and the files its tiles make. */
export function goingWith(tree: readonly NodeTree[], ids: readonly string[]): string[] {
  const rows = flatRows(tree);
  const within = new Set(ids.flatMap((id) => subtreeIds(rows, id)));
  const made = [...madeFilesOf(rows)].filter(([, maker]) => within.has(maker)).flatMap(([file]) => subtreeIds(rows, file));
  return [...new Set([...within, ...made])].filter((id) => rows.some((row) => row.id === id));
}

const findNode = (tree: readonly NodeTree[], id: string): NodeTree | null => {
  for (const node of tree) {
    if (node.id === id) return node;
    const inner = node.children?.length ? findNode(node.children, id) : null;
    if (inner) return inner;
  }
  return null;
};

const allNodes = (tree: readonly NodeTree[]): NodeTree[] => tree.flatMap((node) => [node, ...allNodes(node.children ?? [])]);

/** A file goes: it comes out of every tile's uses first, then it is deleted. */
export async function dropFile(nodes: RemovableNodes, fileId: string): Promise<void> {
  const use: Use = { kind: "file", node_id: fileId };
  for (const user of allNodes(nodes.current())) {
    if (!usesOf(user).some((entry) => entry.kind === use.kind && entry.node_id === use.node_id)) continue;
    const fresh = findNode(nodes.current(), user.id);
    if (fresh) nodes.record(fresh.id, await removeUse(rowOf(fresh), use));
  }
  const file = findNode(nodes.current(), fileId);
  if (!file) return;
  const inside = flatRows([file]).map((row) => row.id);
  for (const inner of [...inside].reverse()) await deleteNode(inner);
  for (const gone of inside) nodes.record(gone, null);
}

/** These nodes go with what is inside them and the files their tiles make. Call inside the node queue. */
export async function dropNodes(nodes: RemovableNodes, ids: readonly string[]): Promise<void> {
  for (const id of ids) {
    const rows = flatRows(nodes.current());
    if (!rows.some((row) => row.id === id)) continue;
    const within = new Set(subtreeIds(rows, id));
    for (const [fileId, maker] of madeFilesOf(rows)) if (within.has(maker) && !within.has(fileId)) await dropFile(nodes, fileId);
    // It may have been a made file of an earlier one, and already gone.
    if (!flatRows(nodes.current()).some((row) => row.id === id)) continue;
    // What is inside goes first, deepest last to first: the foreign key would take it with its parent, and this does not depend on it.
    for (const inner of [...within].reverse()) await deleteNode(inner);
    for (const gone of within) nodes.record(gone, null);
  }
}
