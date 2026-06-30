import { supabase } from "@/integrations/supabase/client";

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB

export type MediaKind = "image" | "video";

export type UploadMediaArgs = {
  file: File;
  bucket: string;
  pathPrefix: string;
  onProgress?: (pct: number) => void;
};

export type UploadMediaResult = {
  url: string;
  path: string;
  kind: MediaKind;
  width?: number;
  height?: number;
  durationSec?: number;
};

export class MediaUploadError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function classify(file: File): MediaKind {
  if ((IMAGE_MIME as readonly string[]).includes(file.type)) return "image";
  if ((VIDEO_MIME as readonly string[]).includes(file.type)) return "video";
  throw new MediaUploadError(
    "MEDIA_TYPE_UNSUPPORTED",
    `Unsupported file type: ${file.type || "unknown"}. Allowed: jpg, png, webp, gif, mp4, webm, mov.`,
  );
}

function checkSize(file: File, kind: MediaKind) {
  if (kind === "image" && file.size > IMAGE_MAX_BYTES) {
    throw new MediaUploadError("MEDIA_TOO_LARGE", "Image is too large (max 10 MB).");
  }
  if (kind === "video" && file.size > VIDEO_MAX_BYTES) {
    throw new MediaUploadError("MEDIA_TOO_LARGE", "Video is too large (max 100 MB).");
  }
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function readVideoMetadata(
  file: File,
): Promise<{ width: number; height: number; durationSec: number } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const meta = {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/**
 * Generic media uploader for Supabase Storage.
 *
 * - Validates MIME + size against image/video allowlists.
 * - Writes to `${pathPrefix}/${userId}/${uuid}.${ext}` with upsert: false.
 * - Reads intrinsic dimensions (and duration for video) on the client.
 * - Calls onProgress with an indeterminate ramp (Supabase JS v2 doesn't
 *   expose real progress for browser uploads); hits 100 on success.
 */
export async function uploadMedia(args: UploadMediaArgs): Promise<UploadMediaResult> {
  const { file, bucket, pathPrefix, onProgress } = args;

  const kind = classify(file);
  checkSize(file, kind);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    throw new MediaUploadError("NOT_AUTHENTICATED", "You must be signed in to upload media.");
  }
  const userId = userData.user.id;

  const ext = MIME_EXT[file.type] ?? (kind === "image" ? "bin" : "bin");
  const cleanPrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
  const path = `${cleanPrefix}/${userId}/${crypto.randomUUID()}.${ext}`;

  onProgress?.(0);
  let pct = 10;
  let timer: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    timer = setInterval(() => {
      pct = Math.min(90, pct + 5);
      onProgress(pct);
    }, 250);
  }

  // Kick off metadata extraction in parallel with the upload.
  const metaPromise =
    kind === "image" ? readImageDimensions(file) : readVideoMetadata(file);

  try {
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
    if (upErr) {
      throw new MediaUploadError("UPLOAD_FAILED", upErr.message);
    }

    const meta = await metaPromise;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    onProgress?.(100);

    return {
      url: pub.publicUrl,
      path,
      kind,
      width: meta?.width,
      height: meta?.height,
      durationSec: meta && "durationSec" in meta ? meta.durationSec : undefined,
    };
  } finally {
    if (timer) clearInterval(timer);
  }
}
