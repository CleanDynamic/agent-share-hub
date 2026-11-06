// UX-10 P3: a profile picture's crop, carried by its URL as `#crop=x,y,w,h` so that every read of `avatar_url` across the site
// gets it with no new column. The browser never sends a fragment, so the file is fetched as it was. PURE and small: `Avatar`
// imports it on every page.

export interface UrlCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CROP_FRAGMENT = /#crop=([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)$/;
/** A crop side under this is not a crop (thread.ts's CROP_MIN). */
const SIDE_MIN = 0.01;
const EDGE = 1e-6;

/** The URL without a crop fragment. */
export function plainUrl(url: string): string {
  return url.replace(CROP_FRAGMENT, "");
}

/** The URL with its crop as a fragment (no fragment without a crop). */
export function urlWithCrop(url: string, crop: UrlCrop | null): string {
  const plain = plainUrl(url);
  if (!crop) return plain;
  const n = (value: number) => String(Math.round(value * 1e5) / 1e5);
  return `${plain}#crop=${n(crop.x)},${n(crop.y)},${n(crop.w)},${n(crop.h)}`;
}

/** The crop a URL carries, or null for none or one that is not inside the picture. */
export function cropFromUrl(url: string | null | undefined): UrlCrop | null {
  const found = url ? CROP_FRAGMENT.exec(url) : null;
  if (!found) return null;
  const [x, y, w, h] = found.slice(1, 5).map(Number);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  if (x < -EDGE || y < -EDGE || w < SIDE_MIN - EDGE || h < SIDE_MIN - EDGE || x + w > 1 + EDGE || y + h > 1 + EDGE) return null;
  return { x, y, w, h };
}
