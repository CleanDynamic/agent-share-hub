// Crop and blur an attached picture before publishing, so nothing private is kept: the edited picture is uploaded as a new
// file, the File node is pointed at it, and the old object is deleted. A new upload that cannot be pointed at is deleted
// again, so no object is left that nothing uses.
//
// PURE but for what it is given: the upload, the repoint and the delete come from the page.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle drawn from any corner to any other, kept inside the picture, in whole pixels; null when it holds nothing. */
export function normaliseRect(from: { x: number; y: number }, to: { x: number; y: number }, bounds: { width: number; height: number }): Rect | null {
  const clampX = (v: number) => Math.max(0, Math.min(bounds.width, v));
  const clampY = (v: number) => Math.max(0, Math.min(bounds.height, v));
  const x1 = Math.round(clampX(Math.min(from.x, to.x)));
  const y1 = Math.round(clampY(Math.min(from.y, to.y)));
  const x2 = Math.round(clampX(Math.max(from.x, to.x)));
  const y2 = Math.round(clampY(Math.max(from.y, to.y)));
  return x2 - x1 >= 2 && y2 - y1 >= 2 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}

/** A rectangle drawn on the shown picture, in the picture's own pixels. */
export const toImageRect = (rect: Rect, scale: number): Rect => ({ x: Math.round(rect.x / scale), y: Math.round(rect.y / scale), width: Math.max(1, Math.round(rect.width / scale)), height: Math.max(1, Math.round(rect.height / scale)) });

export interface ReplaceDeps {
  /** The media the File node points at now. */
  oldMediaId: string | null;
  upload: (file: File) => Promise<{ id: string; bytes?: number | null; mime?: string | null }>;
  /** Point the File node at the new media; false when it could not be. */
  repoint: (media: { id: string; size?: number | null; mime?: string | null }) => Promise<boolean>;
  remove: (mediaId: string) => Promise<void>;
}

/** Upload the edited picture, point the node at it, then delete the old object. Resolves true when the picture was replaced. */
export async function replacePicture(file: File, deps: ReplaceDeps): Promise<boolean> {
  const made = await deps.upload(file);
  const pointed = await deps.repoint({ id: made.id, size: made.bytes ?? file.size, mime: made.mime ?? (file.type || null) }).catch(() => false);
  if (!pointed) {
    await deps.remove(made.id).catch(() => undefined);
    return false;
  }
  if (deps.oldMediaId && deps.oldMediaId !== made.id) await deps.remove(deps.oldMediaId).catch(() => undefined);
  return true;
}
