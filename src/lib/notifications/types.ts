// Shared types for the notifications data layer.

export type NotificationKind =
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
  | null;

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
