// Add to a draft (UX-06 Part 4): copy one step into one of the reader's drafts, with credit.
//
// THE COPY GOES THROUGH SV-18'S INSERT PATH. A step is put in as Add from Library puts a saved step (`insertSavedTile`), and,
// with the composer not open, written as `startBuildFromItems` writes it (`writeNodeRows`, only the new tile). So the copy keeps
// its source (`source_ref`) and credits the step's maker exactly as a saved step is credited. No saved item is involved, so the
// copy names none (`saved_item_id` null).
//
// WHERE THE STEP COMES FROM. A published step is read again as it is now (`currentSnapshotOf`, the snapshot Save makes); a step
// a reply carries from a draft is its snapshot, which is already a step's copy.

import { snapshotOf } from "@/lib/build/buildSnapshot";
import { insertSavedTile } from "@/lib/build/fromLibrary";
import { getNodeTree } from "@/lib/build/nodes";
import { flatRows, writeNodeRows } from "@/lib/build/sessionEdit";
import type { BuildNode } from "@/lib/build/types";
import { currentSnapshotOf, type LibrarySavedItem } from "@/lib/library/savedItems";
import { currentUserId } from "@/lib/social/types";

import { signedOut } from "./types";

export type StepToCopy = { kind: "published"; buildId: string; nodeId: string } | { kind: "copy"; snapshot: Record<string, unknown> };

/** The step's copy: as it is now for a published step, or the snapshot a reply carries. */
export async function stepSnapshotFor(step: StepToCopy): Promise<Record<string, unknown>> {
  if (step.kind === "copy") return step.snapshot;
  return currentSnapshotOf({ kind: "step", buildId: step.buildId, ref: step.nodeId });
}

/** Put the step at the end of the draft's top level, as the signed-in reader. */
export async function addStepToDraft(draftId: string, snapshot: Record<string, unknown>): Promise<void> {
  const copier = await currentUserId();
  if (!copier) throw signedOut("addStepToDraft");
  const tree = await getNodeTree(draftId);
  const item: Pick<LibrarySavedItem, "id" | "kind" | "snapshot"> = { id: "", kind: "step", snapshot };
  const made = insertSavedTile(snapshotOf(tree, {}, []), item, { kind: "top", session: null, name: "" }, { buildId: draftId, copierId: copier, newId: () => crypto.randomUUID() });
  if (!made) throw new Error("addStepToDraft: the step does not fit a draft");
  const had = new Set(flatRows(tree).map((row) => row.id));
  const rows = made.snapshot.nodes
    .filter((row) => !had.has(row.id))
    .map((row): BuildNode => {
      const ref = row.source_ref && typeof row.source_ref === "object" && !Array.isArray(row.source_ref) ? (row.source_ref as Record<string, unknown>) : null;
      return ref ? ({ ...row, source_ref: { ...ref, saved_item_id: null } } as BuildNode) : row;
    });
  await writeNodeRows(rows);
}
