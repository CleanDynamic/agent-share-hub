// thread: a build's post as a thread (PT-01).
//
// A thread is one TipTap document (ProseMirror JSON) stored on builds.post_doc.
// It holds several posts, separated by postBreak nodes; each post is a run of
// text blocks, then (CA-07) one postMediaGrid of its pictures as its last block.
// Older posts held pictures between the lines and in rows; `toGrids` reads them
// in the new shape without writing anything.
//
// THE PICTURES STAY IN THE POST-MEDIA SET. saveThread writes the set in the
// order the pictures appear in the document, so position 0 is the thread's
// first picture, the database trigger keeps cover_media_id on it, and the
// Gallery's media embed keeps working without reading the document at all.
//
// Everything here is pure and queries nothing, except saveThread, which writes
// through cover.ts and builds.ts.

import { updateBuild } from "./builds";
import { getPostMedia, postEntriesOf, setPostMedia, type PostEntryMedia, type PostTextSource } from "./cover";
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
/** Characters in a picture's alt text (CA-07: 1,000, as X allows). */
export const ALT_MAX = 1000;
/** The smallest crop, as a fraction of the original, either way. */
export const CROP_MIN = 0.01;
/** What Crop media can set the shape to. */
export const CROP_ASPECTS = ["original", "wide", "square"] as const;
export type CropAspect = (typeof CROP_ASPECTS)[number];
/** The warnings a maker can put on a picture. */
export const MEDIA_WARNINGS = ["nudity", "violence", "sensitive"] as const;
export type MediaWarning = (typeof MEDIA_WARNINGS)[number];
/** Crop media's zoom, 1 to 3. */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

/** Widths a single picture may take, as a percent of the column. */
export const POST_MEDIA_WIDTH_MIN = 25;
export const POST_MEDIA_WIDTH_MAX = 100;

// --- the stored document -----------------------------------------------------

export type ThreadMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } }
  /** CA-06 P1: words that point at a tile or a session of this build. `to` is `refTo`'s: `node:<id>`, `session:<key>` or `workstream:<key>`. */
  | { type: "ref"; attrs: { to: string } };

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

/** A crop rectangle, as fractions 0 to 1 of the original picture. */
export interface MediaCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PostMediaAttrs {
  /** The build_media row this picture shows. */
  mediaId: string;
  /** The picture's pixel width, copied from build_media when inserted. */
  w: number | null;
  /** The picture's pixel height, copied from build_media when inserted. */
  h: number | null;
  /** May be empty. Up to ALT_MAX. */
  alt: string;
  /** CA-07: the part of the original shown, or null for all of it. The file itself is never changed. */
  crop: MediaCrop | null;
  /** CA-07: what Crop was set to, to reopen it as it was left. */
  aspect: CropAspect | null;
  /** CA-07: Crop's zoom, 1 to 3, to reopen it as it was left. */
  zoom: number | null;
  /** CA-07: the warnings readers see before the picture; empty for none. */
  warn: MediaWarning[];
  /** Kept from PT-06; no longer used. */
  width: number;
  /** Kept from PT-06; no longer shown. */
  caption: string;
}

/** CA-07's attributes on a picture nobody has cropped, described or flagged. */
export const NO_MEDIA_EDITS: Pick<PostMediaAttrs, "crop" | "aspect" | "zoom" | "warn"> = { crop: null, aspect: null, zoom: null, warn: [] };

export interface ThreadPostMedia {
  type: "postMedia";
  attrs: PostMediaAttrs;
}

/** PT-06's two or three pictures side by side. Still read, so old posts load; `toGrids` turns it into a grid. */
export interface ThreadPostMediaRow {
  type: "postMediaRow";
  content: ThreadPostMedia[];
}

/** CA-07: a post's pictures, one block after its words: 1 to MAX_POST_PICTURES, drawn as X draws them. */
export interface ThreadPostMediaGrid {
  type: "postMediaGrid";
  /** `step` is "node:<build_nodes id>", the step the pictures come from, or null. */
  attrs: { step: string | null };
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
  | ThreadPostMediaRow
  | ThreadPostMediaGrid;

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
  "postMediaGrid",
  "postBreak",
]);

export const THREAD_MARK_TYPES: ReadonlySet<string> = new Set(["bold", "italic", "underline", "link", "ref"]);

// --- references (CA-06 P1) ----------------------------------------------------

/** What a reference points at: a node of the build (a tile), a session by the key CA-04 gives it, or (CA-17) a whole part by its key (`ws-<uuid>`). */
export interface RefTarget {
  kind: "node" | "session" | "workstream";
  /** A build_nodes id, a session key (an import_sessions id, or `typed-<uuid>`), or a part's key. */
  id: string;
}

/** An id or a key, as the build stores them: letters, digits, "-" and "_", at most 80. */
const REF_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
/** An old build's run of typed prompts is read as a session but never stored, so nothing can point at it. */
const UNSTORED_SESSION = "typed-legacy-";

/** The `to` of a reference: `node:<id>`, `session:<key>` or `workstream:<key>`. */
export function refTo(target: RefTarget): string {
  return `${target.kind}:${target.id}`;
}

/** A reference's `to`, read; null for any other shape. Whether the part is still in the build is not asked here. */
export function parseRefTo(to: unknown): RefTarget | null {
  if (typeof to !== "string") return null;
  const at = to.indexOf(":");
  const kind = to.slice(0, at);
  const id = to.slice(at + 1);
  if ((kind !== "node" && kind !== "session" && kind !== "workstream") || !REF_ID.test(id)) return null;
  if (kind === "session" && id.startsWith(UNSTORED_SESSION)) return null;
  return { kind, id };
}

/** Every `to` the thread's references hold, in document order, each once. */
export function threadRefs(doc: unknown): string[] {
  const seen = new Set<string>();
  const walk = (node: unknown) => {
    if (!isRecord(node)) return;
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (isRecord(mark) && mark.type === "ref" && isRecord(mark.attrs) && parseRefTo(mark.attrs.to)) seen.add(mark.attrs.to as string);
      }
    }
    for (const child of childrenOf(node)) walk(child);
  };
  walk(doc);
  return [...seen];
}

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

// --- one block of pictures per post (CA-07) ---------------------------------------

const PICTURE_HOLDERS: ReadonlySet<string> = new Set(["postMedia", "postMediaRow", "postMediaGrid"]);

/** A grid's step, read: "node:<id>" when it has that shape, else null. Whether the step is still in the build is not asked. */
export function gridStepOf(grid: unknown): string | null {
  const step = isRecord(grid) && isRecord(grid.attrs) ? grid.attrs.step : null;
  const target = parseRefTo(step);
  return target && target.kind === "node" ? (step as string) : null;
}

/** Whether one post's blocks are already in the new shape: no loose picture or row, at most one grid, and it is last. */
function postInShape(blocks: readonly unknown[]): boolean {
  let grids = 0;
  for (let at = 0; at < blocks.length; at++) {
    const block = blocks[at];
    if (!isRecord(block)) continue;
    if (block.type === "postMedia" || block.type === "postMediaRow") return false;
    if (block.type === "postMediaGrid") {
      grids += 1;
      if (grids > 1 || at !== blocks.length - 1 || childrenOf(block).length === 0) return false;
    }
  }
  return true;
}

/**
 * The thread with each post's pictures in one postMediaGrid, the post's last block: every postMedia at the top level,
 * in a row or in a grid, in document order, with the first step any grid named. A post with no pictures gets no grid;
 * one with more than four keeps them all, and checkThread says so. Pure, and the same object comes back when every post
 * is already in that shape, so a post saved in the new shape is never touched. Readers call it before drawing; the
 * editor calls it as it opens a thread. Nothing is saved by it.
 */
export function toGrids(doc: ThreadDoc): ThreadDoc {
  const content = childrenOf(doc);
  const posts: unknown[][] = [[]];
  for (const block of content) {
    if (isRecord(block) && block.type === "postBreak") posts.push([]);
    else posts[posts.length - 1].push(block);
  }
  if (posts.every(postInShape)) return doc;

  const out: unknown[] = [];
  posts.forEach((blocks, index) => {
    if (index > 0) out.push({ type: "postBreak" });
    const pictures: unknown[] = [];
    let step: string | null = null;
    for (const block of blocks) {
      if (isRecord(block) && PICTURE_HOLDERS.has(block.type as string)) {
        if (block.type === "postMedia") pictures.push(block);
        else for (const child of childrenOf(block)) if (isRecord(child) && child.type === "postMedia") pictures.push(child);
        if (block.type === "postMediaGrid") step ??= gridStepOf(block);
      } else out.push(block);
    }
    if (pictures.length > 0) out.push({ type: "postMediaGrid", attrs: { step }, content: pictures });
  });
  return { ...doc, content: out as ThreadBlock[] };
}

/** A picture's attributes as readers draw them: whatever was stored, with CA-07's defaults where they are missing. */
export function mediaAttrsOf(node: unknown): PostMediaAttrs {
  const attrs = isRecord(node) && isRecord(node.attrs) ? node.attrs : {};
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
  const crop = cropOf(attrs.crop);
  const aspect = CROP_ASPECTS.includes(attrs.aspect as CropAspect) ? (attrs.aspect as CropAspect) : null;
  const zoom = typeof attrs.zoom === "number" && attrs.zoom >= ZOOM_MIN && attrs.zoom <= ZOOM_MAX ? attrs.zoom : null;
  const warn = Array.isArray(attrs.warn) ? (attrs.warn.filter((value) => MEDIA_WARNINGS.includes(value as MediaWarning)) as MediaWarning[]) : [];
  return {
    mediaId: typeof attrs.mediaId === "string" ? attrs.mediaId : "",
    w: number(attrs.w),
    h: number(attrs.h),
    alt: typeof attrs.alt === "string" ? attrs.alt : "",
    crop,
    aspect,
    zoom,
    warn,
    width: typeof attrs.width === "number" ? attrs.width : POST_MEDIA_WIDTH_MAX,
    caption: typeof attrs.caption === "string" ? attrs.caption : "",
  };
}

/** A crop, read: four fractions inside 0 to 1, each side at least CROP_MIN; else null. */
export function cropOf(value: unknown): MediaCrop | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (![x, y, w, h].every((part) => typeof part === "number" && Number.isFinite(part))) return null;
  const crop = { x, y, w, h } as MediaCrop;
  return cropProblem(crop as unknown as Record<string, unknown>) ? null : crop;
}

/** Why a crop cannot be kept, or null. */
function cropProblem(crop: Record<string, unknown>): string | null {
  const { x, y, w, h } = crop;
  if (![x, y, w, h].every((part) => typeof part === "number" && Number.isFinite(part))) return "not four numbers";
  const [cx, cy, cw, ch] = [x, y, w, h] as number[];
  const EDGE = 1e-6;
  if (cx < -EDGE || cy < -EDGE || cw < CROP_MIN - EDGE || ch < CROP_MIN - EDGE) return "outside";
  if (cx + cw > 1 + EDGE || cy + ch > 1 + EDGE) return "outside";
  return null;
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
  /** CA-06 P1: a reference whose `to` is not `node:<id>`, `session:<key>` or `workstream:<key>`, or one that is also a web link. */
  | "bad_ref"
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
    const markTypes = node.marks.map((mark) => (isRecord(mark) ? mark.type : null));
    if (markTypes.includes("ref") && markTypes.includes("link")) {
      out.push({ code: "bad_ref", post, message: `${postLabel(post)} has words that are both a web link and a link to a part. Remove one of them.` });
    }
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
      } else if (markType === "ref" && !parseRefTo(isRecord(mark) && isRecord(mark.attrs) ? mark.attrs.to : null)) {
        out.push({ code: "bad_ref", post, message: `A link in ${postLabel(post).toLowerCase()} points at something that isn't in this build.` });
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

  if (type === "postMediaGrid") {
    if (childrenOf(node).length === 0) {
      out.push({ code: "bad_picture", post, message: `${postLabel(post)} has an empty block of pictures. Add a picture or remove it.` });
    }
    for (const child of childrenOf(node)) {
      if (!isRecord(child) || child.type !== "postMedia") {
        out.push({ code: "bad_picture", post, message: `${postLabel(post)} has something other than a picture with its pictures. Move it out.` });
      }
    }
    const step = isRecord(node.attrs) ? node.attrs.step : null;
    if (step !== null && step !== undefined && !gridStepOf(node)) {
      out.push({ code: "bad_ref", post, message: `The step a picture links to in ${postLabel(post).toLowerCase()} isn't in this build.` });
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
  if (attrs.warn !== undefined && (!Array.isArray(attrs.warn) || attrs.warn.some((value) => !MEDIA_WARNINGS.includes(value as MediaWarning)))) {
    out.push({ code: "bad_picture", post, message: `${postLabel(post)} has a content warning a thread cannot keep. Choose Nudity, Violence or Sensitive.` });
  }
  if (attrs.crop !== undefined && attrs.crop !== null && (!isRecord(attrs.crop) || cropProblem(attrs.crop))) {
    out.push({ code: "bad_picture", post, message: `${postLabel(post)} has a picture cropped outside itself. Crop it again.` });
  }
  const alt = typeof attrs.alt === "string" ? attrs.alt : "";
  if (characters(alt) > ALT_MAX) {
    out.push({
      code: "alt_too_long",
      post,
      message: `${postLabel(post)} has a picture description of ${characters(alt)} characters. Descriptions are at most ${ALT_MAX.toLocaleString("en-US")}; shorten it.`,
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
        crop: null,
        aspect: null,
        zoom: null,
        warn: [],
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

/**
 * The thread's media rows, in thread order: what Show more asks for when it
 * opens the posts after the first. At most MAX_THREAD_MEDIA rows, one request.
 */
export function getThreadMedia(buildId: string): Promise<BuildMedia[]> {
  return getPostMedia(buildId);
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
