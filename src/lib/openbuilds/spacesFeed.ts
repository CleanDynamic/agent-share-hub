// What the OpenBuilds pages read about spaces beyond UX-04's own functions (UX-05): who is in a space, which are busy, how many
// posts are new, who a post can go to, and adding a moderator by @handle. Named columns and a limit on every list.

import { currentUserId } from "@/lib/social/types";
import { listMySpaces, listSpaces, setModerator } from "./spaces";
import { PostError, SPACE_COLUMNS, db, postLayerError, signedOut, toSpace, unique, type Space, type SpaceRow } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_ROWS = 1000;
const MEMBER_ROWS = 5000;

export interface SpaceCrowd {
  space: Space;
  creator: { id: string; handle: string | null };
  moderators: { id: string; handle: string | null; name: string | null; avatarUrl: string | null }[];
  members: number;
  /** The reader's place: none, a member, or a moderator (the creator is one). */
  role: "none" | "member" | "moderator";
}

interface MemberRow {
  user_id: string;
  role: "member" | "moderator";
  profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

/** One space with its creator, moderators, member count and the reader's role. Null when there is no such space. */
export async function getSpaceCrowd(slug: string, viewerId: string | null): Promise<SpaceCrowd | null> {
  const found = await db.from("spaces").select(SPACE_COLUMNS).eq("slug", slug.trim().toLowerCase()).limit(1).maybeSingle();
  if (found.error) throw postLayerError("getSpaceCrowd", found);
  if (!found.data) return null;
  const space = toSpace(found.data as SpaceRow);
  const [members, count, creator] = await Promise.all([
    db
      .from("space_members")
      .select("user_id, role, profile:profiles(username, display_name, avatar_url)")
      .eq("space_id", space.id)
      .eq("role", "moderator")
      .limit(20),
    db.from("space_members").select("user_id", { count: "estimated", head: true }).eq("space_id", space.id),
    db.from("profiles").select("id, username").eq("id", space.creatorId).limit(1).maybeSingle(),
  ]);
  if (members.error) throw postLayerError("getSpaceCrowd", members);
  if (count.error) throw postLayerError("getSpaceCrowd", count);
  const moderators = ((members.data ?? []) as unknown as MemberRow[]).map((row) => ({ id: row.user_id, handle: row.profile?.username ?? null, name: row.profile?.display_name ?? null, avatarUrl: row.profile?.avatar_url ?? null }));
  let role: SpaceCrowd["role"] = "none";
  if (viewerId) {
    if (moderators.some((moderator) => moderator.id === viewerId) || space.creatorId === viewerId) role = "moderator";
    else {
      const mine = await db.from("space_members").select("user_id").eq("space_id", space.id).eq("user_id", viewerId).limit(1).maybeSingle();
      if (mine.error) throw postLayerError("getSpaceCrowd", mine);
      role = mine.data ? "member" : "none";
    }
  }
  return { space, creator: { id: space.creatorId, handle: (creator.data as { username: string | null } | null)?.username ?? null }, moderators, members: count.count ?? 0, role };
}

/** The post times in the last week in each of these spaces, newest first (at most a thousand rows in all). */
export async function listRecentPostTimes(spaceIds: readonly string[], now: number = Date.now()): Promise<Record<string, string[]>> {
  const ids = unique(spaceIds);
  if (ids.length === 0) return {};
  const response = await db
    .from("post_spaces")
    .select("space_id, created_at")
    .in("space_id", ids)
    .gte("created_at", new Date(now - WEEK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(RECENT_ROWS);
  if (response.error) throw postLayerError("listRecentPostTimes", response);
  const out: Record<string, string[]> = {};
  for (const row of (response.data ?? []) as { space_id: string; created_at: string }[]) (out[row.space_id] ??= []).push(row.created_at);
  return out;
}

export interface BusySpace {
  space: Space;
  creatorHandle: string | null;
  members: number;
  recent: number;
}

/** The spaces with the most new posts this week, most first. Two reads in turn: the week's posts, then the winners' details. */
export async function listBusySpaces(options: { limit?: number; now?: number } = {}): Promise<BusySpace[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const now = options.now ?? Date.now();
  const response = await db
    .from("post_spaces")
    .select("space_id")
    .gte("created_at", new Date(now - WEEK_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(RECENT_ROWS);
  if (response.error) throw postLayerError("listBusySpaces", response);
  const tally = new Map<string, number>();
  for (const row of (response.data ?? []) as { space_id: string }[]) tally.set(row.space_id, (tally.get(row.space_id) ?? 0) + 1);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return [];
  const ids = top.map(([id]) => id);
  const [spaces, members] = await Promise.all([
    db.from("spaces").select(SPACE_COLUMNS).in("id", ids).limit(ids.length),
    db.from("space_members").select("space_id").in("space_id", ids).limit(MEMBER_ROWS),
  ]);
  if (spaces.error) throw postLayerError("listBusySpaces", spaces);
  if (members.error) throw postLayerError("listBusySpaces", members);
  const rows = (spaces.data ?? []) as SpaceRow[];
  const creatorIds = unique(rows.map((row) => row.creator_id));
  const creators = creatorIds.length ? await db.from("profiles").select("id, username").in("id", creatorIds).limit(creatorIds.length) : { data: [], error: null };
  if (creators.error) throw postLayerError("listBusySpaces", creators);
  const handleOf = new Map(((creators.data ?? []) as { id: string; username: string | null }[]).map((row) => [row.id, row.username]));
  const memberCount = new Map<string, number>();
  for (const row of (members.data ?? []) as { space_id: string }[]) memberCount.set(row.space_id, (memberCount.get(row.space_id) ?? 0) + 1);
  return top.flatMap(([id, recent]) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? [{ space: toSpace(row), creatorHandle: handleOf.get(row.creator_id) ?? null, members: memberCount.get(id) ?? 0, recent }] : [];
  });
}

/** The spaces a new post can go to: the ones the reader belongs to, and those anyone can post in. The database is the judge of each post. */
export async function listPostableSpaces(): Promise<Space[]> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("listPostableSpaces");
  const [mine, everyone] = await Promise.all([listMySpaces(), listSpaces({ limit: 50 })]);
  const seen = new Set<string>();
  return [...mine, ...everyone.spaces.filter((space) => space.whoCanPost === "anyone")].filter((space) => (seen.has(space.id) ? false : (seen.add(space.id), true)));
}

/** A handle as people type it: "@ola", " ola ". */
export const cleanHandle = (value: string): string => value.trim().replace(/^@+/, "").toLowerCase();

/** Make the person with this @handle a moderator: they join the space (invited) if they are not in it, then take the role. */
export async function addModeratorByHandle(spaceId: string, handle: string): Promise<{ id: string; handle: string }> {
  const clean = cleanHandle(handle);
  if (!clean) throw new PostError("addModeratorByHandle", "Type a handle, like @ola.");
  const found = await db.from("profiles").select("id, username").eq("username", clean).limit(1).maybeSingle();
  if (found.error) throw postLayerError("addModeratorByHandle", found);
  const person = found.data as { id: string; username: string } | null;
  if (!person) throw new PostError("addModeratorByHandle", `No one has the handle @${clean}.`);
  const joined = await db.from("space_members").insert({ space_id: spaceId, user_id: person.id, role: "member", invited: true });
  if (joined.error && joined.error.code !== "23505") throw postLayerError("addModeratorByHandle", joined, "Only a moderator can add people.");
  await setModerator(spaceId, person.id, true);
  return { id: person.id, handle: person.username };
}

/** A web address for a new space's name: lower case, words joined by hyphens, at most 40 characters. */
export function slugOf(name: string): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");
  return slug || "space";
}

/** People by @handle for mentions: the ids of the handles that match a profile. */
export async function resolveMentionIds(body: string): Promise<string[]> {
  const handles = [...new Set((body.match(/(?:^|[^\w@])@([a-zA-Z0-9_]{1,30})/g) ?? []).map((match) => match.replace(/^[^@]*@/, "").toLowerCase()))].slice(0, 20);
  if (handles.length === 0) return [];
  const response = await db.from("profiles").select("id, username").in("username", handles).limit(handles.length);
  if (response.error) return [];
  return unique(((response.data ?? []) as { id: string }[]).map((row) => row.id));
}
