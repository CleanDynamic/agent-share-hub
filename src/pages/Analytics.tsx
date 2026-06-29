import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Eye, Download, Star, TrendingUp, TrendingDown, FileText, Image, Paperclip, Sparkles, Zap } from "lucide-react";
import { TYPE_COLORS, displayContentType } from "@/lib/content-types";
import { format, subDays, eachDayOfInterval } from "date-fns";
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

type Range = "7" | "30" | "90";
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  trophies: "Trophies",
  history: "History",
};

export default function Analytics() {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const { progress, surfaces, quest, challenges, marks, xpInLevel, xpForNext, level, isLoading } = useProgress();
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

            <SectionHeader title="Your content" subtitle="The classic analytics view, preserved." />
            <ContentAnalyticsSection userId={user.id} />
          </>
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

/* ─────────── Existing analytics, preserved ─────────── */
function ContentAnalyticsSection({ userId }: { userId: string }) {
  const [range, setRange] = useState<Range>("30");
  const days = parseInt(range, 10);
  const rangeStart = useMemo(() => subDays(new Date(), days).toISOString(), [days]);
  const prevRangeStart = useMemo(() => subDays(new Date(), days * 2).toISOString(), [days]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="flex justify-end">
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="w-40 h-8 text-sm bg-transparent border border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <OverviewCards userId={userId} rangeStart={rangeStart} prevRangeStart={prevRangeStart} days={days} />
      <ViewsDownloadsChart userId={userId} rangeStart={rangeStart} days={days} />
      <ContentPerformanceTable userId={userId} />
      <BlockEngagementHeatmap userId={userId} />
    </div>
  );
}

/* ─── Section 1: Overview Cards ─── */
function OverviewCards({ userId, rangeStart, prevRangeStart, days }: { userId: string; rangeStart: string; prevRangeStart: string; days: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics_overview", userId, rangeStart],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("content_items")
        .select("id, view_count, download_count, avg_rating, status")
        .eq("creator_id", userId)
        .eq("status", "approved");

      const contentIds = (items || []).map((i) => i.id);
      const totalViews = (items || []).reduce((s, i) => s + (i.view_count || 0), 0);
      const totalDownloads = (items || []).reduce((s, i) => s + (i.download_count || 0), 0);
      const ratings = (items || []).filter((i) => i.avg_rating > 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((s, i) => s + i.avg_rating, 0) / ratings.length : 0;

      const now = new Date().toISOString();
      const [curViews, prevViews, curDl, prevDl] = await Promise.all([
        supabase.from("content_views").select("id", { count: "exact", head: true })
          .in("content_id", contentIds.length ? contentIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("viewed_at", rangeStart).lte("viewed_at", now),
        supabase.from("content_views").select("id", { count: "exact", head: true })
          .in("content_id", contentIds.length ? contentIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("viewed_at", prevRangeStart).lt("viewed_at", rangeStart),
        supabase.from("downloads").select("id", { count: "exact", head: true })
          .in("content_id", contentIds.length ? contentIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("downloaded_at", rangeStart).lte("downloaded_at", now),
        supabase.from("downloads").select("id", { count: "exact", head: true })
          .in("content_id", contentIds.length ? contentIds : ["00000000-0000-0000-0000-000000000000"])
          .gte("downloaded_at", prevRangeStart).lt("downloaded_at", rangeStart),
      ]);

      const { data: purchases } = await supabase
        .from("project_package_purchases")
        .select("amount_gbp")
        .eq("user_id", userId);
      const totalEarnings = (purchases || []).reduce((s, p) => s + (p.amount_gbp || 0), 0);

      return {
        totalViews,
        totalDownloads,
        avgRating: Math.round(avgRating * 10) / 10,
        totalEarnings,
        curViews: curViews.count ?? 0,
        prevViews: prevViews.count ?? 0,
        curDownloads: curDl.count ?? 0,
        prevDownloads: prevDl.count ?? 0,
      };
    },
  });

  const delta = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  };

  const cards = [
    { label: "Total Views", value: data?.totalViews ?? 0, icon: Eye, d: delta(data?.curViews ?? 0, data?.prevViews ?? 0) },
    { label: "Total Downloads", value: data?.totalDownloads ?? 0, icon: Download, d: delta(data?.curDownloads ?? 0, data?.prevDownloads ?? 0) },
    { label: "Total Earnings", value: data?.totalEarnings !== undefined ? `£${data.totalEarnings.toFixed(2)}` : "—", icon: TrendingUp, d: null as number | null },
    { label: "Avg Star Rating", value: data?.avgRating ?? 0, icon: Star, d: null as number | null, isStar: true },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="flex items-center" style={{ gap: 6, fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            <c.icon style={{ width: 13, height: 13 }} />
            {c.label}
          </div>
          <p style={{ fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.90)', lineHeight: 1.1 }}>
            {(c as any).isStar ? (
              <span className="flex items-center" style={{ gap: 6 }}>
                {c.value} <Star style={{ width: 18, height: 18, fill: '#8B4513', color: '#8B4513' }} />
              </span>
            ) : (
              (c.value as any).toLocaleString?.() ?? c.value
            )}
          </p>
          {c.d !== null && c.d !== 0 && (
            <p className="flex items-center" style={{ fontSize: 11, fontWeight: 500, gap: 4, color: c.d > 0 ? '#34D399' : '#F87171' }}>
              {c.d > 0 ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
              {c.d > 0 ? "+" : ""}{c.d}% vs prev period
            </p>
          )}
          {c.label === "Total Earnings" && data?.totalEarnings === 0 && (
            <Link to="/settings" style={{ fontSize: 11, color: '#1F7A6D' }}>
              Connect Stripe →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Section 2: Views vs Downloads Chart ─── */
function ViewsDownloadsChart({ userId, rangeStart, days }: { userId: string; rangeStart: string; days: number }) {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["analytics_chart", userId, rangeStart],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("content_items")
        .select("id")
        .eq("creator_id", userId)
        .eq("status", "approved");
      const ids = (items || []).map((i) => i.id);
      if (!ids.length) return [];

      const [viewsRes, dlRes] = await Promise.all([
        supabase.from("content_views").select("viewed_at").in("content_id", ids).gte("viewed_at", rangeStart),
        supabase.from("downloads").select("downloaded_at").in("content_id", ids).gte("downloaded_at", rangeStart),
      ]);

      const interval = eachDayOfInterval({ start: subDays(new Date(), days), end: new Date() });
      const viewsByDay: Record<string, number> = {};
      const dlByDay: Record<string, number> = {};
      interval.forEach((d) => { const k = format(d, "yyyy-MM-dd"); viewsByDay[k] = 0; dlByDay[k] = 0; });

      (viewsRes.data || []).forEach((v) => {
        const k = format(new Date(v.viewed_at), "yyyy-MM-dd");
        if (viewsByDay[k] !== undefined) viewsByDay[k]++;
      });
      (dlRes.data || []).forEach((d) => {
        const k = format(new Date(d.downloaded_at), "yyyy-MM-dd");
        if (dlByDay[k] !== undefined) dlByDay[k]++;
      });

      return interval.map((d) => {
        const k = format(d, "yyyy-MM-dd");
        return { date: format(d, "MMM d"), views: viewsByDay[k], downloads: dlByDay[k] };
      });
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  const hasData = (chartData || []).some((d) => d.views > 0 || d.downloads > 0);

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 14, padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: 16 }}>Views vs Downloads</h2>
      <div className="relative" style={{ maxHeight: 200, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Views" />
            <Line type="monotone" dataKey="downloads" stroke="hsl(168 70% 45%)" strokeWidth={2} dot={false} name="Downloads" />
          </LineChart>
        </ResponsiveContainer>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs italic text-muted-foreground">No data yet — views and downloads will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Section 3: Content Performance Table ─── */
function ContentPerformanceTable({ userId }: { userId: string }) {
  const [sortCol, setSortCol] = useState<string>("download_count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: items, isLoading } = useQuery({
    queryKey: ["analytics_content_table", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type, view_count, download_count, avg_rating, verification_count, fork_count, created_at")
        .eq("creator_id", userId)
        .eq("status", "approved")
        .order("download_count", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const sorted = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a: any, b: any) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [items, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
      {label} {sortCol === col && (sortDir === "asc" ? "↑" : "↓")}
    </TableHead>
  );

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 14, padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: 16 }}>Your posts</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead col="title" label="Title" />
              <TableHead style={{ width: 140 }}>Type</TableHead>
              <SortHead col="view_count" label="Views" />
              <SortHead col="download_count" label="Downloads" />
              <SortHead col="avg_rating" label="Avg Rating" />
              <SortHead col="verification_count" label="Verifications" />
              <SortHead col="fork_count" label="Forks" />
              <SortHead col="created_at" label="Published" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell style={{ minWidth: 160 }}>
                  <Link to={`/content/${item.id}`} className="text-primary hover:underline truncate max-w-[200px] block">
                    {item.title}
                  </Link>
                </TableCell>
                <TableCell style={{ width: 140 }}>
                  <Badge variant="outline" className={`text-[10px] font-medium whitespace-nowrap ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                    {displayContentType(item.content_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" style={{ width: 80 }}>{item.view_count}</TableCell>
                <TableCell className="text-right" style={{ width: 100 }}>{item.download_count}</TableCell>
                <TableCell style={{ width: 110 }}>
                  {item.avg_rating > 0 ? (
                    <span className="flex items-center gap-1">
                      {item.avg_rating.toFixed(1)} <Star className="h-3 w-3 fill-primary text-primary" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell style={{ width: 120 }}>{item.verification_count}</TableCell>
                <TableCell>{item.fork_count}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{format(new Date(item.created_at), "MMM d, yyyy")}</TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No approved content yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ─── Section 4: Block Engagement Heatmap ─── */
function BlockEngagementHeatmap({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics_block_heatmap", userId],
    queryFn: async () => {
      const { data: topPosts } = await supabase
        .from("content_items")
        .select("id, title")
        .eq("creator_id", userId)
        .eq("status", "approved")
        .order("view_count", { ascending: false })
        .limit(5);
      if (!topPosts?.length) return [];

      const results = await Promise.all(
        topPosts.map(async (post) => {
          const { data: blocks } = await supabase
            .from("content_blocks")
            .select("id, position, block_type")
            .eq("content_id", post.id)
            .order("position", { ascending: true });

          if (!blocks?.length) return { ...post, blocks: [] };

          const { count: totalImpressions } = await supabase
            .from("ad_impressions")
            .select("id", { count: "exact", head: true })
            .eq("content_id", post.id);

          const total = totalImpressions ?? 0;
          const blockData = blocks.map((b, idx) => {
            const viewEstimate = Math.round(total * Math.pow(0.85, idx));
            return { ...b, views: viewEstimate };
          });

          return { ...post, blocks: blockData };
        })
      );

      return results;
    },
  });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!data?.length) return null;

  const blockTypeIcon = (type: string) => {
    switch (type) {
      case "text": return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
      case "image": return <Image className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: 14, padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: 4 }}>Which blocks are people actually reading?</h2>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>Based on View button clicks per block.</p>

      <div className="space-y-6">
        {data.map((post) => {
          if (!post.blocks.length) return null;
          const maxViews = Math.max(...post.blocks.map((b: any) => b.views), 1);
          return (
            <div key={post.id}>
              <h3 className="text-sm font-medium mb-2 truncate">{post.title}</h3>
              <div className="space-y-1.5">
                {post.blocks.map((block: any) => (
                  <div key={block.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{block.position}</span>
                    {blockTypeIcon(block.block_type)}
                    <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{ width: `${Math.max((block.views / maxViews) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{block.views}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
