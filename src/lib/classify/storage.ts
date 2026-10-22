/* CA-16 P2 — reading and writing `builds.classification` and `builds.facets`.

   THE COLUMNS ARE NEWER THAN THE GENERATED TYPES, and until the CA-16 migration is applied they do not exist. The way
   CA-13 told for `patterns` is used here: a read that finds the column missing says `live: false`, a write that finds it
   missing is remembered and no more are tried this session, and neither is ever a failure of the save that called it.
   Nothing here throws for a missing column. `shape` is written through `updateBuild`, which does not need them. */

import { supabase } from "@/integrations/supabase/client";
import { updateBuild } from "@/lib/build/builds";
import type { BuildPatch, BuildShape } from "@/lib/build/types";

import { computeFacets, readClassification } from "./facets";
import type { Classification } from "./types";

/** What a read of the columns says. */
export interface StoredClassification {
  /** The columns exist. False until the CA-16 migration is applied. */
  live: boolean;
  classification: Classification;
  facets: string[];
}

export const NOT_LIVE: StoredClassification = { live: false, classification: readClassification(null), facets: [] };

let columnMissing = false;

export const isMissingColumn = (error: unknown): boolean => {
  const text = `${(error as { code?: string })?.code ?? ""} ${(error as { message?: string })?.message ?? ""} ${(error as { cause?: { code?: string } })?.cause?.code ?? ""}`;
  return /42703|PGRST204|classification|facets/.test(text);
};

interface ClassificationTable {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: { classification?: unknown; facets?: unknown } | null; error: unknown }> };
    };
  };
}

/** The stored classification of one build. `live: false` when the columns are not there yet (or the read failed). */
export async function getClassification(buildId: string): Promise<StoredClassification> {
  if (columnMissing) return NOT_LIVE;
  let answer: { data: { classification?: unknown; facets?: unknown } | null; error: unknown };
  try {
    answer = await (supabase as unknown as ClassificationTable).from("builds").select("classification, facets").eq("id", buildId).maybeSingle();
  } catch {
    return NOT_LIVE;
  }
  const { data, error } = answer;
  if (error) {
    if (isMissingColumn(error)) columnMissing = true;
    return NOT_LIVE;
  }
  return {
    live: true,
    classification: readClassification(data?.classification),
    facets: Array.isArray(data?.facets) ? (data?.facets as unknown[]).filter((value): value is string => typeof value === "string") : [],
  };
}

export interface ClassificationWrite {
  /** The classification was written. False when the columns are not live, or the write failed. */
  written: boolean;
  /** The columns are not there yet. */
  missing: boolean;
}

/**
 * Writes the classification and its `facets` (recomputed here, so they cannot disagree). With `shape`, writes that too:
 * the `shape` goes in its own update first, because it does not need the new columns, so it lands even before the
 * migration is applied.
 */
export async function writeClassification(buildId: string, classification: Classification, options: { shape?: BuildShape | null } = {}): Promise<ClassificationWrite> {
  if (options.shape) await updateBuild(buildId, { shape: options.shape } as BuildPatch);
  if (columnMissing) return { written: false, missing: true };
  try {
    await updateBuild(buildId, { classification, facets: computeFacets(classification) } as unknown as BuildPatch);
    return { written: true, missing: false };
  } catch (error) {
    if (isMissingColumn(error)) {
      columnMissing = true;
      return { written: false, missing: true };
    }
    throw error;
  }
}

/** For tests: forget that the columns were missing. */
export const resetClassificationColumns = (): void => {
  columnMissing = false;
};
