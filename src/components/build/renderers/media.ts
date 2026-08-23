// Media references, resolved to a *transformed* URL.
//
// The rest of the application asks Supabase Storage for originals and then
// scales them down in the browser — a 4MB screenshot arriving to fill a 480px
// slot. This surface does not. Every storage-backed image is requested through
// the render endpoint with an explicit width and quality, so the bytes on the
// wire match the box they land in.
//
// This is pure string work on purpose. It builds a URL; it never calls the
// Supabase client, because renderers do not talk to Supabase.

const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string) ?? "";

/** Widths the page actually uses. Anything else is a caller passing a number. */
export const MEDIA_WIDTH = {
  /** A variant tile in the generated-media grid. */
  thumb: 480,
  /** A single full-width image inside a node card. */
  full: 960,
} as const;

/** Supabase's render endpoint tops out at 100; 70 is indistinguishable here. */
export const MEDIA_QUALITY = 70;

export interface MediaTransform {
  width: number;
  quality?: number;
}

/** ".../object/public/bucket/key" -> ".../render/image/public/bucket/key" */
const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

function withTransform(base: string, transform: MediaTransform): string {
  const separator = base.includes("?") ? "&" : "?";
  const quality = transform.quality ?? MEDIA_QUALITY;
  return `${base}${separator}width=${transform.width}&quality=${quality}`;
}

/**
 * Resolve a `media_id` payload value to something an <img> can load.
 *
 * Three shapes reach this function today:
 *
 *   a public storage URL   rewritten onto the render endpoint, transformed
 *   a bare "bucket/key"    turned into a render URL, transformed
 *   an external http URL   returned untouched — not ours to transform
 *
 * Anything else — and the demo seed's opaque "demo-media-…" handles are the
 * live example — returns null. A caller that gets null shows a placeholder;
 * it must never emit an <img> with a src it cannot resolve.
 */
export function mediaUrl(
  ref: string | null | undefined,
  transform: MediaTransform
): string | null {
  const value = typeof ref === "string" ? ref.trim() : "";
  if (value.length === 0) return null;

  if (/^https?:\/\//i.test(value)) {
    const objectIndex = value.indexOf(OBJECT_PATH);
    if (objectIndex === -1) return value;
    const rewritten =
      value.slice(0, objectIndex) +
      RENDER_PATH +
      value.slice(objectIndex + OBJECT_PATH.length);
    return withTransform(rewritten, transform);
  }

  // A storage path is "bucket/key". A single segment with no slash is an
  // opaque id from some other system and cannot be located in storage.
  const path = value.replace(/^\/+/, "");
  if (!path.includes("/") || SUPABASE_URL.length === 0) return null;

  return withTransform(`${SUPABASE_URL}${RENDER_PATH}${path}`, transform);
}
