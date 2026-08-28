/**
 * Remix feature flags.
 *
 * NS-P43 — Freeze remix creation.
 *
 * Remix is the document model's derivation edge: createRemix clones a
 * `content_items` row into a new draft and writes a `post_lineage` row linking
 * the two. Rebuild supersedes it on the typed build record — parent_build_id,
 * root_build_id, forked_from_event_id (NS-P38–NS-P41) — so no new derivation
 * should be recorded in the old shape.
 *
 * WHAT THIS FLAG GATES. Creation only: `createRemix`, and the one affordance
 * that reaches it, the Remix button in ContentDetail's lineage row.
 *
 * WHAT IT DOES NOT GATE — everything that reads a lineage already recorded.
 * The /b/:slug/lineage page, its `get_post_lineage` RPC, useLineageParent and
 * useRemixCount, the attribution chip and the descendant badge all keep
 * working, so a post derived before the freeze still shows where it came from
 * and how many derived from it.
 *
 * WHY THE GATE IS BOTH IN THE FUNCTION AND AT THE AFFORDANCE. The affordance
 * guard is what a reader sees: no button, nothing offered, nothing that fails
 * on click. The gate inside createRemix is what makes it a freeze rather than
 * a hidden button — any call site that survives or reappears gets a named
 * error instead of writing a lineage row.
 *
 * ROLLBACK. Flip this to `true`. The button returns to the lineage row and
 * createRemix answers again; nothing was removed, so nothing else has to be
 * restored. The one companion step is src/lib/retiredSurfaces.test.tsx, whose
 * remix cases assert the frozen behaviour and are expected to be reverted
 * alongside the flip.
 */
export const REMIX_CREATE_ENABLED = false as const;

/**
 * Mirrors ReblogValidationError (src/lib/reblog/media.ts): a typed `code` so a
 * caller can branch on the reason rather than match on a message string.
 */
export class RemixValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RemixValidationError";
  }
}

/**
 * The remix authoring gate. Called as the first statement of createRemix.
 */
export function assertRemixCreateEnabled(): void {
  if (REMIX_CREATE_ENABLED) return;
  throw new RemixValidationError(
    "REMIX_RETIRED",
    "Remixing has been replaced by Rebuild."
  );
}
