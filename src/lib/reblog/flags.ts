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
 * ROLLBACK. Flip this to `true`. Every guarded affordance reappears where it
 * was and composing works again — nothing else has to be restored, because
 * nothing else was removed.
 */
export const REBLOG_COMPOSE_ENABLED = false as const;
