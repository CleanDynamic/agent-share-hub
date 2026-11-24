import { supabase } from "@/integrations/supabase/client";

/* ─────────── Types ─────────── */
export type TrackId = "architect" | "curator" | "mentor" | "explorer";

export type VisibleSurfaces = {
  tabs: string[];
  eligibility_notice: boolean;
  quest: boolean;
  daily_nudge: boolean;
  next_unlock: boolean;
  engagement_grid: boolean;
  empty_state: boolean;
  marks_row: boolean;
  showcase: boolean;
  ledger: boolean;
  depth_revealed?: boolean;
  depth_revealed_at?: string | null;
  skill_tree_isnew?: boolean;
  challenges_isnew?: boolean;
  track?: TrackId | null;
  last_respec_at?: string | null;
};

export type PerkRow = {
  slug: string;
  track: TrackId;
  tier: number;
  effect_key: string;
  name: string;
  description: string;
  icon_name: string;
};

export type UserPerkRow = { perk_slug: string; earned_at: string };
export type StreakDayRow = { date: string; kind: "active" | "frozen" };

export type CreatorMarkRow = {
  id: string;
  user_id: string;
  mark_key: string;
  earned_at: string;
  pinned: boolean;
  display_order: number;
  metadata: Record<string, any>;
};

/* ─────────── Reads ─────────── */

export async function getVisibleSurfaces(userId: string): Promise<VisibleSurfaces> {
  const { data } = await (supabase as any).rpc("get_visible_surfaces", { _user_id: userId });
  return (data ?? {
    tabs: ["overview", "trophies", "history"],
    eligibility_notice: true,
    quest: true,
    daily_nudge: true,
    next_unlock: true,
    engagement_grid: false,
    empty_state: true,
    marks_row: true,
    showcase: true,
    ledger: true,
  }) as VisibleSurfaces;
}

/** UI-P40: every list read is bounded. Far above any real reader's count of these rows. */
const LIST_CAP = 200;

export async function getCreatorMarks(userId: string) {
  const { data } = await (supabase as any)
    .from("creator_marks")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .limit(LIST_CAP);
  return (data ?? []) as CreatorMarkRow[];
}

/* ─────────── Mutations ─────────── */
/* ─────────── Depth reveal + tracks + perks ─────────── */
export async function markDepthRevealed(): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc("mark_depth_revealed");
  if (error) throw error;
  return data as string | null;
}

export async function setUserTrack(track: TrackId) {
  const { error } = await (supabase as any).rpc("set_user_track", { _track: track });
  if (error) throw error;
}

export async function respecTrack(track: TrackId) {
  const { data, error } = await (supabase as any).rpc("respec_track", { _track: track });
  if (error) throw error;
  return data as string;
}

export async function getPerksCatalogue(): Promise<PerkRow[]> {
  const { data } = await (supabase as any)
    .from("perks")
    .select("*")
    .eq("is_active", true)
    .limit(LIST_CAP);
  return (data ?? []) as PerkRow[];
}

export async function getUserPerks(userId: string): Promise<UserPerkRow[]> {
  const { data } = await (supabase as any)
    .from("user_perks")
    .select("perk_slug, earned_at")
    .eq("user_id", userId)
    .limit(LIST_CAP);
  return (data ?? []) as UserPerkRow[];
}

export async function getStreakDays(userId: string, sinceDays = 60): Promise<StreakDayRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - sinceDays);
  const { data } = await (supabase as any)
    .from("streak_days")
    .select("date, kind")
    .eq("user_id", userId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true })
    // A day can carry more than one kind; the window bounds the rest.
    .limit((sinceDays + 1) * 4);
  return (data ?? []) as StreakDayRow[];
}

export async function recordDailyActivity() {
  const { data, error } = await (supabase as any).rpc("record_daily_activity");
  if (error) throw error;
  return data as { changed: boolean; streak_current: number; milestone: number | null };
}

export async function getPendingRevealBadges(userId: string) {
  const { data } = await (supabase as any)
    .from("user_badges")
    .select("id, badge_key, title, description, metadata")
    .eq("user_id", userId)
    .eq("state", "pending_reveal")
    .limit(LIST_CAP);
  return (data ?? []) as Array<{
    id: string; badge_key: string; title: string | null;
    description: string | null; metadata: Record<string, any>;
  }>;
}
