// Start a build from a collection (SV-18): a new draft made from the collection's saved items, in order, each put in the way
// Add from Library puts it in (`insertSavedTile`, `sessionCopyOf`), so each keeps its source and credits its maker.
//
// The composer is not open, so there is no history and no animation: the draft is made, the items go in one after another
// (each read against the draft as it stands, so positions follow), and the caller opens the draft. A failure part way leaves a
// draft with what went in; the maker can see it and remove it from Drafts.

import type { LibrarySavedItem } from "@/lib/library/savedItems";
import { currentUserId } from "@/lib/social/types";

import { addSessionCopy } from "./addSession";
import { createBuild } from "./builds";
import { snapshotOf } from "./buildSnapshot";
import { insertSavedTile, sessionCopyOf } from "./fromLibrary";
import { getNodeTree } from "./nodes";
import { flatRows, writeNodeRows } from "./sessionEdit";

export const START_COPY = {
  nothing: "Nothing in this collection can start a build.",
  untitled: "Untitled build",
} as const;

/** Whether a saved item can start a build: a step, a part or a session. */
export const startsABuild = (item: Pick<LibrarySavedItem, "kind">): boolean => item.kind === "step" || item.kind === "part" || item.kind === "session";

/** The draft's id once every item is in. Resolves null when none of the items can go in a build (no draft is made). */
export async function startBuildFromItems(items: readonly LibrarySavedItem[], title: string): Promise<string | null> {
  const usable = items.filter(startsABuild);
  if (usable.length === 0) return null;
  const copier = await currentUserId();
  if (!copier) throw new Error("startBuildFromItems: signed out");
  const build = await createBuild({ title: title.trim() || START_COPY.untitled });
  for (const item of usable) {
    if (item.kind === "session") {
      await addSessionCopy(build.id, sessionCopyOf(item, copier));
      continue;
    }
    const before = snapshotOf(await getNodeTree(build.id), {}, []);
    const made = insertSavedTile({ ...before }, item, { kind: "top", session: null, name: build.title ?? title }, { buildId: build.id, copierId: copier, newId: () => crypto.randomUUID() });
    if (!made) continue;
    const had = new Set(flatRows(await getNodeTree(build.id)).map((row) => row.id));
    await writeNodeRows(made.snapshot.nodes.filter((row) => !had.has(row.id)));
  }
  return build.id;
}
