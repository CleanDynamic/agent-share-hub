/**
 * Reblog data layer.
 *
 * FROZEN — read-only since NS-P43; replaced by src/lib/build/rebuild.ts.
 *
 * Everything already published keeps working: getReblog, getReblogsOfPost,
 * getReblogsByUser, checkExcerptStillValid, the realtime hooks and the
 * engagement writes (likeReblog, bookmarkReblog) are live and untouched, and
 * an existing reblog renders at its /b/:slug URL exactly as before.
 *
 * The authoring half is dead code held behind REBLOG_COMPOSE_ENABLED (see
 * ./flags.ts): createReblog, updateReblog, deleteReblog, uploadReblogMedia and
 * generateReblogSlug still import and type-check, but calling one while the
 * flag is false throws ReblogValidationError("REBLOG_RETIRED"). New
 * fork-with-credit work belongs in src/lib/build/rebuild.ts.
 *
 * Nothing was dropped: the reblogs, reblog_likes, reblog_bookmarks and
 * reblog_reports tables and the reblog-media bucket are archived in place.
 * docs/retired-surfaces.md carries the record and the rollback.
 */
export * from "./types";
export * from "./media";
export { createReblog } from "./createReblog";
export { getReblog } from "./getReblog";
export { getReblogsByUser } from "./getReblogsByUser";
export { getReblogsOfPost } from "./getReblogsOfPost";
export { likeReblog } from "./likeReblog";
export { bookmarkReblog } from "./bookmarkReblog";
export { deleteReblog } from "./deleteReblog";
export { updateReblog } from "./updateReblog";
export { useReblogUpdates, useReblogsOfPost } from "./realtime";
export { validateExcerpt, hashExcerpt } from "./validateExcerpt";
export { checkExcerptStillValid } from "./checkExcerptStillValid";
