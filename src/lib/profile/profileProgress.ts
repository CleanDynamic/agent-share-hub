// A maker's track and streak, for the Profile's Your progress section (UI-P34a).
//
// WHO CAN READ WHAT. `user_progress` is readable by its owner (migrations
// 20260612120000 and 20260629162842), so on the reader's own profile the row
// is there and every figure is real. On anyone else's it comes back empty under
// row-level security; the track is then read from `get_visible_surfaces(_user_id)`,
// the one security-definer function that answers it for another person, and the
// streak and the respec date are unknown (zeros), which the page draws as "no
// figure" rather than as a start at nothing.
//
// ERRORS CARRY IDENTIFIERS ONLY, with the code and status isPermissionError
// reads, as every progress read does (progressFailure).

import { supabase } from "@/integrations/supabase/client";
import { type TrackId } from "@/lib/progress";
import { progressFailure } from "@/lib/progress/errors";

/** What Your progress shows for one maker. */
export interface ProfileProgress {
  /** Null when no track has been chosen, or it cannot be read. */
  track: TrackId | null;
  streakDays: number;
  streakBest: number;
  /** When they last switched track; null when never, or unknown. */
  lastRespecAt: string | null;
}

const TRACKS: readonly TrackId[] = ["architect", "curator", "mentor", "explorer"];

/** `value` as a track, or null for anything that is not one of the four. */
export function asTrack(value: unknown): TrackId | null {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value) ? (value as TrackId) : null;
}

/** A count as a whole number; zero for anything that is not one. */
function whole(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

interface ProgressRow {
  track: string | null;
  streak_days: number | null;
  streak_best: number | null;
  last_respec_at: string | null;
}

interface SurfacesAnswer {
  track?: string | null;
}

/**
 * The maker's progress: their own row when the reader may read it, else the
 * track the visible-surfaces function gives for anyone.
 */
export async function getProfileProgress(userId: string): Promise<ProfileProgress> {
  const row = await supabase
    .from("user_progress")
    .select("track, streak_days, streak_best, last_respec_at")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (row.error) throw progressFailure("getProfileProgress", userId, row);

  if (row.data) {
    const data = row.data as unknown as ProgressRow;
    return {
      track: asTrack(data.track),
      streakDays: whole(data.streak_days),
      streakBest: whole(data.streak_best),
      lastRespecAt: data.last_respec_at ?? null,
    };
  }

  const surfaces = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: SurfacesAnswer | null; error: unknown; status?: number }>
  )("get_visible_surfaces", { _user_id: userId });
  if (surfaces.error) throw progressFailure("getProfileProgress (surfaces)", userId, surfaces);

  return {
    track: asTrack(surfaces.data?.track),
    streakDays: 0,
    streakBest: 0,
    lastRespecAt: null,
  };
}
