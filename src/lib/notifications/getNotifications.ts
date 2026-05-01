import { supabase } from "@/integrations/supabase/client";
import { resolveNotificationTargets } from "./resolveTarget";
import type {
  Notification,
  NotificationActor,
  NotificationRow,
  NotificationTargetType,
} from "./types";

export interface GetNotificationsArgs {
  userId: string;
  filter?: "all" | "unread";
  limit?: number;
  offset?: number;
}

export interface GetNotificationsResult {
  notifications: Notification[];
  total: number;
}

const SELECT_COLUMNS =
  "id, recipient_id, actor_id, notification_type, body, target_type, target_id, content_id, project_id, collection_id, metadata, is_read, read_at, created_at";

export async function getNotifications({
  userId,
  filter = "all",
  limit = 25,
  offset = 0,
}: GetNotificationsArgs): Promise<GetNotificationsResult> {
  let query = supabase
    .from("notifications" as any)
    .select(SELECT_COLUMNS, { count: "exact" })
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === "unread") query = query.eq("is_read", false);

  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as NotificationRow[];

  // Batched actor lookup
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))
  );
  const actorById = new Map<string, NotificationActor>();
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds);
    for (const a of (actors ?? []) as any[]) {
      actorById.set(a.id, {
        id: a.id,
        username: a.username ?? null,
        display_name: a.display_name ?? null,
        avatar_url: a.avatar_url ?? null,
      });
    }
  }

  const targetMap = await resolveNotificationTargets(rows);

  const notifications: Notification[] = rows.map((r) => {
    const effectiveType = (r.target_type ??
      (r.content_id ? "blueprint" : null)) as NotificationTargetType;
    const effectiveId = r.target_id ?? r.content_id ?? null;
    const target =
      effectiveType && effectiveId
        ? targetMap.get(`${effectiveType}:${effectiveId}`) ?? null
        : null;

    return {
      ...r,
      kind: r.notification_type,
      actor: r.actor_id ? actorById.get(r.actor_id) ?? null : null,
      target,
    };
  });

  return { notifications, total: count ?? notifications.length };
}
