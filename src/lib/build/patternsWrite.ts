// CA-13 P11: write `builds.patterns`. Called by refreshMakingStats after it has written the making stats, so the patterns follow the
// build whenever it changes. Loaded on demand (a dynamic import) so making.ts and graph.ts never import each other at start-up.
//
// THE COLUMN IS NEWER THAN THE GENERATED TYPES, and until the CA-13 patterns migration is live it does not exist: the first write
// that finds it missing is remembered, and no more are tried this session. It is never a failure of the save that called it.

import { buildSteps, sessionGroups } from "./graph";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf, type Making } from "./making";
import { getNodeTree } from "./nodes";
import { buildPatterns, type Pattern } from "./patterns";
import { updateBuild } from "./builds";
import type { BuildPatch } from "./types";

let columnMissing = false;

const isMissingColumn = (error: unknown): boolean => {
  const text = `${(error as { code?: string })?.code ?? ""} ${(error as { message?: string })?.message ?? ""} ${(error as { cause?: { code?: string } })?.cause?.code ?? ""}`;
  return /42703|PGRST204|patterns/.test(text);
};

/** The patterns of a build, from its placed nodes and its making. */
export async function patternsOfBuild(buildId: string, making: unknown): Promise<Pattern[]> {
  const tree = await getNodeTree(buildId);
  const steps = buildSteps(tree);
  const record = (making && typeof making === "object" && !Array.isArray(making) ? making : {}) as Making;
  const sessions = Array.isArray(record.sessions) ? record.sessions : [];
  const tools = record.session_tools && typeof record.session_tools === "object" ? (record.session_tools as Record<string, string>) : {};
  return buildPatterns(steps, sessionGroups(steps, sessions, tools, sessionsMetaOf(record), sessionOrderOf(record), storedWorkstreamsOf(record)));
}

/** Write `patterns` for a build. Resolves true once it is written; false when the column is not live yet or the write failed. */
export async function refreshPatterns(buildId: string, making: unknown): Promise<boolean> {
  if (columnMissing) return false;
  try {
    const patterns = await patternsOfBuild(buildId, making);
    await updateBuild(buildId, { patterns } as unknown as BuildPatch);
    return true;
  } catch (error) {
    if (isMissingColumn(error)) columnMissing = true;
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    else console.warn("[refreshPatterns] patterns not written", { buildId });
    return false;
  }
}

/** For tests: forget that the column was missing. */
export const resetPatternsColumn = (): void => {
  columnMissing = false;
};
