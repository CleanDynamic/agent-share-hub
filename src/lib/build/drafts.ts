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
  /** UX-03 P7: the first prompt's text, for a draft with no title to be shown by (`listDraftFirstPrompts`). Never written to the title. */
  firstPrompt?: string | null;
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
// First prompts (UX-03 P7)
// -----------------------------------------------------------------------------
//
// A draft with no title of its own is shown by its first prompt. Read beside the drafts, not inside their read, so the two start
// together (one round) and the drafts list is the same request it always was. Only the untitled drafts are asked about, and of
// each only one row: its top-level prompt with the lowest position, and of that only the text.

const UNTITLED_TITLES = ["", "Untitled build"];

export const DRAFT_PROMPT_COLUMNS = "id, first_prompt:build_nodes!build_nodes_build_id_fkey(text:payload->>text)";

interface DraftPromptQuery extends PromiseLike<{ data: { id: string; first_prompt?: { text: string | null }[] | null }[] | null; error: unknown }> {
  eq: (column: string, value: string) => DraftPromptQuery;
  in: (column: string, values: readonly string[]) => DraftPromptQuery;
  is: (column: string, value: null) => DraftPromptQuery;
  order: (column: string, options: { ascending: boolean; referencedTable?: string }) => DraftPromptQuery;
  limit: (count: number, options?: { referencedTable: string }) => DraftPromptQuery;
}

/** UX-03 P7: each untitled draft's first prompt, by draft id. A draft with no prompt is not in the map. */
export async function listDraftFirstPrompts(creatorId: string | null | undefined): Promise<Map<string, string>> {
  if (!creatorId) return new Map();
  const { data, error } = await (supabase as unknown as { from: (t: string) => { select: (columns: string) => DraftPromptQuery } })
    .from("builds")
    .select(DRAFT_PROMPT_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .in("title", UNTITLED_TITLES)
    .eq("first_prompt.type", "prompt")
    .is("first_prompt.parent_id", null)
    .order("updated_at", { ascending: false })
    .order("position", { ascending: true, referencedTable: "first_prompt" })
    .limit(1, { referencedTable: "first_prompt" })
    .limit(DRAFTS_LIMIT);
  if (error) throw buildLayerError("listDraftFirstPrompts", error);
  const out = new Map<string, string>();
  for (const row of data ?? []) {
    const text = (row.first_prompt?.[0]?.text ?? "").trim();
    if (text) out.set(row.id, text);
  }
  return out;
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
