// Shared types for the notifications data layer.

/**
 * RC-P19 — the nine kinds the database writes about builds
 * (20261001200000_rc_build_notifications.sql). Their message is the stored
 * body: fixed text, never a reader's.
 */
export const BUILD_NOTIFICATION_KINDS = [
  "rebuilt",
  "published",
  "reproduced",
  "comment",
  "reply",
  "like",
  "solution",
  "solved",
  "follow",
] as const;

export type BuildNotificationKind = (typeof BUILD_NOTIFICATION_KINDS)[number];

export type NotificationKind =
  | BuildNotificationKind
  | "reference_received"
  | "new_follower"
  | "bounty_interaction"
  | "engagement"
  | "new_message"
  | "mention"
  | "system"
  // Legacy / system-generated kinds we still want to surface.
  | "message_received"
  | string;

export type NotificationTargetType =
  | "blueprint"
  | "blog"
  | "bounty"
  | "stage"
  | "block"
  | "comment"
  | "message"
  | "thread"
  | "profile"
  // RC-P19: a build, a comment on one, and a bounty on one.
  | "build"
  | "build_comment"
  | "bounty_build"
  | null;

/** RC-P19 — the build a notification is about, as the page names and links it. */
export interface NotificationBuild {
  id: string;
  slug: string;
  title: string | null;
}

export interface NotificationActor {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface NotificationTargetPreview {
  id: string;
  type: NonNullable<NotificationTargetType>;
  title: string | null;
  slug: string | null;
  cover_image_url?: string | null;
  // Resolver may attach extra hints (post_type for content_items, etc.)
  extra?: Record<string, any>;
}

export interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  notification_type: string;
  body: string | null;
  target_type: NotificationTargetType;
  target_id: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;

  // Legacy quick-link columns still used by the app.
  content_id?: string | null;
  project_id?: string | null;
  collection_id?: string | null;
}

export interface Notification extends NotificationRow {
  kind: NotificationKind;
  actor: NotificationActor | null;
  target: NotificationTargetPreview | null;
  /** RC-P19: the build it is about, when there is one and the reader can read it. */
  build: NotificationBuild | null;
}

export interface CreateNotificationInput {
  recipientId: string;
  kind: NotificationKind;
  actorId?: string | null;
  targetType?: NotificationTargetType;
  targetId?: string | null;
  body?: string | null;
  metadata?: Record<string, any>;
}
