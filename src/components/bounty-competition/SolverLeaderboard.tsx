import * as React from "react";
import {
  Trophy,
  Hexagon,
  Award,
  ChevronDown,
  Send,
  ThumbsUp,
  Check,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface LeaderboardUser {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  isTrustedSolver: boolean;
}

export interface Contributor {
  rank: number;
  user: LeaderboardUser;
  voteCount: number;
  submissionCount: number;
  acceptedCount: number;
  hasActiveDraft: boolean;
  publicActiveDraft: boolean;
}

export interface ActivityEvent {
  id: string;
  type: "submitted" | "voted" | "accepted";
  handle: string;
  slotName?: string;
  voteCount?: number;
  timeAgo: string;
}

export interface SolverLeaderboardProps {
  bountyId: string;
  variant: "desktop" | "narrow";
  contributors: Contributor[];
  sort: string;
  onSortChange: (sort: string) => void;
  onContributorClick: (userId: string) => void;
  recentActivity: ActivityEvent[];
  onViewAll: () => void;
  isLive: boolean;
  highlightedUserId?: string | null;
}

const sortOptions = [
  { value: "votes", label: "Most votes" },
  { value: "submissions", label: "Most submissions" },
  { value: "accepted", label: "Most accepted" },
  { value: "newest", label: "Newest" },
];

// ─── Sub-components ─────────────────────────────────────────────────────────
function RankIndicator({ rank }: { rank: number }) {
  if (rank <= 3) {
    const colorMap: Record<number, { bg: string; border: string; text: string }> = {
      1: { bg: "rgba(245,158,11,0.20)", border: "rgba(245,158,11,0.55)", text: "#F59E0B" },
      2: { bg: "rgba(209,213,219,0.20)", border: "rgba(209,213,219,0.55)", text: "#D1D5DB" },
      3: { bg: "rgba(180,83,9,0.20)", border: "rgba(180,83,9,0.55)", text: "#B45309" },
    };
    const c = colorMap[rank];
    return (
      <div style={{ position: "relative", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Hexagon size={28} strokeWidth={1.5} style={{ position: "absolute", inset: 0, color: c.border, fill: c.bg }} />
        <span style={{ position: "relative", fontFamily: "Figtree, sans-serif", fontSize: 11, fontWeight: 700, color: c.text }}>{rank}</span>
      </div>
    );
  }
  return (
    <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.45)", width: 28, textAlign: "center" }}>
      #{rank}
    </span>
  );
}

function TrustedSolverBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "1px 6px",
        borderRadius: 4,
        background: "rgba(46,196,182,0.12)",
        border: "1px solid rgba(46,196,182,0.30)",
        color: "#2EC4B6",
        fontFamily: "Figtree, sans-serif",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <Award size={9} />
      Trusted
    </span>
  );
}

function LiveDot() {
  return (
    <span
      title="Active draft in progress"
      style={{
        position: "absolute",
        bottom: -1,
        right: -1,
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: "#2EC4B6",
        border: "2px solid #25252F",
        boxShadow: "0 0 6px rgba(46,196,182,0.7)",
      }}
    />
  );
}

function ContributorRow({
  contributor,
  variant,
  onClick,
  isHighlighted,
}: {
  contributor: Contributor;
  variant: "desktop" | "narrow";
  onClick: () => void;
  isHighlighted: boolean;
}) {
  const rowHeight = variant === "desktop" ? 60 : 56;
  const baseBg = isHighlighted ? "rgba(46,196,182,0.12)" : "transparent";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        height: rowHeight,
        cursor: "pointer",
        backgroundColor: baseBg,
        borderRadius: 8,
        transition: "background-color 600ms ease, transform 400ms ease",
        minWidth: variant === "narrow" ? 240 : undefined,
        boxShadow: isHighlighted ? "0 0 0 1px rgba(46,196,182,0.35)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isHighlighted) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!isHighlighted) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <RankIndicator rank={contributor.rank} />

      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar style={{ width: 32, height: 32 }}>
          <AvatarImage src={contributor.user.avatarUrl} alt={contributor.user.displayName} />
          <AvatarFallback>{contributor.user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        {contributor.hasActiveDraft && contributor.publicActiveDraft && <LiveDot />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {contributor.user.displayName}
          </span>
          {contributor.user.isTrustedSolver && <TrustedSolverBadge />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          <span>@{contributor.user.handle}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {contributor.voteCount} votes
        </span>
        <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
          {contributor.submissionCount} solution{contributor.submissionCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onCTA }: { onCTA: () => void }) {
  return (
    <div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
      <Trophy size={28} color="rgba(245,158,11,0.45)" />
      <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
        No solutions submitted yet
      </span>
      <button
        onClick={onCTA}
        style={{
          padding: "6px 12px",
          borderRadius: 6,
          border: "1px solid rgba(245,158,11,0.35)",
          background: "transparent",
          color: "#F59E0B",
          fontFamily: "Figtree, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 150ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(245,158,11,0.10)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Be the first to climb the board
      </button>
    </div>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const icon =
    event.type === "submitted" ? <Send size={11} color="rgba(245,158,11,0.85)" /> :
    event.type === "voted" ? <ThumbsUp size={11} color="rgba(46,196,182,0.85)" /> :
    event.type === "accepted" ? <Check size={11} color="rgba(46,196,182,0.95)" /> :
    <Clock size={11} color="rgba(255,255,255,0.45)" />;

  let message: React.ReactNode = null;
  if (event.type === "submitted") {
    message = (
      <>
        <span style={{ color: "rgba(255,255,255,0.70)" }}>@{event.handle}</span> submitted to slot{" "}
        <span style={{ color: "rgba(255,255,255,0.70)" }}>{event.slotName}</span>
      </>
    );
  } else if (event.type === "voted") {
    message = (
      <>
        <span style={{ color: "rgba(255,255,255,0.70)" }}>@{event.handle}</span> received {event.voteCount} votes
      </>
    );
  } else if (event.type === "accepted") {
    message = (
      <>
        <span style={{ color: "rgba(255,255,255,0.70)" }}>@{event.handle}</span>
        {`'`}s solution was accepted
      </>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0" }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
        {message} · {event.timeAgo}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export function SolverLeaderboard({
  variant,
  contributors,
  sort,
  onSortChange,
  onContributorClick,
  recentActivity,
  onViewAll,
  isLive,
  highlightedUserId = null,
}: SolverLeaderboardProps) {
  const currentSortLabel = sortOptions.find((opt) => opt.value === sort)?.label || "Most votes";

  const panelStyle: React.CSSProperties = {
    backgroundColor: "rgba(22,22,30,0.40)",
    border: "0.5px solid rgba(255, 255, 255, 0.14)",
    borderRadius: 10,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  };

  const headerStyle: React.CSSProperties = {
    height: 44,
    padding: "0 12px",
    borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  if (variant === "desktop") {
    return (
      <div style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={14} color="#F59E0B" />
            <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
              Top contributors
            </span>
            {isLive && (
              <span title="Live" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#2EC4B6", boxShadow: "0 0 6px rgba(46,196,182,0.8)" }} />
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.65)",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {currentSortLabel}
                <ChevronDown size={11} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortOptions.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => onSortChange(opt.value)} style={{ fontSize: 12 }}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* List */}
        {contributors.length === 0 ? (
          <EmptyState onCTA={onViewAll} />
        ) : (
          <div style={{ padding: "6px 4px", display: "flex", flexDirection: "column", gap: 2 }}>
            {contributors.map((c) => (
              <ContributorRow
                key={c.user.id}
                contributor={c}
                variant="desktop"
                onClick={() => onContributorClick(c.user.id)}
                isHighlighted={highlightedUserId === c.user.id}
              />
            ))}
          </div>
        )}

        {/* Activity feed */}
        {recentActivity.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: "0.5px solid rgba(255, 255, 255, 0.14)" }}>
            <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)", marginBottom: 8 }}>
              Activity feed
            </div>
            {recentActivity.slice(0, 5).map((ev) => (
              <ActivityItem key={ev.id} event={ev} />
            ))}
          </div>
        )}

        {/* View all */}
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255, 255, 255, 0.14)" }}>
          <button
            onClick={onViewAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: "rgba(46,196,182,0.85)",
              fontFamily: "Figtree, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(46,196,182,1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(46,196,182,0.85)"; }}
          >
            View all contributors
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    );
  }

  // ─── Narrow variant ────────────────────────────────────────
  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={14} color="#F59E0B" />
          <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
            Top contributors
          </span>
          {isLive && (
            <span title="Live" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#2EC4B6", boxShadow: "0 0 6px rgba(46,196,182,0.8)" }} />
          )}
        </div>
        <button
          onClick={onViewAll}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: "rgba(46,196,182,0.85)",
            fontFamily: "Figtree, sans-serif",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            padding: 0,
          }}
        >
          View all
          <ArrowRight size={11} />
        </button>
      </div>

      {contributors.length === 0 ? (
        <EmptyState onCTA={onViewAll} />
      ) : (
        <ScrollArea style={{ width: "100%" }}>
          <div style={{ display: "flex", gap: 8, padding: 8 }}>
            {contributors.slice(0, 5).map((c) => (
              <ContributorRow
                key={c.user.id}
                contributor={c}
                variant="narrow"
                onClick={() => onContributorClick(c.user.id)}
                isHighlighted={highlightedUserId === c.user.id}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}

export default SolverLeaderboard;
