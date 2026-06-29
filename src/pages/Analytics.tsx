import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { Sparkles, Zap } from "lucide-react";
import { useProgress, useXpEvents, useClaimChallenge } from "@/hooks/useProgress";
import { useUploadPicker } from "@/contexts/UploadPickerContext";
import { toast } from "@/hooks/use-toast";


// Progress UI
import ProgressTabBar from "@/components/progress/ProgressTabBar";
import { ProgressHero } from "@/components/progress/ProgressHero";
import { SectionHeader } from "@/components/progress/SectionHeader";
import { EngagementGrid } from "@/components/progress/EngagementGrid";
import { NextUnlockCard } from "@/components/progress/NextUnlockCard";
import { EmptyProgressState } from "@/components/progress/EmptyProgressState";
import EligibilityNotice from "@/components/progress/xp-kit/eligibility-notice";
import XpLedger, { type XpLedgerEntry } from "@/components/progress/xp-kit/xp-ledger";

// Quest + challenges
import QuestChecklist from "@/components/challenges/quest/quest-checklist";
import DailyNudgeCard from "@/components/challenges/quest/daily-nudge-card";
import ChallengeHistoryRow from "@/components/challenges/quest/challenge-history-row";

// Trophies
import { CreatorMarksRow } from "@/components/trophies/creator-marks-row";
import { ShowcaseStrip } from "@/components/trophies/showcase-strip";
import { creatorMarks as creatorMarksCatalog, cabinetBadges } from "@/components/trophies/badge-data";

// Streaks
import StreakFlame from "@/components/streaks/streak-flame";
import StreakInlineNote from "@/components/streaks/streak-inline-note";
import StreakCalendar from "@/components/streaks/streak-calendar";
import FreezeIndicator from "@/components/streaks/freeze-indicator";

// L2 tabs
import SkillTreeTab from "@/components/progress/SkillTreeTab";
import ChallengesTab from "@/components/progress/ChallengesTab";
import { useStreakDays } from "@/hooks/useProgress";


const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  skill_tree: "Skill tree",
  trophies: "Trophies",
  challenges: "Challenges",
  history: "History",
};

export default function Analytics() {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const { progress, surfaces, quest, challenges, marks, xpInLevel, xpForNext, level, isLoading } = useProgress();
  const streakDaysQ = useStreakDays(60);
  const [xpEventsQ, historyQ] = useXpEvents(50);
  const claim = useClaimChallenge();
  const navigate = useNavigate();
  const { openUploadTypePicker } = useUploadPicker();

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Skeleton className="h-8 w-48" /></div>;
  }
  if (!user) return null;

  const tabs = (surfaces?.tabs ?? ["overview", "trophies", "history"]).map((id) => ({
    id,
    label: TAB_LABELS[id] ?? id,
    isNew:
      (id === "skill_tree" && !!surfaces?.skill_tree_isnew) ||
      (id === "challenges" && !!surfaces?.challenges_isnew),
  }));

  const initials = (profile?.display_name || profile?.username || user.email || "?").slice(0, 2).toUpperCase();
  const displayName = profile?.display_name || profile?.username || "You";

  // Map server marks to creatorMarks catalog entries for the row
  const enrichedMarks = useMemo(() => {
    const earnedKeys = new Set((marks ?? []).map((m) => m.mark_key));
    return creatorMarksCatalog.map((m) => ({
      ...m,
      earnedDate: earnedKeys.has(m.id) ? "Earned" : undefined,
    }));
  }, [marks]);

  const heroMarks = useMemo(
    () =>
      (marks ?? []).slice(0, 3).map((m) => ({
        id: m.id,
        name: creatorMarksCatalog.find((c) => c.id === m.mark_key)?.name ?? m.mark_key,
      })),
    [marks]
  );

  // Build quest steps from server state
  const QUEST_DEF: { id: string; label: string; xp: number }[] = [
    { id: "verify-email", label: "Verify your email", xp: 10 },
    { id: "complete-profile", label: "Complete your profile", xp: 15 },
    { id: "save-posts", label: "Save your first blueprint", xp: 10 },
    { id: "first-comment", label: "Leave a comment", xp: 10 },
    { id: "publish-draft", label: "Publish your first post", xp: 30 },
    { id: "todays-nudge", label: "Complete today's nudge", xp: 10 },
    { id: "come-back", label: "Come back tomorrow", xp: 10 },
  ];
  // map server keys (first-save, first-publish, first-nudge, return-tomorrow) to UI ids
  const serverKeyAlias: Record<string, string> = {
    "save-posts": "first-save",
    "publish-draft": "first-publish",
    "todays-nudge": "first-nudge",
    "come-back": "return-tomorrow",
  };
  const questSteps = QUEST_DEF.map((s) => {
    const serverKey = serverKeyAlias[s.id] ?? s.id;
    const done = !!quest?.steps?.[serverKey];
    return { ...s, status: (done ? "completed" : "active") as "completed" | "active" | "future" };
  });

  const handleQuestGo = (step: { id: string }) => {
    switch (step.id) {
      case "verify-email":
        supabase.auth.resend({ type: "signup", email: user.email! } as any).then(() => {
          toast({ title: "Verification email sent" });
        }).catch(() => toast({ title: "Could not resend", variant: "destructive" }));
        break;
      case "complete-profile":
        navigate("/profile");
        break;
      case "save-posts":
      case "first-comment":
        navigate("/discover");
        break;
      case "publish-draft":
        openUploadTypePicker();
        break;
      case "todays-nudge": {
        const el = document.getElementById("daily-nudge-anchor");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
      case "come-back":
      default:
        break;
    }
  };

  const todayChallenge = challenges[0];
  const challengeState: "go" | "claimable" | "claimed" = todayChallenge
    ? todayChallenge.claimed
      ? "claimed"
      : todayChallenge.progress >= todayChallenge.target
      ? "claimable"
      : "go"
    : "go";

  const xpEvents: XpLedgerEntry[] = (xpEventsQ.data ?? []).map((e: any) => ({
    id: e.id,
    icon: Zap,
    action: humanizeReason(e.reason),
    sourceLabel: e.metadata?.title,
    xp: e.amount,
    timestamp: new Date(e.created_at),
  }));

  const showcaseAuto = cabinetBadges.filter((b) => b.earned).slice(0, 5);

  const overviewSurfaces = surfaces ?? {
    eligibility_notice: true,
    quest: true,
    daily_nudge: true,
    next_unlock: true,
    engagement_grid: false,
    empty_state: true,
  };

  return (
    <>
      <SeoHead title="Your Progress — NeoScale AI" description="Track your XP, quests, and creator marks." path="/analytics" />
      <ShellHeader title="Your Progress" />
      <div
        className="mx-auto"
        style={{
          maxWidth: 760,
          padding: "16px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <ProgressTabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === "overview" && (
          <>
            {overviewSurfaces.eligibility_notice && (
              <EligibilityNotice
                isVerified={!!user.email_confirmed_at}
                hoursRemaining={Math.max(0, 48 - Math.floor(((Date.now() - new Date(progress?.created_at ?? Date.now()).getTime()) / 3_600_000)))}
                onVerifyClick={() => handleQuestGo({ id: "verify-email" })}
              />
            )}

            <ProgressHero
              name={displayName}
              avatarUrl={profile?.avatar_url ?? undefined}
              initials={initials}
              level={level}
              xpInLevel={xpInLevel}
              xpForNext={xpForNext}
              marks={heroMarks}
              rightSlot={
                <>
                  <StreakFlame streak={progress?.streak_days ?? 0} state={(progress?.streak_days ?? 0) > 0 ? "active" : "zero"} />
                  <StreakInlineNote />
                </>
              }
            />

            {surfaces?.depth_revealed && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FreezeIndicator
                  available={Math.max(0, 2 - ((progress as any)?.freezes_used_month ?? 0))}
                  total={2}
                />
                <StreakCalendar
                  days={(streakDaysQ.data ?? []).map((d) => ({
                    date: d.date,
                    level: d.kind === "frozen" ? 0 : 3,
                    frozen: d.kind === "frozen",
                  }))}
                />
              </div>
            )}

            {overviewSurfaces.quest && (
              <QuestChecklist
                steps={questSteps as any}
                onGo={handleQuestGo as any}
              />
            )}

            <div id="daily-nudge-anchor">
              {overviewSurfaces.daily_nudge && todayChallenge && (
                <DailyNudgeCard
                  challenge={{
                    id: todayChallenge.id,
                    title: todayChallenge.title,
                    description: todayChallenge.description ?? undefined,
                    xp: todayChallenge.xp_reward,
                    state: challengeState,
                  } as any}
                  state={challengeState}
                  onClaim={() => claim.mutate(todayChallenge.id)}
                />
              )}
            </div>

            {overviewSurfaces.next_unlock && (
              <NextUnlockCard
                milestoneLabel={quest?.next_milestone}
                isMysterious={!!quest?.completed && level < 5}
              />
            )}

            {overviewSurfaces.empty_state ? (
              <EmptyProgressState />
            ) : (
              <EngagementGrid counters={progress?.counters ?? {}} />
            )}

          </>
        )}

        {activeTab === "skill_tree" && (
          <SkillTreeTab progress={progress} surfaces={surfaces} />
        )}

        {activeTab === "challenges" && (
          <ChallengesTab
            challenges={challenges}
            history={historyQ.data ?? []}
            hasNew={!!surfaces?.challenges_isnew}
          />
        )}

        {activeTab === "trophies" && (
          <>
            <CreatorMarksRow marks={enrichedMarks as any} />
            <ShowcaseStrip badges={showcaseAuto} autoPinned isOwnProfile />
          </>
        )}

        {activeTab === "history" && (
          <>
            <SectionHeader title="XP ledger" />
            <XpLedger
              entries={xpEvents}
              onLoadMore={() => xpEventsQ.refetch()}
            />
            <SectionHeader title="Challenges completed" />
            <div style={{ background: "rgba(52,52,66,0.45)", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.10)", overflow: "hidden" }}>
              {(historyQ.data ?? []).length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                  No challenges claimed yet.
                </div>
              ) : (
                (historyQ.data ?? []).map((h: any) => (
                  <ChallengeHistoryRow
                    key={h.id}
                    entry={{
                      id: h.id,
                      title: h.title ?? h.challenge_key,
                      xp: h.xp_awarded,
                      completedAt: h.completed_at,
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function humanizeReason(reason: string): string {
  if (reason.startsWith("challenge:")) return "Challenge claimed";
  return reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
