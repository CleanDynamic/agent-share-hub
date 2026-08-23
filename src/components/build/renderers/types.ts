// The renderer contract.
//
// Every typed renderer takes exactly these props and nothing else. In
// particular a renderer never fetches: `resolveNode` is handed down from
// BuildPage over the already-loaded tree, so a node_id reference costs a Map
// lookup rather than a query. No renderer imports the Supabase client,
// useQuery or useAuth — a build page renders from one record or not at all.

import type { ComponentType } from "react";
import type { Build, BuildNode, NodeType } from "@/lib/build";

export interface NodeProps {
  node: BuildNode;
  /** The registry row for `node.type`. Absent only for an unregistered type. */
  nodeType?: NodeType;
  build: Build;
  /** Placed nodes only. Returns undefined for a tray node or a dangling id. */
  resolveNode: ResolveNode;
}

export type ResolveNode = (id: string | null | undefined) => BuildNode | undefined;

export type NodeRenderer = ComponentType<NodeProps>;

/**
 * A renderer module's answer to "what does the copy button put on the
 * clipboard?". Returning null means there is nothing worth copying, and
 * NodeCard renders no control at all.
 */
export type GetCopyText = (node: BuildNode, nodeType?: NodeType) => string | null;
