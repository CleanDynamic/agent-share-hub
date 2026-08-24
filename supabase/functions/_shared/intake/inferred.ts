// =============================================================================
// NeoScale — inferred / inferred_reason marking (NS-P20a)
// =============================================================================
// Rule 2 of the two rules every parser in this sequence obeys, in one place:
//
//   Anything inferred rather than read carries `inferred: true` and a short
//   reason string. Anything read verbatim carries `inferred: false` and
//   `inferred_reason: null`.
//
// Read verbatim from the source => verbatim(). Guessed, matched by heuristic,
// or assembled from scattered mentions => guessed(reason), with a reason a
// creator can read and disagree with. Auto extraction is only trustworthy when
// it admits what it guessed.
//
// The pair is returned as an object to be spread LAST into a proposed item, so
// the two keys land in the position they have always occupied. That is not
// cosmetic: the envelope is serialised to JSON and compared field by field
// against the other reader's, and key order is part of what a diff sees.
// =============================================================================

/** The `inferred` / `inferred_reason` pair carried by every proposed item. */
export interface InferenceMark {
  inferred: boolean;
  inferred_reason: string | null;
}

/** Read out of the source as it stands. The one thing that is not a guess. */
export function verbatim(): InferenceMark {
  return { inferred: false, inferred_reason: null };
}

/** Guessed, matched or assembled. `reason` is shown to the creator as written. */
export function guessed(reason: string): InferenceMark {
  return { inferred: true, inferred_reason: reason };
}

/**
 * For the common case where one condition decides it: a null reason means the
 * item was read, a string means it was not.
 *
 * `mark(computed ? WHY : null)` reads better at a call site than a ternary
 * spanning two fields, and it cannot produce the two states that make no sense
 * — inferred with no reason, or a reason on something read verbatim.
 */
export function mark(reason: string | null): InferenceMark {
  return reason === null ? verbatim() : guessed(reason);
}
