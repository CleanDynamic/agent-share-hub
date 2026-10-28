// SV-12: test support for `buildsMaps.test.ts`: a nested tree back to the flat rows the read returns.

import type { NodeTree } from "./types";

type Row = Omit<NodeTree, "children">;

export function flattenTree(tree: readonly NodeTree[]): Row[] {
  return tree.flatMap((node) => {
    const { children, ...row } = node;
    return [row, ...flattenTree(children ?? [])];
  });
}
