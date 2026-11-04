// Spaces (UX-04 Part 1): user-made places for posts, run by hand by their creator and moderators.
// Reads are open to everyone; every write is the signed-in user's own, and the database decides what it allows.

import { currentUserId } from "@/lib/social/types";
import {
  PostError,
  SPACE_COLUMNS,
  db,
  pageLimit,
  postLayerError,
  signedOut,
  toSpace,
  type Space,
  type SpaceOrder,
  type SpaceReaction,
  type SpaceRole,
  type SpaceRow,
  type SpaceView,
  type SpaceWhoCanPost,
} from "./types";

export interface SpacesPage {
  spaces: Space[];
  /** The offset of the next page, or null at the end. */
  next: number | null;
}

/** Spaces, newest first, one request. */
export async function listSpaces(options: { limit?: number; offset?: number } = {}): Promise<SpacesPage> {
  const limit = pageLimit(options.limit);
  const from = Math.max(0, options.offset ?? 0);
  const response = await db.from("spaces").select(SPACE_COLUMNS).order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (response.error) throw postLayerError("listSpaces", response);
  const rows = (response.data ?? []) as SpaceRow[];
  return { spaces: rows.map(toSpace), next: rows.length < limit ? null : from + rows.length };
}

export interface MySpace extends Space {
  role: SpaceRole;
}

/** The spaces the signed-in user belongs to, one request. */
export async function listMySpaces(): Promise<MySpace[]> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("listMySpaces");
  const response = await db
    .from("space_members")
    .select(`role, space:spaces(${SPACE_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (response.error) throw postLayerError("listMySpaces", response);
  const rows = (response.data ?? []) as unknown as { role: SpaceRole; space: SpaceRow | null }[];
  return rows.flatMap((row) => (row.space ? [{ ...toSpace(row.space), role: row.role }] : []));
}

/** One space by its slug, or null. */
export async function getSpace(slug: string): Promise<Space | null> {
  const response = await db.from("spaces").select(SPACE_COLUMNS).eq("slug", slug.trim().toLowerCase()).limit(1).maybeSingle();
  if (response.error) throw postLayerError("getSpace", response);
  return response.data ? toSpace(response.data as SpaceRow) : null;
}

export interface SpaceInput {
  slug: string;
  name: string;
  description?: string;
  rules?: string;
  whoCanPost?: SpaceWhoCanPost;
  postOrder?: SpaceOrder;
  defaultView?: SpaceView;
  rewardsAllowed?: boolean;
  reactions?: SpaceReaction[];
}

const columnsOf = (input: Partial<SpaceInput>): Record<string, unknown> => ({
  ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : null),
  ...(input.name !== undefined ? { name: input.name.trim() } : null),
  ...(input.description !== undefined ? { description: input.description } : null),
  ...(input.rules !== undefined ? { rules: input.rules } : null),
  ...(input.whoCanPost !== undefined ? { who_can_post: input.whoCanPost } : null),
  ...(input.postOrder !== undefined ? { post_order: input.postOrder } : null),
  ...(input.defaultView !== undefined ? { default_view: input.defaultView } : null),
  ...(input.rewardsAllowed !== undefined ? { rewards_allowed: input.rewardsAllowed } : null),
  ...(input.reactions !== undefined ? { reactions: input.reactions } : null),
});

/** Make a space as the signed-in user. They become its first moderator (the database does that). */
export async function createSpace(input: SpaceInput): Promise<Space> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("createSpace");
  const response = await db.from("spaces").insert({ ...columnsOf(input), creator_id: userId }).select(SPACE_COLUMNS).single();
  if (response.error) {
    if (response.error.code === "23505") throw new PostError("createSpace", "That address is taken.", "23505");
    throw postLayerError("createSpace", response);
  }
  return toSpace(response.data as SpaceRow);
}

/** Change a space's settings. Only its creator can; anyone else gets no row back, which is said in words. */
export async function updateSpace(spaceId: string, patch: Partial<SpaceInput>): Promise<Space> {
  const response = await db.from("spaces").update(columnsOf(patch)).eq("id", spaceId).select(SPACE_COLUMNS).limit(1).maybeSingle();
  if (response.error) {
    if (response.error.code === "23505") throw new PostError("updateSpace", "That address is taken.", "23505");
    throw postLayerError("updateSpace", response);
  }
  if (!response.data) throw new PostError("updateSpace", "Only the person who made a space can change it.");
  return toSpace(response.data as SpaceRow);
}

/** Join as the signed-in user. Joining twice is not an error; an invite-only space refuses in words. */
export async function joinSpace(spaceId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("joinSpace");
  const response = await db.from("space_members").insert({ space_id: spaceId, user_id: userId, role: "member", invited: false });
  if (response.error && response.error.code !== "23505") throw postLayerError("joinSpace", response, "This space is invite only.");
}

/** Leave as the signed-in user. */
export async function leaveSpace(spaceId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOut("leaveSpace");
  const response = await db.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
  if (response.error) throw postLayerError("leaveSpace", response);
}

/** A moderator invites someone. An invited row is their way in to an invite-only space. */
export async function inviteToSpace(spaceId: string, userId: string): Promise<void> {
  const me = await currentUserId();
  if (!me) throw signedOut("inviteToSpace");
  const response = await db.from("space_members").insert({ space_id: spaceId, user_id: userId, role: "member", invited: true });
  if (response.error && response.error.code !== "23505") throw postLayerError("inviteToSpace", response, "Only a moderator can invite people.");
}

/** The creator makes a member a moderator, or takes it back. */
export async function setModerator(spaceId: string, userId: string, on: boolean): Promise<void> {
  const response = await db
    .from("space_members")
    .update({ role: on ? "moderator" : "member" })
    .eq("space_id", spaceId)
    .eq("user_id", userId)
    .select("user_id")
    .limit(1);
  if (response.error) throw postLayerError("setModerator", response);
  if (!((response.data as unknown[] | null) ?? []).length) throw new PostError("setModerator", "Only the person who made a space can change who moderates it.");
}
