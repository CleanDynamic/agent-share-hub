// A build's parts, numbered as a reader meets them (RC-P17).
//
// "on part 3 · Parse the invoice": a comment about one part names it by its
// place in the anatomy, depth first, counting from one, and by its title. The
// numbering is the placed tree's own order, so it is the order the Anatomy tab
// draws; tray nodes are not in the tree and never get a number.

import type { NodeTree } from "@/lib/build";

export interface PartLabel {
  position: number;
  title: string;
}

export function numberParts(tree: readonly NodeTree[]): Map<string, PartLabel> {
  const parts = new Map<string, PartLabel>();
  const walk = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      parts.set(node.id, { position: parts.size + 1, title: (node.title ?? "").trim() || "Untitled part" });
      walk(node.children);
    }
  };
  walk(tree);
  return parts;
}
