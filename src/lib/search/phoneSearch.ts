// The phone search page's two other kinds (prompt 19): topics and people. Builds come from the repo's own search
// (`listGallery({ query })`, which calls `search_build_ids`); these two read the tables the rest of the site reads: a topic
// is a root `openbuild_posts` row that is not hidden, matched on its text, and a person is a `profiles` row matched on the
// handle or the name, as the mention picker matches them. Each returns at most `LIMIT` rows and the count of all matches.
//
// THE QUERY NEVER LEAVES IN AN ERROR (neoscale-error-monitoring, Privacy): a failure names the read and the database's code only.

import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/openbuilds/types";

/** The most rows a group shows. */
export const PHONE_SEARCH_LIMIT = 20;
/** A topic's row title is its first line, cut to this many characters. */
export const TOPIC_TITLE_MAX = 90;

export interface TopicHit {
  id: string;
  /** The first line of the topic's text. */
  title: string;
  /** "@handle", or null when the author has none. */
  by: string | null;
}

export interface PersonHit {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
}

export interface Hits<T> {
  rows: T[];
  total: number;
}

/** `%text%` for a LIKE, with the characters that would end a filter or act as wildcards taken out. */
export const likePattern = (query: string): string => `%${query.trim().replace(/[%_,()\\]/g, " ").replace(/\s+/g, " ").trim()}%`;

/** A topic's first line, cut with an ellipsis. */
export function firstLine(body: string | null | undefined): string {
  const line = (body ?? "").split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  return line.length > TOPIC_TITLE_MAX ? `${line.slice(0, TOPIC_TITLE_MAX - 1).trimEnd()}…` : line;
}

const failed = (read: string, error: unknown): Error => {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code ?? "") : "";
  return new Error(`${read}: ${code ? `code ${code}` : "no error code"}`);
};

interface TopicRow {
  id: string;
  body: string | null;
  author: { username: string | null } | { username: string | null }[] | null;
}

export async function searchTopics(query: string): Promise<Hits<TopicHit>> {
  const response = await db
    .from("openbuild_posts")
    .select("id, body, author:profiles!openbuild_posts_author_id_fkey(username)", { count: "exact" })
    .is("parent_id", null)
    .is("hidden_by", null)
    .ilike("body", likePattern(query))
    .order("created_at", { ascending: false })
    .limit(PHONE_SEARCH_LIMIT);
  if (response.error) throw failed("searchTopics", response.error);
  const rows = ((response.data ?? []) as unknown as TopicRow[]).map((row) => {
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    return { id: row.id, title: firstLine(row.body), by: author?.username ? `@${author.username}` : null };
  });
  return { rows: rows.filter((row) => row.title), total: response.count ?? rows.length };
}

interface PersonRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export async function searchPeople(query: string): Promise<Hits<PersonHit>> {
  const pattern = likePattern(query);
  const { data, error, count } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url", { count: "exact" })
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(PHONE_SEARCH_LIMIT);
  if (error) throw failed("searchPeople", error);
  const rows = ((data ?? []) as PersonRow[])
    .filter((row): row is PersonRow & { username: string } => Boolean(row.username))
    .map((row) => ({ id: row.id, handle: row.username, name: row.display_name?.trim() || `@${row.username}`, avatarUrl: row.avatar_url }));
  return { rows, total: count ?? rows.length };
}

/** "3 people", "1 topic": the count as the heading. */
export const groupHeading = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;
