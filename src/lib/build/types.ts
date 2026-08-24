// Shared types for the typed build record data layer.
//
// Row shapes are DERIVED from the generated Supabase types rather than
// hand-written, so a column added in a later migration shows up here the
// moment src/integrations/supabase/types.ts is regenerated.

import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

// --- row types ---------------------------------------------------------------

export type Build = Tables<"builds">;
export type BuildNode = Tables<"build_nodes">;
export type BuildEvent = Tables<"build_events">;
export type BuildMedia = Tables<"build_media">;
export type BuildReproduction = Tables<"build_reproductions">;

/** The registry row exactly as stored — `schema` still untyped Json. */
export type NodeTypeRow = Tables<"node_types">;

/** A registry row with its payload schema parsed into the field dialect. */
export interface NodeType extends Omit<NodeTypeRow, "schema"> {
  schema: NodeSchema;
}

// --- write shapes ------------------------------------------------------------

export type BuildInsert = TablesInsert<"builds">;
export type BuildNodeInsert = TablesInsert<"build_nodes">;
export type BuildEventInsert = TablesInsert<"build_events">;
export type BuildMediaInsert = TablesInsert<"build_media">;
export type BuildReproductionInsert = TablesInsert<"build_reproductions">;

/** A partial update. `id` and `creator_id` are fixed once a build exists. */
export type BuildPatch = Omit<TablesUpdate<"builds">, "id" | "creator_id">;

// --- constrained string columns ----------------------------------------------
//
// Postgres enforces these as CHECK constraints rather than enum types, so the
// generated types widen them to `string`. Narrow them back here.

export type BuildStatus = "draft" | "published" | "gallery";

export type BuildShape =
  | "app"
  | "agent"
  | "workflow"
  | "prompt"
  | "dataset"
  | "study"
  | "media"
  | "technique"
  | "other";

export type EventKind = "prompt" | "milestone" | "breakage" | "deploy" | "note";

export type EventVisibility = "kept" | "folded" | "hidden";

export type MediaKind = "image" | "video" | "audio" | "file";

export type NodeCategory =
  | "instruction"
  | "configuration"
  | "data"
  | "artefact"
  | "evidence"
  | "narrative";

// --- the payload schema dialect ----------------------------------------------
//
// node_types.schema is NOT JSON Schema. It is the constrained object described
// at the top of the NS-P02 migration: six field types and no others, with one
// level of list nesting. A field inside `of` never itself carries `of`.

export type FieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "enum"
  | "list";

/** Widget hint on a string field. Storage stays `string` either way. */
export type FieldFormat = "node_id" | "media_id" | "url" | "timestamp";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  /** Present when `type` is "enum". */
  options?: string[];
  /** Present when `type` is "list". Its members never carry `of` themselves. */
  of?: FieldDef[];
  /** Only meaningful on `type: "string"`. */
  format?: FieldFormat;
}

export interface NodeSchema {
  fields: FieldDef[];
}

/** A node payload is an object keyed by the FieldDef keys of its type. */
export type NodePayload = Record<string, Json | undefined>;

// --- the composed record -----------------------------------------------------

/** A placed node with its placed descendants attached. */
export type NodeTree = BuildNode & { children: NodeTree[] };

/**
 * Everything a consumer needs to render one build, assembled by one call.
 *
 * Consumers take this shape whole. They do not assemble it themselves — that
 * is what produced the fifteen-query home feed.
 */
export interface BuildRecord {
  build: Build;
  /** Placed nodes (position IS NOT NULL), nested and ordered. */
  tree: NodeTree[];
  /** Unplaced nodes (position IS NULL), oldest first. */
  tray: BuildNode[];
  events: BuildEvent[];
  nodeTypes: NodeType[];
}

// --- errors ------------------------------------------------------------------

/**
 * Every Supabase failure in this module is rethrown through here so the message
 * names the operation that failed. It lives in types.ts because this module is
 * a fixed file list with no room for a _shared.ts.
 */
export function buildLayerError(operation: string, cause: unknown): Error {
  const detail =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : String(cause);
  const error = new Error(`${operation} failed: ${detail}`);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}
