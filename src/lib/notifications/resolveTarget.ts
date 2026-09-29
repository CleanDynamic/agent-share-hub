import { supabase } from "@/integrations/supabase/client";
import {
  BUILD_NOTIFICATION_KINDS,
  type BuildNotificationKind,
  type Notification,
  type NotificationBuild,
  type NotificationRow,
  type NotificationTargetPreview,
  type NotificationTargetType,
} from "./types";

/* ── RC-P19: builds ─────────────────────────────────────────────────────────

   A notification about a build carries the build's id in metadata.build_id
   (rc_notify writes it there as well as in notifications.build_id, so this
   reads a column that exists whether or not 20261001200000 has been applied).
   The bounty layer's own bounty_interaction rows carry it there too. Every
   build on a page is named in ONE request ⟦neoscale-performance⟧. */

/** The build a row is about, or null. */
export function buildIdOf(row: Pick<NotificationRow, "metadata" | "target_type" | "target_id">): string | null {
  const fromMetadata = row.metadata?.build_id;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) return fromMetadata;
  return row.target_type === "build" ? row.target_id : null;
}

/** Every build a page of notifications is about, in one request. A build the reader cannot read is absent. */
export async function resolveNotificationBuilds(rows: NotificationRow[]): Promise<Map<string, NotificationBuild>> {
  const ids = [...new Set(rows.map(buildIdOf).filter((id): id is string => id !== null))];
  const out = new Map<string, NotificationBuild>();
  if (ids.length === 0) return out;

  const { data, error } = await supabase.from("builds").select("id, slug, title").in("id", ids).limit(ids.length);
  if (error) return out;
  for (const row of (data ?? []) as Array<{ id: string; slug: string; title: string | null }>) {
    out.set(row.id, { id: row.id, slug: row.slug, title: row.title ?? null });
  }
  return out;
}

/**
 * Where a notification leads, or null when it leads nowhere. A build target is
 * the build's page: build and bounty_build to /b2/<slug>, build_comment to its
 * comments (/b2/<slug>#comments). A kind this page does not know leads
 * nowhere: it shows its stored message and nothing else.
 */
export function notificationHref(n: Notification): string | null {
  switch (n.target_type) {
    case "build":
    case "bounty_build":
      return n.build ? `/b2/${n.build.slug}` : null;
    case "build_comment":
      return n.build ? `/b2/${n.build.slug}#comments` : null;
    default:
      break;
  }
  switch (n.kind) {
    case "follow":
    case "new_follower":
      return n.actor?.username ? `/profile/${n.actor.username}` : null;
    case "message_received":
    case "new_message": {
      const thread =
        (typeof n.metadata?.thread_id === "string" ? n.metadata.thread_id : null) ??
        (n.target_type === "thread" ? n.target_id : null);
      return thread ? `/messages/${thread}` : "/messages";
    }
    case "bounty_interaction":
      return n.build ? `/b2/${n.build.slug}` : null;
    default:
      return null;
  }
}

/** The words each build kind is written with (rc_notify's messages), should a row arrive without them. */
const BUILD_MESSAGES: Record<BuildNotificationKind, string> = {
  rebuilt: "rebuilt your build",
  published: "published a new build",
  reproduced: "ran your build",
  comment: "commented on your build",
  reply: "replied to your comment",
  like: "liked your build",
  solution: "posted a solution to your bounty",
  solved: "accepted your solution",
  follow: "started following you",
};

export function isBuildNotificationKind(kind: string): kind is BuildNotificationKind {
  return (BUILD_NOTIFICATION_KINDS as readonly string[]).includes(kind);
}

/**
 * What a notification says after its actor's name. The nine build kinds say
 * their stored message; a direct message says so; anything else says its
 * stored message, or that there is one.
 */
export function notificationMessage(n: Notification): string {
  const stored = n.body?.trim() ?? "";
  if (isBuildNotificationKind(n.kind)) return stored || BUILD_MESSAGES[n.kind];
  if (n.kind === "message_received") return "sent you a message";
  return stored || "New notification";
}

/**
 * Polymorphic resolver. Given a notification target_type + target_id, fetch a
 * minimal preview (title/slug/cover) so the UI can render a link without an
 * extra round-trip per item.
 *
 * Batched to one query per (target_type) for a page of notifications.
 */
export async function resolveNotificationTargets(
  rows: NotificationRow[]
): Promise<Map<string, NotificationTargetPreview>> {
  const out = new Map<string, NotificationTargetPreview>();

  // Bucket ids by effective target_type. Falls back to legacy content_id.
  const byType: Record<string, Set<string>> = {};
  const trackedRowKey = (type: NonNullable<NotificationTargetType>, id: string) =>
    `${type}:${id}`;

  for (const r of rows) {
    const id = r.target_id ?? r.content_id ?? null;
    if (!id) continue;
    let type = r.target_type as NonNullable<NotificationTargetType> | null;
    if (!type && r.content_id) type = "blueprint";
    if (!type) continue;
    // RC-P19: builds are named by resolveNotificationBuilds, and a follow's
    // profile is its actor, whom the page already has.
    if (type === "build" || type === "build_comment" || type === "bounty_build") continue;
    if (type === "profile" && r.notification_type === "follow") continue;
    (byType[type] ??= new Set()).add(id);
  }

  // ---- content_items covers blueprint/blog/bounty/stage (stage_grids embed)
  const contentTypes: NonNullable<NotificationTargetType>[] = [
    "blueprint",
    "blog",
    "bounty",
  ];
  const contentIds = new Set<string>();
  for (const t of contentTypes) byType[t]?.forEach((id) => contentIds.add(id));

  if (contentIds.size > 0) {
    const { data } = await supabase
      .from("content_items")
      .select("id, title, slug, cover_image_url, post_type")
      .in("id", Array.from(contentIds));
    for (const row of (data ?? []) as any[]) {
      // The notification can claim type 'blueprint' even when post_type='blog'.
      // Trust the notification's declared type so the link resolves correctly.
      for (const t of contentTypes) {
        if (byType[t]?.has(row.id)) {
          out.set(trackedRowKey(t, row.id), {
            id: row.id,
            type: t,
            title: row.title ?? null,
            slug: row.slug ?? null,
            cover_image_url: row.cover_image_url ?? null,
            extra: { post_type: row.post_type ?? null },
          });
        }
      }
    }
  }

  // ---- profile
  if (byType.profile?.size) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", Array.from(byType.profile));
    for (const row of (data ?? []) as any[]) {
      out.set(trackedRowKey("profile", row.id), {
        id: row.id,
        type: "profile",
        title: row.display_name ?? row.username ?? null,
        slug: row.username ?? null,
        cover_image_url: row.avatar_url ?? null,
      });
    }
  }

  // ---- comment
  if (byType.comment?.size) {
    const { data } = await supabase
      .from("content_comments")
      .select("id, content_id, text")
      .in("id", Array.from(byType.comment));
    for (const row of (data ?? []) as any[]) {
      out.set(trackedRowKey("comment", row.id), {
        id: row.id,
        type: "comment",
        title: (row.text ?? "").slice(0, 80) || "Comment",
        slug: null,
        extra: { content_id: row.content_id },
      });
    }
  }

  // ---- thread / message — no public title; surface a generic label.
  for (const t of ["thread", "message"] as const) {
    byType[t]?.forEach((id) => {
      out.set(trackedRowKey(t, id), {
        id,
        type: t,
        title: t === "thread" ? "Conversation" : "Message",
        slug: null,
      });
    });
  }

  // ---- block / stage — embedded in content_items.stage_grids; surface a label.
  for (const t of ["stage", "block"] as const) {
    byType[t]?.forEach((id) => {
      out.set(trackedRowKey(t, id), {
        id,
        type: t,
        title: t === "stage" ? "Stage" : "Block",
        slug: null,
      });
    });
  }

  return out;
}
