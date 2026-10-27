// SV-12 P2: the Map of each build on a page of Builds, read on demand.
//
// ONE REQUEST for the page's builds: each build's `making` (its sessions, order, parts) and its placed nodes, named
// columns only. Then the composer's own functions, none of them new: `buildSteps`, `sessionGroups` (which numbers the
// sessions with SV-05's function) and `sessionMapFor`. The layout (`layoutSessionMap`) is the composer's too and is run
// by the view's model for the direction being shown, so Horizontal and Vertical swap without another read.
//
// Loaded by a dynamic import from the page, so the graph and the Map code are a chunk of their own.

import { supabase } from "@/integrations/supabase/client";
import { buildSteps, madeFileNamesOf, madeFilesOf, sessionGroups } from "./graph";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf, type Making } from "./making";
import { nestNodes } from "./nodes";
import { sessionMapFor, type MapPieceLike, type SessionMapModel } from "./sessionMap";
import { buildLayerError, type BuildNode } from "./types";

/** The columns the Map reads from a node, and nothing else (`NODE_COLUMNS` less what `buildSteps` ignores). */
export const MAP_NODE_COLUMNS = "id, parent_id, position, type, title, payload, is_gap";
/** A build far past this is a data problem, as in `getNodeTree`. */
const NODE_LIMIT = 2000;
/** A page of Maps is 24 builds (`MAPS_PAGE` in the page's model); the read refuses to be asked for many more. */
const BUILDS_LIMIT = 100;

export interface BuildMap {
  buildId: string;
  /** Absent when the build has no sessions (nothing placed yet). */
  model: SessionMapModel | null;
}

interface MapRow {
  id: string;
  making: unknown;
  build_nodes: (Pick<BuildNode, "id" | "parent_id" | "position" | "type" | "title" | "payload"> & { is_gap: boolean | null })[] | null;
}

interface MapQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  in(column: string, values: readonly unknown[]): MapQuery;
  not(column: string, operator: string, value: unknown): MapQuery;
  order(column: string, options: { ascending: boolean; referencedTable?: string }): MapQuery;
  limit(count: number, options?: { referencedTable: string }): MapQuery;
}

/** The Map of one build from its row. PURE. */
export function buildMapOf(row: MapRow): BuildMap {
  const nodes = (row.build_nodes ?? []).map((node) => ({ ...node, build_id: row.id, note: null, source_ref: null, event_id: null, is_gap: node.is_gap === true, created_at: "" }) as unknown as BuildNode);
  const tree = nestNodes(nodes);
  const steps = buildSteps(tree);
  const record = (row.making && typeof row.making === "object" && !Array.isArray(row.making) ? row.making : {}) as Making;
  const groups = sessionGroups(
    steps,
    Array.isArray(record.sessions) ? record.sessions : [],
    record.session_tools && typeof record.session_tools === "object" ? (record.session_tools as Record<string, string>) : {},
    sessionsMetaOf(record),
    sessionOrderOf(record),
    storedWorkstreamsOf(record),
  );
  const makers = madeFilesOf(tree);
  const names = madeFileNamesOf(tree);
  const files: MapPieceLike[] = [...makers].map(([id, madeBy]) => ({ id, name: names.get(id) ?? "", madeBy }));
  const model = sessionMapFor({ groups, steps, files, making: record });
  return { buildId: row.id, model: model.sessions.length > 0 ? model : null };
}

/** The Maps of these builds, in the order asked. One request. */
export async function listBuildMaps(ids: readonly string[]): Promise<BuildMap[]> {
  const wanted = ids.slice(0, BUILDS_LIMIT);
  if (wanted.length === 0) return [];
  const query = (supabase as unknown as { from: (table: string) => { select: (columns: string) => MapQuery } })
    .from("builds")
    .select(`id, making, build_nodes!build_nodes_build_id_fkey(${MAP_NODE_COLUMNS})`)
    .in("id", wanted)
    .not("build_nodes.position", "is", null)
    .order("position", { ascending: true, referencedTable: "build_nodes" })
    .limit(NODE_LIMIT, { referencedTable: "build_nodes" })
    .limit(BUILDS_LIMIT);
  const { data, error } = await query;
  if (error) throw buildLayerError("listBuildMaps", error);
  const byId = new Map(((data ?? []) as MapRow[]).map((row) => [row.id, buildMapOf(row)]));
  return wanted.map((id) => byId.get(id) ?? { buildId: id, model: null });
}
