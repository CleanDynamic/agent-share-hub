/**
 * Legacy bounty creation flags.
 *
 * NS-P54 — Retire /bounty/new and the legacy bounty writers.
 *
 * WHAT "LEGACY BOUNTY CREATION" IS. A bounty used to be a `content_items` row
 * with `post_type = 'bounty'` and a dozen `bounty_*` columns beside it. Two
 * routes wrote one: `/bounty/new` (src/pages/BountyUpload.tsx, a three-step
 * wizard that inserted an APPROVED row straight from the form) and
 * `/upload/bounty` (src/pages/BountyUploadShell.tsx, which bootstrapped a draft
 * row and handed it to the shared editor). Two library helpers wrote one too —
 * `createMetaBounty` and `promoteBountyToBlueprint` in
 * src/lib/bounty-competition/.
 *
 * WHAT REPLACES IT. A bounty is now a gap node on a build: marked unsolved in
 * the composer (src/components/compose/BountySection.tsx), priced at publish,
 * filed against `public.bounties` and answered by a typed payload or a rebuild
 * (NS-P45–NS-P53). Every former entry point lands on /compose/new.
 *
 * WHY THE FORM MOVED RATHER THAN THE FEATURE. /bounty/new asked a creator to
 * start from the ask — to describe a hole before they had done any of the work
 * around it. Almost nobody does. The gap panel asks the same question at the
 * one moment the answer is already in front of them: they are publishing a
 * build, and one part of it is missing.
 *
 * WHAT THIS FLAG GATES — creation, and only creation:
 *
 *   * `BountyUpload`'s submit handler (/bounty/new)
 *   * `BountyUploadShell`'s draft bootstrap (/upload/bounty with no ?id)
 *   * `createMetaBounty` and `promoteBountyToBlueprint` (NS-P54 commit 2)
 *
 * WHAT IT DOES NOT GATE — every read of a legacy bounty, and every write
 * against one that already exists. /content/:id with its solutions and
 * discussion, /b/:id/thread, /b/:id/leaderboard, the solver flow in
 * src/lib/bounty-solver/, `refreshLeaderboardCache`, the pledge and spawn path
 * in `pledgeToSubBounty`, and the legacy meta-bounty page all keep working.
 * A bounty is retired as a thing to CREATE, not as a thing to read or solve.
 *
 * A DRAFT IN PROGRESS IS STILL FINISHABLE. `/upload/bounty?id={draftId}` still
 * mounts the shared editor in bounty mode and still saves and publishes through
 * src/pages/Upload.tsx, which this prompt does not touch. What stops is the
 * bootstrap that MINTS a new draft row on a bare visit. src/pages/Drafts.tsx
 * still routes a `post_type = 'bounty'` draft back there, deliberately.
 *
 * WHY THE GATE IS BOTH IN THE WRITER AND AT THE AFFORDANCE, the reasoning
 * NS-P42, NS-P43 and NS-P44 set: the affordance guard is what a creator meets —
 * the picker's Bounty card and Home's bounties CTA go to /compose/new, so
 * nothing is offered that fails on click. The gate inside the writer is what
 * makes it a freeze rather than a hidden button: a bookmarked URL, or a call
 * site that survives a later refactor, gets a named error rather than a silent
 * row on a retired shape.
 *
 * ROLLBACK. Flip this to `true`. Both routes write again, both helpers answer,
 * and nothing else has to be restored — no file was deleted, no column was
 * dropped and no row was touched. Three companion steps:
 *
 *   1. Point the picker's `bounty` entry in src/contexts/UploadPickerContext.ts
 *      back at "/upload/bounty" and Home's bounties CTA back at
 *      `openUploadTypePicker("bounty")`.
 *   2. Unwrap `/bounty/new` from `LegacyUploadRoute` in src/App.tsx.
 *   3. Revert src/lib/bounty-legacy/legacyBountyCreateRetired.test.tsx, which
 *      asserts the frozen behaviour directly and will fail — correctly — once
 *      it is unfrozen.
 *
 * See docs/retired-surfaces.md, "Legacy bounty creation", for the full record.
 */
export const LEGACY_BOUNTY_CREATE_ENABLED = false as const;

/**
 * Mirrors ReblogValidationError (src/lib/reblog/media.ts), RemixValidationError
 * (src/lib/remix/flags.ts) and Gen1BountyValidationError
 * (src/lib/bounty-gen1/flags.ts): a typed `code` so a caller can branch on the
 * reason rather than match on a message string.
 */
export class LegacyBountyValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LegacyBountyValidationError";
  }
}

/** The sentence every frozen writer answers with, in one place. */
export const BOUNTY_RETIRED_MESSAGE =
  "Bounties are now part of publishing a build — mark a part unsolved in the composer.";

/**
 * The legacy bounty creation gate. Called as the FIRST statement of every
 * writer named above, before any state is read and before any row is touched.
 */
export function assertLegacyBountyCreateEnabled(): void {
  if (LEGACY_BOUNTY_CREATE_ENABLED) return;
  throw new LegacyBountyValidationError("BOUNTY_RETIRED", BOUNTY_RETIRED_MESSAGE);
}
