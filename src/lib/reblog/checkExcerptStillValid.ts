import { loadSourceCorpus } from "./validateExcerpt";

function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface ExcerptStillValid {
  isStillValid: boolean;
  fuzzy?: boolean;
}

// Tiny in-memory TTL cache so render-time checks don't hammer the DB.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; result: ExcerptStillValid }>();

/**
 * Render-time check: is the reblog's stored excerpt still present in the
 * current source post content?
 */
export async function checkExcerptStillValid(
  reblogId: string,
  sourcePostId: string,
  excerptText: string | null | undefined
): Promise<ExcerptStillValid> {
  if (!excerptText) return { isStillValid: true };
  const key = `${reblogId}:${sourcePostId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;

  let result: ExcerptStillValid;
  try {
    const corpus = await loadSourceCorpus(sourcePostId);
    if (!corpus) {
      result = { isStillValid: false };
    } else if (corpus.includes(excerptText)) {
      result = { isStillValid: true, fuzzy: false };
    } else if (normalise(corpus).includes(normalise(excerptText))) {
      result = { isStillValid: true, fuzzy: true };
    } else {
      result = { isStillValid: false };
    }
  } catch {
    // On error, fail open so we don't accidentally tag valid excerpts as stale.
    result = { isStillValid: true };
  }
  cache.set(key, { at: Date.now(), result });
  return result;
}
