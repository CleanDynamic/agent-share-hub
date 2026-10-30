// SV-23: the one-off backfill. Every build whose `step_count` is still null (nobody has saved it since the counts existed) is counted
// with the composer's own functions and written. It writes only the counts that differ, so running it again is safe. Admins
// only: the builds update policy lets an admin write any build, and the page that runs this is behind AdminRoute.

import { supabase } from "@/integrations/supabase/client";

import { countsToWrite } from "./buildCounts";
import { updateBuild } from "./builds";
import { storedCountsOfBuild } from "./buildCountsWrite";
import type { BuildPatch } from "./types";

export const BACKFILL_BATCH = 20;
const READ_LIMIT = 200;

export interface BackfillRow {
  id: string;
  making: unknown;
  step_count: number | null;
  part_count: number | null;
  agent_count: number | null;
  session_count: number | null;
}

export type BackfillOutcome = { id: string; result: "done" } | { id: string; result: "skipped" | "failed"; reason: string };

export interface BackfillSummary {
  done: number;
  skipped: { id: string; reason: string }[];
  failed: { id: string; reason: string }[];
}

const COLUMNS = "id, making, step_count, part_count, agent_count, session_count";

interface ReadQuery extends PromiseLike<{ data: unknown; error: { message?: string } | null }> {
  is: (column: string, value: null) => ReadQuery;
  gt: (column: string, value: string) => ReadQuery;
  order: (column: string, options: { ascending: boolean }) => ReadQuery;
  limit: (count: number) => ReadQuery;
}

/** The next builds with no step count, after `after` (the last id read, so a build that is skipped is not read again). */
export async function readUncounted(after: string | null): Promise<BackfillRow[]> {
  let query = (supabase as unknown as { from: (table: string) => { select: (columns: string) => ReadQuery } }).from("builds").select(COLUMNS).is("step_count", null);
  if (after) query = query.gt("id", after);
  const { data, error } = await query.order("id", { ascending: true }).limit(READ_LIMIT);
  if (error) throw new Error(error.message ?? "builds not read");
  return (data ?? []) as BackfillRow[];
}

/** Count one build and write what differs. */
export async function backfillOne(row: BackfillRow): Promise<BackfillOutcome> {
  try {
    const counts = await storedCountsOfBuild(row.id, row.making);
    const patch = countsToWrite(counts, row);
    if (!patch) return { id: row.id, result: "skipped", reason: "nothing to write: an empty build with no count yet, or counts as stored" };
    await updateBuild(row.id, patch as unknown as BuildPatch);
    return { id: row.id, result: "done" };
  } catch (error) {
    return { id: row.id, result: "failed", reason: (error as { message?: string })?.message ?? "not written" };
  }
}

/** Run the whole backfill, a batch at a time. `onProgress` is called after each batch with the totals so far. */
export async function backfillCounts(onProgress: (summary: BackfillSummary) => void, stop: () => boolean = () => false): Promise<BackfillSummary> {
  const summary: BackfillSummary = { done: 0, skipped: [], failed: [] };
  let after: string | null = null;
  for (;;) {
    const page = await readUncounted(after);
    if (page.length === 0) break;
    after = page[page.length - 1].id;
    for (let at = 0; at < page.length; at += BACKFILL_BATCH) {
      if (stop()) return summary;
      for (const outcome of await Promise.all(page.slice(at, at + BACKFILL_BATCH).map(backfillOne))) {
        if (outcome.result === "done") summary.done += 1;
        else if (outcome.result === "skipped") summary.skipped.push({ id: outcome.id, reason: outcome.reason });
        else summary.failed.push({ id: outcome.id, reason: outcome.reason });
      }
      onProgress({ done: summary.done, skipped: [...summary.skipped], failed: [...summary.failed] });
    }
    if (page.length < READ_LIMIT) break;
  }
  return summary;
}
