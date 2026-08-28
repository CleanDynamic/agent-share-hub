import { supabase } from "@/integrations/supabase/client";
import { REBLOG_COMPOSE_ENABLED } from "./flags";

export const REBLOG_TEXT_MAX = 500;
export const REBLOG_IMAGE_MAX_BYTES = 8 * 1024 * 1024;   // 8MB
export const REBLOG_VIDEO_MAX_BYTES = 50 * 1024 * 1024;  // 50MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export class ReblogValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ReblogValidationError";
  }
}

/**
 * NS-P43 — the reblog authoring gate.
 *
 * Called as the first statement of every reblog write (createReblog,
 * updateReblog, deleteReblog, uploadReblogMedia, generateReblogSlug). While
 * REBLOG_COMPOSE_ENABLED is false it throws, so those functions are explicit
 * dead code rather than live code nothing happens to call: a caller that
 * appears later — a stale import, a half-reverted component, a script — gets a
 * named error instead of writing a row into a retired table.
 *
 * It lives here because this is the module that owns ReblogValidationError;
 * flags.ts stays a leaf that imports nothing, so there is no cycle.
 *
 * NOT gated by it: the read path, and the engagement writes on an existing
 * reblog (likeReblog, bookmarkReblog). Those are outside the freeze by design
 * — see flags.ts and docs/retired-surfaces.md.
 */
export function assertReblogAuthoringEnabled(): void {
  if (REBLOG_COMPOSE_ENABLED) return;
  throw new ReblogValidationError(
    "REBLOG_RETIRED",
    "Reblogging has been replaced by Rebuild."
  );
}

export function generateReblogSlug(): string {
  assertReblogAuthoringEnabled();
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let hash = "";
  for (let i = 0; i < 8; i++) hash += chars[Math.floor(Math.random() * chars.length)];
  return `reblog-${hash}`;
}

export function detectMediaKind(file: File): "image" | "video" {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  throw new ReblogValidationError(
    "MEDIA_TYPE_UNSUPPORTED",
    `Unsupported media type: ${file.type}`
  );
}

export function validateMedia(file: File): "image" | "video" {
  const kind = detectMediaKind(file);
  if (kind === "image" && file.size > REBLOG_IMAGE_MAX_BYTES) {
    throw new ReblogValidationError("MEDIA_TOO_LARGE", "Image must be ≤ 8MB");
  }
  if (kind === "video" && file.size > REBLOG_VIDEO_MAX_BYTES) {
    throw new ReblogValidationError("MEDIA_TOO_LARGE", "Video must be ≤ 50MB");
  }
  return kind;
}

/**
 * Uploads media to the reblog-media bucket at
 *   {reblogger_id}/{reblog_id}/{uuid}.{ext}
 * Returns the public URL.
 */
export async function uploadReblogMedia(args: {
  rebloggerId: string;
  reblogId: string;
  file: File;
}): Promise<{ url: string; kind: "image" | "video" }> {
  assertReblogAuthoringEnabled();
  const kind = validateMedia(args.file);
  const ext = args.file.name.split(".").pop()?.toLowerCase() || (kind === "image" ? "jpg" : "mp4");
  const uuid = crypto.randomUUID();
  const path = `${args.rebloggerId}/${args.reblogId}/${uuid}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("reblog-media")
    .upload(path, args.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: args.file.type,
    });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("reblog-media").getPublicUrl(path);
  return { url: data.publicUrl, kind };
}
