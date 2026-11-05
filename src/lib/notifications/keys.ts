// The stable keys of every notification the database writes (UX-09, for UX-15's Settings › Notifications).
//
// Each key is the `kind` argument public.rc_notify (20261001200000) is called with, stored in notifications.notification_type. A key
// never changes once written: rows already stored carry it, and UX-15's switches (one per key, read by rc_notify) are keyed on it.
// A new kind gets a new key here in the same change as the migration that writes it; `keys.test.ts` reads every migration and fails
// when a kind rc_notify or rc_notify_savers is called with is missing from this list.
//
// Saved-item notifications (SV-20, rc_notify_savers) reuse `rebuilt`, `reproduced` and `solution`: the reader is told under the same
// key, and target_type ('node' or 'collection') says it reached them through something they kept.

export interface NotificationKey {
  /** The kind rc_notify writes. Stable. */
  key: string;
  /** Who is told, and of what: plain words for the settings page. */
  tells: string;
  /** The migration that first writes it. */
  since: string;
}

export const NOTIFICATION_KEYS = [
  // Builds (RC-P19, 20261001200000; SV-20 adds savers, 20261031120000)
  { key: "rebuilt", tells: "A build of yours, or one you kept, was rebuilt", since: "20261001200000_rc_build_notifications" },
  { key: "published", tells: "Someone you follow published a build", since: "20261001200000_rc_build_notifications" },
  { key: "reproduced", tells: "A build of yours, or one you kept, was run", since: "20261001200000_rc_build_notifications" },
  { key: "comment", tells: "Someone commented on your build", since: "20261001200000_rc_build_notifications" },
  { key: "reply", tells: "Someone replied to your comment on a build", since: "20261001200000_rc_build_notifications" },
  { key: "like", tells: "Someone liked your build", since: "20261001200000_rc_build_notifications" },
  { key: "solution", tells: "An answer came to your request, or to one on a build you kept", since: "20261001200000_rc_build_notifications" },
  { key: "solved", tells: "Your answer to a request was accepted", since: "20261001200000_rc_build_notifications" },
  { key: "follow", tells: "Someone followed you", since: "20261001200000_rc_build_notifications" },
  // Topics and replies (UX-04, 20261107160000)
  { key: "post_reply", tells: "Someone replied to your topic or your reply", since: "20261107160000_ux04_notifications" },
  { key: "post_thread", tells: "Someone replied in a topic you started", since: "20261107160000_ux04_notifications" },
  { key: "post_mention", tells: "Someone mentioned you", since: "20261107160000_ux04_notifications" },
  { key: "post_like", tells: "Someone liked your topic or your reply", since: "20261107160000_ux04_notifications" },
  { key: "post_started", tells: "Someone started a topic from your build, part, session or step", since: "20261107160000_ux04_notifications" },
  { key: "post_pinned", tells: "Your topic or reply was pinned", since: "20261107160000_ux04_notifications" },
] as const satisfies ReadonlyArray<NotificationKey>;

export type NotificationKeyName = (typeof NOTIFICATION_KEYS)[number]["key"];

export function isNotificationKey(kind: string): kind is NotificationKeyName {
  return NOTIFICATION_KEYS.some((entry) => entry.key === kind);
}
