/**
 * Generation-1 bounty response flags.
 *
 * NS-P44 — Freeze generation-1 bounty responses.
 *
 * The bounty estate has two generations. Generation 1 (March 2026,
 * supabase/migrations/20260323000001_bounty_system.sql) is `bounty_responses`
 * with its `inline_blocks` jsonb, `upvotes`, `verified_count` and generated
 * `score` column, plus `bounty_me_too`, `bounty_response_verifications` and a
 * row of `bounty_*` columns on `content_items`. Generation 2 (May 2026) is
 * `solutions` and its satellites, served by src/lib/bounty-solver/ and
 * BountySolvePage. Generation 2 is the live system; this flag is about
 * generation 1 only and touches nothing generation 2 owns.
 *
 * WHAT THE AUDIT FOUND. Measured 28 Aug 2026 against the project this repo
 * points at (supabase/config.toml `project_id`, and the only Supabase host
 * that appears anywhere in the tree): the generation-1 schema is not there.
 * `bounty_responses`, `bounty_me_too` and `bounty_response_verifications` each
 * answer PGRST205 "Could not find the table in the schema cache" — the same
 * answer a table name invented for the probe gets — and
 * `content_items.bounty_enabled` and `profiles.bounties_solved` each answer
 * Postgres 42703 "column does not exist". No migration in the repository drops
 * them, so the March migration was authored and never applied. Row counts are
 * therefore zero because there is nothing to hold rows. The full measurement is
 * in docs/retired-surfaces.md.
 *
 * WHY FREEZE ANYWAY. The freeze is the point regardless of the count: it is
 * what stops the shape coming back. The composer's insert is written
 * `.from("bounty_responses" as any)` — the cast is there precisely because the
 * table is absent from the generated types — so nothing in the type system
 * stands between a future re-route and a live generation-1 write path. This
 * flag does.
 *
 * WHAT THIS FLAG GATES. The generation-1 authoring path, and only that:
 * BountyResponseComposer, which renders nothing while the flag is false, and
 * its submit handler, which asks assertGen1BountyResponsesEnabled() before it
 * inserts; plus the one affordance that opens it, the "Submit a Blueprint →"
 * button in the bounty response section of src/pages/ContentDetail.legacy.tsx.
 *
 * WHAT IT DOES NOT GATE — every read of a generation-1 row. The response list
 * and its sort, the me-too count, the verification counts and the mark-as-
 * solution control in that same legacy page; the "Solutions" tab and the
 * "★ N bounties solved" chip on src/pages/CreatorProfile.tsx and
 * src/pages/Profile.legacy.tsx. Whatever those render today they render
 * unchanged after the freeze. Nothing generation 2 owns is inside the flag
 * either — solutions, solution_votes, the discussion tables and all seventeen
 * files of src/lib/bounty-solver/ are untouched.
 *
 * WHY THE GATE IS BOTH IN THE COMPONENT AND AT THE AFFORDANCE, the reasoning
 * NS-P42 and NS-P43 set: the affordance guard is what a reader meets — no
 * button, nothing offered, nothing that fails on click. The gate inside the
 * component and its submit handler is what makes it a freeze rather than a
 * hidden button — a call site that survives, or a page that is re-routed
 * later, gets nothing rendered and a named error rather than a silent write.
 *
 * ROLLBACK. Flip this to `true`. The composer mounts again, its submit handler
 * answers, and the button returns to the response section — nothing was
 * deleted, so nothing else has to be restored. Two companion steps: revert
 * src/lib/bounty-gen1/gen1ResponsesRetired.test.tsx, which asserts the frozen
 * behaviour directly and is expected to fail once it is unfrozen, and apply
 * supabase/migrations/20260323000001_bounty_system.sql, without which the
 * unfrozen path writes to a table that does not exist.
 */
export const GEN1_BOUNTY_RESPONSES_ENABLED = false as const;

/**
 * Mirrors ReblogValidationError (src/lib/reblog/media.ts) and
 * RemixValidationError (src/lib/remix/flags.ts): a typed `code` so a caller can
 * branch on the reason rather than match on a message string.
 */
export class Gen1BountyValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "Gen1BountyValidationError";
  }
}

/**
 * The generation-1 authoring gate. Called as the first statement of the
 * composer's submit handler.
 */
export function assertGen1BountyResponsesEnabled(): void {
  if (GEN1_BOUNTY_RESPONSES_ENABLED) return;
  throw new Gen1BountyValidationError(
    "GEN1_BOUNTY_RESPONSES_RETIRED",
    "Generation-1 bounty responses are frozen. Bounties are solved through solutions."
  );
}
