// The one search, as the browser asks for it (RC-P07).
//
// SEARCH IS THE GALLERY WITH A QUERY (CONTRACT §14). This module does not
// render or rank anything: it tidies what the reader typed and asks the
// database which builds match, in the gallery's evidence order. The gallery
// page reads the ids (RC-P10); the nav's search field and the old /search
// address both land there.
//
// ONE REQUEST PER SEARCH. search_build_ids does the matching, the ordering and
// the cap in one round trip, over builds.title, builds.outcome,
// builds.made_for, builds.made_with and the titles of the nodes placed in each
// record (supabase/migrations/20261001140000_rc_search_builds.sql). Nothing
// here queries a table.
//
// THE QUERY NEVER LEAVES IN AN ERROR ⟦neoscale-error-monitoring › Privacy⟧. A
// search query is text the reader wrote, and CONTRACT §9 keeps it out of every
// error and every log. A failure is reported by the function's name and the
// database's error code only: buildLayerError puts its cause's message into
// the message it throws, so the cause handed to it is built from the code
// alone, never from the server's own words, which could quote the input.
//
// WHY THE ROW TYPE IS HAND-WRITTEN: search_build_ids is newer than the
// generated types in src/integrations/supabase/types.ts, so the call is made
// through the same narrow cast src/lib/feed/getBuildFeed.ts uses.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";

/** A query shorter than this is no query: it would match nearly everything. */
export const SEARCH_MIN = 2;

/** The longest query the search accepts; longer input is cut to this. */
export const SEARCH_MAX = 80;

/** The most ids one search returns; the function caps at the same number. */
const SEARCH_RESULTS_MAX = 200;

/** One row of search_build_ids, exactly as the migration's RETURNS TABLE declares it. */
interface SearchBuildIdsRow {
  build_id: string;
}

/**
 * What the reader typed, tidied the way the search reads it: trimmed, every
 * run of whitespace one space, cut to SEARCH_MAX characters. Null when what is
 * left is shorter than SEARCH_MIN, which means "no query".
 */
export function normaliseQuery(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const tidied = raw.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX);
  return tidied.length < SEARCH_MIN ? null : tidied;
}

/** The error's code, and nothing the reader wrote. */
function withoutQueryText(error: unknown): { message: string } {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code ?? "")
      : "";
  return { message: code ? `code ${code}` : "no error code" };
}

/**
 * The ids of the published and gallery builds matching `query`, most
 * reproduced first, then most recently published — at most 200.
 *
 * Pass a query through normaliseQuery first; the database applies the same
 * rules again, so an untidied query is read the same way rather than refused.
 */
export async function searchBuildIds(query: string): Promise<string[]> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: SearchBuildIdsRow[] | null; error: unknown }>
  )("search_build_ids", { q: query, max_results: SEARCH_RESULTS_MAX });

  if (error) throw buildLayerError("searchBuildIds", withoutQueryText(error));

  return (data ?? []).map((row) => row.build_id);
}
