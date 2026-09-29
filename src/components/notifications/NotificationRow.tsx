// One notification (RC-P19).
//
// WHAT A ROW SAYS: who (their avatar and name), what (the stored message —
// fixed text the database wrote, never a reader's), about which build (its
// title, read live), and when. A row that leads somewhere is one link to it; a
// kind the page does not know says its stored message and leads nowhere.
//
// ONE ROW TREATMENT for every kind ⟦law-of-similarity⟧: rows parted by
// hairlines, not boxed; an unread row carries a 2px --action edge on its
// leading side, a read row the same edge transparent, so nothing moves when it
// is read; a link lifts to --recess under the pointer and rings on focus.
// There is no per-row control to find: opening a row reads it, and "Mark all
// as read" sits above the list.

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { getTitle, type NotificationCardData } from "@/components/notifications/NotificationCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  isBuildNotificationKind,
  notificationHref,
  notificationMessage,
  type Notification,
} from "@/lib/notifications";
import { commentTime } from "@/lib/social/time";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, tabular } from "@/lib/theme/type";

export function actorName(n: Pick<Notification, "actor">): string | null {
  const actor = n.actor;
  if (!actor) return null;
  return actor.display_name?.trim() || (actor.username ? `@${actor.username}` : "Someone");
}

/**
 * The legacy kinds the old row knew keep its words, which name their own actor
 * (NotificationCard's getTitle, BG-P26's contract in e2e/tier2).
 */
const LEGACY_TITLED = new Set([
  "reference_received",
  "new_follower",
  "bounty_interaction",
  "engagement",
  "new_message",
  "mention",
  "system",
]);

function legacyCard(n: Notification): NotificationCardData {
  return {
    id: n.id,
    kind: n.kind,
    isRead: n.is_read,
    timestamp: n.created_at,
    actor: n.actor
      ? {
          displayName: n.actor.display_name || n.actor.username || "Someone",
          handle: n.actor.username || "",
          avatarUrl: n.actor.avatar_url ?? null,
        }
      : null,
    target: n.target
      ? { contentType: String(n.target.type), contentId: n.target.id, contentTitle: n.target.title || "", slug: n.target.slug ?? null }
      : null,
    body: n.body || "",
    metadata: (n.metadata ?? {}) as NotificationCardData["metadata"],
  };
}

/** The row's sentence: who and what for the kinds this page knows; the stored message for any other. */
function sentence(n: Notification, name: string | null): ReactNode {
  if (LEGACY_TITLED.has(n.kind)) return getTitle(legacyCard(n));
  if (isBuildNotificationKind(n.kind) || n.kind === "message_received") {
    return (
      <>
        {name ? <span style={{ fontWeight: 600 }}>{name} </span> : null}
        {notificationMessage(n)}
      </>
    );
  }
  return notificationMessage(n);
}

export interface NotificationRowProps {
  notification: Notification;
  /** Opening a row that leads somewhere reads it. */
  onOpen: (notification: Notification) => void;
}

export function NotificationRow({ notification, onOpen }: NotificationRowProps) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const href = notificationHref(notification);
  const name = actorName(notification);
  const initial = (name ?? "?").replace(/^@/, "").slice(0, 1).toUpperCase();

  const content = (
    <>
      <Avatar style={{ width: 36, height: 36, flexShrink: 0 }}>
        {notification.actor?.avatar_url ? <AvatarImage src={notification.actor.avatar_url} alt="" /> : null}
        <AvatarFallback style={{ background: t.recess, color: t.text2, fontFamily: DM_MONO, fontSize: 12 }}>
          {initial}
        </AvatarFallback>
      </Avatar>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <p data-testid="notification-message" style={{ ...body, color: t.text, margin: 0, overflowWrap: "anywhere" }}>
          {sentence(notification, name)}
        </p>
        {notification.build?.title ? (
          <span
            data-testid="notification-build"
            style={{ ...body, color: t.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {notification.build.title}
          </span>
        ) : null}
        <time
          dateTime={notification.created_at}
          style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.3, color: t.text2, ...tabular }}
        >
          {commentTime(notification.created_at)}
        </time>
      </div>
    </>
  );

  const rowStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: SPACE.sm,
    padding: `${SPACE.sm}px ${SPACE.sm}px ${SPACE.sm}px ${SPACE.sm - 2}px`,
    borderInlineStart: `2px solid ${notification.is_read ? "transparent" : t.action}`,
    color: t.text,
    textDecoration: "none",
  } as const;

  return href ? (
    <Link
      to={href}
      data-testid="notification"
      data-kind={notification.kind}
      data-unread={notification.is_read ? undefined : "true"}
      onClick={() => onOpen(notification)}
      {...handlers}
      style={{
        ...rowStyle,
        background: state.hovered ? t.recess : "transparent",
        transition: feedback("background-color"),
        ...ring(state.focusVisible),
      }}
    >
      {content}
    </Link>
  ) : (
    <div
      data-testid="notification"
      data-kind={notification.kind}
      data-unread={notification.is_read ? undefined : "true"}
      style={rowStyle}
    >
      {content}
    </div>
  );
}

export default NotificationRow;
