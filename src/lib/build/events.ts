// The ordered event sequence of a build: what the creator did, in the order
// they did it. Events are numbered by `ordinal` and grouped into phases.

import { supabase } from "@/integrations/supabase/client";
import {
  buildLayerError,
  DEFAULT_LIMIT,
  type BuildEvent,
  type BuildEventInsert,
  type EventVisibility,
} from "./types";

const EVENT_COLUMNS =
  "id, build_id, ordinal, occurred_at, kind, payload, phase, phase_title, visibility, produced_node_id, created_at";

export interface GetEventsOptions {
  /** Hidden events are the creator's own; off by default. */
  includeHidden?: boolean;
  limit?: number;
}

/** A target ordinal for one event in a reorder. */
export interface EventOrder {
  id: string;
  ordinal: number;
}

/**
 * A build's events by ordinal. The hidden filter is part of the query, not a
 * pass over the result, so hidden rows never cross the wire to a reader who
 * is not entitled to them.
 */
export async function getEvents(
  buildId: string,
  { includeHidden = false, limit = DEFAULT_LIMIT }: GetEventsOptions = {}
): Promise<BuildEvent[]> {
  let query = supabase
    .from("build_events")
    .select(EVENT_COLUMNS)
    .eq("build_id", buildId);

  if (!includeHidden) query = query.neq("visibility", "hidden");

  const { data, error } = await query.order("ordinal", { ascending: true }).limit(limit);
  if (error) throw buildLayerError("getEvents", error);
  return (data ?? []) as BuildEvent[];
}

/** Inserts an event, or updates it in place when the input carries an id. */
export async function upsertEvent(event: BuildEventInsert): Promise<BuildEvent> {
  const { data, error } = await supabase
    .from("build_events")
    .upsert(event, { onConflict: "id" })
    .select(EVENT_COLUMNS)
    .single();
  if (error) throw buildLayerError("upsertEvent", error);
  return data as BuildEvent;
}

/**
 * Renumbers a set of events in one batched write. Unlike node positions,
 * ordinals carry no unique index, so a single pass is safe.
 */
export async function reorderEvents(buildId: string, order: EventOrder[]): Promise<void> {
  if (order.length === 0) return;

  const ids = order.map((o) => o.id);
  const { data, error } = await supabase
    .from("build_events")
    .select("id, build_id, kind")
    .eq("build_id", buildId)
    .in("id", ids)
    .limit(order.length);
  if (error) throw buildLayerError("reorderEvents (load)", error);

  const known = new Map((data ?? []).map((row) => [row.id, row]));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    throw buildLayerError("reorderEvents", {
      message: `${missing.length} event(s) do not belong to build ${buildId}`,
    });
  }

  const rows = order.map((o) => ({ ...known.get(o.id)!, ordinal: o.ordinal }));
  const { error: writeError } = await supabase
    .from("build_events")
    .upsert(rows, { onConflict: "id" });
  if (writeError) throw buildLayerError("reorderEvents (write)", writeError);
}

/** Folds, unfolds or hides one event. */
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
