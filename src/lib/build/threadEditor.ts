// threadEditor: the thread as the composer's editor shows it (PT-05).
//
// Pure. Nothing here queries anything. thread.ts decides what a thread may hold;
// this file answers the questions an editor asks of a document in hand: which
// blocks make up each post, how far along the 1,000 characters a post is, what
// the status line should say when a save has to wait, and what a reordered
// thread looks like.
//
// POSTS ARE NUMBERED BY THEIR PLACE IN THE EDITOR. splitThread drops an empty
// post at either end of the thread, because the Gallery has nothing to show for
// it; the editor keeps it, because the writer is looking at it. `postRuns`
// keeps every run, so Post 3 in the outline, the label on the break and the
// sentence in the status line are the same Post 3.

import {
  checkThread,
  MAX_THREAD_POSTS,
  POST_BODY_MAX,
  postBodyLength,
  type Post,
  type PostBlock,
  type ThreadBlock,
  type ThreadDoc,
  toGrids,
} from "./thread";

/** A post's character count is shown once it passes this. */
export const COUNT_SHOWN_FROM = 900;

/** One post as the editor holds it: the blocks between two breaks. */
export interface PostRun {
  /** 0-based place in the editor. */
  index: number;
  /** The blocks, as they stand in doc.content. */
  blocks: ThreadBlock[];
  /** Index in doc.content of the first block, or of the break's slot when the run is empty. */
  start: number;
  /** One past the last block. */
  end: number;
}

type Loose = { type?: unknown; text?: unknown; content?: unknown; attrs?: unknown };

const isRecord = (value: unknown): value is Loose => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const childrenOf = (node: unknown): unknown[] => (isRecord(node) && Array.isArray(node.content) ? node.content : []);

/** An empty thread: one empty paragraph, which is what the editor opens on. */
export function emptyThread(): ThreadDoc {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * CA-07: a thread as the editor opens it: toGrids's shape (one grid per post, last), and an empty line before the
 * pictures of a post that is only pictures, where its placeholder sits. Nothing is saved by opening it.
 */
export function editorShape(doc: ThreadDoc): ThreadDoc {
  const grids = toGrids(doc);
  const content: ThreadBlock[] = [];
  let inPost = 0;
  for (const block of grids.content) {
    if (isRecord(block) && block.type === "postBreak") inPost = 0;
    else {
      if (isRecord(block) && block.type === "postMediaGrid" && inPost === 0) content.push({ type: "paragraph" });
      inPost += 1;
    }
    content.push(block);
  }
  return content.length === grids.content.length ? grids : { ...grids, content };
}

/** The thread cut at its postBreaks, keeping every post, empty or not. Always at least one run. */
export function postRuns(doc: ThreadDoc): PostRun[] {
  const runs: PostRun[] = [{ index: 0, blocks: [], start: 0, end: 0 }];
  childrenOf(doc).forEach((block, at) => {
    if (isRecord(block) && block.type === "postBreak") {
      runs.push({ index: runs.length, blocks: [], start: at + 1, end: at + 1 });
      return;
    }
    const run = runs[runs.length - 1];
    run.blocks.push(block as ThreadBlock);
    run.end = at + 1;
  });
  return runs;
}

/** Characters of body text in a run, counted the way thread.ts counts a post. */
export function runLength(run: PostRun): number {
  return postBodyLength({ content: run.blocks as PostBlock[] } as Post);
}

function textOf(node: unknown): string {
  if (!isRecord(node)) return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return " ";
  const parts = childrenOf(node).map(textOf);
  return node.type === "bulletList" || node.type === "orderedList" ? parts.join(" ") : parts.join("");
}

/**
 * The first words of a post, for the outline: the first block that has any text
 * (or a picture), cut to `words` words. "" when the post holds nothing yet.
 */
export function postLead(run: PostRun, words = 8): string {
  for (const block of run.blocks) {
    const words_ = textOf(block).trim().split(/\s+/).filter(Boolean);
    if (words_.length > 0) return words_.length > words ? `${words_.slice(0, words).join(" ")}…` : words_.join(" ");
    if (isRecord(block) && block.type === "postMedia") return "Picture";
    if (isRecord(block) && block.type === "postMediaRow") return "Pictures";
    // CA-07: a post's block of pictures is named by its count.
    if (isRecord(block) && block.type === "postMediaGrid") return childrenOf(block).length === 1 ? "Picture" : "Pictures";
  }
  return "";
}

/** "912 / 1,000" once a post passes 900 characters, else null. */
export function countLabel(length: number): string | null {
  return length > COUNT_SHOWN_FROM ? `${length.toLocaleString("en-US")} / ${POST_BODY_MAX.toLocaleString("en-US")}` : null;
}

/** "Post 3 is over 1,000 characters": what the status line says while a save waits. */
export function overLimitSentence(index: number): string {
  return `Post ${index + 1} is over ${POST_BODY_MAX.toLocaleString("en-US")} characters`;
}

/** The sentence a save waits on while a picture did not upload (CA-07 P4). Post and picture count from 0. */
export function failedSentence(picture: number, post: number): string {
  return `Picture ${picture + 1} in post ${post + 1} did not upload. Retry it or remove it.`;
}

/** The first picture the editor marked as not uploaded, by the editor's numbering, or null. */
export function firstFailedUpload(doc: ThreadDoc): { post: number; picture: number } | null {
  for (const run of postRuns(doc)) {
    for (const block of run.blocks) {
      if (!isRecord(block) || block.type !== "postMediaGrid") continue;
      const at = childrenOf(block).findIndex((child) => isRecord(child) && isRecord(child.attrs) && (child.attrs as Record<string, unknown>).failed === true);
      if (at >= 0) return { post: run.index, picture: at };
    }
  }
  return null;
}

/** The first post over its limit, or null. */
export function firstOverLimit(doc: ThreadDoc): { index: number; length: number } | null {
  for (const run of postRuns(doc)) {
    const length = runLength(run);
    if (length > POST_BODY_MAX) return { index: run.index, length };
  }
  return null;
}

/**
 * A sentence while this thread cannot be saved, else null. An over-long post is
 * named by the editor's own numbering; anything else is thread.ts's sentence.
 */
export function holdSentence(doc: ThreadDoc): string | null {
  const failed = firstFailedUpload(doc);
  if (failed) return failedSentence(failed.picture, failed.post);
  const over = firstOverLimit(doc);
  if (over) return overLimitSentence(over.index);
  const [problem] = checkThread(doc);
  return problem ? problem.message : null;
}

/** Whether another post may start: a thread holds at most MAX_THREAD_POSTS. */
export function canStartPost(doc: ThreadDoc): boolean {
  return postRuns(doc).length < MAX_THREAD_POSTS;
}

/** The sentence an 11th post is refused with. */
export const POST_LIMIT_SENTENCE = `Posts: ${MAX_THREAD_POSTS} max`;

/** The thread with the post at `from` moved to place `to`, its whole run of blocks with it. */
export function movePost(doc: ThreadDoc, from: number, to: number): ThreadDoc {
  const runs = postRuns(doc);
  if (from === to || from < 0 || to < 0 || from >= runs.length || to >= runs.length) return doc;
  const order = runs.map((_, index) => index);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  const content: ThreadBlock[] = [];
  order.forEach((place, at) => {
    if (at > 0) content.push({ type: "postBreak" });
    content.push(...runs[place].blocks);
  });
  return { type: "doc", content };
}

// --- comparing and tidying ----------------------------------------------------

// uploadId is the editor's mark on a picture still uploading, and failed (CA-07) its mark on one that did not upload;
// their defaults are never stored.
const DEFAULT_ATTRS: Record<string, unknown> = { size: "body", language: null, uploadId: null, failed: false };

function tidyNode(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const out: Record<string, unknown> = { ...node };
  if (isRecord(node.attrs)) {
    const attrs = Object.fromEntries(
      Object.entries(node.attrs as Record<string, unknown>).filter(([key, value]) => !(key in DEFAULT_ATTRS && DEFAULT_ATTRS[key] === value)),
    );
    if (Object.keys(attrs).length > 0) out.attrs = attrs;
    else delete out.attrs;
  }
  if (Array.isArray(node.content)) out.content = node.content.map(tidyNode);
  return out;
}

function isBlankParagraph(node: unknown): boolean {
  return isRecord(node) && node.type === "paragraph" && childrenOf(node).length === 0;
}

/**
 * The document as it is stored: attributes that are only their default left
 * out, and the empty paragraphs the editor keeps at the end taken off. The
 * editor reads these back as it found them (trailingNode puts one back when the
 * last block is not a paragraph).
 */
export function tidyThread(doc: ThreadDoc): ThreadDoc {
  const content = childrenOf(doc).map(tidyNode) as ThreadBlock[];
  while (content.length > 0 && isBlankParagraph(content[content.length - 1])) content.pop();
  return { type: "doc", content };
}

/** Whether two documents are the same thread, as far as a save is concerned. */
export function sameThread(a: ThreadDoc, b: ThreadDoc): boolean {
  return JSON.stringify(tidyThread(a)) === JSON.stringify(tidyThread(b));
}
