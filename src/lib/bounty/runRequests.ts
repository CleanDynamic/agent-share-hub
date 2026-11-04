// SV-21 P1, UX-08 P2: finding the run a feed line stands for.
//
// A RUN IS A build_reproductions ROW. The database refuses a maker's own, so every run that did not work is someone else's, and
// the maker is the only person it is offered to. UX-08 P2: it used to file a request from the run; it now opens the New post window
// with the run in its words (`src/pages/site/home/runTopic.ts`), and nothing is written until the person presses Post.

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

/** A run as the request needs it. */
export interface RunForRequest {
  id: string;
  buildId: string;
  worked: boolean;
  note: string;
  /** The model the run was made on (`model_used`), when it said. */
  model: string | null;
}

interface RunRow {
  id: string;
  build_id: string;
  worked: boolean;
  note: string | null;
  model_used: string | null;
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
const RUN_COLUMNS = "id, build_id, worked, note, model_used";

const toRun = (row: RunRow): RunForRequest => ({ id: row.id, buildId: row.build_id, worked: row.worked, note: row.note?.trim() ?? "", model: row.model_used?.trim() || null });

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
