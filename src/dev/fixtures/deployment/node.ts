// SV-27 P14: a fixture node, placed in order. Sample content only.

import type { NodeTree } from "@/lib/build/types";

export function fixtureNode(id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null, children: NodeTree[] = []): NodeTree {
  const made = { id, build_id: "fixture-deployment", parent_id: null, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-31T09:00:00Z", children } as unknown as NodeTree;
  for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
  return made;
}
