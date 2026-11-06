// Finding the run a feed line stands for, so the maker can start a topic from it (UX-08 P2).
//
// A run is a build_reproductions row. The database refuses a maker's own, so every run that did not work is someone else's, and the
// maker is the only person it is offered to. One run per person per build, so there is at most one.

import { supabase } from "@/integrations/supabase/client";

export interface RunToStartFrom {
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
        eq: (column: string, value: unknown) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
  };
}

const reads = supabase as unknown as Reads;

/** The run a feed line stands for, by its build and the reproducer's handle (the feed row carries those, not the run's id). */
export async function findRunByHandle(buildId: string, handle: string): Promise<RunToStartFrom | null> {
  const { data, error } = await reads
    .from("build_reproductions")
    .select("id, build_id, worked, note, model_used, profiles!build_reproductions_user_id_fkey!inner(username)")
    .eq("build_id", buildId)
    .eq("profiles.username", handle)
    .maybeSingle();
  if (error) throw new Error(`findRunByHandle failed: ${(error as { message?: string }).message ?? "unknown"}`);
  if (!data) return null;
  const row = data as RunRow;
  return { id: row.id, buildId: row.build_id, worked: row.worked, note: row.note?.trim() ?? "", model: row.model_used?.trim() || null };
}
