// SV-23: the stored counts of a build, worked out away from the composer. `refreshMakingStats` calls it after every change a
// session makes to a build (an offer accepted on OpenBuilds, a session added from Drafts or the upload page), and the admin
// backfill calls it for builds nobody has saved since the counts existed. It counts with the composer's own functions
// (`buildSteps`, `sessionGroups`, `shownGroups`, the stored parts, the session order the table or `making` holds), so the
// number written is the number the composer shows. Loaded on demand, as patternsWrite is, so making.ts and graph.ts never
// import each other at start-up.
//
// THE COLUMNS MAY NOT EXIST YET (the SV-23 migration is applied later): the first write that finds one missing is remembered
// and no more are tried this session. It is never a failure of the change that called it.

import { updateBuild } from "./builds";
import { getSessionOrder } from "./sessionLayout";
import { listBuildSessionRows } from "./buildSessions";
import { storedCountsOf, type StoredBuildCounts } from "./buildCounts";
import { buildSteps, sessionGroups } from "./graph";
import { sessionsMetaOf, storedWorkstreamsOf, type Making } from "./making";
import { getNodeTree } from "./nodes";
import { orderByWorkstream } from "./workstreams";
import { isMissingColumn } from "@/lib/classify/storage";
import type { BuildPatch } from "./types";

let columnsMissing = false;

/** The counts of a build, from its placed tiles, its sessions' order and its making. */
export async function storedCountsOfBuild(buildId: string, making: unknown): Promise<StoredBuildCounts> {
  const [tree, rows] = await Promise.all([getNodeTree(buildId), listBuildSessionRows(buildId)]);
  const steps = buildSteps(tree);
  const record = (making && typeof making === "object" && !Array.isArray(making) ? making : {}) as Making;
  const sessions = Array.isArray(record.sessions) ? record.sessions : [];
  const tools = record.session_tools && typeof record.session_tools === "object" ? (record.session_tools as Record<string, string>) : {};
  const parts = storedWorkstreamsOf(record);
  const meta = sessionsMetaOf(record);
  // The order the composer numbers by: the table's rows (else `making.session_order`), the parts in their order.
  const order = orderByWorkstream(getSessionOrder(record, rows), meta, parts);
  return storedCountsOf(steps, sessionGroups(steps, sessions, tools, meta, order, parts), parts);
}

/** Write the counts of a build. Resolves true once written; false when the columns are not live yet or the write failed. */
export async function refreshStoredCounts(buildId: string, making: unknown): Promise<boolean> {
  if (columnsMissing) return false;
  try {
    await updateBuild(buildId, (await storedCountsOfBuild(buildId, making)) as unknown as BuildPatch);
    return true;
  } catch (error) {
    if (isMissingColumn(error)) columnsMissing = true;
    else console.warn("[refreshStoredCounts] counts not written", { buildId });
    return false;
  }
}

/** For tests: forget that the columns were missing. */
export const resetStoredCountsColumns = (): void => {
  columnsMissing = false;
};
