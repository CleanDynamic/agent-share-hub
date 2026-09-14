import * as React from "react";
import {
  Trophy,
  Award,
  ChevronDown,
  Send,
  ThumbsUp,
  Check,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { categoryFill } from "@/lib/theme/category";
import { GLASS_BLUR } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t as tok, tokenAlpha } from "@/lib/theme/tokens";
import {
  body as bodyText,
  data as dataText,
  eyebrow as eyebrowText,
  label as labelText,
  tabular,
  FIGTREE,
} from "@/lib/theme/type";

/** The measured evidence pair, spent on the marks that mean "verified". */
const EVIDENCE = categoryFill("evidence");
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
/**
 * The rank mark.
 *
 * NO MEDALS. Gold, silver and bronze were three invented hues in a system whose
 * nine hues are spoken for, and two of them (#D1D5DB at 1.3:1, #B45309 at
 * 3.4:1) could not carry a numeral on the Exhibition ground anyway. The theme
 * ranks tiers by WEIGHT AND FILL instead, three steps only, and the top three
 * take that ladder:
 *
 *   1st  `--lit` fill with `--on-lit` on it — amber as LIGHT, which is the one
 *        way it is legal to spend, never as the numeral's own colour.
 *   2nd  `--recess` fill, the middle step.
 *   3rd  outline, the common step, so third still reads as a place.
 *   4th+ a bare numeral in `--text2` and no mark at all.
 *
 * The hexagon went with the medals: the shape language was dropped, and a
 * six-sided plate is decorative geometry. The mark is a chip like every other
 * small square-ish thing on the platform.
 */
function RankIndicator({ rank }: { rank: number }) {
  if (rank <= 3) {
    const step: Record<number, CSSProperties> = {
      1: { background: tok.lit, color: tok.onLit, border: `1px solid ${tok.lit}` },
      2: { background: tok.recess, color: tok.text, border: `1px solid ${tok.line}` },
      3: { background: "transparent", color: tok.text, border: `1px solid ${tok.line}` },
    };
    return (
      <span
        data-leaderboard-rank={rank}
        style={{
          ...dataText,
          ...tabular,
          fontSize: 12,
          fontWeight: 500,
          width: 28,
          height: 28,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: r.chip,
          ...step[rank],
        }}
      >
        {rank}
      </span>
    );
  }
  return (
    <span
      data-leaderboard-rank={rank}
      style={{ ...dataText, ...tabular, fontSize: 12, color: tok.text2, width: 28, textAlign: "center" }}
    >
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
        borderRadius: r.chip,
        background: EVIDENCE.background,
        border: "1px solid transparent",
        color: EVIDENCE.color,
        ...dataText,
        fontSize: 11,
        fontWeight: 500,
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
        borderRadius: r.full,
        background: tok.evidence,
        border: `2px solid ${tok.bg}`,
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
  /* The reader's own row is marked with the action tint, not the evidence one:
     evidence on this platform means a reproduction, and "this is you" is not
     one. */
  const baseBg = isHighlighted ? tokenAlpha("action", 0.12) : tok.recess;

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
        borderRadius: r.control,
        transition: "background-color 600ms ease, transform 400ms ease",
        minWidth: variant === "narrow" ? 240 : undefined,
        boxShadow: isHighlighted ? `0 0 0 1px ${tok.action}` : "none",
      }}
      onMouseEnter={(e) => {
        if (!isHighlighted) e.currentTarget.style.backgroundColor = tokenAlpha("action", 0.06);
      }}
      onMouseLeave={(e) => {
        if (!isHighlighted) e.currentTarget.style.backgroundColor = tok.recess;
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
          <span style={{ ...labelText, fontWeight: 600, color: tok.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {contributor.user.displayName}
          </span>
          {contributor.user.isTrustedSolver && <TrustedSolverBadge />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, ...dataText, fontSize: 12, color: tok.text2 }}>
          <span>@{contributor.user.handle}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
        <span style={{ ...dataText, ...tabular, fontSize: 13, fontWeight: 500, color: tok.text }}>
          {contributor.voteCount} votes
        </span>
        <span style={{ ...dataText, ...tabular, fontSize: 12, color: tok.text2 }}>
          {contributor.submissionCount} solution{contributor.submissionCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onCTA }: { onCTA: () => void }) {
  return (
    <div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
      <Trophy size={28} color={tok.text2} />
      <span style={{ ...bodyText, fontSize: 13, color: tok.text2 }}>
        No solutions submitted yet
      </span>
      <button
        onClick={onCTA}
        style={{
          padding: "6px 12px",
          borderRadius: r.control,
          border: `1px solid ${tok.action}`,
          background: "transparent",
          color: tok.action,
          ...labelText,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 150ms ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokenAlpha("action", 0.1); }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Be the first to climb the board
      </button>
    </div>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const icon =
    event.type === "submitted" ? <Send size={11} color={tok.text2} /> :
    event.type === "voted" ? <ThumbsUp size={11} color={tok.text2} /> :
    event.type === "accepted" ? <Check size={11} color={tok.evidence} /> :
    <Clock size={11} color={tok.text2} />;

  let message: React.ReactNode = null;
  if (event.type === "submitted") {
    message = (
      <>
        <span style={{ color: tok.text }}>@{event.handle}</span> submitted to slot{" "}
        <span style={{ color: tok.text }}>{event.slotName}</span>
      </>
    );
  } else if (event.type === "voted") {
    message = (
      <>
        <span style={{ color: tok.text }}>@{event.handle}</span> received {event.voteCount} votes
      </>
    );
  } else if (event.type === "accepted") {
    message = (
      <>
        <span style={{ color: tok.text }}>@{event.handle}</span>
        {`'`}s solution was accepted
      </>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "4px 0" }}>
      <span style={{ marginTop: 2 }}>{icon}</span>
      <span style={{ ...dataText, fontSize: 12, color: tok.text2, lineHeight: 1.4 }}>
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
    backgroundColor: tok.glass,
    border: `1px solid ${tok.glassBorder}`,
    borderRadius: r.panel,
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
  };

  const headerStyle: React.CSSProperties = {
    height: 44,
    padding: "0 12px",
    borderBottom: `1px solid ${tok.line}`,
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
            <Trophy size={14} color={tok.text2} />
            <span style={{ ...labelText, color: tok.text, letterSpacing: "0.02em" }}>
              Top contributors
            </span>
            {isLive && (
              <span title="Live" style={{ display: "inline-block", width: 6, height: 6, borderRadius: r.full, background: tok.evidence }} />
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
                  border: `1px solid ${tok.line}`,
                  color: tok.text2,
                  fontFamily: FIGTREE,
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
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${tok.line}` }}>
            <div style={{ ...eyebrowText, color: tok.text2, marginBottom: 8 }}>
              Activity feed
            </div>
            {recentActivity.slice(0, 5).map((ev) => (
              <ActivityItem key={ev.id} event={ev} />
            ))}
          </div>
        )}

        {/* View all */}
        <div style={{ padding: "10px 16px", borderTop: `1px solid ${tok.line}` }}>
          <button
            onClick={onViewAll}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              color: tok.action,
              fontFamily: FIGTREE,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tok.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tok.action; }}
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
          <Trophy size={14} color={tok.text2} />
          <span style={{ ...labelText, color: tok.text }}>
            Top contributors
          </span>
          {isLive && (
            <span title="Live" style={{ display: "inline-block", width: 6, height: 6, borderRadius: r.full, background: tok.evidence }} />
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
            color: tok.action,
            ...labelText,
            fontSize: 12,
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
