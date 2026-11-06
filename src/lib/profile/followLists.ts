// UX-10 P5b: a person's followers and the people they follow, newest first, 30 a page, each with whether the reader follows
// them: one request per page (list_profile_follows, 20261109120000). A private profile the reader does not follow lists nobody.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "@/lib/build/types";

export type FollowList = "followers" | "following";

export const FOLLOWS_PAGE = 30;

export interface FollowPerson {
  id: string;
  handle: string | null;
  name: string;
  avatarUrl: string | null;
  /** Their one line (bio), or null. */
  line: string | null;
  /** When the follow was made: the page's cursor. */
  at: string;
  readerFollows: boolean;
}

export interface FollowPage {
  people: FollowPerson[];
  next: string | null;
}

interface FollowRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followed_at: string;
  reader_follows: boolean;
}

type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

export async function listProfileFollows(handle: string, which: FollowList, cursor: string | null = null): Promise<FollowPage> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)("list_profile_follows", { p_username: handle, p_which: which, p_cursor: cursor, p_limit: FOLLOWS_PAGE });
  if (error) throw buildLayerError("listProfileFollows", error);
  const rows = (data ?? []) as FollowRow[];
  return {
    people: rows.map((row) => ({
      id: row.user_id,
      handle: row.username,
      name: (row.display_name ?? "").trim() || row.username || "Someone",
      avatarUrl: row.avatar_url,
      line: row.bio?.trim() || null,
      at: row.followed_at,
      readerFollows: Boolean(row.reader_follows),
    })),
    next: rows.length < FOLLOWS_PAGE ? null : (rows[rows.length - 1]?.followed_at ?? null),
  };
}
