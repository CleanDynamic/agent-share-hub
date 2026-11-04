// UX-07 Part 1: what Home needs to draw the feed's topics and reply groups, beyond the feed's own rows.
//
// The feed row (get_build_feed, 20261107170000) carries a topic's words, author, reward and reply count, so a card is drawn from it at
// once. This read adds what the row does not carry: the topic's spaces, tags and attachments, the newest reply's attachments, and the
// reader's own marks (their likes, how many replies are new to them). Started together; the work the attachments name (readCardExtras)
// needs the posts, so it follows them inside this one call.

import { readCardExtras, type CardExtras } from "./cardWork";
import { getNewReplyCounts } from "./posts";
import { listMyLikes } from "./postPage";
import { ATTACHMENTS_EMBED, AUTHOR_EMBED, POST_COLUMNS, SPACES_EMBED, db, postLayerError, toPost, unique, type Post, type PostRow } from "./types";

/** The most posts one read asks for: a feed page holds at most 50 rows. */
const FEED_TOPICS_MAX = 100;

export interface FeedTopics {
  /** The topics and the newest replies, by id. */
  posts: Map<string, Post>;
  extras: CardExtras;
  /** Of these posts, the ones the reader liked. */
  liked: Set<string>;
  /** Replies new to the reader, by topic id. Empty signed out. */
  newReplies: Record<string, number>;
}

/** The posts by their ids, with their author, attachments and spaces: one request. */
export async function readPostsByIds(ids: readonly string[]): Promise<Post[]> {
  const wanted = unique(ids).slice(0, FEED_TOPICS_MAX);
  if (wanted.length === 0) return [];
  const response = await db
    .from("openbuild_posts")
    .select(`${POST_COLUMNS}, ${AUTHOR_EMBED}, ${ATTACHMENTS_EMBED}, ${SPACES_EMBED}`)
    .in("id", wanted)
    .is("hidden_by", null)
    .limit(wanted.length);
  if (response.error) throw postLayerError("readPostsByIds", response);
  return ((response.data ?? []) as unknown as PostRow[]).map(toPost);
}

/** Everything Home draws for these topics (`topicIds`) and newest replies (`replyIds`) beyond the feed rows. */
export async function readFeedTopics(topicIds: readonly string[], replyIds: readonly string[]): Promise<FeedTopics> {
  const ids = unique([...topicIds, ...replyIds]);
  const [posts, liked, newReplies] = await Promise.all([readPostsByIds(ids), listMyLikes(ids), getNewReplyCounts(topicIds).catch(() => ({}))]);
  const extras = await readCardExtras(posts);
  return { posts: new Map(posts.map((post) => [post.id, post])), extras, liked, newReplies };
}

export interface TopicCards {
  posts: Map<string, Post>;
  extras: CardExtras;
}

/** UX-07 P4: the topics a reader keeps, as their cards: the posts, then the work their attachments name. */
export async function readTopicCards(ids: readonly string[]): Promise<TopicCards> {
  const posts = await readPostsByIds(ids);
  const extras = await readCardExtras(posts);
  return { posts: new Map(posts.map((post) => [post.id, post])), extras };
}
