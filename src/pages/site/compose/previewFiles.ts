/* TF-10 — what can be shown as the preview of a file a step makes.

   A picture, a clip or a track, one file, within the size the build's media accepts. Readers view it on the page and
   never download it. `previewRefusal` is the one place that says no, so the panel and the page's write agree. */

import { MEDIA_MAX_BYTES, mediaKindFor } from "@/lib/build/media";

export const PREVIEW_COPY = {
  add: "Add a preview",
  remove: "Remove preview",
  quiet: "Readers can view it but not download it.",
  refused: "A preview is a picture, a clip or a track.",
  tooBig: `A preview can be up to ${MEDIA_MAX_BYTES / (1024 * 1024)} MB.`,
} as const;

/** The `accept` of the file picker: pictures, clips and tracks. */
export const PREVIEW_ACCEPT = "image/*,video/*,audio/*";

/** Why this file cannot be a preview, or null when it can. */
export function previewRefusal(file: Pick<File, "type" | "size">): string | null {
  const kind = mediaKindFor(file.type);
  if (kind !== "image" && kind !== "video" && kind !== "audio") return PREVIEW_COPY.refused;
  if (file.size > MEDIA_MAX_BYTES) return PREVIEW_COPY.tooBig;
  return null;
}
