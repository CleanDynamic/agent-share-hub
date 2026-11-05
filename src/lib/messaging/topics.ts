// Topics in messages (UX-09 Q4).
//
// ONE CONVERSATION BETWEEN TWO PEOPLE. "Message @maya" on a topic opens the reader's one direct thread with the topic's author
// (createDirectThread: found, or made once) and puts the topic in the message box as a card, as a build is (sendBuildMessage). The
// card goes with the next message the reader sends, with their words as its note. No thread is made per topic and nothing is pinned
// to the thread.
//
// A TOPIC MESSAGE IS A TEXT MESSAGE whose shared_post_id is set (20261108150000_ux09_topic_messages.sql). The card is drawn from the
// topic as the reader may read it now: a hidden or deleted topic draws no card, and the message shows its words alone.
//
// MESSAGE WORDS NEVER REACH AN ERROR ⟦neoscale-error-monitoring › Privacy⟧, nor does a topic's body: failures are SocialErrors,
// identifiers only.

import { splitBody } from "@/components/post/postCardModel";
import { currentUserId, db, signedOutError, socialError, uniqueIds } from "@/lib/social/types";
import { createDirectThread } from "./createDirectThread";

/** A topic as a message card draws it. */
export interface SharedTopic {
  id: string;
  /** The topic's first line, as its page heads it. */
  heading: string;
  /** Its author's handle, no @; null when the profile has none. */
  handle: string | null;
}

/** The router state that hands a topic to the thread's message box. */
export interface TopicShareState {
  shareTopic: { id: string; label: string; subtitle?: string };
}

export function isTopicShareState(value: unknown): value is TopicShareState {
  const share = (value as { shareTopic?: { id?: unknown; label?: unknown } } | null)?.shareTopic;
  return typeof share?.id === "string" && typeof share.label === "string";
}

interface TopicRow {
  id: string;
  parent_id: string | null;
  body: string;
  author?: { username: string | null } | { username: string | null }[] | null;
}

/** The topics a thread's messages carry, readable by the reader now. One request. */
export async function getSharedTopics(topicIds: readonly string[]): Promise<Map<string, SharedTopic>> {
  const ids = uniqueIds(topicIds);
  const out = new Map<string, SharedTopic>();
  if (ids.length === 0) return out;
  const response = await db
    .from("openbuild_posts")
    .select("id, parent_id, body, author:profiles!openbuild_posts_author_id_fkey(username)")
    .in("id", ids)
    .limit(ids.length);
  if (response.error) throw socialError("getSharedTopics", response);
  for (const row of (response.data ?? []) as unknown as TopicRow[]) {
    if (row.parent_id !== null) continue;
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    out.set(row.id, { id: row.id, heading: splitBody(row.body).heading || "A topic", handle: author?.username ?? null });
  }
  return out;
}

/**
 * The reader's one direct thread with a topic's author: found, or made once. Returns its id; the caller opens it with the topic
 * handed to the message box (TopicShareState).
 */
export async function openTopicThread(authorId: string): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("openTopicThread");
  try {
    return await createDirectThread(authorId);
  } catch (cause) {
    throw socialError("openTopicThread", { error: cause });
  }
}

/** Send a topic, with an optional note, as the signed-in reader. The thread's preview says a topic was shared. */
export async function sendTopicMessage(threadId: string, topicId: string, note?: string | null): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw signedOutError("sendTopicMessage");

  const words = (note ?? "").trim();
  const response = await db.from("dm_messages").insert({
    thread_id: threadId,
    sender_id: userId,
    kind: "text",
    message_type: "text",
    body: words || null,
    text_content: words || null,
    shared_post_id: topicId,
  });
  if (response.error) throw socialError("sendTopicMessage", response);

  const bump = await db
    .from("dm_threads")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: "Shared a topic",
      last_message_sender_id: userId,
    })
    .eq("id", threadId);
  if (bump.error) throw socialError("sendTopicMessage (thread)", bump);
}
