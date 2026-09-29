// What a build page tells a search engine and a link preview (RC-P16b).
//
// A shared link is most people's first sight of a build
// ⟦aesthetic-usability › Where It Applies: First impressions⟧, so the page
// names itself: "<title> — buildgallery", and a description a preview can hold
// whole. The description is the build's outcome, cut at a word boundary to 155
// characters with "…" when it had to be cut; a build with no outcome says who
// made it and how many people have reproduced it instead, which is the fact the
// plaque leads with.

/** The longest description a result or a preview shows whole, "…" included. */
export const SHARE_DESCRIPTION_MAX = 155;

/** Where every build's canonical address lives. */
export const SITE_ORIGIN = "https://buildgallery.ai";

/**
 * `text` in at most `max` characters: whole when it fits, otherwise cut back
 * to the last word boundary that leaves room for "…", and never mid-word
 * unless the first word alone is longer than the limit.
 */
export function cutAtWord(text: string, max: number = SHARE_DESCRIPTION_MAX): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const room = clean.slice(0, max - 1);
  const boundary = room.lastIndexOf(" ");
  const cut = (boundary > 0 ? room.slice(0, boundary) : room).replace(/[\s,;:.–—-]+$/, "");
  return `${cut}…`;
}

export interface ShareDescriptionInput {
  outcome: string | null | undefined;
  /** The maker as a reader would name them; null when it could not be read. */
  makerName: string | null | undefined;
  reproductionCount: number | null | undefined;
}

/** The build page's meta description. */
export function shareDescription({ outcome, makerName, reproductionCount }: ShareDescriptionInput): string {
  const text = (outcome ?? "").trim();
  if (text.length > 0) return cutAtWord(text);
  const n = Math.max(0, reproductionCount ?? 0);
  const by = (makerName ?? "").trim() || "a maker";
  return cutAtWord(`A build by ${by}, reproduced ${n} ${n === 1 ? "time" : "times"}.`);
}

/** "<title> — buildgallery". */
export function shareTitle(title: string | null | undefined): string {
  const text = (title ?? "").trim() || "Untitled build";
  return `${text} — buildgallery`;
}
