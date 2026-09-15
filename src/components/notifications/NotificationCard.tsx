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
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t as tok, tokenAlpha } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { data as dataType, eyebrow, tabular } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

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
  bountySubType?:
    | "solution_submitted"
    | "solution_accepted"
    | "new_comment"
    | "bounty_solver_overtaken"
    | "meta_bounty_sub_spawned"
    | "bounty_deadline_approaching"
    | "bounty_promoted_to_blueprint";
  commentText?: string;
  domain?: string;
  badgeName?: string;
  isFollowing?: boolean;
  /** Server-side metadata uses `sub` for bounty subkinds; mirrored here for typing. */
  sub?: string;
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
          background: tok.recess,
          color: tok.text2,
          border: `1px solid ${tok.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Figtree, sans-serif",
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
        border: `0.5px solid ${tok.line}`,
      }}
    />
  );
}

/**
 * BG-P26 — ONE badge treatment, for every subkind.
 *
 * This used to take a `color` and there were nine of them: #2EC4B6, #E8571A,
 * #FF6B6B, #A8DADC, #AA96DA, #888888 and the rest, mixed with hex-alpha
 * suffixes (`${color}26`). None was a theme token, so none changed between the
 * rooms, and a stream of nine differently-coloured discs is a rainbow that
 * encodes nothing — the nine hues that DO encode something in this system are
 * the part categories, and a notification is not a part.
 *
 * BG-P26 asks for one row treatment for every subkind, so the badge is one
 * treatment: `--recess` ground, `--line` hairline, `--text2` icon. What the
 * notification says is carried by the words — the actor, the action in plain
 * words, the target — which is where it belongs and where a screen reader can
 * reach it. The icon stays as the shape cue it always was.
 *
 * The `color` prop is gone rather than ignored, so a call site cannot pass a
 * hue and quietly have it dropped.
 */
function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: tok.recess,
        border: `1px solid ${tok.line}`,
        color: tok.text2,
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
        <IconBadge>
          <Quote size={16} />
        </IconBadge>
      );
    case "new_follower":
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge>
          <UserPlus size={16} />
        </IconBadge>
      );
    case "bounty_interaction":
      return (
        <IconBadge>
          <Target size={16} />
        </IconBadge>
      );
    case "engagement": {
      const t = metadata.engagementType;
      if (t === "like") {
        return (
          <IconBadge>
            <Heart size={16} />
          </IconBadge>
        );
      }
      if (t === "repost") {
        return (
          <IconBadge>
            <Repeat2 size={16} />
          </IconBadge>
        );
      }
      return (
        <IconBadge>
          <MessageSquare size={16} />
        </IconBadge>
      );
    }
    case "new_message":
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge>
          <MessageSquare size={16} />
        </IconBadge>
      );
    case "mention":
      return (
        <IconBadge>
          <AtSign size={16} />
        </IconBadge>
      );
    case "system":
      return (
        <IconBadge>
          <Sparkles size={16} />
        </IconBadge>
      );
    default:
      return actor?.avatarUrl ? (
        <Avatar src={actor.avatarUrl} alt={actor.displayName} fallback={initials} />
      ) : (
        <IconBadge>
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
      const s =
        (n.metadata.bountySubType as string | undefined) ??
        (n.metadata.sub as string | undefined);
      if (s === "solution_submitted") return `${handle} submitted a solution to your bounty`;
      if (s === "solution_accepted") return `Your solution was accepted by ${handle}`;
      if (s === "bounty_solver_overtaken") {
        const prev = n.metadata.previous_rank;
        const next = n.metadata.new_rank;
        return prev != null && next != null
          ? `${handle} overtook your rank (#${prev} → #${next})`
          : `${handle} overtook your rank`;
      }
      if (s === "meta_bounty_sub_spawned") {
        const t = (n.metadata.sub_title as string | undefined) ?? "a sub-bounty";
        return `Sub-bounty '${t}' has spawned`;
      }
      if (s === "bounty_deadline_approaching") {
        const hrs = n.metadata.hours_remaining;
        return typeof hrs === "number"
          ? `Bounty deadline in ~${Math.max(1, Math.round(hrs))}h`
          : "Bounty deadline approaching";
      }
      if (s === "bounty_promoted_to_blueprint") {
        const t = (n.metadata.bounty_title as string | undefined) ?? "a bounty";
        return `${handle} promoted '${t}' to a blueprint`;
      }
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

  // Rows sit on the page ground and lift to `--recess` on hover, the same
  // two-step the thread list uses. A realtime arrival flashes `--evidence` —
  // the token for a live state — rather than the teal it was hard-coded to.
  const background = pulseActive
    ? tokenAlpha("evidence", 0.08)
    : hovered
    ? tok.recess
    : tok.bg;

  // BG-P26: an unread row carries an `--action` left edge. A read row keeps a
  // transparent 2px edge so nothing shifts when it is marked read.
  const leftRule = !notification.isRead
    ? tok.action
    : pulseActive
    ? tokenAlpha("evidence", 0.4)
    : "transparent";

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
      className={cn("group relative mb-2 flex cursor-pointer gap-3 px-4 py-3")}
      style={{
        background,
        // A list row takes `--r-control` from the radius scale.
        borderRadius: r["r-control"],
        border: `0.5px solid ${tok.line}`,
        borderLeft: `2px solid ${leftRule}`,
        transition: feedback("background-color", "border-color", "opacity"),
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
            fontFamily: "Figtree, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: tok.text,
            lineHeight: 1.4,
            paddingRight: 28,
          }}
        >
          {title}
        </div>

        {bodyText && (
          <div
            style={{
              marginTop: 4,
              fontFamily: "Figtree, sans-serif",
              fontSize: 12,
              color: tok.text2,
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
            // A timestamp is data, so it takes the mono face and tabular
            // digits — a column of them lines up rather than jitters.
            fontFamily: dataType.fontFamily,
            ...tabular,
            fontSize: 11,
            color: tok.text2,
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
            // The emphasised CTA takes an `--action` wash with `--text` on it,
            // the same ground and ink as an own-message bubble — the hue itself
            // is not legal as ink on its own wash (3.97:1 on Exhibition).
            // Everything else is a secondary: a `--line` border and no fill.
            background: isFollowBack ? tokenAlpha("action", 0.14) : "transparent",
            border: `0.5px solid ${isFollowBack ? tokenAlpha("action", 0.4) : tok.line}`,
            color: isFollowBack ? tok.text : tok.text2,
            fontFamily: "Figtree, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 9px",
            borderRadius: r["r-chip"],
            cursor: "pointer",
          }}
        >
          {ctaLabel}
        </button>
      </div>

      {/* Mark-as-read check, top-right corner, no layout shift */}
      {!notification.isRead && (
        <button
          type="button"
          aria-label="Mark as read"
          title="Mark as read"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: `0.5px solid ${tok.line}`,
            borderRadius: 999,
            color: tok.text2,
            cursor: "pointer",
            opacity: hovered ? 1 : 0,
            transition: feedback("opacity"),
            padding: 0,
          }}
        >
          <Check size={12} />
        </button>
      )}
    </div>
  );
}

// ── Group header ─────────────────────────────────────────────────────────
export function NotificationGroupHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 6,
        paddingLeft: 4,
        // BG-P26: mono day headings. This is the eyebrow role — 12px DM Mono,
        // uppercase, 0.08em — which is what the scale already calls a small
        // label above a group, so the heading is taken from there rather than
        // hand-set a fourth time.
        ...eyebrow,
        color: tok.text2,
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
