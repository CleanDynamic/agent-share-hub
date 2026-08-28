// How a rebuild is named and summarised, in one place.
//
// The same two answers are needed by three surfaces — the Rebuilds tab's rows,
// the replay scrubber's divergence markers, and anything NS-P41 puts in the
// feed — and they are answers about presentation rather than about data, so
// they live here rather than in src/lib/build/. It is the sibling of
// rebuildCredit.ts, which composes the other sentence a rebuild carries.
//
// A function returning a string, for the same reason that file gives: it is
// what lets a marker and a row call a person the same thing without one of them
// importing the other's component.

import type { RebuildSummary } from "@/lib/build";

/**
 * "@sam", the display name, or "someone".
 *
 * The handle leads because it is the stable address and the thing a reader can
 * go and look up. The last fallback is never reached in practice — builds.
 * creator_id is NOT NULL against profiles — and exists so that no surface can
 * ever render a name-shaped blank.
 */
export function creatorLabel(rebuild: RebuildSummary): string {
  const handle = rebuild.creator?.username?.trim();
  if (handle) return `@${handle}`;
  const display = rebuild.creator?.display_name?.trim();
  return display || "someone";
}

/**
 * The first line of a rebuild's note, or null.
 *
 * A row gets one line of it; the rebuild's own page renders all of it under the
 * banner. A note that is only whitespace is no note at all.
 */
export function firstLine(note: string | null | undefined): string | null {
  const text = (note ?? "").trim();
  if (!text) return null;
  const line = text.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return line.length > 0 ? line : null;
}
