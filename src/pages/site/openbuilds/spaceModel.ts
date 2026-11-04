// UX-05 Part 3: a space's words, keys and settings. Pure.

import type { SpaceCrowd } from "@/lib/openbuilds/spacesFeed";
import type { Space, SpaceOrder, SpaceReaction, SpaceView, SpaceWhoCanPost } from "@/lib/openbuilds/types";
import { postKey } from "@/lib/openbuilds/types";

export type SpaceTab = "posts" | "rules";

export const spaceCrowdKey = (slug: string, viewerId: string | null) => postKey("getSpaceCrowd", slug, viewerId);
export const spacePostsKey = (spaceId: string, order: SpaceOrder, moderator: boolean) => postKey("listPostCards", "space", spaceId, order, moderator);
export const postableKey = (viewerId: string | null) => postKey("listPostableSpaces", viewerId);
export const spaceChoicesKey = postKey("listSpaces", "choices");

export const readSpaceTab = (params: URLSearchParams): SpaceTab => (params.get("tab") === "rules" ? "rules" : "posts");

/** The address with the tab in it; Posts, the default, leaves it. */
export function spaceSearch(params: URLSearchParams, tab: SpaceTab): URLSearchParams {
  const out = new URLSearchParams(params);
  if (tab === "posts") out.delete("tab");
  else out.set("tab", tab);
  return out;
}

export const WHO_WORDS: Record<SpaceWhoCanPost, string> = { anyone: "anyone can post", members: "members can post", invite: "invite only" };
export const ORDER_WORDS: Record<SpaceOrder, string> = { newest: "Newest first", most_replied: "Most replied first", pinned_first: "Pinned first" };

const handles = (list: readonly { handle: string | null }[]) => list.map((person) => (person.handle ? `@${person.handle}` : "someone")).join(", ");
export const membersWords = (n: number) => `${n} ${n === 1 ? "member" : "members"}`;

/** "Made by @sam · moderated by @sam, @ola · 412 members · anyone can post". */
export function spaceMeta(crowd: SpaceCrowd): string {
  return [`Made by ${crowd.creator.handle ? `@${crowd.creator.handle}` : "someone"}`, `moderated by ${handles(crowd.moderators)}`, membersWords(crowd.members), WHO_WORDS[crowd.space.whoCanPost]].join(" · ");
}

/** "Newest first · set by @sam". */
export const orderLine = (order: SpaceOrder, handle: string | null): string => `${ORDER_WORDS[order]} · set by ${handle ? `@${handle}` : "someone"}`;

/** What the primary says for this reader: Join to someone outside the space, Post here to a member (the database decides each post). */
export const primaryFor = (role: SpaceCrowd["role"]): "join" | "post" => (role === "none" ? "join" : "post");

/* ── settings ── */

export interface SettingsDraft {
  whoCanPost: SpaceWhoCanPost;
  rules: string;
  postOrder: SpaceOrder;
  defaultView: SpaceView;
  rewardsAllowed: boolean;
  reactions: SpaceReaction[];
}

export const DEFAULT_SETTINGS: SettingsDraft = { whoCanPost: "anyone", rules: "", postOrder: "newest", defaultView: "thread", rewardsAllowed: true, reactions: [] };

export const settingsOf = (space: Space): SettingsDraft => ({
  whoCanPost: space.whoCanPost,
  rules: space.rules,
  postOrder: space.postOrder,
  defaultView: space.defaultView,
  rewardsAllowed: space.rewardsAllowed,
  reactions: [...space.reactions],
});

/** Copy another space's settings: not its name, description or members. */
export const copySettings = (from: Space): SettingsDraft => settingsOf(from);

export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 280;
export const RULES_MAX = 2000;

/** Why a new space cannot be made yet, in words; null when it can. */
export const makeRefusal = (name: string): string | null => (name.trim() ? (name.trim().length > NAME_MAX ? `A name is at most ${NAME_MAX} characters.` : null) : "Give the space a name.");
