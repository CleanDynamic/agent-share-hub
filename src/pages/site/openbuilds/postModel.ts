// UX-06: the post page, worked out from its data. Pure: no reads, no React.
//
//   * The Thread: replies oldest first, pinned ones before the rest at each level, two levels drawn, a deeper branch as a count.
//   * The step filter (`?step=<node id>`): the replies about that step, wherever they sit, each once.
//   * The Wall: the replies that hold a build, as cards.
//   * Line up steps: the post's build beside its rebuilds in replies, step by step.
//
// Words a reader sees say "step"; the reply's own editor says "step tile".

import type { PlaqueBuild } from "@/components/brand/Plaque";
import { cardAttachment, splitBody, type CardAttachment } from "@/components/post/postCardModel";
import { kindOfNode, topSteps } from "@/lib/build/graph";
import { REF_KIND } from "@/lib/build/postRefs";
import type { StepToCopy } from "@/lib/openbuilds/addToDraft";
import type { CardNode, CardWork } from "@/lib/openbuilds/cardWork";
import type { LineStepRow, PostPageExtras, WallBuildFacts } from "@/lib/openbuilds/postPage";
import type { Post, PostAttachment, PostThread } from "@/lib/openbuilds/types";
import { shortAge } from "@/lib/social/time";

export type PostTab = "thread" | "wall";

/** The query keys the page reads on. */
export const postPageKey = (id: string) => ["posts", "getPost", id] as const;
export const postExtrasKey = (id: string, viewerId: string | null) => ["posts", "readPostExtras", id, viewerId] as const;

/* ── the address ── */

export interface PostAddress {
  tab: PostTab;
  /** The step the Thread is filtered to. */
  step: string | null;
  /** A deeper branch opened from `View n more replies`. */
  reply: string | null;
  lineUp: boolean;
}

export function readPostAddress(params: URLSearchParams, defaultView: PostTab): PostAddress {
  const view = params.get("view");
  return {
    tab: view === "wall" || view === "thread" ? view : defaultView,
    step: params.get("step") || null,
    reply: params.get("reply") || null,
    lineUp: params.get("lineup") === "1",
  };
}

/** The address with these changes. A value that is the default leaves it. */
export function postSearch(params: URLSearchParams, change: Partial<PostAddress>, defaultView: PostTab): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (name: string, value: string | null) => (value ? next.set(name, value) : next.delete(name));
  if (change.tab !== undefined) {
    set("view", change.tab === defaultView ? null : change.tab);
    // The filter, a branch and the line-up belong to the view they were set in.
    if (change.tab === "wall") {
      next.delete("step");
      next.delete("reply");
    } else next.delete("lineup");
  }
  if (change.step !== undefined) set("step", change.step);
  if (change.reply !== undefined) set("reply", change.reply);
  if (change.lineUp !== undefined) set("lineup", change.lineUp ? "1" : null);
  return next;
}

/* ── steps ── */

const nodeLike = (node: Pick<CardNode, "id" | "parent_id" | "position" | "type" | "title" | "tested" | "setup" | "step">) => ({
  id: node.id,
  parent_id: node.parent_id,
  position: node.position,
  type: node.type,
  title: node.title,
  payload: { tested: node.tested, setup: node.setup, step: node.step },
});

const kindWord = (node: { type: string; payload?: unknown }): string => {
  const kind = kindOfNode(node);
  return kind ? (REF_KIND[kind] ?? "Step") : "Step";
};

export interface StepEntry {
  id: string;
  number: number;
  kind: string;
  title: string;
  /** "Step 4 · Prompt". */
  label: string;
}

/** A build's top-level steps, in order, with the reader's words. */
export function stepsOf(nodes: readonly Pick<CardNode, "id" | "parent_id" | "position" | "type" | "title" | "tested" | "setup" | "step">[]): StepEntry[] {
  const tops = topSteps(nodes.filter((node) => node.parent_id === null).map(nodeLike));
  return tops.map((node, index) => {
    const kind = kindWord(node);
    return { id: node.id, number: index + 1, kind, title: node.title?.trim() || kind, label: `Step ${index + 1} · ${kind}` };
  });
}

/** The build the post is about or attaches: its id and its steps. */
export function postBuildOf(post: Post, work: CardWork): { buildId: string | null; steps: StepEntry[] } {
  const buildId = post.attachments.find((attachment) => attachment.kind === "build" && attachment.buildId && !attachment.snapshot)?.buildId ?? post.aboutBuildId ?? null;
  return { buildId, steps: buildId ? stepsOf(work.nodes.get(buildId) ?? []) : [] };
}

/* ── the Thread ── */

/** Every reply under the post, at any depth. */
export function allReplies(thread: PostThread): PostThread[] {
  return thread.replies.flatMap((reply) => [reply, ...allReplies(reply)]);
}

/** Pinned first (in the order they were pinned), then the rest oldest first. */
export function threadOrder<T extends Pick<Post, "pinnedBy" | "pinnedAt" | "createdAt">>(replies: readonly T[]): T[] {
  const pinned = replies.filter((reply) => reply.pinnedBy !== null).sort((a, b) => (a.pinnedAt ?? "").localeCompare(b.pinnedAt ?? ""));
  const rest = replies.filter((reply) => reply.pinnedBy === null).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...pinned, ...rest];
}

export interface ReplyItem {
  id: string;
  depth: 0 | 1;
  author: { id: string; name: string; handle: string | null; avatarUrl: string | null };
  age: string;
  body: string;
  /** "Step 4 · Prompt": the step the reply is about. */
  about: string | null;
  attachments: CardAttachment[];
  likes: number;
  liked: boolean;
  /** "@maya", or "someone". */
  pinnedBy: string | null;
  /** An attached build's page and its rebuild, when it is published. */
  build: { to: string; rebuildTo: string } | null;
  /** An attached step, for Add to a draft. */
  step: StepSource | null;
  children: ReplyItem[];
  /** Replies deeper than two levels, not drawn: `View n more replies`. */
  more: number;
  canPin: boolean;
  canHide: boolean;
  /** UX-09 P8: Report, for everyone but the reply's author. */
  canReport: boolean;
}

/** Where a step to copy comes from: published (read again as it is now), or the copy a reply carries. */
export type StepSource = StepToCopy & { name: string };

export interface ThreadContext {
  work: CardWork;
  signed: ReadonlyMap<string, string>;
  liked: ReadonlySet<string>;
  now: number;
  /** The step labels of the post's build, by node id. */
  stepLabels: ReadonlyMap<string, string>;
  /** "@ola" for a profile id, when known. */
  handleOf: (userId: string) => string | null;
  /** The reader may pin (the post's author or a moderator) and hide (a moderator). */
  canPin: boolean;
  canHide: boolean;
  /** UX-09 P8: the reader (null signed out), so a reply's author is not offered Report. Absent: Report is not offered. */
  viewerId?: string | null;
}

const buildLinks = (attachment: PostAttachment, work: CardWork): ReplyItem["build"] => {
  const facts = attachment.buildId ? work.builds.get(attachment.buildId) : undefined;
  return facts?.slug && facts.status !== "draft" ? { to: `/b2/${facts.slug}`, rebuildTo: `/rebuild/${facts.slug}` } : null;
};

const stepSourceOf = (attachment: PostAttachment, drawn: CardAttachment | undefined): StepSource | null => {
  if (attachment.kind !== "step") return null;
  const name = drawn?.kind === "step" ? drawn.head : "Step";
  if (attachment.snapshot) return { kind: "copy", snapshot: attachment.snapshot, name };
  return attachment.buildId && attachment.nodeId ? { kind: "published", buildId: attachment.buildId, nodeId: attachment.nodeId, name } : null;
};

/** One reply as the Thread draws it, with its own replies when it is at the first level. */
export function replyItem(reply: PostThread, depth: 0 | 1, context: ThreadContext): ReplyItem {
  const drawnPairs = reply.attachments.map((attachment) => ({ attachment, drawn: cardAttachment(reply, attachment, context.work, context.signed) ?? undefined }));
  const build = drawnPairs.find(({ attachment }) => attachment.kind === "build");
  const step = drawnPairs.find(({ attachment }) => attachment.kind === "step");
  const children = depth === 0 ? threadOrder(reply.replies).map((child) => replyItem(child, 1, context)) : [];
  const pinnerHandle = reply.pinnedBy ? context.handleOf(reply.pinnedBy) : null;
  return {
    id: reply.id,
    depth,
    author: { id: reply.authorId, name: reply.author?.name?.trim() || reply.author?.handle || "Someone", handle: reply.author?.handle ?? null, avatarUrl: reply.author?.avatarUrl ?? null },
    age: shortAge(reply.createdAt, context.now),
    body: reply.body.trim(),
    about: reply.aboutNodeId ? (context.stepLabels.get(reply.aboutNodeId) ?? null) : null,
    attachments: drawnPairs.flatMap(({ drawn }) => (drawn ? [drawn] : [])),
    likes: reply.likeCount,
    liked: context.liked.has(reply.id),
    pinnedBy: reply.pinnedBy ? (pinnerHandle ? `@${pinnerHandle}` : "someone") : null,
    build: build ? buildLinks(build.attachment, context.work) : null,
    step: step ? stepSourceOf(step.attachment, step.drawn) : null,
    children,
    // At the first level the drawn children carry their own counts; at the second, everything under the reply is deeper.
    more: depth === 1 ? reply.replyCount : 0,
    canPin: context.canPin,
    canHide: context.canHide,
    canReport: context.viewerId !== undefined && reply.authorId !== context.viewerId,
  };
}

/** The Thread: every first-level reply in order, or, filtered to a step, each reply about it once (under a matching parent if it has one). */
export function threadItems(thread: PostThread, context: ThreadContext, step: string | null): ReplyItem[] {
  if (!step) return threadOrder(thread.replies).map((reply) => replyItem(reply, 0, context));
  const out: ReplyItem[] = [];
  const walk = (replies: readonly PostThread[]) => {
    for (const reply of threadOrder(replies)) {
      if (reply.aboutNodeId === step) out.push(replyItem(reply, 0, context));
      else walk(reply.replies);
    }
  };
  walk(thread.replies);
  return out;
}

/** How many replies are about each step, at any depth. */
export function repliesByStep(thread: PostThread): Map<string, number> {
  const counts = new Map<string, number>();
  for (const reply of allReplies(thread)) if (reply.aboutNodeId) counts.set(reply.aboutNodeId, (counts.get(reply.aboutNodeId) ?? 0) + 1);
  return counts;
}

/** The replies that hold a build, in the Thread's order (pinned first). */
export function buildReplies(thread: PostThread): PostThread[] {
  return threadOrder(allReplies(thread).filter((reply) => reply.attachments.some((attachment) => attachment.kind === "build")));
}

/** "People replying": the people who replied, once each. */
export const peopleReplying = (thread: PostThread): number => new Set(allReplies(thread).map((reply) => reply.authorId)).size;

/* ── the Wall ── */

export type WallCard =
  | {
      kind: "published";
      replyId: string;
      title: string;
      author: ReplyItem["author"];
      /** "Claude Code · Rebuilt from @maya", or "Claude Code · new build". */
      line: string;
      plaque: PlaqueBuild | null;
      pinned: boolean;
      to: string;
      rebuildTo: string;
    }
  | {
      kind: "in-progress";
      replyId: string;
      title: string;
      author: ReplyItem["author"];
      /** "In progress · 2 sessions". */
      line: string;
      /** "updated 20m ago". */
      updated: string;
      pinned: boolean;
    };

const sessionsWords = (n: number) => `${n} ${n === 1 ? "session" : "sessions"}`;

/** The sessions a build copied from a draft holds: its tiles' sessions, once each. */
export function sessionsInSnapshot(snapshot: Record<string, unknown>): number {
  const children = Array.isArray(snapshot.children) ? (snapshot.children as { payload?: Record<string, unknown> }[]) : [];
  const keys = new Set(children.map((child) => child.payload?.session).filter((key): key is string => typeof key === "string" && key.length > 0));
  return Math.max(1, keys.size);
}

export function wallCards(thread: PostThread, extras: Pick<PostPageExtras, "work" | "facts">, now: number): WallCard[] {
  return buildReplies(thread).flatMap((reply): WallCard[] => {
    const attachment = reply.attachments.find((entry) => entry.kind === "build");
    if (!attachment) return [];
    const author = { id: reply.authorId, name: reply.author?.name?.trim() || reply.author?.handle || "Someone", handle: reply.author?.handle ?? null, avatarUrl: reply.author?.avatarUrl ?? null };
    const pinned = reply.pinnedBy !== null;
    if (attachment.snapshot) {
      const snapshot = attachment.snapshot;
      const source = (snapshot.source ?? {}) as { buildTitle?: unknown };
      const title = (typeof snapshot.title === "string" && snapshot.title.trim()) || (typeof source.buildTitle === "string" && source.buildTitle.trim()) || "Untitled build";
      return [{ kind: "in-progress", replyId: reply.id, title, author, line: `In progress · ${sessionsWords(sessionsInSnapshot(snapshot))}`, updated: `updated ${shortAge(reply.updatedAt, now)} ago`.replace(/ now ago$/, " just now"), pinned }];
    }
    const card = attachment.buildId ? extras.work.builds.get(attachment.buildId) : undefined;
    const facts = attachment.buildId ? extras.facts.get(attachment.buildId) : undefined;
    if (!card?.slug || card.status === "draft") return [];
    const harness = card.madeWith?.trim() || null;
    const origin = facts?.parentBuildId ? (facts.sourceHandle ? `Rebuilt from @${facts.sourceHandle}` : "Rebuilt") : "new build";
    return [
      {
        kind: "published",
        replyId: reply.id,
        title: card.title?.trim() || "Untitled build",
        author,
        line: [harness, origin].filter(Boolean).join(" · "),
        plaque: { reproduction_count: card.reproduction_count, last_confirmed_at: card.last_confirmed_at, last_confirmed_model: card.last_confirmed_model, published_at: card.published_at },
        pinned,
        to: `/b2/${card.slug}`,
        rebuildTo: `/rebuild/${card.slug}`,
      },
    ];
  });
}

/* ── Line up steps ── */

export interface LineCell {
  title: string;
  changed: boolean;
  open: boolean;
}

export interface LineRow {
  key: string;
  /** "The post", or "@kit". */
  name: string;
  author: ReplyItem["author"] | null;
  /** One entry per step number; null where the build has no step there. */
  cells: (LineCell | null)[];
  finished: boolean;
}

export interface LineUp {
  steps: number;
  rows: LineRow[];
  /** "2 of 2 finished builds changed Step 4.", or null when no finished build changed a step. */
  sentence: string | null;
}

/** The rebuilds of the post's build among the replies' builds, in the Wall's order. */
export function rebuildsInReplies(thread: PostThread, postBuildId: string | null, facts: ReadonlyMap<string, WallBuildFacts>): { reply: PostThread; buildId: string }[] {
  if (!postBuildId) return [];
  return buildReplies(thread).flatMap((reply) => {
    const attachment = reply.attachments.find((entry) => entry.kind === "build" && entry.buildId && !entry.snapshot);
    const fact = attachment?.buildId ? facts.get(attachment.buildId) : undefined;
    return fact && fact.parentBuildId === postBuildId ? [{ reply, buildId: fact.id }] : [];
  });
}

/** Line up steps is offered only with two rebuilds of the post's build in replies. */
export const lineUpOffered = (rebuilds: number): boolean => rebuilds >= 2;

interface Compared {
  kind: string;
  text: string;
  title: string;
  open: boolean;
}

const comparedOf = (rows: readonly LineStepRow[]): Compared[] => {
  const tops = topSteps(rows.filter((row) => row.parent_id === null).map((row) => ({ ...nodeLike(row), is_gap: row.is_gap, text: row.text, source: row.source })));
  return tops.map((row) => {
    const kind = kindWord(row);
    return { kind, text: (row.type === "code" ? row.source : row.text)?.trim() ?? "", title: row.title?.trim() || kind, open: row.is_gap };
  });
};

export function lineUpOf(thread: PostThread, postBuildId: string | null, extras: Pick<PostPageExtras, "steps" | "facts">): LineUp {
  const base = comparedOf(postBuildId ? (extras.steps.get(postBuildId) ?? []) : []);
  const rebuilds = rebuildsInReplies(thread, postBuildId, extras.facts).map(({ reply, buildId }) => ({ reply, steps: comparedOf(extras.steps.get(buildId) ?? []) }));
  const steps = Math.max(base.length, ...rebuilds.map((entry) => entry.steps.length), 0);
  const cellsOf = (row: readonly Compared[], compare: boolean): (LineCell | null)[] =>
    Array.from({ length: steps }, (_, at) => {
      const step = row[at];
      if (!step) return null;
      const against = base[at];
      const changed = compare && (!against || against.kind !== step.kind || against.text !== step.text);
      return { title: step.title, changed, open: step.open };
    });

  const rows: LineRow[] = [
    {
      key: "post",
      name: "The post",
      author: { id: thread.authorId, name: thread.author?.name?.trim() || thread.author?.handle || "Someone", handle: thread.author?.handle ?? null, avatarUrl: thread.author?.avatarUrl ?? null },
      cells: cellsOf(base, false),
      finished: !base.some((step) => step.open),
    },
    ...rebuilds.map(({ reply, steps: row }) => ({
      key: reply.id,
      name: reply.author?.handle ? `@${reply.author.handle}` : reply.author?.name?.trim() || "Someone",
      author: { id: reply.authorId, name: reply.author?.name?.trim() || reply.author?.handle || "Someone", handle: reply.author?.handle ?? null, avatarUrl: reply.author?.avatarUrl ?? null },
      cells: cellsOf(row, true),
      finished: !row.some((step) => step.open),
    })),
  ];

  // The one fact: the step changed by the most finished builds (the earliest step on a tie).
  const finished = rows.slice(1).filter((row) => row.finished);
  let best = -1;
  let most = 0;
  for (let at = 0; at < steps; at += 1) {
    const changed = finished.filter((row) => row.cells[at]?.changed).length;
    if (changed > most) {
      most = changed;
      best = at;
    }
  }
  const sentence = best >= 0 ? `${most} of ${finished.length} finished ${finished.length === 1 ? "build" : "builds"} changed Step ${best + 1}.` : null;
  return { steps, rows, sentence };
}

/* ── the post's own words ── */

/** The heading the reply's draft is named after: `Reply: <heading>`. */
export const replyDraftTitle = (post: Pick<Post, "body">): string => `Reply: ${splitBody(post.body).heading || "a post"}`.slice(0, 140);

/** "6 replies"-style counts for the switch: `Thread · 6`, `Wall · 3 builds`. */
export const threadLabel = (replies: number): string => `Thread · ${replies}`;
export const wallLabel = (builds: number): string => `Wall · ${builds} ${builds === 1 ? "build" : "builds"}`;
