/**
 * Persisted shapes for blueprint cover image + results media.
 *
 * Stored on `public.content_items`:
 *   cover_image_url      text
 *   cover_image_path     text
 *   cover_image_focal_x  real  (0..1, default 0.5)
 *   cover_image_focal_y  real  (0..1, default 0.5)
 *   results              jsonb (default '[]'::jsonb)
 *
 * Note: there is also a legacy `content_item_results` table used by the
 * slide-style ResultsCarouselEditor. The `results` JSONB column on
 * `content_items` is the new draft-scoped store for blueprint media and
 * is independent of that table.
 */

export type CoverImage = {
  url: string;
  path: string;
  focalX: number;
  focalY: number;
} | null;

export type ImageResult = {
  id: string;
  type: "image";
  url: string;
  path: string;
  caption: string;
  alt: string;
  width: number;
  height: number;
};

export type VideoResult = {
  id: string;
  type: "video";
  url: string;
  path: string;
  posterUrl: string;
  posterPath: string;
  caption: string;
  durationSec: number;
  width: number;
  height: number;
};

export type TextResult = {
  id: string;
  type: "text";
  body: string;
};

export type ResultBlock = ImageResult | VideoResult | TextResult;

/* ─────────── (de)serialization helpers for the DB <-> client boundary ─────────── */

export function emptyCoverImage(): CoverImage {
  return null;
}

export function emptyResults(): ResultBlock[] {
  return [];
}

/** Build a CoverImage from raw `content_items` columns. */
export function coverImageFromRow(row: {
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  cover_image_focal_x?: number | null;
  cover_image_focal_y?: number | null;
}): CoverImage {
  if (!row?.cover_image_url) return null;
  return {
    url: row.cover_image_url,
    path: row.cover_image_path ?? "",
    focalX: typeof row.cover_image_focal_x === "number" ? row.cover_image_focal_x : 0.5,
    focalY: typeof row.cover_image_focal_y === "number" ? row.cover_image_focal_y : 0.5,
  };
}

/** Best-effort coercion of an unknown DB JSONB into a ResultBlock[]. */
export function resultsFromJson(value: unknown): ResultBlock[] {
  if (!Array.isArray(value)) return [];
  const out: ResultBlock[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : crypto.randomUUID();
    if (r.type === "image") {
      out.push({
        id,
        type: "image",
        url: String(r.url ?? ""),
        path: String(r.path ?? ""),
        caption: String(r.caption ?? ""),
        alt: String(r.alt ?? ""),
        width: Number(r.width ?? 0) || 0,
        height: Number(r.height ?? 0) || 0,
      });
    } else if (r.type === "video") {
      out.push({
        id,
        type: "video",
        url: String(r.url ?? ""),
        path: String(r.path ?? ""),
        posterUrl: String(r.posterUrl ?? ""),
        posterPath: String(r.posterPath ?? ""),
        caption: String(r.caption ?? ""),
        durationSec: Number(r.durationSec ?? 0) || 0,
        width: Number(r.width ?? 0) || 0,
        height: Number(r.height ?? 0) || 0,
      });
    } else if (r.type === "text") {
      out.push({ id, type: "text", body: String(r.body ?? "") });
    }
  }
  return out;
}
