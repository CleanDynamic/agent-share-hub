// UX-06: rows the post page's tests share: a post with replies, the post's build and its steps.

import type { CardNode, CardWork } from "@/lib/openbuilds/cardWork";
import type { PostAttachment, PostThread } from "@/lib/openbuilds/types";

export const NOW = Date.parse("2026-11-04T12:00:00Z");

export const node = (id: string, position: number, type: string, title: string, extra: Partial<CardNode> = {}): CardNode => ({
  id,
  build_id: "b-post",
  parent_id: null,
  type,
  title,
  position,
  is_gap: false,
  tested: null,
  setup: null,
  step: null,
  text: null,
  session: null,
  ...extra,
});

export const attachment = (kind: PostAttachment["kind"], extra: Partial<PostAttachment> = {}): PostAttachment => ({
  position: 0,
  kind,
  buildId: null,
  nodeId: null,
  partKey: null,
  sessionKey: null,
  mediaPath: null,
  mediaKind: null,
  snapshot: null,
  ...extra,
});

export const entry = (id: string, minutesAgo: number, extra: Partial<PostThread> = {}): PostThread => ({
  id,
  authorId: `u-${id}`,
  parentId: "p1",
  rootId: "p1",
  body: `Words of ${id}`,
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 0,
  createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  updatedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  author: { id: `u-${id}`, handle: id, name: id.toUpperCase(), avatarUrl: null },
  attachments: [],
  spaces: [],
  replyCount: 0,
  replies: [],
  ...extra,
});

export const postNodes = [node("n1", 0, "prompt", "Take the CV"), node("n2", 1, "code", "Rubric"), node("n3", 2, "prompt", "Score"), node("n4", 3, "prompt", "Summarise")];
export const work: CardWork = { builds: new Map(), nodes: new Map([["b-post", postNodes]]) };
