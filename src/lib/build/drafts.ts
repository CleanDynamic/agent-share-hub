// The Drafts page's list: a creator's drafts and how many sessions each holds.
//
// Builds and one count column only. The old Drafts.tsx reads content_items and
// content_blocks; this list reads neither, and the new page must not.
//
// session_count is newer than the generated types, so the read goes through a
// narrow cast, as getBuildFeed.ts does.

import { supabase } from "@/integrations/supabase/client";
import { listDraftBuildsByCreator } from "./builds";
import { buildLayerError } from "./types";

const DRAFTS_LIMIT = 50;

export interface DraftListItem {
  id: string;
  title: string;
  updatedAt: string;
  sessionCount: number;
}

interface CountRow {
  id: string;
  session_count: number | null;
}

interface CountQuery {
  select: (columns: string) => {
    in: (
      column: string,
      values: string[],
    ) => {
      limit: (count: number) => PromiseLike<{ data: CountRow[] | null; error: unknown }>;
    };
  };
}

/** The signed-in creator's drafts, most recently worked on first, at most fifty. */
export async function listDraftsWithSessions(): Promise<DraftListItem[]> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("listDraftsWithSessions (session)", sessionError);
  const creatorId = sessionData.session?.user?.id;
  if (!creatorId) return [];

  const drafts = await listDraftBuildsByCreator(creatorId, { limit: DRAFTS_LIMIT });
  if (drafts.length === 0) return [];

  const ids = drafts.map((draft) => draft.id);
  const { data, error } = await (supabase as unknown as { from: (t: string) => CountQuery })
    .from("builds")
    .select("id, session_count")
    .in("id", ids)
    .limit(ids.length);
  if (error) throw buildLayerError("listDraftsWithSessions (counts)", error);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.id, typeof row.session_count === "number" ? Math.max(0, row.session_count) : 0);
  }

  return drafts.map((draft) => ({
    id: draft.id,
    title: draft.title,
    updatedAt: draft.updated_at,
    sessionCount: counts.get(draft.id) ?? 0,
  }));
}
