// build_events: the ordered sequence of what actually happened while the build
// was made. Ordinals are dense and 1-based; visibility decides how much of the
// sequence a reader sees by default.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  type BuildEvent,
  type BuildEventInsert,
  type EventVisibility,
} from "./types";

export const EVENT_COLUMNS =
  "id, build_id, ordinal, occurred_at, kind, payload, phase, phase_title, visibility, produced_node_id, created_at";

/** A build with more events than this has a capture problem, not a page. */
const EVENT_LIMIT = 2000;

export interface GetEventsOptions {
  /** Include events the creator has hidden. Defaults to false. */
  includeHidden?: boolean;
}

export interface EventMove {
  id: string;
  ordinal: number;
}

/**
 * The event sequence for a build, in ordinal order.
 *
 * When includeHidden is false — the default — hidden events are excluded by
 * the query. They never cross the wire, so a consumer cannot leak them by
 * forgetting to filter.
 */
export async function getEvents(
  buildId: string,
  { includeHidden = false }: GetEventsOptions = {}
): Promise<BuildEvent[]> {
  let query = supabase
    .from("build_events")
    .select(EVENT_COLUMNS)
    .eq("build_id", buildId);

  if (!includeHidden) query = query.neq("visibility", "hidden");

  const { data, error } = await query
    .order("ordinal", { ascending: true })
    .limit(EVENT_LIMIT);

  if (error) throw buildLayerError("getEvents", error);
  return (data ?? []) as BuildEvent[];
}

/** Insert or update one event. Pass `id` to update, omit it to insert. */
export async function upsertEvent(
  event: BuildEventInsert
): Promise<BuildEvent> {
  const { data, error } = await supabase
    .from("build_events")
    .upsert(event, { onConflict: "id" })
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw buildLayerError("upsertEvent", error);
  return data as BuildEvent;
}

/**
 * Renumber a set of events in one batched write.
 *
 * build_events has no unique index on ordinal, so unlike reorderNodes this
 * needs no parking pass — one read to satisfy the NOT NULL columns PostgREST
 * requires on an upsert, then one write.
 */
export async function reorderEvents(
  buildId: string,
  moves: EventMove[]
): Promise<void> {
  if (moves.length === 0) return;

  const ids = moves.map((m) => m.id);
  const { data, error } = await supabase
    .from("build_events")
    .select(EVENT_COLUMNS)
    .eq("build_id", buildId)
    .in("id", ids)
    .limit(EVENT_LIMIT);

  if (error) throw buildLayerError("reorderEvents (read)", error);

  const existing = new Map(
    (data as BuildEvent[] | null ?? []).map((e) => [e.id, e])
  );
  const missing = ids.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    throw buildLayerError(
      "reorderEvents",
      new Error(`events not found in build ${buildId}: ${missing.join(", ")}`)
    );
  }

  const rows = moves.map((move) => ({
    ...(existing.get(move.id) as BuildEvent),
    ordinal: move.ordinal,
  }));

  const { error: writeError } = await supabase
    .from("build_events")
    .upsert(rows, { onConflict: "id" });
  if (writeError) throw buildLayerError("reorderEvents (write)", writeError);
}

/** Move one event between kept, folded and hidden. */
export async function setEventVisibility(
  id: string,
  visibility: EventVisibility
): Promise<BuildEvent> {
  const { data, error } = await supabase
    .from("build_events")
    .update({ visibility })
    .eq("id", id)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw buildLayerError("setEventVisibility", error);
  return data as BuildEvent;
}
