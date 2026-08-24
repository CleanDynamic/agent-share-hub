// =============================================================================
// NeoScale — source_ref shaping (NS-P20a)
// =============================================================================
// Rule 1 of the two rules every parser in this sequence obeys, in one place:
//
//   Every proposed item carries source_ref recording where it came from —
//   { source, session_id, index }, where index is the turn or message it was
//   read out of, counted across BOTH speakers from 1.
//
// Both readers had already written the same three-line closure to avoid
// repeating the session id at every call site. This is that closure, once.
// =============================================================================

import type { SourceRef } from "./envelope.ts";

/**
 * Bind a reader's `source` and this run's `session_id`, leaving the index.
 *
 * ```ts
 * const ref = sourceRefFor("lovable", sessionId);
 * ref(message.index);  // { source: "lovable", session_id, index }
 * ```
 *
 * `source` is the reader's own discriminator and the only value in the whole
 * envelope a client could branch on. intake.ts types it as `string` and does
 * not branch on it, and build_nodes.source_ref holds it as-is.
 */
export function sourceRefFor<Source extends string>(
  source: Source,
  sessionId: string,
): (index: number) => SourceRef<Source> {
  return (index: number) => ({ source, session_id: sessionId, index });
}
