// The Drafts page's list: a creator's drafts and how many sessions each holds.
//
// One request: a title, a date and a count from `builds`, no `post_doc` and no `making` (SV-03 P2). The old Drafts.tsx
// reads content_items and content_blocks; this list reads neither, and the new page must not.
//
// session_count is newer than the generated types, so the read goes through a narrow cast, as getBuildFeed.ts does.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";

const DRAFTS_LIMIT = 50;

/** What a draft row on the list needs, and no more. */
export const DRAFT_LIST_COLUMNS = "id, title, updated_at, session_count";

export interface DraftListItem {
  id: string;
  title: string;
  updatedAt: string;
  sessionCount: number;
}

interface DraftRow {
  id: string;
  title: string;
  updated_at: string;
  session_count: number | null;
}

interface DraftQuery extends PromiseLike<{ data: DraftRow[] | null; error: unknown }> {
  eq: (column: string, value: string) => DraftQuery;
  order: (column: string, options: { ascending: boolean }) => DraftQuery;
  limit: (count: number) => DraftQuery;
}

interface DraftsTable {
  select: (columns: string) => DraftQuery;
}

/** The creator's drafts, most recently worked on first, at most fifty. The creator comes from the caller's session. */
export async function listDraftsWithSessions(creatorId: string | null | undefined): Promise<DraftListItem[]> {
  if (!creatorId) return [];

  const { data, error } = await (supabase as unknown as { from: (t: string) => DraftsTable })
    .from("builds")
    .select(DRAFT_LIST_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(DRAFTS_LIMIT);
  if (error) throw buildLayerError("listDraftsWithSessions", error);

  return (data ?? []).map((draft) => ({
    id: draft.id,
    title: draft.title,
    updatedAt: draft.updated_at,
    sessionCount: typeof draft.session_count === "number" ? Math.max(0, draft.session_count) : 0,
  }));
}

// -----------------------------------------------------------------------------
// Empty drafts (SV-03 P2)
// -----------------------------------------------------------------------------
//
// A draft is empty when it has no title, no sessions, no tiles, no files and no post. "Remove empty drafts (N)" at the foot
// of Drafts removes them in one delete. The candidates are cut down in the database (this maker's untitled drafts with no
// sessions); tiles, files and the post are judged on what comes back, because they live in other tables and in a document.

const EMPTY_LIMIT = 200;
const UNTITLED = "Untitled build";

export const EMPTY_DRAFT_COLUMNS =
  "id, title, session_count, post_doc, build_nodes!build_nodes_build_id_fkey(count), build_media!build_media_build_id_fkey(count)";

/** No post, an empty document, or paragraphs with nothing but blanks in them. Anything else (words, a picture) is a post. */
export function isEmptyPost(doc: unknown): boolean {
  if (doc === null || doc === undefined) return true;
  if (typeof doc !== "object") return false;
  const node = doc as { type?: unknown; text?: unknown; content?: unknown };
  if (node.type === "text") return typeof node.text !== "string" || node.text.trim() === "";
  if (node.type !== "doc" && node.type !== "paragraph") return false;
  if (!Array.isArray(node.content)) return true;
  return node.content.every(isEmptyPost);
}

interface EmptyRow {
  id: string;
  title: string | null;
  session_count: number | null;
  post_doc: unknown;
  build_nodes: Array<{ count: number }> | null;
  build_media: Array<{ count: number }> | null;
}

interface EmptyQuery extends PromiseLike<{ data: EmptyRow[] | null; error: unknown }> {
  eq: (column: string, value: string | number) => EmptyQuery;
  or: (filter: string) => EmptyQuery;
  limit: (count: number) => EmptyQuery;
}

interface DeleteQuery extends PromiseLike<{ data: Array<{ id: string }> | null; error: unknown }> {
  in: (column: string, values: string[]) => DeleteQuery;
  eq: (column: string, value: string) => DeleteQuery;
  select: (columns: string) => DeleteQuery;
}

interface EmptyTable {
  select: (columns: string) => EmptyQuery;
  delete: () => DeleteQuery;
}

const countOf = (embed: Array<{ count: number }> | null) => embed?.[0]?.count ?? 0;

/** The ids of this maker's drafts that have nothing in them, newest first as the database gave them. */
export async function listEmptyDraftIds(creatorId: string | null | undefined): Promise<string[]> {
  if (!creatorId) return [];
  const table = (supabase as unknown as { from: (t: string) => EmptyTable }).from("builds");
  const { data, error } = await table
    .select(EMPTY_DRAFT_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .eq("session_count", 0)
    .or(`title.eq.,title.eq.${UNTITLED}`)
    .limit(EMPTY_LIMIT);
  if (error) throw buildLayerError("listEmptyDraftIds", error);

  return (data ?? [])
    .filter((draft) => countOf(draft.build_nodes) === 0 && countOf(draft.build_media) === 0 && isEmptyPost(draft.post_doc))
    .map((draft) => draft.id);
}

/**
 * Remove the drafts that are empty now. The list is read again first, so a draft that gained something since the page
 * opened stays; then one delete, scoped to this maker's drafts. Resolves how many went.
 */
export async function removeEmptyDrafts(creatorId: string | null | undefined): Promise<number> {
  if (!creatorId) return 0;
  const ids = await listEmptyDraftIds(creatorId);
  if (ids.length === 0) return 0;

  const table = (supabase as unknown as { from: (t: string) => EmptyTable }).from("builds");
  const { data, error } = await table.delete().in("id", ids).eq("creator_id", creatorId).eq("status", "draft").select("id");
  if (error) throw buildLayerError("removeEmptyDrafts", error);
  return (data ?? []).length;
}
