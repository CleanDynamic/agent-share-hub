// UX-10 P5 and P7: what the record line and the side column count, in one request (get_profile_side, 20261109120000).
//
// Every count is what the reader may see. `level` is null unless the owner shows it (level_visible) or the reader is the owner.
// A private profile the reader does not follow answers null: nothing to count.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "@/lib/build/types";

export type SpaceStanding = "created" | "moderator" | "member";

export interface ProfileSpace {
  slug: string;
  name: string;
  standing: SpaceStanding;
}

export interface ProfileSideData {
  /** What the feed holds of each kind, as the reader may see it: an empty kind's filter is hidden. */
  counts: { builds: number; topics: number; replies: number; notes: number };
  reproducedByOthers: number;
  rebuiltFrom: number;
  /** The first rebuild of their work, for the record line's link. */
  firstRebuildSlug: string | null;
  stepsAdded: number;
  topicsStarted: number;
  level: number | null;
  /** The tools and models of their published builds, most used first, up to 5. */
  worksIn: string[];
  spaces: ProfileSpace[];
}

const whole = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const STANDINGS: readonly SpaceStanding[] = ["created", "moderator", "member"];

/** The function's jsonb as the page reads it. */
export function toProfileSide(raw: unknown): ProfileSideData | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const spaces = Array.isArray(s.spaces) ? (s.spaces as Record<string, unknown>[]) : [];
  return {
    counts: { builds: whole(s.builds), topics: whole(s.topics), replies: whole(s.replies), notes: whole(s.notes) },
    reproducedByOthers: whole(s.reproduced_by_others),
    rebuiltFrom: whole(s.rebuilt_from),
    firstRebuildSlug: typeof s.first_rebuild_slug === "string" ? s.first_rebuild_slug : null,
    stepsAdded: whole(s.steps_added),
    topicsStarted: whole(s.topics_started),
    level: s.level === null || s.level === undefined ? null : whole(s.level) || null,
    worksIn: Array.isArray(s.works_in) ? (s.works_in as unknown[]).filter((tool): tool is string => typeof tool === "string").slice(0, 5) : [],
    spaces: spaces.flatMap((space) =>
      typeof space?.slug === "string" && typeof space.name === "string"
        ? [{ slug: space.slug, name: space.name, standing: STANDINGS.includes(space.standing as SpaceStanding) ? (space.standing as SpaceStanding) : "member" }]
        : [],
    ),
  };
}

type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** The record line's and the side column's counts for a profile: one request. */
export async function getProfileSide(handle: string): Promise<ProfileSideData | null> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)("get_profile_side", { p_username: handle });
  if (error) throw buildLayerError("getProfileSide", error);
  return toProfileSide(data);
}
