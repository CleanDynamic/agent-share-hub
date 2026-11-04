/* UX-06 Part 2: sending a reply, written ahead of the server's answer (as sendPost is for a post).

   The reply goes into the post's cached thread under the post or reply it answers at once; the database is asked after. A refusal
   puts the thread back as it was and hands back the database's words when it gave some (UX-04's authorship rule: "A reply can
   attach only your own work."), unchanged; any other failure is one plain sentence. Nothing here is a component. */

import type { QueryClient } from "@tanstack/react-query";

import { reportError } from "@/lib/errors/report";
import { PostError, createReply, resolveMentionIds, type AttachmentInput, type PostAttachment, type PostThread } from "@/lib/openbuilds";

import { attachmentOf, type Sender } from "./sendPost";
import { postPageKey } from "./postModel";

export const REPLY_FAILED = "Your reply didn't send. Try again.";

export interface ReplyDraft {
  body: string;
  /** At most one: a reply is words, work, or both. */
  attachment: { input: AttachmentInput; name?: string } | null;
  /** The step the reply is about. */
  about: { buildId: string | null; nodeId: string; label: string } | null;
}

export const EMPTY_REPLY: ReplyDraft = { body: "", attachment: null, about: null };

/** Words, or one attachment. */
export const replyHasContent = (draft: ReplyDraft): boolean => draft.body.trim().length > 0 || draft.attachment !== null;

/** The reply as the thread draws it until the server answers. A copy a step tile made is drawn from `snapshot`. */
export function pendingReply(draft: ReplyDraft, parentId: string, rootId: string, sender: Sender, now: Date = new Date(), snapshot: Record<string, unknown> | null = null): PostThread {
  const attachments: PostAttachment[] = draft.attachment ? [{ ...attachmentOf(draft.attachment.input, 0), snapshot }] : [];
  return {
    id: `pending-${now.getTime()}`,
    authorId: sender.id,
    parentId,
    rootId,
    body: draft.body.trim(),
    aboutBuildId: draft.about?.buildId ?? null,
    aboutNodeId: draft.about?.nodeId ?? null,
    rewardGbp: null,
    stillOpen: false,
    tags: [],
    closesAt: null,
    pinnedBy: null,
    pinnedAt: null,
    hiddenBy: null,
    hiddenReason: null,
    likeCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    author: { id: sender.id, handle: sender.handle, name: sender.name, avatarUrl: sender.avatarUrl },
    attachments,
    spaces: [],
    replyCount: 0,
    replies: [],
  };
}

/** The thread with the reply added under its parent, and every count above it one higher. */
export function withReply(thread: PostThread, reply: PostThread): PostThread {
  const add = (node: PostThread): { node: PostThread; added: boolean } => {
    if (node.id === reply.parentId) return { node: { ...node, replyCount: node.replyCount + 1, replies: [...node.replies, reply] }, added: true };
    let added = false;
    const replies = node.replies.map((child) => {
      const result = add(child);
      added ||= result.added;
      return result.node;
    });
    return { node: added ? { ...node, replyCount: node.replyCount + 1, replies } : node, added };
  };
  return add(thread).node;
}

export interface SendReplyOptions {
  qc: QueryClient;
  /** The post whose page this is (its thread is the cache entry to change). */
  pageId: string;
  parentId: string;
  rootId: string;
  draft: ReplyDraft;
  sender: Sender;
  /** Part 3: the step tile's copy, drawn until the server answers. */
  snapshot?: Record<string, unknown> | null;
  /** Part 3: what to attach, once known (a step tile's draft is made first). Defaults to the draft's own attachment. */
  attach?: () => Promise<AttachmentInput | null>;
}

/** Show the reply at once; ask the database after. Resolves null when it is in, or the words to show under the box. */
export async function sendReply({ qc, pageId, parentId, rootId, draft, sender, snapshot = null, attach }: SendReplyOptions): Promise<string | null> {
  const key = postPageKey(pageId);
  const before = qc.getQueryData<PostThread | null>(key);
  if (before) qc.setQueryData(key, withReply(before, pendingReply(draft, parentId, rootId, sender, new Date(), snapshot)));
  try {
    const input = attach ? await attach() : (draft.attachment?.input ?? null);
    await createReply({
      parentId,
      body: draft.body.trim(),
      attachments: input ? [input] : [],
      aboutBuildId: draft.about?.buildId ?? null,
      aboutNodeId: draft.about?.nodeId ?? null,
      mentionIds: await resolveMentionIds(draft.body),
    });
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["posts", "readPostExtras", pageId] });
    void qc.invalidateQueries({ queryKey: ["posts", "listPostCards"] });
    return null;
  } catch (error) {
    qc.setQueryData(key, before);
    reportError(error, { source: "openbuilds", context: "createReply" });
    // The database's own refusal (a raised exception) is fixed text naming the rule: shown as it is.
    return error instanceof PostError && error.code === "P0001" ? error.message : REPLY_FAILED;
  }
}
