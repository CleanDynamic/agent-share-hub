/* UX-07 Part 1: the feed's topics and reply groups as Home draws them. Pure: the feed's rows and what `readFeedTopics` read, in;
   the items `HomeView` draws, out.

   A TOPIC is a `PostCard`, drawn from the feed row the moment the feed answers and filled in (spaces, tags, attachments) when the
   second read lands. A REPLY GROUP is every reply under one topic as one item: the topic's head and heading, `3 new replies`, and the
   newest reply in the post page's reply anatomy, all leading to the topic at that reply. */

import { replyHref, repliesWords, toCardData, topicHref, type PostCardData } from "@/components/post/postCardModel";
import type { PostFeedEntry, PostFeedPerson, ReplyGroupFeedItem } from "@/lib/feed/getBuildFeed";
import { NO_CARD_WORK } from "@/lib/openbuilds/cardWork";
import type { FeedTopics } from "@/lib/openbuilds/feedTopics";
import type { Post, PostAuthor, PostThread } from "@/lib/openbuilds/types";
import { shortAge } from "@/lib/social/time";
import { replyItem, type ReplyItem } from "@/pages/site/openbuilds/postModel";

export interface HomeTopicPost {
  kind: "topic";
  key: string;
  at: string;
  postId: string;
  card: PostCardData;
  likes: number;
  liked: boolean;
  replies: number;
}

export interface HomeReplyGroup {
  kind: "reply_group";
  key: string;
  at: string;
  postId: string;
  /** The topic at the newest reply. */
  to: string;
  topic: { author: PostCardData["author"]; age: string; heading: string };
  /** "3 new replies", or "3 replies" when nothing is new to the reader. */
  count: string;
  reply: ReplyItem;
}

export type HomePostItem = HomeTopicPost | HomeReplyGroup;

const author = (person: PostFeedPerson): PostAuthor => ({ id: person.id, handle: person.handle, name: person.name, avatarUrl: person.avatarUrl });

/** A post as far as the feed row tells it: no spaces, tags or attachments until the second read brings them. */
export function postOfRow(entry: PostFeedEntry): Post {
  const root = entry.kind === "post" ? { author: entry.author, body: entry.body, createdAt: entry.at, replyCount: entry.replyCount } : entry.root;
  const reward = entry.kind === "post" && entry.reward !== null ? Number(entry.reward) : null;
  return {
    id: entry.postId,
    authorId: root.author.id,
    parentId: null,
    rootId: entry.postId,
    body: root.body,
    aboutBuildId: null,
    aboutNodeId: null,
    rewardGbp: reward !== null && Number.isFinite(reward) ? reward : null,
    stillOpen: entry.kind === "post" ? entry.stillOpen : false,
    tags: [],
    closesAt: null,
    pinnedBy: null,
    pinnedAt: null,
    hiddenBy: null,
    hiddenReason: null,
    likeCount: 0,
    createdAt: root.createdAt,
    updatedAt: root.createdAt,
    author: author(root.author),
    attachments: [],
    spaces: [],
    replyCount: root.replyCount,
  };
}

/** The newest reply as the feed row tells it, until the second read brings its attachments. */
function replyOfRow(entry: ReplyGroupFeedItem): PostThread {
  return {
    ...postOfRow(entry),
    id: entry.reply.id,
    authorId: entry.reply.author.id,
    parentId: entry.postId,
    rootId: entry.postId,
    body: entry.reply.body,
    stillOpen: false,
    rewardGbp: null,
    createdAt: entry.reply.at,
    updatedAt: entry.reply.at,
    author: author(entry.reply.author),
    replyCount: 0,
    replies: [],
  };
}

/** "3 new replies" when the reader has new ones, else every reply the topic has. */
export function replyGroupCount(entry: ReplyGroupFeedItem, newReplies: Readonly<Record<string, number>>): string {
  const fresh = entry.newReplyCount ?? newReplies[entry.postId] ?? 0;
  if (fresh > 0) return `${fresh} new ${fresh === 1 ? "reply" : "replies"}`;
  return repliesWords(Math.max(1, entry.root.replyCount));
}

/** One topic or reply group as Home draws it. */
export function homePostItemOf(entry: PostFeedEntry, read: FeedTopics | undefined, now: number): HomePostItem {
  const work = read?.extras.work ?? NO_CARD_WORK;
  const signed = read?.extras.signed ?? new Map<string, string>();
  const root = read?.posts.get(entry.postId) ?? postOfRow(entry);
  // The feed row's reply count is exact and newer than nothing: it wins over the post read's.
  const topic: Post = { ...root, replyCount: entry.kind === "post" ? entry.replyCount : entry.root.replyCount };
  const card = toCardData(topic, { work, signed, digests: read?.extras.digests ?? new Map(), now, hrefOf: (post) => topicHref(post.id) });

  if (entry.kind === "post") {
    return { kind: "topic", key: entry.key, at: entry.at, postId: entry.postId, card, likes: topic.likeCount, liked: read?.liked.has(topic.id) ?? false, replies: topic.replyCount };
  }

  const read_ = read?.posts.get(entry.reply.id);
  const reply: PostThread = read_ ? { ...read_, replies: [] } : replyOfRow(entry);
  return {
    kind: "reply_group",
    key: entry.key,
    at: entry.at,
    postId: entry.postId,
    to: replyHref(entry.postId, entry.reply.id),
    topic: { author: card.author, age: shortAge(entry.root.createdAt, now), heading: card.heading },
    count: replyGroupCount(entry, read?.newReplies ?? {}),
    reply: replyItem(reply, 0, { work, signed, liked: read?.liked ?? new Set(), now, stepLabels: new Map(), handleOf: () => null, canPin: false, canHide: false }),
  };
}

/** The ids the second read asks for: the topics, and each group's newest reply. */
export function feedTopicIds(entries: readonly PostFeedEntry[]): { topics: string[]; replies: string[] } {
  return {
    topics: [...new Set(entries.map((entry) => entry.postId))],
    replies: [...new Set(entries.flatMap((entry) => (entry.kind === "reply_group" ? [entry.reply.id] : [])))],
  };
}
