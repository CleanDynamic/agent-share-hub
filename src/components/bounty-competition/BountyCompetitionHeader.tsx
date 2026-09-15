import * as React from "react";
import {
  Trophy,
  Send,
  Users,
  MessageSquare,
  Clock,
  Mail,
  Award,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
// A local `type` binding in this file shadows the scale object, so the
// roles are imported by name.
import { sectionHead } from "@/lib/theme/type";

type BountyStatus = "open" | "closed" | "solved" | "partially_solved";
type RewardType = "cash" | "token" | "kudos" | "none";

export interface BountyCompetitionHeaderBounty {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: BountyStatus;
  sequentialId: number;
  rewardType: RewardType;
  rewardAmount?: number;
  rewardCurrency?: string;
  deadline: Date | null;
  submissionCount: number;
  activeSolverCount: number;
  commentCount: number;
  slotsTotal: number;
  slotsSolved: number;
  createdAt: Date;
  solvedAt?: Date | null;
}

interface BountyCompetitionHeaderProps {
  bounty: BountyCompetitionHeaderBounty;
  isOwnBounty: boolean;
  onSubmitSolution: () => void;
  onDiscussion: () => void;
  onAskAuthor: () => void;
  onManageBounty?: () => void;
  onPromoteToBlueprint?: () => void;
}

function getStatusConfig(status: BountyStatus) {
  switch (status) {
    case "open":
      return { label: "OPEN", bg: "color-mix(in srgb, var(--cat-breakage) 15%, transparent)", color: "var(--cat-breakage)" };
    case "closed":
      return { label: "CLOSED", bg: "color-mix(in srgb, var(--text2) 15%, transparent)", color: "var(--text2)" };
    case "solved":
      return { label: "SOLVED", bg: "color-mix(in srgb, var(--evidence) 15%, transparent)", color: "var(--evidence)" };
    case "partially_solved":
      return { label: "PARTIALLY SOLVED", bg: "color-mix(in srgb, var(--cat-data) 15%, transparent)", color: "var(--cat-data)" };
    default:
      return { label: "UNKNOWN", bg: "color-mix(in srgb, var(--text2) 15%, transparent)", color: "var(--text2)" };
  }
}

function getDeadlineState(deadline: Date | null) {
  if (!deadline) return { type: "open_ended" as const, color: "var(--text2)" };
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const daysRemaining = diff / (1000 * 60 * 60 * 24);
  if (diff < 0) {
    const daysAgo = Math.abs(Math.floor(daysRemaining));
    return { type: "past" as const, daysAgo, color: "color-mix(in srgb, var(--cat-breakage) 65%, transparent)" };
  }
  if (daysRemaining < 1) return { type: "urgent" as const, color: "var(--cat-breakage)" };
  if (daysRemaining <= 7) return { type: "warning" as const, color: "var(--cat-breakage)" };
  return { type: "normal" as const, color: "var(--text)" };
}

function formatTimeRemaining(deadline: Date | null): string {
  if (!deadline) return "Open-ended";
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) {
    const daysAgo = Math.abs(Math.floor(diff / (1000 * 60 * 60 * 24)));
    return `Closed ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`;
}

function calculateTimeProgress(deadline: Date | null, createdAt: Date): number {
  if (!deadline) return 0;
  const total = deadline.getTime() - createdAt.getTime();
  const elapsed = Date.now() - createdAt.getTime();
  if (elapsed <= 0) return 0;
  if (elapsed >= total) return 100;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

function useNow(intervalMs = 60_000) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function CounterPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "var(--recess)",
        border: "1px solid var(--line)",
        fontFamily: "Figtree, sans-serif",
        fontSize: 12,
        color: "var(--text)",
      }}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

function RewardDisplay({
  type,
  amount,
  currency,
}: {
  type: RewardType;
  amount?: number;
  currency?: string;
}) {
  const baseStyle: React.CSSProperties = {
    ...sectionHead,

    color: "var(--cat-breakage)",

  };
  switch (type) {
    case "cash":
      return <div style={baseStyle}>${amount ?? 0} {currency || "USD"}</div>;
    case "token":
      return <div style={baseStyle}>{amount ?? 0} {currency || "USDC"}</div>;
    case "kudos":
      return <div style={{ ...baseStyle, color: "var(--evidence)", fontSize: 22 }}>Community recognition</div>;
    case "none":
    default:
      return <div style={{ ...baseStyle, color: "var(--text2)", fontSize: 18, fontWeight: 500 }}>No reward — knowledge is the prize</div>;
  }
}

export function BountyCompetitionHeader({
  bounty,
  isOwnBounty,
  onSubmitSolution,
  onDiscussion,
  onAskAuthor,
  onManageBounty,
  onPromoteToBlueprint,
}: BountyCompetitionHeaderProps) {
  useNow(60_000); // re-render every minute for live deadline countdown
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);

  const statusConfig = getStatusConfig(bounty.status);
  const deadlineState = getDeadlineState(bounty.deadline);
  const timeProgress = calculateTimeProgress(bounty.deadline, bounty.createdAt);
  const slotProgress = bounty.slotsTotal > 0 ? (bounty.slotsSolved / bounty.slotsTotal) * 100 : 0;

  const isDisabled = bounty.status === "closed" || bounty.status === "solved";
  const disabledReason =
    bounty.status === "closed"
      ? "Bounty is closed; cannot accept new solutions"
      : "Bounty is solved; cannot accept new solutions";

  const estimatedDaysToComplete = React.useMemo(() => {
    if (bounty.slotsSolved === 0 || bounty.slotsTotal === bounty.slotsSolved) return null;
    const daysElapsed = (Date.now() - bounty.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysElapsed < 1) return null;
    const ratePerDay = bounty.slotsSolved / daysElapsed;
    if (ratePerDay === 0) return null;
    const remaining = bounty.slotsTotal - bounty.slotsSolved;
    return Math.ceil(remaining / ratePerDay);
  }, [bounty.slotsSolved, bounty.slotsTotal, bounty.createdAt]);

  const containerStyle: React.CSSProperties = {
    background: "var(--recess)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "Figtree, sans-serif",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    color: "var(--text2)",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const primaryBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid color-mix(in srgb, var(--cat-breakage) 40%, transparent)",
    background: "var(--action)",
    color: "var(--bg)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--recess)",
    color: "var(--text)",
    fontFamily: "Figtree, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };

  return (
    <TooltipProvider>
      <div style={containerStyle}>
        {/* TOP ROW */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Trophy size={16} color="var(--cat-breakage)" />
            <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--cat-breakage)" }}>BOUNTY</span>
            <span style={{ padding: "3px 8px", borderRadius: 6, background: statusConfig.bg, color: statusConfig.color, fontFamily: "Figtree, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
              {statusConfig.label}
            </span>
            <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, fontWeight: 500, color: "var(--text2)" }}>
              BOUNTY #{bounty.sequentialId}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <CounterPill icon={<Send size={12} />} text={`${bounty.submissionCount} solutions submitted`} />
            <CounterPill icon={<Users size={12} />} text={`${bounty.activeSolverCount} solvers`} />
            <CounterPill icon={<MessageSquare size={12} />} text={`${bounty.commentCount} discussion messages`} />
          </div>
        </div>

        {/* TITLE */}
        <h1 style={{ ...sectionHead,   color: "var(--text)",  margin: "0 0 12px 0" }}>
          {bounty.title}
        </h1>

        {/* DESCRIPTION */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text2)",
              maxHeight: isDescriptionExpanded ? "none" : 80,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {bounty.description}
          </div>
          {bounty.description && bounty.description.length > 200 && (
            <button
              onClick={() => setIsDescriptionExpanded((v) => !v)}
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--cat-breakage)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginTop: 8,
              }}
            >
              {isDescriptionExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* REWARD + DEADLINE */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 20, padding: "16px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div>
            <div style={labelStyle}>Reward</div>
            <RewardDisplay type={bounty.rewardType} amount={bounty.rewardAmount} currency={bounty.rewardCurrency} />
          </div>
          <div>
            <div style={labelStyle}>Deadline</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color={deadlineState.color as string} />
              <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 16, fontWeight: 600, color: deadlineState.color as string }}>
                {formatTimeRemaining(bounty.deadline)}
              </span>
            </div>
            {bounty.deadline && deadlineState.type !== "past" && deadlineState.type !== "open_ended" && (
              <div style={{ marginTop: 8, height: 4, background: "var(--recess)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${timeProgress}%`, height: "100%", background: deadlineState.color as string, transition: "none" }} />
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {isOwnBounty ? (
            <>
              <button onClick={onManageBounty} style={primaryBtnStyle}>
                <Settings size={16} />
                Manage bounty
              </button>
              <button onClick={onDiscussion} style={secondaryBtnStyle}>
                <MessageSquare size={14} />
                Discussion ({bounty.commentCount})
              </button>
              {bounty.status === "solved" && (
                <button onClick={onPromoteToBlueprint} style={{ ...secondaryBtnStyle, borderColor: "color-mix(in srgb, var(--evidence) 40%, transparent)", color: "var(--evidence)" }}>
                  <Sparkles size={14} />
                  Promote to blueprint
                </button>
              )}
            </>
          ) : (
            <>
              {isDisabled ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <button disabled style={{ ...primaryBtnStyle, opacity: 0.5, cursor: "not-allowed" }}>
                        <Send size={16} />
                        Submit a solution
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{disabledReason}</TooltipContent>
                </Tooltip>
              ) : (
                <button onClick={onSubmitSolution} style={primaryBtnStyle}>
                  <Send size={16} />
                  Submit a solution
                </button>
              )}
              <button onClick={onDiscussion} style={secondaryBtnStyle}>
                <MessageSquare size={14} />
                Discussion ({bounty.commentCount})
              </button>
              <button onClick={onAskAuthor} style={secondaryBtnStyle}>
                <Mail size={14} />
                Ask the author
              </button>
            </>
          )}
        </div>

        {/* PROGRESS METER */}
        <div>
          {(bounty.status === "open" || bounty.status === "partially_solved") && (
            <>
              <div style={{ height: 6, background: "var(--recess)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${slotProgress}%`, height: "100%", background: "linear-gradient(90deg, var(--evidence), var(--cat-data))", transition: "none" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, color: "var(--text2)" }}>
                  {bounty.slotsSolved} of {bounty.slotsTotal} slots solved
                </span>
                {estimatedDaysToComplete !== null && (
                  <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, color: "var(--text2)" }}>
                    ~{estimatedDaysToComplete} day{estimatedDaysToComplete !== 1 ? "s" : ""} at current pace
                  </span>
                )}
              </div>
            </>
          )}
          {bounty.status === "closed" && (
            <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 13, color: "var(--text2)" }}>
              Closed without resolution. {bounty.slotsTotal - bounty.slotsSolved} of {bounty.slotsTotal} slots remained unsolved.
            </div>
          )}
          {bounty.status === "solved" && bounty.solvedAt && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Figtree, sans-serif", fontSize: 13, color: "var(--evidence)" }}>
              <Award size={14} />
              Solved on {bounty.solvedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} by {bounty.slotsSolved} contributor{bounty.slotsSolved !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
