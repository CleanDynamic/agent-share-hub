// The credit a rebuild carries, composed in one place.
//
// WHY THIS IS NOT A COMPONENT. The same sentence has to appear in three
// different kinds of surface — the publish sheet's preview, the gallery card,
// and (NS-P40) the build page's header — and two of those are rendered by files
// that know nothing about rebuilding. A function returning a string is the only
// shape that all three can take without one of them importing the other's
// module, and it is what makes "exactly as the card will render it" a fact
// rather than a promise: the preview and the card call this.
//
// IT READS THE SNAPSHOT COLUMNS AND NOTHING ELSE. source_title_at_fork and
// source_handle_at_fork were frozen by startRebuild (NS-P37) and are never
// maintained again. Resolving the credit live instead would make it revocable —
// parent_build_id is ON DELETE SET NULL, and a source can be renamed or
// unpublished at any time — and a credit the credited party can erase is not a
// credit. This is also why there is no fallback to the live parent's title: a
// card cannot go and fetch one, so allowing it here would make the preview
// promise a line the card cannot keep.

import type { Build } from "@/lib/build";

/** The two frozen columns, and only those. */
export type RebuildCreditSource = Pick<
  Build,
  "source_title_at_fork" | "source_handle_at_fork"
>;

/**
 * "Rebuilt from Inbox triage agent by @amara".
 *
 * null when the fork was taken before those columns existed, or by a path that
 * did not freeze them: naming nobody is better than "Rebuilt from" trailing
 * off, and a card that renders nothing is a card that has not lied.
 *
 * The handle is optional on its own — a source whose creator has no handle
 * still gets its title named, because the title is the part a reader can go and
 * check.
 */
export function rebuildCreditLine(source: RebuildCreditSource): string | null {
  const title = source.source_title_at_fork?.trim();
  if (!title) return null;

  const handle = source.source_handle_at_fork?.trim();
  return handle ? `Rebuilt from ${title} by @${handle}` : `Rebuilt from ${title}`;
}
