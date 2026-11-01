// One node type, read from the list the build record already holds (SV-03 P3).
//
// The page used to ask for six types by key, one query each. The record carries the whole registry (`composeRecord`), so a
// type is found in it in the first render, with no request. Without a record (a build that is not made yet) the registry is
// asked for once, under one key shared by every caller, and kept for good.

import { useQuery, type QueryClient } from "@tanstack/react-query";

import { getNodeTypes, nodeTypesKey } from "@/lib/build/nodeTypes";
import type { NodeType } from "@/lib/build/types";

/** The node types, once, under the one key every reader of them shares. A read already on its way is joined, not repeated. */
export const fetchNodeTypes = (queryClient: QueryClient): Promise<NodeType[]> =>
  queryClient.fetchQuery({ queryKey: nodeTypesKey, queryFn: getNodeTypes, staleTime: Infinity });

export function useNodeType(known: readonly NodeType[], key: string): NodeType | null {
  const needsRegistry = known.length === 0;
  const registry = useQuery({
    queryKey: nodeTypesKey,
    queryFn: getNodeTypes,
    staleTime: Infinity,
    enabled: needsRegistry,
  });
  const list = needsRegistry ? (registry.data ?? []) : known;
  return list.find((type) => type.key === key) ?? null;
}

/** SV-27 P7: every node type, from the record or the one registry read, for a check over several keys (the Deployment group). */
export function useNodeTypes(known: readonly NodeType[]): readonly NodeType[] {
  const needsRegistry = known.length === 0;
  const registry = useQuery({ queryKey: nodeTypesKey, queryFn: getNodeTypes, staleTime: Infinity, enabled: needsRegistry });
  return needsRegistry ? (registry.data ?? []) : known;
}
