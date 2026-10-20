// postMedia: pictures and videos in the composer's post (PT-06, CA-07).
//
// Pure, except `uploadPostPicture` and `signPostMedia`, which go through media.ts. thread.ts decides what a stored
// thread may hold; this file answers what a picture asks: may this file go in, and what are the sentences for one
// that may not. CA-07 put a post's pictures in one grid, so the sizes, the rows and the moves PT-06 kept here are gone;
// the editor's adding and reordering live with the editor (components/post/editor/pictures.ts).
//
// A PICTURE STILL UPLOADING IS A postMedia WITH NO mediaId. thread.ts already refuses to save such a node ("has not
// finished uploading"), so the save waits on its own and nothing here has to hold it. The editor marks it with an
// `uploadId` while it uploads; threadEditor's tidyThread drops the mark once it is null.

import { MEDIA_MAX_BYTES, mediaKindFor, signedMediaUrl, uploadMedia, type MediaRef } from "./media";
import { MAX_POST_PICTURES, MAX_THREAD_MEDIA, NO_MEDIA_EDITS, type PostMediaAttrs, type ThreadPostMedia } from "./thread";
import type { BuildMedia } from "./types";

// --- the sentences ---------------------------------------------------------------

/** The sentence a fifth picture in a post is refused with. */
export const POST_FULL_SENTENCE = `A post holds ${MAX_POST_PICTURES} pictures. Start a new post or remove one.`;
/** The sentence a forty-first picture in a thread is refused with. */
export const THREAD_FULL_SENTENCE = `A thread holds ${MAX_THREAD_MEDIA} pictures. Remove one before adding another.`;

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

// --- blocks ----------------------------------------------------------------------

/** What the editor holds on a picture while it uploads: the stored attributes, and the mark. */
export type PictureAttrs = PostMediaAttrs & { uploadId?: string | null };

/** A picture with nothing yet: no mediaId, no alt, crop or warning. */
export function newPicture(over: Partial<PictureAttrs> = {}): ThreadPostMedia {
  return { type: "postMedia", attrs: { mediaId: "", width: 100, w: null, h: null, alt: "", ...NO_MEDIA_EDITS, caption: "", ...over } };
}

/** Trim to `max` characters, counted in code points as thread.ts counts them. */
export function limitText(text: string, max: number): string {
  const characters = [...text];
  return characters.length > max ? characters.slice(0, max).join("") : text;
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
