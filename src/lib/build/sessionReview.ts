// SV-30 P8: how much of a session's changes a human reviewed. PURE. A fact, not a judgement: the labels say what was reviewed.

export const REVIEW_SCOPES = ["none", "high_blast_radius", "all"] as const;
export type ReviewScope = (typeof REVIEW_SCOPES)[number];
export const REVIEW_FILES_MAX = 10;
export const REVIEW_FILE_MAX = 200;

export interface SessionReview {
  scope: ReviewScope;
  /** The high-blast-radius files that were reviewed, as paths. */
  files?: string[];
}

/** A stored review, read defensively. Files belong to the high-blast-radius scope only. */
export function reviewOf(raw: unknown): SessionReview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { scope, files } = raw as { scope?: unknown; files?: unknown };
  if (!REVIEW_SCOPES.includes(scope as ReviewScope)) return null;
  const list = scope === "high_blast_radius" && Array.isArray(files) ? files.flatMap((file) => (typeof file === "string" && file.trim() ? [file.trim().slice(0, REVIEW_FILE_MAX)] : [])).slice(0, REVIEW_FILES_MAX) : [];
  return { scope: scope as ReviewScope, ...(list.length > 0 ? { files: list } : null) };
}

/** Why a review cannot be saved, or null. */
export function reviewRefusal(review: SessionReview): string | null {
  if (!REVIEW_SCOPES.includes(review.scope)) return "Human review is none, high-blast-radius files only, or all changes.";
  if ((review.files ?? []).length > REVIEW_FILES_MAX) return `Files: ${REVIEW_FILES_MAX} max`;
  if ((review.files ?? []).some((file) => file.trim().length > REVIEW_FILE_MAX)) return `A file path: ${REVIEW_FILE_MAX} characters max`;
  return null;
}

/** "Human review: none", "Human review: high-blast-radius files only (db/migrate.sql, src/core.ts)", "Human review: all changes". */
export function reviewLine(review: SessionReview): string {
  if (review.scope === "none") return "Human review: none";
  if (review.scope === "all") return "Human review: all changes";
  return `Human review: high-blast-radius files only${review.files && review.files.length > 0 ? ` (${review.files.join(", ")})` : ""}`;
}
