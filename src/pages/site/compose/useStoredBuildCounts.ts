/* SV-23 P1: the build's stored counts (steps, parts, agents, sessions), written the way the classification facets are: 1.5 seconds
   after the tiles stop changing and the maker's own saves have landed, through the build's write queue (`updateBuild`). The counts are the ones the composer shows
   (`storedCountsOf`), so a number on the Builds table is the number here. The same counts are written, with the same function, by
   `refreshMakingStats` for a session added away from the composer (`buildCountsWrite`), so the two always agree.

   The columns may not exist yet (the SV-23 migration is applied later): a write that finds one missing is remembered and no more
   are tried this session, and it is never a failure of anything the maker did. A build that has nothing in it and was never counted
   writes nothing. */

import { useEffect, useRef } from "react";

import { countsToWrite, type StoredBuildCounts } from "@/lib/build/buildCounts";
import { updateBuild } from "@/lib/build/builds";
import { pendingWrites } from "@/lib/build/pendingWrites";
import type { BuildPatch } from "@/lib/build/types";
import { isMissingColumn } from "@/lib/classify/storage";

import { DERIVED_WRITE_MS } from "./useClassificationCard";

let columnsMissing = false;

/** For tests: forget that the columns were missing. */
export const resetStoredCountColumns = (): void => {
  columnsMissing = false;
};

export interface UseStoredBuildCountsInput {
  buildId: string | undefined;
  /** The build row as the page last read it; its held counts decide whether anything is owed. */
  build: unknown;
  owner: boolean;
  /** Absent until the tiles have loaded: nothing is written from a half-loaded build. */
  counts: StoredBuildCounts | null;
}

export function useStoredBuildCounts({ buildId, build, owner, counts }: UseStoredBuildCountsInput): void {
  const sent = useRef("");
  const countsJson = counts ? JSON.stringify(counts) : "";
  useEffect(() => {
    if (!buildId || !owner || !counts || !build || columnsMissing) return;
    const patch = countsToWrite(counts, build);
    const key = JSON.stringify([buildId, patch]);
    if (!patch || key === sent.current) return;
    let timer = 0;
    const write = () => {
      // The counts are derived from the tiles and can wait: they never go in among the maker's own saves, which are still on their way.
      if (pendingWrites.total() > 0) {
        timer = window.setTimeout(write, DERIVED_WRITE_MS);
        return;
      }
      sent.current = key;
      updateBuild(buildId, patch as unknown as BuildPatch).catch((cause: unknown) => {
        if (isMissingColumn(cause)) columnsMissing = true;
        else sent.current = "";
        console.warn("[counts] stored counts not written", { code: (cause as { code?: string })?.code });
      });
    };
    timer = window.setTimeout(write, DERIVED_WRITE_MS);
    return () => window.clearTimeout(timer);
    // `counts` is read through its JSON: a new object with the same numbers is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildId, owner, build, countsJson]);
}
