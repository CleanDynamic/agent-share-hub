import { supabase } from "@/integrations/supabase/client";
import type {
  NotificationRow,
  NotificationTargetPreview,
  NotificationTargetType,
} from "./types";

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
