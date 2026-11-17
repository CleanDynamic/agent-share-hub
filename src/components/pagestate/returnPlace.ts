/* G15: where the member was, kept while they are away at a provider (Google, GitHub, X) signing in again after the
   server ended their session. The address rides to the provider and back as the sign-in's return address; the scroll
   cannot, so it is kept here, in this tab's sessionStorage, and given back once, on the same address, within ten
   minutes. Storage can be missing or full: every read and write is in try/catch, and a page that cannot be put back
   opens at the top, as before. */

export const PLACE_KEY = "ob-return-place";
const KEEP_FOR_MS = 10 * 60_000;

export function keepPlace(path: string, y: number): void {
  try {
    sessionStorage.setItem(PLACE_KEY, JSON.stringify({ path, y: Math.round(y), at: Date.now() }));
  } catch {
    /* storage refused: the page opens at the top */
  }
}

const forget = () => {
  try {
    sessionStorage.removeItem(PLACE_KEY);
  } catch {
    /* nothing to do */
  }
};

/**
 * The scroll kept for `path`, once. A record for another address is left for its own page (the callback's address
 * comes first on the way back); a stale or unreadable one is dropped.
 */
export function takePlace(path: string): number | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PLACE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let record: { path?: unknown; y?: unknown; at?: unknown };
  try {
    record = JSON.parse(raw) as typeof record;
  } catch {
    forget();
    return null;
  }
  const fresh = typeof record.at === "number" && Date.now() - record.at <= KEEP_FOR_MS;
  const usable = fresh && typeof record.path === "string" && typeof record.y === "number" && Number.isFinite(record.y);
  if (!usable) {
    forget();
    return null;
  }
  if (record.path !== path) return null;
  forget();
  return record.y as number;
}
