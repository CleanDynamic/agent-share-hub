import { supabase } from "@/integrations/supabase/client";

/* ─────────── Level math (75 × L^1.7) ─────────── */
/** XP threshold to enter `level`. xpForLevel(1) = 0, xpForLevel(2) = 75 × 1^1.7, etc. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(75 * Math.pow(level - 1, 1.7));
}
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.pow(xp / 75, 1 / 1.7)) + 1);
}
export function xpProgressInLevel(xp: number) {
  const level = levelFromXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    level,
    xpInLevel: Math.max(0, xp - base),
    xpForNext: Math.max(1, next - base),
  };
}

/* ─────────── Types ─────────── */
export type UserProgress = {
  user_id: string;
  xp_total: number;
  level: number;
  eligible_at: string | null;
  counters: Record<string, number>;
  quest_state: {
    steps: Record<string, boolean>;
    completed_at: string | null;
  };
  streak_days: number;
  last_active_date: string | null;
  created_at: string;
};

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
};

export type QuestStateApi = {
  steps: Record<string, boolean>;
  completed_at: string | null;
  completed: boolean;
  next_milestone: string;
};

export type DailyChallengeRow = {
  id: string;
  challenge_key: string;
  title: string;
  description: string | null;
  target: number;
  progress: number;
  xp_reward: number;
  claimed: boolean;
  expires_at: string;
};

export type XpEventRow = {
  id: string;
  amount: number;
  reason: string;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

export type CreatorMarkRow = {
  id: string;
  user_id: string;
  mark_key: string;
  earned_at: string;
  pinned: boolean;
  display_order: number;
  metadata: Record<string, any>;
};

export type ChallengeHistoryRow = {
  id: string;
  challenge_key: string;
  title: string | null;
  xp_awarded: number;
  completed_at: string;
};

/* ─────────── Reads ─────────── */
export async function getUserProgress(userId: string): Promise<UserProgress | null> {
  const { data } = await (supabase as any)
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as UserProgress | null;
}

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

export async function getQuestState(userId: string): Promise<QuestStateApi> {
  const { data } = await (supabase as any).rpc("get_quest_state", { _user_id: userId });
  return (data ?? {
    steps: {},
    completed_at: null,
    completed: false,
    next_milestone: "Reach Level 2",
  }) as QuestStateApi;
}

export async function getChallenges(userId: string): Promise<DailyChallengeRow[]> {
  // Auto-seed today's challenge row if none active
  const { data: existing } = await (supabase as any)
    .from("daily_challenges")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (existing && existing.length > 0) return existing as DailyChallengeRow[];

  // Seed a default daily nudge (client-side, RLS allows owner insert via service? no)
  // Use a safe INSERT scoped to the current user via RLS — we need an INSERT policy.
  // Fallback: return an in-memory stub if insert isn't allowed.
  try {
    const { data: inserted } = await (supabase as any)
      .from("daily_challenges")
      .insert({
        user_id: userId,
        challenge_key: "daily_save",
        title: "Save a Blueprint",
        description: "Bookmark something that inspires you today.",
        target: 1,
        progress: 0,
        xp_reward: 10,
      } as any)
      .select()
      .single();
    return inserted ? [inserted as DailyChallengeRow] : [];
  } catch {
    return [];
  }
}

export async function getXpEvents(userId: string, limit = 50, before?: string) {
  let q = (supabase as any)
    .from("xp_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data } = await q;
  return (data ?? []) as XpEventRow[];
}

export async function getCreatorMarks(userId: string) {
  const { data } = await (supabase as any)
    .from("creator_marks")
    .select("*")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  return (data ?? []) as CreatorMarkRow[];
}

export async function getChallengeHistory(userId: string, limit = 50) {
  const { data } = await (supabase as any)
    .from("challenge_history")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ChallengeHistoryRow[];
}

/* ─────────── Mutations ─────────── */
export async function claimChallenge(challengeId: string) {
  const { data, error } = await (supabase as any).rpc("claim_challenge", { _challenge_id: challengeId });
  if (error) throw error;
  return data as {
    xp_total: number;
    level: number;
    leveled_up: boolean;
    eligible_at: string | null;
    awarded: number;
  };
}

export async function awardXp(opts: {
  userId: string;
  amount: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  metadata?: Record<string, any>;
}) {
  const { data, error } = await (supabase as any).rpc("award_xp", {
    _user_id: opts.userId,
    _amount: opts.amount,
    _reason: opts.reason,
    _source_type: opts.sourceType ?? null,
    _source_id: opts.sourceId ?? null,
    _metadata: opts.metadata ?? {},
  });
  if (error) throw error;
  return data as any;
}
