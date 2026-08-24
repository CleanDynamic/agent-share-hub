// =============================================================================
// NeoScale — generate-build-layers: the row shapes this function reads
// =============================================================================
// Hand-written rather than imported from src/lib/build/types.ts, for the same
// reason every other edge function hand-writes its shapes: supabase/functions/
// is a separate Deno program with no path alias into the Vite app, and the
// generated Supabase types are a browser-bundle artefact. These are the
// columns this function actually selects, and nothing else.
// =============================================================================

export type Layer = "run" | "understand";

export const LAYERS: readonly Layer[] = ["run", "understand"] as const;

export function isLayer(value: unknown): value is Layer {
  return value === "run" || value === "understand";
}

/** public.build_nodes, the columns this function selects. */
export interface NodeRow {
  id: string;
  parent_id: string | null;
  /** NULL means the node is in the compose tray, not in the tree. */
  position: number | null;
  type: string;
  title: string | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  is_gap: boolean;
}

/** public.build_events, the columns this function selects. */
export interface EventRow {
  id: string;
  ordinal: number;
  kind: string;
  phase_title: string | null;
  visibility: string;
  payload: Record<string, unknown> | null;
  produced_node_id: string | null;
}

/** public.builds, the columns this function selects. */
export interface BuildRow {
  id: string;
  creator_id: string;
  title: string;
  outcome: string | null;
  shape: string;
  made_for: string[] | null;
  made_with: string[] | null;
}

// --- the payload schema dialect ----------------------------------------------
//
// node_types.schema is the six-field-type dialect seeded by NS-P02, not JSON
// Schema. This function reads exactly two things out of it: which fields are
// required, and what format hint a string field carries.

export type FieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "list";

export type FieldFormat = "node_id" | "media_id" | "url" | "timestamp";

export interface FieldDef {
  key: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  of?: FieldDef[];
  format?: FieldFormat;
}

export interface NodeSchema {
  fields?: FieldDef[];
}

/** public.node_types, the columns this function selects. */
export interface NodeTypeRow {
  key: string;
  label: string;
  category: string;
  schema: NodeSchema | null;
}

/** A placed node with its placed descendants attached, in position order. */
export interface TreeNode {
  node: NodeRow;
  children: TreeNode[];
}

/** One step of a generated layer, exactly as stored in build_layers.content. */
export interface Step {
  n: number;
  title: string;
  body: string;
  /** A real build_nodes.id in this build, or null. Never anything else. */
  node_ref: string | null;
}

export interface LayerContent {
  steps: Step[];
}
