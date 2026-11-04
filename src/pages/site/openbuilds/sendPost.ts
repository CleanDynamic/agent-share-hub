/* UX-05 Part 4: sending a post, written ahead of the server's answer (as Me too is).

   The post goes into every cached list it belongs in at once; the database is asked after. A refusal puts each list back as it
   was, says so, and hands the window's content back so the reader can try again. Nothing here is a component, so the send goes on
   after the window has closed. */

import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AttachmentInput, CardsPage, LabelledWork, Post, PostAttachment, Space } from "@/lib/openbuilds";
import { createPost, resolveMentionIds } from "@/lib/openbuilds";
import type { CardWork } from "@/lib/openbuilds/cardWork";
import { reportError } from "@/lib/errors/report";

/** Everything the window holds, so a failed send can give it back. */
export interface NewPostDraft {
  body: string;
  spaceIds: string[];
  attachments: { key: string; input: AttachmentInput; /** A file's name, for the row that stands for it. */ name?: string }[];
  /** The rows added from + Add, in the order they were added. */
  added: ("reward" | "open" | "tags" | "closes")[];
  reward: string;
  stillOpen: boolean;
  /** The step of an attached build that is still open. */
  openNodeId: string | null;
  tags: string;
  closes: string;
}

export const EMPTY_DRAFT: NewPostDraft = { body: "", spaceIds: [], attachments: [], added: [], reward: "", stillOpen: false, openNodeId: null, tags: "", closes: "" };

/** Whether there is anything to send: words, or one attachment. */
export const hasContent = (draft: NewPostDraft): boolean => draft.body.trim().length > 0 || draft.attachments.length > 0;

/** "scoring, #cv" to ["scoring", "cv"]. */
export const tagsOf = (text: string): string[] => [...new Set(text.split(/[\s,]+/).map((tag) => tag.replace(/^#+/, "").toLowerCase()).filter(Boolean))].slice(0, 10);

/** The day a post closes, to the end of that day (UTC). */
export const closesIso = (day: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T23:59:59.000Z` : null);

/** The post's fields as the draft's added rows say them. */
export function fieldsOf(draft: NewPostDraft) {
  const reward = draft.added.includes("reward") ? Number(draft.reward) : NaN;
  return {
    rewardGbp: Number.isFinite(reward) && reward > 0 ? reward : null,
    stillOpen: draft.added.includes("open") || draft.stillOpen,
    aboutNodeId: draft.stillOpen ? draft.openNodeId : null,
    tags: draft.added.includes("tags") ? tagsOf(draft.tags) : [],
    closesAt: draft.added.includes("closes") ? closesIso(draft.closes) : null,
  };
}

/** What a picked row attaches. */
export function inputOf(work: LabelledWork): AttachmentInput {
  if (work.size === "build") return { kind: "build", buildId: work.buildId };
  if (work.size === "part") return { kind: "part", buildId: work.buildId, partKey: work.partKey ?? "" };
  if (work.size === "session") return { kind: "session", buildId: work.buildId, sessionKey: work.sessionKey ?? "" };
  return { kind: "step", buildId: work.buildId, nodeId: work.nodeId ?? "" };
}

export const attachmentOf = (input: AttachmentInput, position: number): PostAttachment => ({
  position,
  kind: input.kind,
  buildId: "buildId" in input ? input.buildId : null,
  nodeId: input.kind === "step" ? input.nodeId : null,
  partKey: input.kind === "part" ? input.partKey : null,
  sessionKey: input.kind === "session" ? input.sessionKey : null,
  mediaPath: input.kind === "media" ? input.mediaPath : null,
  mediaKind: input.kind === "media" ? input.mediaKind : null,
  snapshot: null,
});

export interface Sender {
  id: string;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** The post as the list will draw it until the server answers. */
export function pendingPost(draft: NewPostDraft, spaces: readonly Space[], sender: Sender, now: Date = new Date()): Post {
  const fields = fieldsOf(draft);
  const buildInput = draft.attachments.find((attachment) => "buildId" in attachment.input)?.input;
  return {
    id: `pending-${now.getTime()}`,
    authorId: sender.id,
    parentId: null,
    rootId: `pending-${now.getTime()}`,
    body: draft.body.trim(),
    aboutBuildId: fields.aboutNodeId && buildInput && "buildId" in buildInput ? buildInput.buildId : null,
    aboutNodeId: fields.aboutNodeId,
    rewardGbp: fields.rewardGbp,
    stillOpen: fields.stillOpen,
    tags: fields.tags,
    closesAt: fields.closesAt,
    pinnedBy: null,
    pinnedAt: null,
    hiddenBy: null,
    hiddenReason: null,
    likeCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    author: { id: sender.id, handle: sender.handle, name: sender.name, avatarUrl: sender.avatarUrl },
    attachments: draft.attachments.map((attachment, index) => attachmentOf(attachment.input, index)),
    spaces: spaces.filter((space) => draft.spaceIds.includes(space.id)).map((space) => ({ id: space.id, slug: space.slug, name: space.name })),
    replyCount: 0,
  };
}

/** Whether a cached list is one the post belongs in. Feed keys: [.., "feed", scope, open, viewer]; space keys: [.., "space", id, ..]. */
export function belongsIn(key: QueryKey, post: Post): boolean {
  if (key[2] === "feed") return (key[4] !== true || post.stillOpen) && (key[3] === "everyone" || post.spaces.length > 0);
  if (key[2] === "space") return post.spaces.some((space) => space.id === key[3]);
  return false;
}

/** The post at the top of the first page, with the work its cards need. */
export function withPostOnTop(data: InfiniteData<CardsPage, number>, post: Post, work: CardWork): InfiniteData<CardsPage, number> {
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return {
    ...data,
    pages: [{ ...first, posts: [post, ...first.posts], extras: { ...first.extras, work: { builds: new Map([...first.extras.work.builds, ...work.builds]), nodes: new Map([...first.extras.work.nodes, ...work.nodes]) } } }, ...rest],
  };
}

export interface SendOptions {
  qc: QueryClient;
  draft: NewPostDraft;
  spaces: readonly Space[];
  sender: Sender;
  work: CardWork;
  /** Puts the window back, with its content. */
  reopen: (draft: NewPostDraft) => void;
}

/** Show the post at once; ask the database after. */
export async function sendPost({ qc, draft, spaces, sender, work, reopen }: SendOptions): Promise<void> {
  const post = pendingPost(draft, spaces, sender);
  const before = qc.getQueriesData<InfiniteData<CardsPage, number>>({ queryKey: ["posts", "listPostCards"] });
  for (const [key, data] of before) {
    if (data && belongsIn(key, post)) qc.setQueryData(key, withPostOnTop(data, post, work));
  }
  try {
    const fields = fieldsOf(draft);
    await createPost({
      body: draft.body.trim(),
      spaceIds: draft.spaceIds,
      attachments: draft.attachments.map((attachment) => attachment.input),
      aboutBuildId: post.aboutBuildId,
      aboutNodeId: fields.aboutNodeId,
      rewardGbp: fields.rewardGbp,
      stillOpen: fields.stillOpen,
      tags: fields.tags,
      closesAt: fields.closesAt,
      mentionIds: await resolveMentionIds(draft.body),
    });
    void qc.invalidateQueries({ queryKey: ["posts", "listPostCards"] });
    void qc.invalidateQueries({ queryKey: ["posts", "listRecentPostTimes"] });
  } catch (error) {
    for (const [key, data] of before) qc.setQueryData(key, data);
    reportError(error, { source: "openbuilds", context: "createPost" });
    toast.error("Your post didn't send. Try again.");
    reopen(draft);
  }
}
