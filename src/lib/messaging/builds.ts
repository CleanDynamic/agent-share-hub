// Builds in messages (RC-P20).
//
// ONE REFERENCE KIND ⟦hicks-law⟧. What a reader can put in a message is a
// build: one of their own published builds or one they saved, merged, the
// most recent first (their publishing or their saving), at most twenty
// shown. The search box's words go through normaliseQuery, as the gallery's
// do, and filter both lists by title.
//
// A BUILD MESSAGE IS A TEXT MESSAGE whose shared_build_id is set
// (20261001210000_rc_dm_builds.sql): its words, if any, are the note, and the
// card is drawn from the build as the reader may read it now.
//
// MESSAGE WORDS NEVER REACH AN ERROR ⟦neoscale-error-monitoring › Privacy⟧,
// nor do the search box's: failures are SocialErrors, identifiers only.

import { normaliseQuery } from "@/lib/build/search";
import type { GalleryBuild } from "@/lib/build/gallery";
import { resolveBuildItems } from "@/lib/library/resolveItems";
import { currentUserId, db, signedOutError, socialError, uniqueIds } from "@/lib/social/types";

/** The most builds the picker shows. */
export const SHAREABLE_BUILDS_MAX = 20;

export interface ShareableBuild {
  id: string;
  slug: string;
  title: string;
  /** Why it is offered: the reader made it, or saved it. */
  source: "yours" | "saved";
  /** When the reader published it or saved it: the order. */
  at: string;
}

interface OwnRow {
  id: string;
  slug: string;
  title: string | null;
  published_at: string | null;
  created_at: string;
}

interface SaveRow {
  build_id: string;
  created_at: string;
}

interface TitleRow {
  id: string;
  slug: string;
  title: string | null;
}

/** PostgREST's ilike wildcards, escaped, so a reader's % or _ is a character. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * The builds a reader can put in a message: their own published builds and
 * the ones they saved, merged, most recent first, at most twenty. Three
 * requests: their builds, their saves, and the saved builds' titles.
 */
export async function listShareableBuilds(options: { query?: string | null } = {}): Promise<ShareableBuild[]> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("listShareableBuilds");
  const query = normaliseQuery(options.query);

  let own = db
    .from("builds")
    .select("id, slug, title, published_at, created_at")
    .eq("creator_id", userId)
    .in("status", ["published", "gallery"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(SHAREABLE_BUILDS_MAX);
  if (query) own = own.ilike("title", likePattern(query));

  const saves = db
    .from("build_saves")
    .select("build_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(SHAREABLE_BUILDS_MAX);

  const [ownResponse, savesResponse] = await Promise.all([own, saves]);
  if (ownResponse.error) throw socialError("listShareableBuilds (own)", ownResponse);
  if (savesResponse.error) throw socialError("listShareableBuilds (saves)", savesResponse);

  const saveRows = (savesResponse.data ?? []) as SaveRow[];
  const savedIds = uniqueIds(saveRows.map((row) => row.build_id));
  let titles: TitleRow[] = [];
  if (savedIds.length > 0) {
    let saved = db.from("builds").select("id, slug, title").in("id", savedIds).limit(savedIds.length);
    if (query) saved = saved.ilike("title", likePattern(query));
    const savedResponse = await saved;
    if (savedResponse.error) throw socialError("listShareableBuilds (saved)", savedResponse);
    titles = (savedResponse.data ?? []) as TitleRow[];
  }
  const titleById = new Map(titles.map((row) => [row.id, row]));

  const byId = new Map<string, ShareableBuild>();
  const offer = (build: ShareableBuild) => {
    const held = byId.get(build.id);
    if (!held || held.at < build.at) byId.set(build.id, build);
  };
  for (const row of (ownResponse.data ?? []) as OwnRow[]) {
    offer({ id: row.id, slug: row.slug, title: row.title?.trim() || "Untitled build", source: "yours", at: row.published_at ?? row.created_at });
  }
  for (const save of saveRows) {
    const row = titleById.get(save.build_id);
    if (row) offer({ id: row.id, slug: row.slug, title: row.title?.trim() || "Untitled build", source: "saved", at: save.created_at });
  }

  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, SHAREABLE_BUILDS_MAX);
}

/** The builds a thread's messages carry, as the gallery's cards read them. One request. */
export async function getSharedBuilds(buildIds: readonly string[]): Promise<Map<string, GalleryBuild>> {
  return resolveBuildItems(buildIds);
}

/**
 * Send a build, with an optional note, as the signed-in reader. The thread's
 * preview says a build was shared; the note stays in the message.
 */
export async function sendBuildMessage(threadId: string, buildId: string, note?: string | null): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("sendBuildMessage", { buildId });

  const words = (note ?? "").trim();
  const response = await db.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: userId,
    kind: "text",
    message_type: "text",
    body: words || null,
    text_content: words || null,
    shared_build_id: buildId,
  });
  if (response.error) throw socialError("sendBuildMessage", response, { buildId });

  const bump = await db
    .from("dm_threads")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: "Shared a build",
      last_message_sender_id: userId,
    })
    .eq("id", threadId);
  if (bump.error) throw socialError("sendBuildMessage (thread)", bump, { buildId });
}
