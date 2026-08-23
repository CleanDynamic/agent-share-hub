// The node type registry: 26 rows that almost never change, read on every
// build page and every compose session. Cached in memory for the session.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type FieldDef,
  type NodeSchema,
  type NodeType,
  type NodeTypeRow,
} from "./types";

export const NODE_TYPE_COLUMNS =
  "key, label, category, colour, icon, schema, renderer, copyable, is_active, sort";

/** The registry is 26 rows today; the cap is a guard, not a page size. */
const NODE_TYPE_LIMIT = 200;

const EMPTY_SCHEMA: NodeSchema = { fields: [] };

// Resolved rows, and the in-flight request, so N concurrent callers on a cold
// cache make one query rather than N.
let cache: NodeType[] | null = null;
let inFlight: Promise<NodeType[]> | null = null;

function parseSchema(value: NodeTypeRow["schema"]): NodeSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_SCHEMA;
  }
  const fields = (value as { fields?: unknown }).fields;
  return Array.isArray(fields) ? { fields: fields as FieldDef[] } : EMPTY_SCHEMA;
}

function rowToNodeType(row: NodeTypeRow): NodeType {
  return { ...row, schema: parseSchema(row.schema) };
}

async function fetchNodeTypes(): Promise<NodeType[]> {
  const { data, error } = await supabase
    .from("node_types")
    .select(NODE_TYPE_COLUMNS)
    .order("category", { ascending: true })
    .order("sort", { ascending: true })
    .limit(NODE_TYPE_LIMIT);

  if (error) throw buildLayerError("getNodeTypes", error);
  return ((data ?? []) as NodeTypeRow[]).map(rowToNodeType);
}

/**
 * The whole registry, ordered by category then sort.
 *
 * Inactive types are included: a node created against a type that was later
 * retired must still render. Filter on `is_active` at the call site when
 * offering types for *new* nodes.
 */
export async function getNodeTypes(): Promise<NodeType[]> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetchNodeTypes()
      .then((types) => {
        cache = types;
        return types;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** One registry row, or null when the key is unknown. */
export async function getNodeType(key: string): Promise<NodeType | null> {
  const types = await getNodeTypes();
  return types.find((t) => t.key === key) ?? null;
}

/** The field definitions for a type. Empty array for an unknown key. */
export async function getFieldsFor(key: string): Promise<FieldDef[]> {
  const type = await getNodeType(key);
  return type?.schema.fields ?? [];
}

/** Drops the session cache. For tests, and for the admin type editor. */
export function clearNodeTypeCache(): void {
  cache = null;
  inFlight = null;
}
