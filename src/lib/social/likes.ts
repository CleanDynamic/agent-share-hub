// Liking a build (RC-P15).
//
// A like is one build_likes row per (build, reader). Anyone who can read the
// build can read its likes; only the reader adds or removes their own
// (20261001180000_rc_build_social.sql). builds.like_count follows by trigger,
// so nothing here counts.
//
// ONE REQUEST FOR A LIST. getMyLikes answers "which of these do I like?" for a
// whole grid of cards at once ⟦neoscale-performance⟧: one request whatever the
// number of ids, and none when nobody is signed in or there is nothing to ask.

import { currentUserId, db, isDuplicate, signedOutError, socialError, uniqueIds, type ReactionRow } from "./types";

/**
 * Like a build as the signed-in reader. Liking a build twice is not an error:
 * the second like finds the first already there, which is the state asked for.
 */
export async function likeBuild(buildId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("likeBuild", { buildId });

  const response = await db.from("build_likes").insert({ build_id: buildId, user_id: userId });
  if (response.error && !isDuplicate(response.error)) {
    throw socialError("likeBuild", response, { buildId });
  }
}

/** Remove the signed-in reader's like. Removing a like that is not there is not an error. */
export async function unlikeBuild(buildId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("unlikeBuild", { buildId });

  const response = await db.from("build_likes").delete().eq("build_id", buildId).eq("user_id", userId);
  if (response.error) throw socialError("unlikeBuild", response, { buildId });
}

/**
 * The ids, among these, of the builds the signed-in reader likes. One request
 * for the whole list; none when signed out or given no ids.
 */
export async function getMyLikes(buildIds: readonly string[]): Promise<Set<string>> {
  const ids = uniqueIds(buildIds);
  if (ids.length === 0) return new Set();

  const userId = await currentUserId();
  if (!userId) return new Set();

  const response = await db
    .from("build_likes")
    .select("build_id")
    .eq("user_id", userId)
    .in("build_id", ids)
    .limit(ids.length);
  if (response.error) throw socialError("getMyLikes", response);

  return new Set(((response.data ?? []) as Pick<ReactionRow, "build_id">[]).map((row) => row.build_id));
}
