import { supabase } from "@/integrations/supabase/client";
import { xpProgressInLevel } from "@/lib/progress";

export interface ProfileGameData {
  level: number;
  xpTotal: number;
  xpInLevel: number;
  xpForNext: number;
  progressPct: number;
  streakDays: number;
  marksCount: number;
  marks: Array<{
    id: string;
    mark_key: string;
    earned_at: string;
    pinned: boolean;
    display_order: number;
    metadata: Record<string, any>;
  }>;
  founderBadge: {
    earned_at: string;
    memberNumber: number | null;
  } | null;
}

const EMPTY: ProfileGameData = {
  level: 1,
  xpTotal: 0,
  xpInLevel: 0,
  xpForNext: 75,
  progressPct: 0,
  streakDays: 0,
  marksCount: 0,
  marks: [],
  founderBadge: null,
};

export async function getProfileGameData(userId: string): Promise<ProfileGameData> {
  if (!userId) return EMPTY;

  const [progressRes, marksRes, badgeRes] = await Promise.all([
    (supabase as any)
      .from("user_progress")
      .select("xp_total, level, streak_days")
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase as any)
      .from("creator_marks")
      .select("*")
      .eq("user_id", userId)
      .order("pinned", { ascending: false })
      .order("earned_at", { ascending: false }),
    (supabase as any)
      .from("user_badges")
      .select("earned_at, metadata, state")
      .eq("user_id", userId)
      .eq("badge_key", "founder")
      .in("state", ["earned", "revealed"])
      .maybeSingle(),
  ]);

  const xpTotal = Number(progressRes?.data?.xp_total ?? 0);
  const local = xpProgressInLevel(xpTotal);
  const level = Number(progressRes?.data?.level ?? local.level);
  const progressPct =
    local.xpForNext > 0 ? Math.min(100, (local.xpInLevel / local.xpForNext) * 100) : 0;

  const marks = (marksRes?.data ?? []) as ProfileGameData["marks"];

  let founderBadge: ProfileGameData["founderBadge"] = null;
  if (badgeRes?.data) {
    const meta = badgeRes.data.metadata ?? {};
    const memberNumber =
      typeof meta.member_number === "number"
        ? meta.member_number
        : typeof meta.memberNumber === "number"
          ? meta.memberNumber
          : null;
    founderBadge = {
      earned_at: badgeRes.data.earned_at,
      memberNumber,
    };
  }

  return {
    level,
    xpTotal,
    xpInLevel: local.xpInLevel,
    xpForNext: local.xpForNext,
    progressPct,
    streakDays: Number(progressRes?.data?.streak_days ?? 0),
    marksCount: marks.length,
    marks,
    founderBadge,
  };
}
