// thread: a build's post as a thread (PT-01).
//
// A thread is one TipTap document (ProseMirror JSON) stored on builds.post_doc.
// It holds several posts, separated by postBreak nodes; each post is a run of
// text blocks and pictures in any order.
//
// THE PICTURES STAY IN THE POST-MEDIA SET. saveThread writes the set in the
// order the pictures appear in the document, so position 0 is the thread's
// first picture, the database trigger keeps cover_media_id on it, and the
// Gallery's media embed keeps working without reading the document at all.
//
// Everything here is pure and queries nothing, except saveThread, which writes
// through cover.ts and builds.ts.

import { updateBuild } from "./builds";
import { postEntriesOf, setPostMedia, type PostEntryMedia, type PostTextSource } from "./cover";
import type { Build, BuildMedia, BuildPatch, Json } from "./types";

// --- limits ------------------------------------------------------------------

/** The most posts one thread holds. */
export const MAX_THREAD_POSTS = 10;
/** The most pictures one post shows. */
export const MAX_POST_PICTURES = 4;
/** The most pictures one thread shows: the size of the post-media set. */
export const MAX_THREAD_MEDIA = 40;
/**
 * Characters of text in one post, counted in code points the way POST_TEXT_MAX
 * is, so an emoji costs one.
 */
export const POST_BODY_MAX = 1000;
/** Characters in a picture's caption. */
export const CAPTION_MAX = 200;
/** Characters in a picture's alt text. */
export const ALT_MAX = 300;

/** Widths a single picture may take, as a percent of the column. */
export const POST_MEDIA_WIDTH_MIN = 25;
export const POST_MEDIA_WIDTH_MAX = 100;

// --- the stored document -----------------------------------------------------

export type ThreadMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } };

export interface ThreadText {
  type: "text";
  text: string;
  marks?: ThreadMark[];
}

export interface ThreadHardBreak {
  type: "hardBreak";
}

export type ThreadInline = ThreadText | ThreadHardBreak;

export type ParagraphSize = "body" | "small";

export interface ThreadParagraph {
  type: "paragraph";
  /** size defaults to "body". */
  attrs?: { size?: ParagraphSize };
  content?: ThreadInline[];
}

export interface ThreadHeading {
  type: "heading";
  /** 1 is a Title, 2 a Heading. */
  attrs: { level: 1 | 2 };
  content?: ThreadInline[];
}

export interface ThreadCodeBlock {
  type: "codeBlock";
  attrs?: { language?: string | null };
  content?: ThreadText[];
}

export interface ThreadListItem {
  type: "listItem";
  content?: (ThreadParagraph | ThreadBulletList | ThreadOrderedList)[];
}

export interface ThreadBulletList {
  type: "bulletList";
  content?: ThreadListItem[];
}

export interface ThreadOrderedList {
  type: "orderedList";
  attrs?: { start?: number };
  content?: ThreadListItem[];
}

export interface PostMediaAttrs {
  /** The build_media row this picture shows. */
  mediaId: string;
  /** Percent of the column, 25 to 100, default 100. Ignored inside a postMediaRow. */
  width: number;
  /** The picture's pixel width, copied from build_media when inserted. */
  w: number | null;
  /** The picture's pixel height, copied from build_media when inserted. */
  h: number | null;
  /** May be empty. */
  alt: string;
  /** May be empty. */
  caption: string;
}

export interface ThreadPostMedia {
  type: "postMedia";
  attrs: PostMediaAttrs;
}

/** Two or three pictures side by side. */
export interface ThreadPostMediaRow {
  type: "postMediaRow";
  content: ThreadPostMedia[];
}

/** No content. Starts the next post. */
export interface ThreadPostBreak {
  type: "postBreak";
}

/** A block that can sit inside a post. */
export type PostBlock =
  | ThreadParagraph
  | ThreadHeading
  | ThreadCodeBlock
  | ThreadBulletList
  | ThreadOrderedList
  | ThreadPostMedia
  | ThreadPostMediaRow;

export type ThreadBlock = PostBlock | ThreadPostBreak;

/** builds.post_doc: the whole thread. */
export interface ThreadDoc {
  type: "doc";
  content: ThreadBlock[];
}

/** One post of a thread: the blocks between two postBreaks. */
export interface Post {
  content: PostBlock[];
}

export const THREAD_NODE_TYPES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "heading",
  "codeBlock",
  "bulletList",
  "orderedList",
  "listItem",
  "hardBreak",
  "text",
  "postMedia",
  "postMediaRow",
  "postBreak",
]);

export const THREAD_MARK_TYPES: ReadonlySet<string> = new Set(["bold", "italic", "underline", "link"]);

/** Schemes a link may use. */
const LINK_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);

// --- reading -----------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function childrenOf(node: unknown): unknown[] {
  return isRecord(node) && Array.isArray(node.content) ? node.content : [];
}

function characters(text: string): number {
  return [...text].length;
}

/** Whether a value has the shape of a stored thread: an object of type doc with a content list. */
export function isThreadDoc(value: unknown): value is ThreadDoc {
  return isRecord(value) && value.type === "doc" && Array.isArray(value.content);
}

const TEXT_BLOCK_TYPES: ReadonlySet<string> = new Set(["paragraph", "heading", "codeBlock", "bulletList", "orderedList"]);

/**
 * Text blocks only, and no text in them. A picture, or a node a thread cannot
 * hold, makes a post not empty, so checkThread still sees it.
 */
function isEmptyPost(post: Post): boolean {
  return (
    post.content.every((block) => isRecord(block) && TEXT_BLOCK_TYPES.has(block.type)) &&
    postPlainText(post).trim() === ""
  );
}

/**
 * The thread cut at its postBreaks. Empty posts at either end are dropped;
 * an empty post between two breaks stays, so a creator's layout is not
 * rearranged behind their back.
 */
export function splitThread(doc: ThreadDoc): Post[] {
  const posts: Post[] = [{ content: [] }];
  for (const block of childrenOf(doc) as ThreadBlock[]) {
    if (block?.type === "postBreak") posts.push({ content: [] });
    else posts[posts.length - 1].content.push(block);
  }
  let start = 0;
  let end = posts.length;
  while (start < end && isEmptyPost(posts[start])) start++;
  while (end > start && isEmptyPost(posts[end - 1])) end--;
  return posts.slice(start, end);
}

/** Every postMedia node under a node, in document order. */
function mediaNodesOf(node: unknown): ThreadPostMedia[] {
  const out: ThreadPostMedia[] = [];
  const walk = (current: unknown) => {
    if (!isRecord(current)) return;
    if (current.type === "postMedia") out.push(current as unknown as ThreadPostMedia);
    for (const child of childrenOf(current)) walk(child);
  };
  walk(node);
  return out;
}

function mediaIdOf(node: ThreadPostMedia): string | null {
  const id = isRecord(node.attrs) ? node.attrs.mediaId : null;
  return typeof id === "string" && id.trim() ? id : null;
}

/** Every mediaId in the thread, in document order, each once. */
export function threadMediaIds(doc: ThreadDoc): string[] {
  const seen = new Set<string>();
  for (const node of mediaNodesOf(doc)) {
    const id = mediaIdOf(node);
    if (id) seen.add(id);
  }
  return [...seen];
}

function inlineText(node: unknown): string {
  if (!isRecord(node)) return "";
  if (node.type === "text") return typeof node.text === "string" ? node.text : "";
  if (node.type === "hardBreak") return "\n";
  return childrenOf(node).map(inlineText).join("");
}

function blockText(node: unknown): string[] {
  if (!isRecord(node)) return [];
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "codeBlock":
      return [childrenOf(node).map(inlineText).join("")];
    case "bulletList":
    case "orderedList":
    case "listItem":
      return childrenOf(node).flatMap(blockText);
    default:
      // Pictures carry no body text: their alt goes on the image itself.
      return [];
  }
}

/** A post's text, one block per line, for counting and for screen readers. */
export function postPlainText(post: Post): string {
  return post.content.flatMap(blockText).join("\n");
}

/** Characters of body text in a post: postPlainText without its line breaks. */
export function postBodyLength(post: Post): number {
  return characters(postPlainText(post).replace(/\n/g, ""));
}

// --- checking ----------------------------------------------------------------

export type ThreadProblemCode =
  /** The value is not a thread document at all. */
  | "not_a_thread"
  | "too_many_posts"
  | "too_many_post_pictures"
  | "too_many_thread_pictures"
  | "post_too_long"
  | "unknown_node"
  | "unknown_mark"
  | "bad_link"
  /** A picture with no mediaId, a width outside 25 to 100, or a row of other than 2 or 3. */
  | "bad_picture"
  | "caption_too_long"
  | "alt_too_long";

export interface ThreadProblem {
  code: ThreadProblemCode;
  /** The post it is in, counting from 0 as splitThread does, or null for the whole thread. */
  post: number | null;
  /** A sentence a creator can act on. */
  message: string;
}

/** Whether a link's address may be followed: http, https or mailto. PostBody draws any other href as text. */
export function linkAllowed(href: unknown): boolean {
  if (typeof href !== "string" || !href.trim()) return false;
  try {
    return LINK_PROTOCOLS.has(new URL(href.trim()).protocol);
  } catch {
    return false;
  }
}

function postLabel(post: number | null): string {
  return post === null ? "The thread" : `Post ${post + 1}`;
}

/** Problems with the nodes and marks of one post, depth first. */
function nodeProblems(node: unknown, post: number | null, out: ThreadProblem[]): void {
  if (!isRecord(node)) {
    out.push({ code: "unknown_node", post, message: `${postLabel(post)} has a block that cannot be read. Delete it and try again.` });
    return;
  }

  const type = typeof node.type === "string" ? node.type : "";
  if (!THREAD_NODE_TYPES.has(type) || type === "doc") {
    out.push({
      code: "unknown_node",
      post,
      message: `${postLabel(post)} has a block a thread cannot hold${type ? ` (${type})` : ""}. Delete it or paste it again as plain text.`,
    });
    return;
  }

  if (Array.isArray(node.marks)) {
    for (const mark of node.marks) {
      const markType = isRecord(mark) && typeof mark.type === "string" ? mark.type : "";
      if (!THREAD_MARK_TYPES.has(markType)) {
        out.push({
          code: "unknown_mark",
          post,
          message: `${postLabel(post)} has formatting a thread cannot keep${markType ? ` (${markType})` : ""}. Clear the formatting on that text.`,
        });
      } else if (markType === "link" && !linkAllowed(isRecord(mark) && isRecord(mark.attrs) ? mark.attrs.href : null)) {
        out.push({
          code: "bad_link",
          post,
          message: `${postLabel(post)} has a link that does not start with http, https or mailto. Fix the address or remove the link.`,
        });
      }
    }
  }

  if (type === "postMediaRow") {
    const count = childrenOf(node).length;
    if (count < 2 || count > 3) {
      out.push({
        code: "bad_picture",
        post,
        message: `${postLabel(post)} has a row of ${count} picture${count === 1 ? "" : "s"}. A row holds 2 or 3; move the others out of it.`,
      });
    }
    for (const child of childrenOf(node)) {
      if (!isRecord(child) || child.type !== "postMedia") {
        out.push({ code: "bad_picture", post, message: `${postLabel(post)} has something other than a picture in a row of pictures. Move it out of the row.` });
      }
    }
  }

  if (type === "postMedia") mediaProblems(node, post, out);

  for (const child of childrenOf(node)) nodeProblems(child, post, out);
}

function mediaProblems(node: Record<string, unknown>, post: number | null, out: ThreadProblem[]): void {
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  if (typeof attrs.mediaId !== "string" || !attrs.mediaId.trim()) {
    out.push({ code: "bad_picture", post, message: `${postLabel(post)} has a picture that has not finished uploading. Wait for it, or remove it.` });
  }
  const width = attrs.width;
  if (width !== undefined && (typeof width !== "number" || !(width >= POST_MEDIA_WIDTH_MIN && width <= POST_MEDIA_WIDTH_MAX))) {
    out.push({
      code: "bad_picture",
      post,
      message: `${postLabel(post)} has a picture sized outside ${POST_MEDIA_WIDTH_MIN}% to ${POST_MEDIA_WIDTH_MAX}% of the column. Resize it.`,
    });
  }
  const caption = typeof attrs.caption === "string" ? attrs.caption : "";
  if (characters(caption) > CAPTION_MAX) {
    out.push({
      code: "caption_too_long",
      post,
      message: `${postLabel(post)} has a caption of ${characters(caption)} characters. Captions are at most ${CAPTION_MAX}; shorten it.`,
    });
  }
  const alt = typeof attrs.alt === "string" ? attrs.alt : "";
  if (characters(alt) > ALT_MAX) {
    out.push({
      code: "alt_too_long",
      post,
      message: `${postLabel(post)} has a picture description of ${characters(alt)} characters. Descriptions are at most ${ALT_MAX}; shorten it.`,
    });
  }
}

/**
 * Everything that stops this thread being saved. An empty list means it can be
 * saved. Takes unknown because a document is whatever the editor, or the
 * database, handed over.
 */
export function checkThread(doc: unknown): ThreadProblem[] {
  if (!isThreadDoc(doc)) {
    return [{ code: "not_a_thread", post: null, message: "This post could not be read. Reload the page and try again." }];
  }

  const problems: ThreadProblem[] = [];
  const posts = splitThread(doc);

  if (posts.length > MAX_THREAD_POSTS) {
    problems.push({
      code: "too_many_posts",
      post: MAX_THREAD_POSTS,
      message: `This thread has ${posts.length} posts. A thread holds at most ${MAX_THREAD_POSTS}; merge or delete ${posts.length - MAX_THREAD_POSTS}.`,
    });
  }

  posts.forEach((post, index) => {
    for (const block of post.content) nodeProblems(block, index, problems);

    const pictures = post.content.flatMap(mediaNodesOf).length;
    if (pictures > MAX_POST_PICTURES) {
      problems.push({
        code: "too_many_post_pictures",
        post: index,
        message: `${postLabel(index)} has ${pictures} pictures. A post shows at most ${MAX_POST_PICTURES}; move some to another post.`,
      });
    }

    const length = postBodyLength(post);
    if (length > POST_BODY_MAX) {
      problems.push({
        code: "post_too_long",
        post: index,
        message: `${postLabel(index)} has ${length} characters. A post holds at most ${POST_BODY_MAX}; shorten it or split it into two posts.`,
      });
    }
  });

  const total = threadMediaIds(doc).length;
  if (total > MAX_THREAD_MEDIA) {
    problems.push({
      code: "too_many_thread_pictures",
      post: null,
      message: `This thread has ${total} pictures. A thread shows at most ${MAX_THREAD_MEDIA}; remove ${total - MAX_THREAD_MEDIA}.`,
    });
  }

  return problems;
}

// --- old posts ---------------------------------------------------------------

/** The media fields legacyThread reads. Select POST_MEDIA_COLUMNS. */
export type ThreadMedia = PostEntryMedia & Partial<Pick<BuildMedia, "width" | "height">>;

/** The build fields threadOf reads. */
export type ThreadSource = PostTextSource & { post_doc?: unknown };

function pixels(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The old post as a thread, so an old build renders and opens in the editor.
 * Each entry of postEntriesOf is its own post: its text as a paragraph, then
 * its picture at full width. Null when the build has no entries.
 */
export function legacyThread(build: PostTextSource | null | undefined, media: readonly ThreadMedia[]): ThreadDoc | null {
  const entries = postEntriesOf(build, media);
  if (entries.length === 0) return null;

  const content: ThreadBlock[] = [];
  entries.forEach((entry, index) => {
    if (index > 0) content.push({ type: "postBreak" });
    const text = entry.text?.trim();
    if (text) content.push({ type: "paragraph", content: [{ type: "text", text }] });
    content.push({
      type: "postMedia",
      attrs: {
        mediaId: entry.media.id,
        width: 100,
        w: pixels(entry.media.width),
        h: pixels(entry.media.height),
        alt: "",
        caption: "",
      },
    });
  });
  return { type: "doc", content };
}

/** The build's thread: post_doc when it holds one, else the old post as a thread. */
export function threadOf(build: ThreadSource | null | undefined, media: readonly ThreadMedia[]): ThreadDoc | null {
  if (isThreadDoc(build?.post_doc)) return build.post_doc;
  return legacyThread(build, media);
}

// --- writing -----------------------------------------------------------------

/** A thread refused before it was written, shaped like PostMediaError. */
export class ThreadError extends Error {
  readonly code: ThreadProblemCode;
  readonly post: number | null;

  constructor(code: ThreadProblemCode, message: string, post: number | null = null) {
    super(message);
    this.name = "ThreadError";
    this.code = code;
    this.post = post;
  }
}

/**
 * Save the thread. The post-media set is written first, in document order, so
 * the cover mirror follows the first picture; the document is written second,
 * and not at all if the set write fails.
 */
export async function saveThread(buildId: string, doc: ThreadDoc): Promise<Build> {
  const [problem] = checkThread(doc);
  if (problem) throw new ThreadError(problem.code, problem.message, problem.post);

  await setPostMedia(buildId, threadMediaIds(doc));

  // post_doc is newer than the generated types, so the patch is cast here.
  return updateBuild(buildId, { post_doc: doc as unknown as Json } as unknown as BuildPatch);
}
