// =============================================================================
// NeoScale — event ordinal assignment (NS-P20a)
// =============================================================================
// build_events.ordinal is the event's position in the sequence, 1..N, and it is
// a UNIQUE SELECTION KEY within one proposal: the intake surface identifies the
// event a creator kept or dropped by it. So it runs across every kind rather
// than per kind — a proposal holding prompt, deploy and breakage events numbers
// them 1, 2, 3, not 1, 1, 1.
//
// It is renumbered against the build on write, so what matters here is only
// that it is dense, ascending and emitted in the order the session ran.
//
// source_ref.index is a DIFFERENT number and the two are routinely unequal: the
// index is the turn or message the event was read out of, counted across both
// speakers. NS-P13's twentieth event has ordinal 20 and index 39.
// =============================================================================

/**
 * 1, 2, 3, … in emission order.
 *
 * ```ts
 * const ordinal = createOrdinalCounter();
 * events.push({ ordinal: ordinal.next(), ... });
 * ```
 */
export function createOrdinalCounter(start = 1): { next: () => number; issued: () => number } {
  let issued = 0;
  return {
    next: () => start + issued++,
    issued: () => issued,
  };
}

/**
 * Renumber in place, for a reader that appends events out of order and sorts
 * them afterwards. Dense and ascending from `start`, whatever it did before.
 */
export function renumberOrdinals(events: { ordinal: number }[], start = 1): void {
  events.forEach((event, position) => {
    event.ordinal = start + position;
  });
}
