/**
 * Reblog feature flags.
 *
 * NS-P42 — Retire reblog entry points.
 *
 * The platform's light share is now the reproduction note, and the
 * fork-with-credit mechanic is Rebuild (NS-P38–NS-P41). Reblog is being
 * retired one reversible step at a time. This is step one: no new reblog can
 * be STARTED from the UI, while every reblog already published keeps
 * rendering at its /b/:slug URL with its likes, bookmarks and comments
 * working exactly as before.
 *
 * WHAT THIS FLAG GATES. Only the affordances that open a reblog composer —
 * the Repeat2 buttons on the feed cards, the "Reblog with quote" action in
 * the selection overlay, and the "↺ Reblog this" buttons on reblog cards and
 * the reblog detail page. It gates nothing on the read path: route
 * resolution, ReblogDetailView, the reblog rows in the legacy feed tabs and
 * every engagement control on an existing reblog are outside it.
 *
 * WHY IT IS AT THE AFFORDANCE AND NOT IN THE COMPOSER. The composer
 * (ReblogComposeSheet, ReblogComposer) and the write functions behind it
 * (createReblog and friends) are left whole and working. That is what makes
 * the rollback real rather than notional.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NS-P43 — Freeze reblog authoring.
 *
 * Step two extends this same flag from the affordances down to the writes.
 * createReblog, updateReblog, deleteReblog, uploadReblogMedia and
 * generateReblogSlug now ask `assertReblogAuthoringEnabled()` (src/lib/reblog/
 * media.ts) before doing anything, and while this flag is false that call
 * throws ReblogValidationError("REBLOG_RETIRED"). Importing them stays valid
 * and their bodies are untouched — the gate is the first statement, not a
 * deletion — so a call site that survives anywhere gets a named error instead
 * of a silent write to a retired table.
 *
 * WHAT IS STILL OUTSIDE THE FLAG, in NS-P43 as in NS-P42: the whole read path
 * (getReblog, getReblogsOfPost, getReblogsByUser, checkExcerptStillValid,
 * route resolution, ReblogDetailView) and every engagement write on an
 * existing reblog (likeReblog, bookmarkReblog, comments, reports). An
 * existing reblog renders and behaves exactly as it did.
 *
 * ROLLBACK. Flip this to `true`. Every guarded affordance reappears where it
 * was, the write functions answer again, and composing works end to end —
 * nothing else has to be restored, because nothing else was removed. The one
 * companion step is src/lib/retiredSurfaces.test.tsx, whose reblog cases assert
 * the frozen behaviour and are expected to be reverted alongside the flip.
 */
export const REBLOG_COMPOSE_ENABLED = false as const;
