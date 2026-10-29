// SV-21 P1: a request opened from a failed run.
//
// A RUN IS A build_reproductions ROW. The database refuses a maker's own, so every run that did not work is someone else's,
// and the maker is the only person it is offered to. The request is a Whole build request (no gap node: a run is about the
// build, not a step) with the run's note as its problem and the run linked, so the board can say where it came from.
//
// NOTHING IS CREATED ON ITS OWN. These run when the maker presses "Open a request from this run", and not before.

import { supabase } from "@/integrations/supabase/client";
import { createBountyForGap } from "./bounties";
import { bountyLayerError, type Bounty } from "./types";

/** A run as the request needs it. */
export interface RunForRequest {
  id: string;
  buildId: string;
  worked: boolean;
  note: string;
}

interface RunRow {
  id: string;
  build_id: string;
  worked: boolean;
  note: string | null;
}

interface Reads {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: unknown }> & { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
        maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
}

const reads = supabase as unknown as Reads;
const RUN_COLUMNS = "id, build_id, worked, note";

const toRun = (row: RunRow): RunForRequest => ({ id: row.id, buildId: row.build_id, worked: row.worked, note: row.note?.trim() ?? "" });

/**
 * The run a feed line stands for, by its build and the reproducer's handle (the feed row carries those, not the run's id).
 * One run per person per build, so there is at most one.
 */
export async function findRunByHandle(buildId: string, handle: string): Promise<RunForRequest | null> {
  const { data, error } = await reads
    .from("build_reproductions")
    .select(`${RUN_COLUMNS}, profiles!build_reproductions_user_id_fkey!inner(username)`)
    .eq("build_id", buildId)
    .eq("profiles.username", handle)
    .maybeSingle();
  if (error) throw bountyLayerError("findRunByHandle", error);
  return data ? toRun(data as RunRow) : null;
}

/**
 * Open a request from a run that did not work. Refused, before anything is written: a run that is not there, a run that
 * worked, and a viewer who did not make the build. The database says the last again (the bounty insert policy admits only
 * the build's maker), so this is the sentence, not the guarantee.
 */
export async function openRequestFromRun({ runId, viewerId }: { runId: string; viewerId: string }): Promise<Bounty> {
  const { data: run, error: runError } = await reads.from("build_reproductions").select(RUN_COLUMNS).eq("id", runId).maybeSingle();
  if (runError) throw bountyLayerError("openRequestFromRun (run)", runError);
  if (!run) throw new Error("That run is not there any more");
  const found = toRun(run as RunRow);
  if (found.worked) throw new Error("That run worked, so there is nothing to ask for");

  const { data: build, error: buildError } = await reads.from("builds").select("id, creator_id").eq("id", found.buildId).maybeSingle();
  if (buildError) throw bountyLayerError("openRequestFromRun (build)", buildError);
  if (!build || (build as { creator_id: string }).creator_id !== viewerId) throw new Error("Only the person who made the build can open a request from a run");

  return createBountyForGap({ buildId: found.buildId, problem: found.note || null, fromRunId: found.id });
}
