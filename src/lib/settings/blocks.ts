// UX-15 P5: blocking, from the browser.
//
// A block is a row in `user_blocks` that only its blocker can read, write or delete (RLS). Everything a block closes is closed in the
// database (20261111120000_ux15_settings_blocking.sql); these functions only make and remove the row and say what it means to the page.
//
// WHAT THE PAGE IS TOLD. `blockStateOf` answers for one other person: `by_me` (I blocked them), `by_them` (the database says the pair
// is blocked and my own list does not have them), or `none`. It is the one place the pair check is asked of the database from a page.

import { supabase } from "@/integrations/supabase/client";

export type BlockState = "none" | "by_me" | "by_them";

export const BLOCK_COPY = {
  action: (handle: string) => `Block @${handle}`,
  confirm: (handle: string) => `Block @${handle}? They won't be told.`,
  confirmButton: "Block",
  unblock: "Unblock",
  youBlocked: (handle: string) => `You blocked @${handle}.`,
  /** The same sentence for any reason you cannot see their work: it says nothing of why. */
  cannotSee: (handle: string) => `You can't see @${handle}'s builds or posts.`,
  collapsedReply: "A reply from someone you blocked",
  showReply: "Show reply",
  none: "You haven't blocked anyone.",
  how: "When you block someone, you stop following each other. They can't follow you, message you, reply to you, mention you or like your work, and you won't see each other's builds, topics or replies in your feeds. They aren't told. Your public builds stay public.",
} as const;

export interface BlockedPerson {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  blockedAt: string;
}

/** The people I have blocked, newest first. RLS returns only my own rows. */
export async function listBlocks(limit = 200): Promise<BlockedPerson[]> {
  const { data, error } = await supabase
    .from("user_blocks" as never)
    .select("blocked_id, created_at, blocked:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_url)" as never)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = { blocked_id: string; created_at: string; blocked: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.blocked_id,
    username: row.blocked?.username ?? null,
    displayName: row.blocked?.display_name ?? null,
    avatarUrl: row.blocked?.avatar_url ?? null,
    blockedAt: row.created_at,
  }));
}

/** Just the ids I have blocked: what a page needs to collapse their replies. */
export async function listBlockedIds(limit = 500): Promise<string[]> {
  const { data, error } = await supabase.from("user_blocks" as never).select("blocked_id" as never).limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { blocked_id: string }[]).map((row) => row.blocked_id);
}

export async function blockUser(me: string, other: string): Promise<void> {
  if (me === other) return;
  const { error } = await supabase.from("user_blocks" as never).insert({ blocker_id: me, blocked_id: other } as never);
  // A second press finds the row there already: that is a block.
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

export async function unblockUser(me: string, other: string): Promise<void> {
  const { error } = await supabase.from("user_blocks" as never).delete().eq("blocker_id", me).eq("blocked_id", other);
  if (error) throw error;
}

/** Where a pair stands, for the one page that shows the other person. Two reads in one round: my own row, and the pair check. */
export async function blockStateOf(me: string, other: string): Promise<BlockState> {
  if (me === other) return "none";
  const [mine, pair] = await Promise.all([
    supabase.from("user_blocks" as never).select("blocked_id" as never).eq("blocked_id", other).limit(1).maybeSingle(),
    supabase.rpc("is_blocked_between" as never, { a: me, b: other } as never),
  ]);
  if (mine.error) throw mine.error;
  if (pair.error) throw pair.error;
  if (mine.data) return "by_me";
  return pair.data === true ? "by_them" : "none";
}

export const blockKeys = {
  list: ["settings", "listBlocks"] as const,
  ids: (viewerId: string | null) => ["settings", "listBlockedIds", viewerId] as const,
  state: (viewerId: string | null, otherId: string | null) => ["settings", "blockStateOf", viewerId, otherId] as const,
};

/** A reply by someone I blocked collapses to one row; the rest of the thread reads as before. */
export function isCollapsed(authorId: string | null | undefined, blocked: ReadonlySet<string>): boolean {
  return !!authorId && blocked.has(authorId);
}
