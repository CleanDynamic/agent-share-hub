// SV-21 P3: a session or a part the maker has opened as a request. Stored on the session's or the part's own entry in
// `making` (`sessions_meta[key].open`, `workstreams[i].open`) as the problem in the maker's words. It is a mark on the draft,
// not yet a request: the request is filed when the build is published, and only for what the maker marked.

export interface OpenRequest {
  /** What is missing or wrong, in the maker's words. */
  problem: string;
}

export const OPEN_PROBLEM_MAX = 500;

/** A stored `open`, read defensively: a problem as written, trimmed, cut to the limit; none when it reads as nothing. */
export function openOf(value: unknown): OpenRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const problem = (value as Record<string, unknown>).problem;
  if (typeof problem !== "string" || !problem.trim()) return null;
  return { problem: problem.trim().slice(0, OPEN_PROBLEM_MAX) };
}

/** Why an `open` cannot be saved, or null. Pure, so the composer can say no first. */
export function openRefusal(open: OpenRequest | undefined): string | null {
  if (open === undefined) return null;
  if (typeof open.problem !== "string" || !open.problem.trim()) return "Say what the request is for.";
  if (open.problem.trim().length > OPEN_PROBLEM_MAX) return `A request: ${OPEN_PROBLEM_MAX} characters max`;
  return null;
}
