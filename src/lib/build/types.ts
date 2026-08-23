// Shared types for the build record data layer.
//
// A build is a typed record, not a document: a nested tree of typed nodes plus
// an ordered event sequence. Row types are derived from the generated Supabase
// types so a schema change surfaces here as a type error rather than at runtime.

import type { Database, Json } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Build = Tables["builds"]["Row"];
export type BuildInsert = Tables["builds"]["Insert"];
export type BuildUpdate = Tables["builds"]["Update"];

export type BuildNode = Tables["build_nodes"]["Row"];
export type BuildNodeInsert = Tables["build_nodes"]["Insert"];
export type BuildNodeUpdate = Tables["build_nodes"]["Update"];

export type NodeType = Tables["node_types"]["Row"];

export type BuildEvent = Tables["build_events"]["Row"];
export type BuildEventInsert = Tables["build_events"]["Insert"];
export type BuildEventUpdate = Tables["build_events"]["Update"];

/** A placed node with its placed descendants attached. */
export type NodeTree = BuildNode & { children: NodeTree[] };

// The check constraints on the tables, restated for consumers that need to
// switch exhaustively. The generated row types widen all of these to string.
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
export type NodeCategory =
  | "instruction"
  | "configuration"
  | "data"
  | "artefact"
  | "evidence"
  | "narrative";
export type EventKind = "prompt" | "milestone" | "breakage" | "deploy" | "note";
export type EventVisibility = "kept" | "folded" | "hidden";

// --- the payload schema dialect (see the NS-P02 migration header) -----------
//
// node_types.schema is not JSON Schema. It is { fields: FieldDef[] }, where
// every field is one of exactly six types. `format` is a widget hint on a
// string field and does not change the storage type. `of` describes the shape
// of a list's rows, one level of nesting only.

export type FieldType = "string" | "text" | "number" | "boolean" | "enum" | "list";
export type FieldFormat = "node_id" | "media_id" | "url" | "timestamp";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Absent means false. */
  required?: boolean;
  help?: string;
  /** Present on enum fields. */
  options?: string[];
  /** Present on list fields: the shape of one row. */
  of?: FieldDef[];
  /** Present on some string fields. */
  format?: FieldFormat;
}

export interface NodeSchema {
  fields: FieldDef[];
}

/** A node's payload, keyed by FieldDef.key. */
export type NodePayload = Record<string, Json>;

/**
 * The composed build record. Every consumer in this sequence reads this shape
 * rather than assembling it itself.
 */
export interface BuildRecord {
  build: Build;
  tree: NodeTree[];
  tray: BuildNode[];
  events: BuildEvent[];
  nodeTypes: NodeType[];
}

/**
 * Wraps a Supabase error so the thrown message names the operation that
 * failed. Lives here rather than in a _shared module because this slice is
 * specified as a fixed file list.
 */
export function buildLayerError(operation: string, error: { message?: string } | null): Error {
  const detail = error?.message ?? "unknown error";
  return new Error(`build layer: ${operation} failed — ${detail}`);
}

/** Default ceiling on any list query in this module. */
export const DEFAULT_LIMIT = 500;
