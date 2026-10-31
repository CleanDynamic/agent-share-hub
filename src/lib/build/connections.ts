// How a build is used elsewhere (SV-25): public counts for the build page. No migration; both reads use indexes that exist.
//
// USED IN. A tile put in a build from another build's tile carries the source's id in source_ref->>'node_id' (SV-17,
// idx_build_nodes_source_node). The count is the number of OTHER builds with such a tile. build_nodes' policies already
// hide a build the reader can't see, so a draft is never counted. The ids go in parallel requests of CHUNK, one round.
//
// IN COLLECTIONS. collection_items.build_id (idx_collection_items_build), public collections only. The count is for one build
// through an index, so it is exact.

import { db, socialError } from "@/lib/social/types";

const CHUNK = 60;
const ROWS = 1000;

/** For each of these tiles, the number of other builds that used it; ids used nowhere are absent. */
export async function usedInCounts(buildId: string, nodeIds: readonly string[]): Promise<Map<string, number>> {
  const ids = [...new Set(nodeIds)];
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const chunks: string[][] = [];
  for (let at = 0; at < ids.length; at += CHUNK) chunks.push(ids.slice(at, at + CHUNK));
  const responses = await Promise.all(
    chunks.map((chunk) => db.from("build_nodes").select("build_id, node_id:source_ref->>node_id").in("source_ref->>node_id", chunk).neq("build_id", buildId).limit(ROWS)),
  );
  const builds = new Map<string, Set<string>>();
  for (const response of responses) {
    if (response.error) throw socialError("usedInCounts", response, { buildId });
    for (const row of (response.data ?? []) as { build_id: string; node_id: string | null }[]) {
      if (!row.node_id) continue;
      builds.set(row.node_id, (builds.get(row.node_id) ?? new Set()).add(row.build_id));
    }
  }
  for (const [id, set] of builds) out.set(id, set.size);
  return out;
}

/** How many public collections hold this build. */
export async function inCollectionsCount(buildId: string): Promise<number> {
  const response = await db.from("collection_items").select("id, collections!inner(is_public)", { count: "exact", head: true }).eq("build_id", buildId).eq("collections.is_public", true);
  if (response.error) throw socialError("inCollectionsCount", response, { buildId });
  return response.count ?? 0;
}
