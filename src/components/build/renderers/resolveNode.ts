// The node index a renderer resolves node_id references through.
//
// Built once from the loaded tree and handed down, so a renderer that shows a
// tool's title instead of its uuid costs a Map lookup rather than a query.
//
// PLACED NODES ONLY. A reference into the tray resolves to undefined and the
// renderer says so, dimmed. The tray is unplaced work: it does not render
// publicly, and it must not leak onto the page through the back door of a
// node_id reference either.

import type { NodeTree } from "@/lib/build";
import type { ResolveNode } from "./types";

export function buildNodeIndex(tree: NodeTree[]): Map<string, NodeTree> {
  const index = new Map<string, NodeTree>();

  const walk = (nodes: NodeTree[]) => {
    for (const node of nodes) {
      index.set(node.id, node);
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(tree);

  return index;
}

export function makeResolveNode(tree: NodeTree[]): ResolveNode {
  const index = buildNodeIndex(tree);
  return (id) => (typeof id === "string" ? index.get(id) : undefined);
}
