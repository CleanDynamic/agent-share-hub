// Publishing a build: the one write that makes a record readable, and the
// question asked before it.
//
// PUBLICATION IS UNGATED ON COMPLETENESS. This is the decision the handover is
// explicit about and the thing most likely to be quietly re-litigated later, so
// it is written down here rather than left to be inferred from the code: a
// creator who has said what their build does, shown the thing someone would
// run, and shown that it worked has a publishable record. Nothing about cost,
// prerequisites, audience or links stands between them and a live page. Those
// fields raise completeness, and completeness decides GALLERY PLACEMENT — a
// different question, answered in gallery.ts, at query time.
//
// So the two gates are deliberately different in kind:
//
//   publish   three named requirements, tested one at a time, so a control
//             that stays disabled can say which one is outstanding
//   gallery   a score against a shape's threshold, computed when the gallery
//             is queried and never stored
//
// A record below the gallery threshold is not rejected and is never described
// that way. It is live, forkable and on its creator's profile; the gallery is
// something further it can reach.

import {
  MINIMUM_PUBLISHABLE_KEYS,
  computeCompleteness,
  type Completeness,
  type CompletenessSource,
  type MissingItem,
} from "./signals";
import { getBuildHeader, updateBuild } from "./builds";
import type {
  Build,
  BuildPatch,
  BuildStatus,
  NodeTree,
  NodeType,
} from "./types";

/** The columns publishReadiness reads, so a caller can pass a stub. */
export type PublishSource = CompletenessSource;

export interface PublishReadiness {
  /** True when all three minimum requirements are met. */
  ready: boolean;
  /**
   * The outstanding minimum requirements, in rule order. Empty when ready.
   * These are instructions to the creator, never verdicts on the build.
   */
  blocking: MissingItem[];
  /**
   * One sentence naming the missing piece, for the disabled control to show.
   * null when ready.
   */
  reason: string | null;
}

/**
 * Whether this record can be published, and if not, what is missing.
 *
 * Reads the SAME rule table completeness does, filtered to the three minimum
 * requirements — so a record that satisfies the checklist's first three rows is
 * by construction publishable, and a creator is never told two different
 * stories about the same field.
 *
 * `tree` is the PLACED tree. Tray nodes do not count: unplaced material is not
 * part of the record, and publishing a build whose only evidence is sitting in
 * the tray would put a page in front of readers with nothing on it.
 *
 * A caller that already holds a Completeness — the compose workspace does,
 * memoised — should use readinessFrom instead and skip the second tree walk.
 */
export function publishReadiness(
  build: PublishSource,
  tree: NodeTree[],
  nodeTypes: NodeType[]
): PublishReadiness {
  return readinessFrom(computeCompleteness(build, tree, nodeTypes));
}

/**
 * The same answer, from a Completeness already computed.
 *
 * The three minimum requirements are a SUBSET of every shape's rules, so the
 * outstanding ones are already in `missing` and there is nothing to work out
 * twice. This is what the compose top bar calls: it re-renders on every
 * keystroke of the title, and walking a build's whole tree per keystroke to
 * re-derive a list the hook is already holding is work nobody asked for.
 */
export function readinessFrom(completeness: Completeness): PublishReadiness {
  const minimum = new Set<string>(MINIMUM_PUBLISHABLE_KEYS);
  const blocking = completeness.missing.filter((item) => minimum.has(item.key));

  return {
    ready: blocking.length === 0,
    blocking,
    reason: blocking.length === 0 ? null : publishReason(blocking),
  };
}

/**
 * "To publish, add the one line that says what this does for someone."
 *
 * One item, not a list: a control's tooltip that enumerates three things is a
 * control nobody reads. The first outstanding requirement is the next thing to
 * do, and the rest surface as they are cleared.
 */
function publishReason(blocking: MissingItem[]): string {
  const remaining = blocking.length - 1;
  const tail =
    remaining > 0
      ? ` Then ${remaining} more thing${remaining === 1 ? "" : "s"} to go.`
      : "";
  return `To publish, ${blocking[0].copy}.${tail}`;
}

/** The columns publishBuild reads before it decides what to write. */
export type PublishTarget = Pick<Build, "id" | "status" | "published_at">;

/**
 * The columns publishing writes, and only those.
 *
 * WHAT IT WILL NOT OVERWRITE:
 *
 * published_at is the date the record first became readable, so a creator who
 * edits and re-publishes keeps it. A second write would move the build to the
 * top of every "newest first" ordering on the site by doing nothing but saving
 * again.
 *
 * A build already at 'gallery' stays there. That status is editorial promotion
 * by an admin, not something a creator's own publish should undo — and re-
 * publishing is exactly what a creator does after acting on the gallery line
 * shown to them on the way out.
 *
 * The caller is expected to have asked publishReadiness first. Neither this nor
 * publishBuild re-checks it: they take the header alone, and the requirements
 * need the node tree.
 *
 * An empty patch means the build is already live and already dated. That is a
 * real outcome, not an error — a creator re-opening the confirmation to see
 * their link should not cost a write.
 */
export function publishPatch(build: PublishTarget): BuildPatch {
  const patch: BuildPatch = {};

  if (build.status !== "gallery") {
    patch.status = "published" satisfies BuildStatus;
  }
  if (!build.published_at) {
    patch.published_at = new Date().toISOString();
  }

  return patch;
}

/**
 * Set the build live.
 *
 * The compose workspace does not call this: it has unsaved header edits in
 * hand and folds publishPatch into the same row update, so a creator who types
 * their outcome and immediately clicks Publish gets one write rather than a
 * race between two. This is the standalone path, for a caller holding nothing
 * but an id.
 */
export async function publishBuild(build: PublishTarget): Promise<Build> {
  const patch = publishPatch(build);

  // Already published, already dated: nothing to write, and an empty PATCH is
  // a PostgREST error rather than a no-op.
  if (Object.keys(patch).length === 0) {
    const row = await getBuildHeader(build.id);
    if (row) return row;
  }

  return updateBuild(build.id, patch);
}
