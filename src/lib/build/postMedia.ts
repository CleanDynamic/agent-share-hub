// postMedia: pictures and videos in the composer's post (PT-06).
//
// Pure, except `uploadPostPicture` and `signPostMedia`, which go through media.ts. thread.ts decides what a stored
// thread may hold; threadEditor.ts answers what the editor asks of a document in hand; this file answers what a
// picture asks: may this file go in, may this many more, what size is next, and what does the thread look like once
// a picture or a row has been moved.
//
// A PICTURE STILL UPLOADING IS A postMedia WITH NO mediaId. thread.ts already refuses to save such a node ("has not
// finished uploading"), so the save waits on its own and nothing here has to hold it. The editor marks it with an
// `uploadId` while it uploads; threadEditor's tidyThread drops the mark once it is null.

import { MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia, type MediaRef } from "./media";
import {
  MAX_POST_PICTURES,
  MAX_THREAD_MEDIA,
  POST_MEDIA_WIDTH_MAX,
  POST_MEDIA_WIDTH_MIN,
  type PostMediaAttrs,
  type ThreadBlock,
  type ThreadDoc,
  type ThreadPostMedia,
  type ThreadPostMediaRow,
} from "./thread";
import { postRuns } from "./threadEditor";
import type { BuildMedia } from "./types";

// --- the sentences ---------------------------------------------------------------

/** The sentence a fifth picture in a post is refused with. */
export const POST_FULL_SENTENCE = `A post holds ${MAX_POST_PICTURES} pictures. Start a new post or remove one.`;
/** The sentence a forty-first picture in a thread is refused with. */
export const THREAD_FULL_SENTENCE = `A thread holds ${MAX_THREAD_MEDIA} pictures. Remove one before adding another.`;
/** A fourth picture dropped onto a row. */
export const ROW_FULL_SENTENCE = "A row holds 3 pictures. Move one out before adding another.";
/** A row asked for with other than 2 or 3 files. */
export const ROW_COUNT_SENTENCE = "A row holds 2 or 3 pictures. Choose 2 or 3 files.";

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Why this file cannot go in a post, or null when it can. The same shape as the cover's sentence: the file, then the
 * limit, then what happened. Checked before uploadMedia is called at all, so a refused file costs no request.
 */
export function pictureRejection(file: File): string | null {
  const name = file.name || "That file";

  if (file.size > MEDIA_MAX_BYTES) {
    return `${name} is ${megabytes(file.size)}MB. A picture or video has to be under ${megabytes(MEDIA_MAX_BYTES)}MB, so it was not uploaded.`;
  }

  const kind = mediaKindFor(file.type);
  if (kind !== "image" && kind !== "video") {
    return `${name} is ${file.type || "an unrecognised type"}. A post holds pictures and videos: png, jpg, webp, gif, avif, mp4, webm or mov.`;
  }

  return null;
}

/** The mime types the file chooser offers: pictures and videos only. */
export const PICTURE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime";

// --- sizes -----------------------------------------------------------------------

/** Small, Medium, Large and Full, as a percent of the column. */
export const WIDTH_STEPS: readonly number[] = [40, 60, 80, 100];
export const WIDTH_NAMES: Readonly<Record<number, string>> = { 40: "Small", 60: "Medium", 80: "Large", 100: "Full" };
/** Dragging snaps to a step within this many points. */
export const SNAP_WITHIN = 3;

/** A width held to 25 through 100 and rounded to a whole percent. */
export function clampWidth(percent: number): number {
  if (!Number.isFinite(percent)) return POST_MEDIA_WIDTH_MAX;
  return Math.min(POST_MEDIA_WIDTH_MAX, Math.max(POST_MEDIA_WIDTH_MIN, Math.round(percent)));
}

/** Any width from 25 to 100; one within SNAP_WITHIN of a step is that step. */
export function snapWidth(percent: number): number {
  const width = clampWidth(percent);
  for (const step of WIDTH_STEPS) if (Math.abs(width - step) <= SNAP_WITHIN) return step;
  return width;
}

/** The next size up (1) or down (-1) from a width, which need not be on a step. */
export function stepWidth(current: number, direction: 1 | -1): number {
  const width = clampWidth(current);
  if (direction === 1) return WIDTH_STEPS.find((step) => step > width) ?? POST_MEDIA_WIDTH_MAX;
  return [...WIDTH_STEPS].reverse().find((step) => step < width) ?? WIDTH_STEPS[0];
}

/**
 * The width a drag on the bottom-right corner asks for. A picture sits centred in its column, so its right edge is
 * half its width from the centre: width = 2 * (pointer - centre) / column.
 */
export function widthFromPointer(clientX: number, column: { left: number; width: number }): number {
  if (!(column.width > 0)) return POST_MEDIA_WIDTH_MAX;
  const centre = column.left + column.width / 2;
  return snapWidth(((clientX - centre) * 2 * 100) / column.width);
}

// --- counting --------------------------------------------------------------------

type Loose = { type?: unknown; content?: unknown };

const isRecord = (value: unknown): value is Loose => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Pictures in one block: a picture is 1, a row is its children. */
export function picturesIn(block: unknown): number {
  if (!isRecord(block)) return 0;
  if (block.type === "postMedia") return 1;
  if (block.type === "postMediaRow" && Array.isArray(block.content)) return block.content.filter((child) => isRecord(child) && child.type === "postMedia").length;
  return 0;
}

/** Pictures in each post, in the editor's numbering, uploads in flight included. */
export function postPictureCounts(doc: ThreadDoc): number[] {
  return postRuns(doc).map((run) => run.blocks.reduce((total, block) => total + picturesIn(block), 0));
}

/** Pictures in the whole thread, uploads in flight included. */
export function threadPictureCount(doc: ThreadDoc): number {
  return postPictureCounts(doc).reduce((total, count) => total + count, 0);
}

/** The post a gap belongs to: gap `g` sits before the top-level block at index `g`. */
export function postAtGap(doc: ThreadDoc, gap: number): number {
  const runs = postRuns(doc);
  const found = runs.find((run) => gap >= run.start && gap <= run.end);
  return found ? found.index : runs.length - 1;
}

export interface Room {
  /** How many of the offered pictures fit. */
  allowed: number;
  /** The sentence for the ones that do not, or null when all fit. */
  sentence: string | null;
}

/** How many of `adding` pictures fit at `gap`: the post's four and the thread's forty both count. */
export function roomAt(doc: ThreadDoc, gap: number, adding: number, removing = 0): Room {
  const inPost = postPictureCounts(doc)[postAtGap(doc, gap)] ?? 0;
  const postRoom = Math.max(0, MAX_POST_PICTURES - (inPost - removing));
  const threadRoom = Math.max(0, MAX_THREAD_MEDIA - (threadPictureCount(doc) - removing));
  if (adding <= Math.min(postRoom, threadRoom)) return { allowed: adding, sentence: null };
  return postRoom <= threadRoom ? { allowed: postRoom, sentence: POST_FULL_SENTENCE } : { allowed: threadRoom, sentence: THREAD_FULL_SENTENCE };
}

// --- blocks ----------------------------------------------------------------------

/** What the editor holds on a picture while it uploads: the stored attributes, and the mark. */
export type PictureAttrs = PostMediaAttrs & { uploadId?: string | null };

/** A picture with nothing yet: no mediaId, full width, no alt or caption. */
export function newPicture(over: Partial<PictureAttrs> = {}): ThreadPostMedia {
  return { type: "postMedia", attrs: { mediaId: "", width: 100, w: null, h: null, alt: "", caption: "", ...over } };
}

/** Two or three pictures side by side. */
export function newRow(pictures: readonly ThreadPostMedia[]): ThreadPostMediaRow {
  return { type: "postMediaRow", content: [...pictures] };
}

/** Trim to `max` characters, counted in code points as thread.ts counts them. */
export function limitText(text: string, max: number): string {
  const characters = [...text];
  return characters.length > max ? characters.slice(0, max).join("") : text;
}

// --- moving ----------------------------------------------------------------------

/** A block's place: its top-level index, and its index in a row when it is in one. */
export interface BlockPath {
  top: number;
  child?: number;
}

export type Destination =
  /** Before the top-level block at this index (the length of the document puts it last). */
  | { gap: number }
  /** Beside a picture, making a row of it or adding to the row it is in. */
  | { beside: BlockPath; side: "left" | "right" };

export type MoveResult = { doc: ThreadDoc; at: BlockPath } | { refused: string } | null;

function blockAt(top: readonly ThreadBlock[], path: BlockPath): ThreadBlock | null {
  const block = top[path.top];
  if (!block) return null;
  if (path.child === undefined) return block;
  if (block.type !== "postMediaRow") return null;
  return block.content[path.child] ?? null;
}

function locate(top: readonly ThreadBlock[], node: ThreadBlock): BlockPath | null {
  for (let index = 0; index < top.length; index++) {
    const block = top[index];
    if (block === node) return { top: index };
    if (block.type === "postMediaRow") {
      const child = block.content.indexOf(node as ThreadPostMedia);
      if (child >= 0) return { top: index, child };
    }
  }
  return null;
}

/**
 * The thread with one block moved. Null when nothing would change. A refusal carries the sentence to show.
 *
 * A picture taken out of a row is a single picture again, and a row left with one picture becomes that picture; a
 * picture dropped beside another makes a row of two, or joins the row it is beside, up to three. A move may not put
 * a post over its pictures: a block dropped into a full post is refused.
 */
export function moveBlock(doc: ThreadDoc, from: BlockPath, to: Destination): MoveResult {
  const top = [...doc.content];
  const moved = blockAt(top, from);
  if (!moved || moved.type === "postBreak") return null;

  const beside = "beside" in to ? blockAt(top, to.beside) : null;
  if ("beside" in to) {
    if (moved.type !== "postMedia" || !beside || beside.type !== "postMedia" || beside === moved) return null;
  }

  // Take it out.
  if (from.child === undefined) {
    top.splice(from.top, 1);
  } else {
    const row = top[from.top] as ThreadPostMediaRow;
    const rest = row.content.filter((_, index) => index !== from.child);
    top[from.top] = rest.length >= 2 ? { ...row, content: rest } : rest[0];
  }

  if ("gap" in to) {
    let index = Math.max(0, Math.min(to.gap, doc.content.length));
    if (from.child === undefined) {
      if (index === from.top || index === from.top + 1) return null;
      if (index > from.top) index -= 1;
    }
    top.splice(index, 0, moved);
  } else {
    const target = locate(top, beside as ThreadBlock);
    if (!target) return null;
    if (target.child === undefined) {
      const pair = to.side === "left" ? [moved, beside] : [beside, moved];
      top[target.top] = newRow(pair as ThreadPostMedia[]);
    } else {
      const row = top[target.top] as ThreadPostMediaRow;
      if (row.content.length >= 3) return { refused: ROW_FULL_SENTENCE };
      const content = [...row.content];
      content.splice(to.side === "left" ? target.child : target.child + 1, 0, moved as ThreadPostMedia);
      top[target.top] = { ...row, content };
    }
  }

  const next: ThreadDoc = { type: "doc", content: top };
  const before = postPictureCounts(doc);
  const after = postPictureCounts(next);
  if (after.some((count, index) => count > MAX_POST_PICTURES && count > (before[index] ?? 0))) return { refused: POST_FULL_SENTENCE };

  const at = locate(top, moved);
  return at ? { doc: next, at } : null;
}

/** The top-level index a block moves to one step up (-1) or down (1), as a gap for moveBlock. */
export function stepGap(index: number, direction: -1 | 1): number {
  return direction === -1 ? index - 1 : index + 2;
}

/** The thread without one picture; a row left with one picture becomes that picture. */
export function withoutPicture(doc: ThreadDoc, path: BlockPath): ThreadDoc {
  const top = [...doc.content];
  if (path.child === undefined) {
    top.splice(path.top, 1);
  } else {
    const row = top[path.top];
    if (row?.type !== "postMediaRow") return doc;
    const rest = row.content.filter((_, index) => index !== path.child);
    top[path.top] = rest.length >= 2 ? { ...row, content: rest } : rest[0];
  }
  return { type: "doc", content: top };
}

// --- the files -------------------------------------------------------------------

/** What an upload gives the node: the row, and the size the node keeps. */
export interface UploadedPicture {
  media: BuildMedia;
  w: number | null;
  h: number | null;
}

/**
 * Upload one picture or video into the build and report its progress as a whole percent. The node gets mediaId, w
 * and h from the result; a size the row could not read stays what the probe found.
 */
export async function uploadPostPicture(
  buildId: string,
  file: File,
  onPercent: (percent: number) => void,
  probed: { w: number | null; h: number | null } = { w: null, h: null },
): Promise<UploadedPicture> {
  const media = await uploadMedia({ buildId, file, onProgress: (fraction) => onPercent(Math.round(Math.min(1, Math.max(0, fraction)) * 100)) });
  return { media, w: media.width ?? probed.w, h: media.height ?? probed.h };
}

/** path -> signed URL for what the editor draws: a picture's own file, a video's file and its poster. */
export async function signPostMedia(rows: readonly BuildMedia[]): Promise<Map<string, string>> {
  const refs = new Map<string, MediaRef>();
  for (const row of rows) {
    refs.set(row.path, { bucket: row.bucket, path: row.path, kind: row.kind });
    if (row.kind === "video" && row.poster_path) refs.set(row.poster_path, { bucket: row.bucket, path: row.poster_path, kind: "image" });
  }
  const results = await Promise.allSettled([...refs].map(async ([path, ref]) => [path, await signedMediaUrl(ref)] as const));
  const out = new Map<string, string>();
  for (const result of results) if (result.status === "fulfilled") out.set(...result.value);
  return out;
}
