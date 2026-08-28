// What the workspace knows about being a rebuild.
//
// One hook owns it: the source record, the diff against the draft, and the
// per-node treatment the tree paints. Everything visual reads from here, so
// the top bar's count and the tree's accents can never disagree — they are two
// renderings of one ChangeSet.
//
// WHY IT IS DEBOUNCED, AND AGAINST WHAT
// -------------------------------------
// changeSet walks both trees and canonicalises every payload it compares. That
// is cheap once and wrong to do per keystroke, and per keystroke is exactly
// what a naive memo would give: SchemaForm writes each character into the query
// cache optimistically (PAYLOAD_DEBOUNCE_MS later it reaches the database), and
// the top bar's title field writes into the header overlay the same way. So the
// draft record's identity changes on every key.
//
// The answer is a settled SNAPSHOT of the draft, taken SAVE_DEBOUNCE_MS after
// the last change of any kind — the same constant useComposeBuild debounces its
// writes by, imported rather than repeated so the two cadences cannot drift.
// The creator therefore sees the diff resolve on the same beat as "Saved",
// which is the beat they are already watching.
//
// The first record settles at once. A workspace that opened with no treatment
// for the first second would read as a build with nothing inherited, which is
// the opposite of what a rebuild is.
//
// WHAT IT DOES NOT DO
// -------------------
// It writes nothing, and it holds no state the publish sheet would need to be
// handed separately: NS-P39 reads the ChangeSet from here (see `changes`) and
// the readiness gate takes source, draft and changes together, all three of
// which this returns.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  changeSet,
  getBuild,
  serialiseChangeSet,
  type BuildRecord,
  type ChangeLine,
  type ChangeSet,
} from "@/lib/build";
import { SAVE_DEBOUNCE_MS, type ComposeBuild } from "@/hooks/useComposeBuild";

/** What one node is, measured against the build it was forked from. */
export type NodeTreatment = "inherited" | "changed" | "added";

/** Stable identity for the empty case, so a consumer's memo does not re-run. */
const NO_LINES: ChangeLine[] = [];

export interface RebuildDiff {
  /** The draft has a parent. True the moment the header loads. */
  isRebuild: boolean;
  /**
   * The source record, or null while it loads and if it no longer resolves.
   *
   * A parent that has been unpublished since the fork reads as null here: the
   * rebuilder keeps their draft and their credit line, and the workspace simply
   * stops claiming to know what they changed, because it cannot.
   */
  source: BuildRecord | null;
  /** The diff, or null until both records are in hand. */
  changes: ChangeSet | null;
  /** The diff as lines. NS-P39's sheet renders these; the bar counts them. */
  lines: ChangeLine[];
  /**
   * Draft node id -> what it is against the source, for the nodes that are not
   * simply inherited. Null when this is not a rebuild, or when the diff is not
   * available — the tree paints its ordinary accents in both cases rather than
   * calling every node inherited on no evidence.
   */
  nodes: Map<string, NodeTreatment> | null;
}

export function useRebuildDiff(compose: ComposeBuild): RebuildDiff {
  const build = compose.build;
  const buildId = build?.id ?? null;
  const parentBuildId = build?.parent_build_id ?? null;
  const isRebuild = Boolean(parentBuildId);

  // The source is a published build somebody else owns. It does not change
  // under the rebuilder, and refetching it would only cost the diff a flicker.
  const { data: source } = useQuery<BuildRecord | null>({
    queryKey: ["rebuild-source", parentBuildId],
    queryFn: () => getBuild(parentBuildId as string),
    enabled: isRebuild,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /** The draft as a record. New identity on every keystroke, by design. */
  const draft = useMemo<BuildRecord | null>(
    () =>
      build
        ? {
            build,
            tree: compose.tree,
            tray: compose.tray,
            events: compose.events,
            nodeTypes: compose.nodeTypes,
          }
        : null,
    [build, compose.events, compose.nodeTypes, compose.tray, compose.tree]
  );

  const [settled, setSettled] = useState<BuildRecord | null>(null);
  /** Whether anything has settled yet, readable inside the effect without
   *  making the settled value itself a dependency of its own timer. */
  const hasSettledRef = useRef(false);

  // A different build is a different diff. Declared before the timer effect so
  // it runs first on the render that changes the id.
  useEffect(() => {
    hasSettledRef.current = false;
    setSettled(null);
  }, [buildId]);

  useEffect(() => {
    if (!isRebuild || !draft) return;

    if (!hasSettledRef.current) {
      hasSettledRef.current = true;
      setSettled(draft);
      return;
    }

    const timer = window.setTimeout(() => setSettled(draft), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, isRebuild]);

  const changes = useMemo<ChangeSet | null>(
    () => (source && settled ? changeSet(source, settled) : null),
    [settled, source]
  );

  const lines = useMemo<ChangeLine[]>(
    () => (changes ? serialiseChangeSet(changes) : NO_LINES),
    [changes]
  );

  const nodes = useMemo<Map<string, NodeTreatment> | null>(() => {
    if (!isRebuild || !changes) return null;
    const map = new Map<string, NodeTreatment>();
    // Everything else in the tree is inherited by elimination, which is why
    // this map holds only the two positive answers.
    for (const node of changes.changed) map.set(node.node_id, "changed");
    for (const node of changes.added) map.set(node.node_id, "added");
    return map;
  }, [changes, isRebuild]);

  return { isRebuild, source: source ?? null, changes, lines, nodes };
}
