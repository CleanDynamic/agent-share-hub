// build_media: uploaded material attached to a build — a screenshot on a
// result node, a screen recording on a demo, a CSV on a dataset.
//
// A media record is two things that must stay in step: a row in build_media
// and an object in the private build-media bucket. Every function here is
// written so a failure leaves neither one orphaned — the upload removes its
// object if the row will not insert, and the delete removes the row first and
// then tolerates an object that has already gone.
//
// PATH CONVENTION — fixed by the NS-P11 migration and depended on everywhere
// after it:
//
//   <build_id>/<node_id or 'unplaced'>/<uuid>.<ext>
//
// The first segment is not decoration. The storage policies read it as the
// build id and gate the object on that build's readability, so a path built
// any other way is a path nobody can read.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type BuildMedia,
  type MediaKind,
} from "./types";

export const MEDIA_COLUMNS =
  "id, build_id, node_id, bucket, path, kind, mime, bytes, width, height, duration, poster_path, created_at";

export const BUILD_MEDIA_BUCKET = "build-media";

/** Mirrors the bucket's file_size_limit, so the client refuses first. */
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

/** Path segment standing in for node_id on material not yet attached. */
export const UNPLACED_SEGMENT = "unplaced";

/**
 * The accepted upload types, and the kind each one records.
 *
 * This is the only list. The bucket deliberately leaves allowed_mime_types
 * NULL rather than keeping a second copy that would eventually disagree.
 *
 * image/svg+xml is absent on purpose: an SVG is a document that can carry
 * script, and nothing on the new path needs one.
 */
const MIME_KINDS: Readonly<Record<string, MediaKind>> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",

  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",

  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",

  "application/pdf": "file",
  "application/json": "file",
  "application/zip": "file",
  "text/csv": "file",
  "text/markdown": "file",
  "text/plain": "file",
};

/** Fallback extension when the uploaded file's own name carries none. */
const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/zip": "zip",
  "text/csv": "csv",
  "text/markdown": "md",
  "text/plain": "txt",
};

/**
 * The width every image is served at unless a caller says otherwise.
 *
 * The old path serves originals into every slot, including 32px avatars.
 * mediaUrl is the one place that stops that repeating, so the default is a
 * transform rather than the original file.
 */
export const DEFAULT_MEDIA_WIDTH = 1200;
export const DEFAULT_MEDIA_QUALITY = 75;

/** How long a signed URL stays good for. Long enough to render a page. */
export const SIGNED_URL_TTL_SECONDS = 3600;

/** A media probe that takes longer than this is not worth an upload's delay. */
const PROBE_TIMEOUT_MS = 5000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_EXTENSION = /^[a-z0-9]{1,8}$/;

/** `width: "original"` is the explicit opt-out from the transform. */
export type MediaWidth = number | "original";

export interface MediaUrlOptions {
  width?: MediaWidth;
  quality?: number;
}

/** Everything mediaUrl needs. A whole BuildMedia row satisfies it. */
export type MediaRef = Pick<BuildMedia, "bucket" | "path" | "kind">;

export interface UploadMediaInput {
  buildId: string;
  /** Omit or pass null for material that is not attached to a node yet. */
  nodeId?: string | null;
  file: File;
  /** Fraction of bytes uploaded, 0 to 1. The row insert follows the 1. */
  onProgress?: (fraction: number) => void;
}

/** The type of an uploaded file, or null when it is not one we accept. */
export function mediaKindFor(mime: string | null | undefined): MediaKind | null {
  if (!mime) return null;
  return MIME_KINDS[mime.split(";")[0].trim().toLowerCase()] ?? null;
}

/** The accepted mime types, for an <input accept> or a validation message. */
export function acceptedMediaTypes(): string[] {
  return Object.keys(MIME_KINDS);
}

/**
 * Upload one file into the build-media bucket and record it.
 *
 * The guards run before anything is written: size, type, and — for an image —
 * its dimensions, so the row carries them from the start rather than being
 * patched once something renders it.
 *
 * Storage first, row second. If the row will not insert the object is removed
 * again, because an object with no row is invisible to the application and
 * nothing will ever clean it up.
 */
export async function uploadMedia({
  buildId,
  nodeId = null,
  file,
  onProgress,
}: UploadMediaInput): Promise<BuildMedia> {
  if (!file) throw buildLayerError("uploadMedia", new Error("no file given"));

  if (!UUID_PATTERN.test(buildId)) {
    throw buildLayerError(
      "uploadMedia",
      new Error(`buildId is not a uuid: ${buildId}`)
    );
  }
  if (nodeId != null && !UUID_PATTERN.test(nodeId)) {
    throw buildLayerError(
      "uploadMedia",
      new Error(`nodeId is not a uuid: ${nodeId}`)
    );
  }

  if (file.size > MEDIA_MAX_BYTES) {
    throw buildLayerError(
      "uploadMedia",
      new Error(
        `${file.name || "file"} is ${megabytes(file.size)}MB — the limit is ${megabytes(MEDIA_MAX_BYTES)}MB`
      )
    );
  }

  const mime = (file.type || "").split(";")[0].trim().toLowerCase();
  const kind = mediaKindFor(mime);
  if (!kind) {
    throw buildLayerError(
      "uploadMedia",
      new Error(`${mime || "unknown type"} is not an accepted upload type`)
    );
  }

  // Read before the write, so a probe that hangs costs nothing uploaded.
  const probe = await probeFile(file, kind);

  const path = mediaPath(buildId, nodeId, extensionFor(file.name, mime));

  onProgress?.(0);
  await putObject(path, file, onProgress);
  onProgress?.(1);

  const { data, error } = await supabase
    .from("build_media")
    .insert({
      build_id: buildId,
      node_id: nodeId,
      bucket: BUILD_MEDIA_BUCKET,
      path,
      kind,
      mime,
      bytes: file.size,
      width: probe.width,
      height: probe.height,
      duration: probe.duration,
    })
    .select(MEDIA_COLUMNS)
    .single();

  if (error) {
    // Best effort: the row is what the application sees, so a failure to tidy
    // up must not mask the failure that caused it.
    await supabase.storage
      .from(BUILD_MEDIA_BUCKET)
      .remove([path])
      .catch(() => undefined);
    throw buildLayerError("uploadMedia (insert)", error);
  }

  return data as BuildMedia;
}

/**
 * Delete one media record: the row first, then the object.
 *
 * That order is deliberate. A row without an object renders as a broken image;
 * an object without a row is a file nobody can see and nobody will collect.
 * A missing object is not an error — the row is gone either way.
 */
export async function deleteMedia(id: string): Promise<void> {
  const media = await getMediaById(id);
  if (!media) return;

  const { error } = await supabase.from("build_media").delete().eq("id", id);
  if (error) throw buildLayerError("deleteMedia", error);

  const { error: objectError } = await supabase.storage
    .from(media.bucket ?? BUILD_MEDIA_BUCKET)
    .remove([media.path]);

  // Storage answers a missing object with success, but a bucket that has been
  // emptied out from under us must not resurrect a row that is already gone.
  if (objectError && !isMissingObject(objectError)) {
    throw buildLayerError("deleteMedia (object)", objectError);
  }
}

/** Every media record on a build, oldest first. */
export async function getMediaForBuild(buildId: string): Promise<BuildMedia[]> {
  const { data, error } = await supabase
    .from("build_media")
    .select(MEDIA_COLUMNS)
    .eq("build_id", buildId)
    .order("created_at", { ascending: true });

  if (error) throw buildLayerError("getMediaForBuild", error);
  return (data ?? []) as BuildMedia[];
}

/** One media record, or null. */
export async function getMediaById(id: string): Promise<BuildMedia | null> {
  const { data, error } = await supabase
    .from("build_media")
    .select(MEDIA_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw buildLayerError("getMediaById", error);
  return (data as BuildMedia | null) ?? null;
}

/**
 * The URL an image, video or file is served from — ALWAYS transformed.
 *
 * Every image URL carries width and quality unless the caller passes
 * `width: "original"`. That is the whole point of routing URLs through one
 * function: the current path serves full-size originals into 32px slots, and
 * a default that has to be opted out of is the only thing that stops it.
 *
 * The bucket is private, so what comes back addresses the authenticated
 * endpoint and needs a bearer token. Anything going into an <img src> wants
 * signedMediaUrl below, which applies the same transform.
 */
export function mediaUrl(
  media: MediaRef,
  { width = DEFAULT_MEDIA_WIDTH, quality = DEFAULT_MEDIA_QUALITY }: MediaUrlOptions = {}
): string {
  const bucket = media.bucket ?? BUILD_MEDIA_BUCKET;
  const transform = imageTransform(media.kind, width, quality);
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(media.path, transform ? { transform } : undefined);
  return authenticatedUrl(data.publicUrl);
}

export interface SignedMediaUrlOptions extends MediaUrlOptions {
  expiresIn?: number;
}

/**
 * A signed URL for the same object, with the same transform discipline.
 *
 * This is what a browser can actually load: the bucket is private, so an
 * <img src> needs a token in the URL rather than a header it cannot send.
 */
export async function signedMediaUrl(
  media: MediaRef,
  {
    width = DEFAULT_MEDIA_WIDTH,
    quality = DEFAULT_MEDIA_QUALITY,
    expiresIn = SIGNED_URL_TTL_SECONDS,
  }: SignedMediaUrlOptions = {}
): Promise<string> {
  const bucket = media.bucket ?? BUILD_MEDIA_BUCKET;
  const transform = imageTransform(media.kind, width, quality);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(media.path, expiresIn, transform ? { transform } : undefined);

  if (error) throw buildLayerError("signedMediaUrl", error);
  return data.signedUrl;
}

/** `<build_id>/<node_id or 'unplaced'>/<uuid>.<ext>` — the access rule. */
export function mediaPath(
  buildId: string,
  nodeId: string | null | undefined,
  extension: string
): string {
  return `${buildId}/${nodeId ?? UNPLACED_SEGMENT}/${crypto.randomUUID()}.${extension}`;
}

// --- internals ---------------------------------------------------------------

interface ProbeResult {
  width: number | null;
  height: number | null;
  duration: number | null;
}

const NO_PROBE: ProbeResult = { width: null, height: null, duration: null };

/**
 * Read what the file can tell us about itself before it is uploaded.
 *
 * Tolerant by design. A decoder that is absent (a test runner, a worker) or a
 * format the browser will not decode leaves the columns null; it does not cost
 * a creator their upload. The row is still correct, just less described.
 */
async function probeFile(file: File, kind: MediaKind): Promise<ProbeResult> {
  try {
    if (kind === "image") return await probeImage(file);
    if (kind === "video" || kind === "audio") return await probeMedia(file, kind);
  } catch {
    return NO_PROBE;
  }
  return NO_PROBE;
}

async function probeImage(file: File): Promise<ProbeResult> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height, duration: null };
      bitmap.close?.();
      return size;
    } catch {
      // Fall through to the element decoder.
    }
  }

  const url = objectUrl(file);
  if (!url || typeof Image === "undefined") return NO_PROBE;

  return new Promise<ProbeResult>((resolve) => {
    const image = new Image();
    const done = (result: ProbeResult) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => done(NO_PROBE), PROBE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      done({
        width: image.naturalWidth || null,
        height: image.naturalHeight || null,
        duration: null,
      });
    };
    image.onerror = () => {
      clearTimeout(timer);
      done(NO_PROBE);
    };
    image.src = url;
  });
}

async function probeMedia(file: File, kind: MediaKind): Promise<ProbeResult> {
  const url = objectUrl(file);
  if (!url || typeof document === "undefined") return NO_PROBE;

  return new Promise<ProbeResult>((resolve) => {
    const element = document.createElement(kind === "video" ? "video" : "audio");
    const done = (result: ProbeResult) => {
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      resolve(result);
    };
    const timer = setTimeout(() => done(NO_PROBE), PROBE_TIMEOUT_MS);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      clearTimeout(timer);
      const video = element as HTMLVideoElement;
      done({
        width: kind === "video" ? video.videoWidth || null : null,
        height: kind === "video" ? video.videoHeight || null : null,
        duration: Number.isFinite(element.duration) ? element.duration : null,
      });
    };
    element.onerror = () => {
      clearTimeout(timer);
      done(NO_PROBE);
    };
    element.src = url;
  });
}

function objectUrl(file: File): string | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

/**
 * Write the object.
 *
 * supabase-js uploads through fetch, which cannot report progress, so a caller
 * that wants a progress bar gets an XHR against the same storage endpoint with
 * the same session. Without onProgress — and anywhere XHR is not available —
 * the SDK does it.
 */
async function putObject(
  path: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (onProgress && typeof XMLHttpRequest !== "undefined") {
    const uploaded = await putObjectWithProgress(path, file, onProgress);
    if (uploaded) return;
  }

  const { error } = await supabase.storage
    .from(BUILD_MEDIA_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw buildLayerError("uploadMedia (storage)", error);
}

/**
 * Returns false when the request could not be attempted at all — no session,
 * no configured key, no endpoint — so the caller falls back to the SDK. A
 * request that was attempted and rejected throws.
 */
async function putObjectWithProgress(
  path: string,
  file: File,
  onProgress: (fraction: number) => void
): Promise<boolean> {
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;
  if (!apiKey) return false;

  const endpoint = objectEndpoint(path);
  if (!endpoint) return false;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  return new Promise<boolean>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint, true);
    request.setRequestHeader("authorization", `Bearer ${token}`);
    request.setRequestHeader("apikey", apiKey);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("cache-control", "max-age=3600");
    if (file.type) request.setRequestHeader("content-type", file.type);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return;
      // Hold 1 back for the caller to report once the row is in.
      onProgress(Math.min(0.99, event.loaded / event.total));
    };
    request.onerror = () =>
      reject(buildLayerError("uploadMedia (storage)", new Error("network error")));
    request.onabort = () =>
      reject(buildLayerError("uploadMedia (storage)", new Error("aborted")));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(true);
        return;
      }
      reject(
        buildLayerError(
          "uploadMedia (storage)",
          new Error(storageErrorMessage(request.responseText, request.status))
        )
      );
    };
    request.send(file);
  });
}

function storageErrorMessage(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? `HTTP ${status}`;
  } catch {
    return body?.slice(0, 200) || `HTTP ${status}`;
  }
}

/**
 * `.../storage/v1/object/<bucket>/<path>` — the REST endpoint an upload POSTs
 * to, derived from the SDK's own URL so the project host is never duplicated
 * in this module.
 */
function objectEndpoint(path: string): string | null {
  const { data } = supabase.storage.from(BUILD_MEDIA_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url || !url.includes("/object/public/")) return null;
  return url.replace("/object/public/", "/object/");
}

/** Swap the public render path for the authenticated one. */
function authenticatedUrl(url: string): string {
  return url.replace(
    /\/storage\/v1\/(render\/image|object)\/public\//,
    "/storage/v1/$1/authenticated/"
  );
}

/** Transform options for an image, or undefined for everything else. */
function imageTransform(
  kind: string,
  width: MediaWidth,
  quality: number
): { width: number; quality: number; resize: "contain" } | undefined {
  if (kind !== "image" || width === "original") return undefined;
  return { width, quality, resize: "contain" };
}

function extensionFor(fileName: string, mime: string): string {
  const suffix = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (suffix && suffix !== fileName.toLowerCase() && SAFE_EXTENSION.test(suffix)) {
    return suffix;
  }
  return MIME_EXTENSIONS[mime] ?? "bin";
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function isMissingObject(error: unknown): boolean {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message).toLowerCase()
      : "";
  return message.includes("not found") || message.includes("does not exist");
}
