// The counts a card and a build page show beside Like and Comment (RC-P15).
//
// builds.like_count and builds.comment_count are kept by triggers
// (20261001180000_rc_build_social.sql): comment_count counts only comments
// that are not hidden. Reading them is one request for a whole list of builds
// ⟦neoscale-performance⟧, and a build the reader cannot read is simply absent
// from the answer, as it is absent from every other read.

import { db, socialError, uniqueIds, type EngagementCountMap, type EngagementCountRow } from "./types";

/** Like and comment counts for these builds, in one request; none for no ids. */
export async function getEngagementCounts(buildIds: readonly string[]): Promise<EngagementCountMap> {
  const ids = uniqueIds(buildIds);
  if (ids.length === 0) return {};

  const response = await db
    .from("builds")
    .select("id, like_count, comment_count")
    .in("id", ids)
    .limit(ids.length);
  if (response.error) throw socialError("getEngagementCounts", response);

  const counts: EngagementCountMap = {};
  for (const row of (response.data ?? []) as EngagementCountRow[]) {
    counts[row.id] = { likes: Math.max(0, row.like_count ?? 0), comments: Math.max(0, row.comment_count ?? 0) };
  }
  return counts;
}
