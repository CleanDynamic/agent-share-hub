import * as React from "react";
import {
  Quote,
  Target,
  Heart,
  Repeat2,
  MessageSquare,
  Sparkles,
  UserPlus,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────
export type NotificationKind =
  | "reference_received"
  | "new_follower"
  | "bounty_interaction"
  | "engagement"
  | "new_message"
  | "mention"
  | "system"
  | string;

export type EngagementType = "like" | "repost" | "comment";

export interface NotificationActor {
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
}

export interface NotificationTarget {
  contentType: string;
  contentId: string;
  contentTitle: string;
  slug?: string | null;
  parentSlug?: string | null;
  parentBlockId?: string | null;
}

export interface NotificationMetadata {
  engagementType?: EngagementType;
  bountySubType?: "solution_submitted" | "solution_accepted" | "new_comment";
  commentText?: string;
  domain?: string;
  badgeName?: string;
  isFollowing?: boolean;
  [key: string]: unknown;
}

export interface NotificationCardData {
  id: string;
  kind: NotificationKind;
  isRead: boolean;
  timestamp: string;
  actor?: NotificationActor | null;
  target?: NotificationTarget | null;
  body: string;
  metadata: NotificationMetadata;
  /** Optional flag: render with a brief teal pulse (for realtime arrivals). */
  pulse?: boolean;
}

interface NotificationCardProps {
  notification: NotificationCardData;
  onClick: (n: NotificationCardData) => void;
  onMarkAsRead: (id: string) => void;
}

// ── Avatar ───────────────────────────────────────────────────────────────
function Avatar({
  src,
  alt,
  fallback,
}: {
  src?: string | null;
  alt: string;
  fallback: string;
}) {
  const [errored, setErrored] = React.useState(false);
  if (!src || errored) {
    return (
      <div
        aria-label={alt}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(46,196,182,0.15)",
          color: "#2EC4B6",
          border: "1px solid rgba(46,196,182,0.30)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {fallback}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "0.5px solid rgba(255,255,255,0.10)",
      }}
    />
  );
}

function IconBadge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: `${color}26`,
        border: `1px solid ${color}4D`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function NotificationIcon({ notification }: { notification: NotificationCardData }) {
  const { kind, actor, metadata } = notification;
  const initials =
    (actor?.displayName || actor?.handle || "?")
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  switch (kind) {
    case "reference_received":
      return (
        <IconBadge color="#2EC4B6">
          <Quote size={16} />
        </IconBadge>
      );
    case "new_follower":
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge color="#E8571A">
          <UserPlus size={16} />
        </IconBadge>
      );
    case "bounty_interaction":
      return (
        <IconBadge color="#E8571A">
          <Target size={16} />
        </IconBadge>
      );
    case "engagement": {
      const t = metadata.engagementType;
      if (t === "like") {
        return (
          <IconBadge color="#FF6B6B">
            <Heart size={16} />
          </IconBadge>
        );
      }
      if (t === "repost") {
        return (
          <IconBadge color="#A8DADC">
            <Repeat2 size={16} />
          </IconBadge>
        );
      }
      return (
        <IconBadge color="#2EC4B6">
          <MessageSquare size={16} />
        </IconBadge>
      );
    }
    case "new_message":
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge color="#2EC4B6">
          <MessageSquare size={16} />
        </IconBadge>
      );
    case "mention":
      return (
        <IconBadge color="#E8571A">
          <AtSign size={16} />
        </IconBadge>
      );
    case "system":
      return (
        <IconBadge color="#AA96DA">
          <Sparkles size={16} />
        </IconBadge>
      );
    default:
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge color="#888888">
          <Sparkles size={16} />
        </IconBadge>
      );
  }
}

// ── Title + CTA helpers ──────────────────────────────────────────────────
function getTitle(n: NotificationCardData): string {
  const handle = n.actor?.handle ? `@${n.actor.handle}` : n.actor?.displayName || "Someone";
  switch (n.kind) {
    case "reference_received":
      return `${handle} referenced your ${n.target?.contentTitle || "block"}`;
    case "new_follower":
      return `${handle} followed you`;
    case "bounty_interaction": {
      const s = n.metadata.bountySubType;
      if (s === "solution_submitted") return `${handle} submitted a solution to your bounty`;
      if (s === "solution_accepted") return `Your solution was accepted by ${handle}`;
      return "New comment on your bounty";
    }
    case "engagement": {
      const t = n.metadata.engagementType;
      const action = t === "like" ? "liked" : t === "repost" ? "reposted" : "commented on";
      return `${handle} ${action} your ${n.target?.contentType || "post"}`;
    }
    case "new_message":
      return `New message from ${handle}`;
    case "mention":
      return `${handle} mentioned you`;
    case "system":
      return n.body.split("\n")[0] || "System notification";
    default:
      return n.body || "New notification";
  }
}

function getCTA(n: NotificationCardData): string {
  switch (n.kind) {
    case "reference_received":
    case "engagement":
    case "mention":
      return "View";
    case "new_follower":
      return n.metadata.isFollowing ? "View profile" : "Follow back";
    case "bounty_interaction":
      return "Open";
    case "new_message":
      return "Reply";
    case "system":
      return "View";
    default:
      return "View";
  }
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main card ────────────────────────────────────────────────────────────
export function NotificationCard({
  notification,
  onClick,
  onMarkAsRead,
}: NotificationCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [pulseActive, setPulseActive] = React.useState(Boolean(notification.pulse));

  React.useEffect(() => {
    if (!notification.pulse) return;
    setPulseActive(true);
    const t = setTimeout(() => setPulseActive(false), 1000);
    return () => clearTimeout(t);
  }, [notification.pulse]);

  const title = getTitle(notification);
  const ctaLabel = getCTA(notification);
  const formattedTime = formatTimestamp(notification.timestamp);
  const bodyText =
    notification.kind === "system"
      ? notification.body.split("\n").slice(1).join("\n").trim() || ""
      : notification.body;

  const isFollowBack =
    notification.kind === "new_follower" && !notification.metadata.isFollowing;

  const background = pulseActive
    ? "rgba(46,196,182,0.15)"
    : hovered
    ? "rgba(22,22,30,0.50)"
    : "rgba(22,22,30,0.30)";

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(notification);
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        onClick(notification);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative mb-1.5 flex cursor-pointer gap-3 rounded-lg border-[0.5px] border-white/5 px-4 py-3.5"
      )}
      style={{
        background,
        borderLeft: `4px solid ${notification.isRead ? "transparent" : "#2EC4B6"}`,
        transition: "background 280ms ease, opacity 200ms ease",
      }}
    >
      {/* Left — icon/avatar */}
      <div style={{ flexShrink: 0 }}>
        <NotificationIcon notification={notification} />
      </div>

      {/* Centre — content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>

        {bodyText && (
          <div
            style={{
              marginTop: 4,
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {bodyText}
          </div>
        )}

        <div
          style={{
            marginTop: 6,
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.40)",
          }}
        >
          {formattedTime}
        </div>
      </div>

      {/* Right — CTA */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick(notification);
          }}
          style={{
            background: isFollowBack ? "rgba(232,87,26,0.15)" : "transparent",
            border: isFollowBack
              ? "0.5px solid rgba(232,87,26,0.40)"
              : "0.5px solid rgba(255,255,255,0.10)",
            color: isFollowBack ? "#E8571A" : "rgba(255,255,255,0.85)",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>

        {!notification.isRead && hovered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.45)",
              fontFamily: "Inter, sans-serif",
              fontSize: 10,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}

// ── Group header ─────────────────────────────────────────────────────────
export function NotificationGroupHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        marginTop: 18,
        marginBottom: 6,
        paddingLeft: 4,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </div>
  );
}

// ── Time grouping helper ─────────────────────────────────────────────────
export function groupNotificationsByTime(
  notifications: NotificationCardData[]
): Map<string, NotificationCardData[]> {
  const groups = new Map<string, NotificationCardData[]>();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisWeekStart = new Date(today.getTime() - today.getDay() * 86400000);

  for (const n of notifications) {
    const d = new Date(n.timestamp);
    let key: string;
    if (d >= today) key = "Today";
    else if (d >= yesterday) key = "Yesterday";
    else if (d >= thisWeekStart) key = "This week";
    else key = "Earlier";
    const existing = groups.get(key) ?? [];
    existing.push(n);
    groups.set(key, existing);
  }
  return groups;
}
