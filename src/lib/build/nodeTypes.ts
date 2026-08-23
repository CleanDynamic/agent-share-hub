// The node type registry. Twenty-six rows that change only when a migration
// changes them, so they are fetched once per session and held in memory.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError, type FieldDef, type NodeSchema, type NodeType } from "./types";

const NODE_TYPE_COLUMNS =
  "key, label, category, colour, icon, schema, renderer, copyable, is_active, sort";

// Registry size is fixed by migration; the ceiling is headroom, not a page size.
const NODE_TYPE_LIMIT = 200;

let cache: NodeType[] | null = null;
let inFlight: Promise<NodeType[]> | null = null;

/**
 * Every node type, in sort order, including inactive ones — a node of a
 * retired type still has to resolve. Filter on `is_active` for a picker.
 */
export async function getNodeTypes(): Promise<NodeType[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { data, error } = await supabase
      .from("node_types")
      .select(NODE_TYPE_COLUMNS)
      .order("sort", { ascending: true })
      .limit(NODE_TYPE_LIMIT);
    if (error) throw buildLayerError("getNodeTypes", error);
    cache = (data ?? []) as NodeType[];
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** One node type by key, or null when the key is unknown. */
export async function getNodeType(key: string): Promise<NodeType | null> {
  const types = await getNodeTypes();
  return types.find((t) => t.key === key) ?? null;
}

/** The field definitions a type's payload is edited and rendered against. */
export async function getFieldsFor(key: string): Promise<FieldDef[]> {
  const type = await getNodeType(key);
  if (!type) return [];
  const schema = (type.schema ?? {}) as unknown as Partial<NodeSchema>;
  return Array.isArray(schema.fields) ? schema.fields : [];
}

/** Drops the cache. For tests, and after a registry migration in a live tab. */
export function clearNodeTypeCache(): void {
  cache = null;
  inFlight = null;
}
