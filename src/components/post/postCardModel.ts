// UX-05 Part 1: a post as the card draws it. Pure: words and shapes from a Post and the work it names, no reads.

import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { StripTileData } from "@/components/vision/StepStripTiles";
import { kindOfNode, topSteps } from "@/lib/build/graph";
import { storedWorkstreamsOf, partLabelsOf, sessionsMetaOf, toolLabel } from "@/lib/build/making";
import { REF_KIND } from "@/lib/build/postRefs";
import { workstreamsOf, workstreamMark } from "@/lib/build/workstreams";
import type { CardNode, CardWork, ReplyDigest } from "@/lib/openbuilds/cardWork";
import type { Post, PostAttachment } from "@/lib/openbuilds/types";
import { shortAge } from "@/lib/social/time";

/** The most characters the heading takes from the body's first line. */
export const HEADING_MAX = 140;
/** The most tiles a build's strip draws. */
export const STRIP_MAX = 5;

/** The body's first line (up to 140 characters) and the rest. A long first line is cut at a space and goes on in the text. */
export function splitBody(body: string): { heading: string; text: string } {
  const trimmed = body.replace(/^\s+/, "");
  const lineEnd = trimmed.indexOf("\n");
  const first = lineEnd === -1 ? trimmed : trimmed.slice(0, lineEnd);
  const rest = lineEnd === -1 ? "" : trimmed.slice(lineEnd + 1);
  if (first.length <= HEADING_MAX) return { heading: first.trim(), text: rest.trim() };
  const cut = first.lastIndexOf(" ", HEADING_MAX);
  const at = cut > 40 ? cut : HEADING_MAX;
  return { heading: first.slice(0, at).trim(), text: `${first.slice(at).trim()}${rest ? `\n${rest}` : ""}`.trim() };
}

/** "£40", "£12.50". */
export const rewardWords = (gbp: number): string => `£${Number.isInteger(gbp) ? gbp : gbp.toFixed(2)}`;

/** "Closes 20 Nov". */
export function closesWords(iso: string | null): string | null {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  return `Closes ${at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export const stepsWords = (n: number): string => `${n} ${n === 1 ? "step" : "steps"}`;
export const promptsWords = (n: number): string => `${n} ${n === 1 ? "prompt" : "prompts"}`;
export const sessionsWords = (n: number): string => `${n} ${n === 1 ? "session" : "sessions"}`;
export const repliesWords = (n: number): string => `${n} ${n === 1 ? "reply" : "replies"}`;
const buildsWords = (n: number): string => `${n} ${n === 1 ? "build" : "builds"}`;

/** The strip's second half: "· 3 builds · latest from @kit 20m ago". Empty when there is nothing to say. */
export function repliesDetail(digest: ReplyDigest | undefined, now: number): string {
  if (!digest) return "";
  const parts = [
    ...(digest.builds > 0 ? [buildsWords(digest.builds)] : []),
    ...(digest.latest ? [`latest from ${digest.latest.handle ? `@${digest.latest.handle}` : "someone"} ${shortAge(digest.latest.at, now)} ago`.replace(/ now ago$/, " just now")] : []),
  ];
  return parts.join(" · ");
}

/* ── the view's shapes ── */

export type CardAttachment =
  | { kind: "build"; key: string; title: string; harness: string | null; steps: number; plaque: PlaqueBuild | null; tiles: StripTileData[]; to: string | null }
  | { kind: "step"; key: string; head: string; text: string }
  | { kind: "line"; key: string; text: string }
  | { kind: "picture"; key: string; path: string; mediaKind: "image" | "video"; src: string | null }
  | { kind: "file"; key: string; name: string; href: string | null };

export interface PostCardData {
  id: string;
  to: string;
  author: { id: string; name: string; handle: string | null; avatarUrl: string | null };
  age: string;
  spaces: { slug: string; name: string }[];
  reward: string | null;
  heading: string;
  text: string;
  attachments: CardAttachment[];
  stillOpen: boolean;
  tags: string[];
  closes: string | null;
  replies: { count: number; people: { id: string; name: string; avatarUrl: string | null }[]; detail: string; to: string } | null;
  pinned: boolean;
  /** Shown to moderators only: the post is hidden. */
  hidden: { by: string; reason: string | null } | null;
  /** The build the card's engagement row acts on. */
  engagementBuild: { id: string; slug: string; title: string; rebuild_count: number | null } | null;
}

/* ── tiles ── */

const kindWord = (node: Pick<CardNode, "type"> & { payload?: unknown }): string => {
  const kind = kindOfNode(node);
  return kind ? (REF_KIND[kind] ?? "Step") : "Step";
};
const nodeLike = (node: CardNode) => ({ id: node.id, parent_id: node.parent_id, position: node.position, type: node.type, title: node.title, payload: { tested: node.tested, setup: node.setup, step: node.step } });

/** A build's top-level steps as tiles, five at most centred on the open one; `openId` marks the step still open. */
export function tilesOf(nodes: readonly CardNode[], openId: string | null): { tiles: StripTileData[]; count: number } {
  const tops = topSteps(nodes.filter((node) => node.parent_id === null).map(nodeLike));
  const at = openId ? tops.findIndex((node) => node.id === openId) : -1;
  const start = Math.max(0, Math.min((at < 0 ? 0 : at) - Math.floor(STRIP_MAX / 2), tops.length - STRIP_MAX));
  const tiles = tops.slice(start, start + STRIP_MAX).map((node, index) => {
    const kind = kindWord(node);
    return { id: node.id, number: `Step ${start + index + 1}`, kind, title: node.title?.trim() || kind, open: node.id === openId };
  });
  return { tiles, count: tops.length };
}

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");
const snapshotOf = (attachment: PostAttachment): Record<string, unknown> => attachment.snapshot ?? {};
const sourceOf = (snapshot: Record<string, unknown>): Record<string, unknown> => (snapshot.source && typeof snapshot.source === "object" ? (snapshot.source as Record<string, unknown>) : {});

/** One attachment as the card draws it, or null when what it names cannot be read (it is then left out). */
export function cardAttachment(post: Pick<Post, "id" | "stillOpen" | "aboutNodeId">, attachment: PostAttachment, work: CardWork, signed: ReadonlyMap<string, string>): CardAttachment | null {
  const key = `${post.id}:${attachment.position}`;
  const facts = attachment.buildId ? work.builds.get(attachment.buildId) : undefined;
  const nodes = attachment.buildId ? (work.nodes.get(attachment.buildId) ?? []) : [];
  const snapshot = snapshotOf(attachment);

  if (attachment.kind === "media") {
    const name = attachment.mediaPath?.split("/").pop() ?? "File";
    const src = attachment.mediaPath ? (signed.get(attachment.mediaPath) ?? null) : null;
    return attachment.mediaKind === "image" || attachment.mediaKind === "video" ? { kind: "picture", key, path: attachment.mediaPath ?? "", mediaKind: attachment.mediaKind, src } : { kind: "file", key, name, href: src };
  }

  if (attachment.kind === "build") {
    const copied = Array.isArray(snapshot.children) ? (snapshot.children as { id: string; type: string; title: string | null; payload?: Record<string, unknown> }[]) : null;
    const rows: CardNode[] = copied
      ? copied.map((child, index) => ({ id: child.id, build_id: attachment.buildId ?? "", parent_id: null, type: child.type, title: child.title, position: index, is_gap: false, tested: child.payload?.tested, setup: child.payload?.setup, step: child.payload?.step, text: null, session: null }))
      : nodes;
    const openId = post.stillOpen ? (post.aboutNodeId ?? null) : null;
    const { tiles, count } = tilesOf(rows, openId);
    const title = (facts?.title || textOf(snapshot.title) || textOf(sourceOf(snapshot).buildTitle)).trim() || "Untitled build";
    if (!facts && !copied) return null;
    return {
      kind: "build",
      key,
      title,
      harness: facts?.madeWith?.trim() || null,
      steps: count,
      plaque: facts && facts.status !== "draft" ? { reproduction_count: facts.reproduction_count, last_confirmed_at: facts.last_confirmed_at, last_confirmed_model: facts.last_confirmed_model, published_at: facts.published_at } : null,
      tiles,
      to: facts?.slug && facts.status !== "draft" ? `/b2/${facts.slug}` : null,
    };
  }

  if (attachment.kind === "step") {
    const node = nodes.find((candidate) => candidate.id === attachment.nodeId);
    const type = node?.type ?? textOf(snapshot.type);
    if (!node && !attachment.snapshot) return null;
    const kind = type ? kindWord({ type, payload: node ? { tested: node.tested, setup: node.setup, step: node.step } : snapshot.payload }) : "Step";
    const tops = topSteps(nodes.filter((candidate) => candidate.parent_id === null).map(nodeLike));
    const place = node ? tops.findIndex((candidate) => candidate.id === node.id) : -1;
    const payload = (snapshot.payload && typeof snapshot.payload === "object" ? snapshot.payload : {}) as Record<string, unknown>;
    // UX-06: a copied code step keeps its lines in `payload.source`.
    const text = node ? (node.text ?? node.title ?? "") : textOf(payload.text) || textOf(payload.source) || textOf(snapshot.note) || textOf(snapshot.title);
    return { kind: "step", key, head: `Step ${place >= 0 ? `${place + 1} · ` : "· "}${kind}`.replace("· · ", "· "), text };
  }

  if (attachment.kind === "session") {
    const tool = toolLabel(textOf(sourceOf(snapshot).tool) || null);
    if (attachment.snapshot) {
      const prompts = Array.isArray(snapshot.prompts) ? snapshot.prompts.length : 0;
      return { kind: "line", key, text: ["Session", tool, promptsWords(prompts)].filter(Boolean).join(" · ") };
    }
    if (!facts || !attachment.sessionKey) return null;
    const meta = sessionsMetaOf(facts.making);
    const order = Object.keys(meta);
    const number = order.indexOf(attachment.sessionKey) + 1;
    const prompts = nodes.filter((node) => node.type === "prompt" && node.session === attachment.sessionKey).length;
    return { kind: "line", key, text: [number > 0 ? `Session ${number}` : "Session", toolLabel(meta[attachment.sessionKey]?.tool), promptsWords(prompts)].filter(Boolean).join(" · ") };
  }

  // part
  if (attachment.snapshot) {
    const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions.length : 0;
    return { kind: "line", key, text: `${textOf(snapshot.title) ? `Part · ${textOf(snapshot.title)}` : "Part"} · ${sessionsWords(sessions)}` };
  }
  if (!facts || !attachment.partKey) return null;
  const order = Object.keys(sessionsMetaOf(facts.making));
  const parts = workstreamsOf(facts.making, order);
  const part = parts.find((candidate) => candidate.key === attachment.partKey);
  if (!part) return null;
  const mark = storedWorkstreamsOf(facts.making).length > 0 ? workstreamMark(part.index, partLabelsOf(facts.making)) : "";
  return { kind: "line", key, text: `${mark ? `Part ${mark}` : "Part"} · ${sessionsWords(part.sessions.length)}` };
}

export interface CardContext {
  work: CardWork;
  signed: ReadonlyMap<string, string>;
  digests: ReadonlyMap<string, ReplyDigest>;
  now: number;
  /** The address a post opens: the view the space sets as default. */
  hrefOf: (post: Post) => string;
  /** Whether the reader may see that a post is hidden (a moderator). */
  moderator?: (post: Post) => boolean;
  /** The handle of a moderator, for "Hidden by @ola". */
  handleOf?: (userId: string) => string | null;
  /** Replies strips belong to lists. */
  strip?: boolean;
}

/** A post as the card draws it. */
export function toCardData(post: Post, context: CardContext): PostCardData {
  const { heading, text } = splitBody(post.body);
  const attachments = post.attachments.flatMap((attachment) => {
    const drawn = cardAttachment(post, attachment, context.work, context.signed);
    return drawn ? [drawn] : [];
  });
  const digest = context.digests.get(post.id);
  const name = post.author?.name?.trim() || post.author?.handle || "Someone";
  const buildFacts = post.attachments.map((attachment) => (attachment.kind === "build" && attachment.buildId ? context.work.builds.get(attachment.buildId) : undefined)).find(Boolean);
  const href = context.hrefOf(post);
  return {
    id: post.id,
    to: href,
    author: { id: post.authorId, name, handle: post.author?.handle ?? null, avatarUrl: post.author?.avatarUrl ?? null },
    age: shortAge(post.createdAt, context.now),
    spaces: post.spaces.map((space) => ({ slug: space.slug, name: space.name })),
    reward: post.rewardGbp !== null && post.rewardGbp > 0 ? rewardWords(post.rewardGbp) : null,
    heading,
    text,
    attachments,
    stillOpen: post.stillOpen,
    tags: post.tags,
    closes: closesWords(post.closesAt),
    replies: context.strip !== false && post.replyCount > 0 ? { count: post.replyCount, people: digest?.people ?? [], detail: repliesDetail(digest, context.now), to: href } : null,
    pinned: post.pinnedBy !== null,
    hidden: post.hiddenBy !== null && context.moderator?.(post) ? { by: context.handleOf?.(post.hiddenBy) ? `@${context.handleOf(post.hiddenBy)}` : "a moderator", reason: post.hiddenReason } : null,
    engagementBuild: buildFacts?.slug && buildFacts.status !== "draft" ? { id: buildFacts.id, slug: buildFacts.slug, title: buildFacts.title ?? "", rebuild_count: null } : null,
  };
}

/** A topic's address (UX-06 draws the page). A reply opens its topic with the reply in view: `?reply=<reply id>`. */
export const topicHref = (rootId: string, options: { replyId?: string; view?: "thread" | "wall" } = {}): string => {
  const query = [...(options.view === "wall" ? ["view=wall"] : []), ...(options.replyId ? [`reply=${encodeURIComponent(options.replyId)}`] : [])].join("&");
  return `/openbuilds/topics/${rootId}${query ? `?${query}` : ""}`;
};

/** UX-07: a reply in its topic, scrolled to on arrival (`#reply-<id>`, the id the Thread gives each reply). */
export const replyHref = (rootId: string, replyId: string): string => `${topicHref(rootId)}#reply-${encodeURIComponent(replyId)}`;
