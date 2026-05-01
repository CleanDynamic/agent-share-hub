import { supabase } from "@/integrations/supabase/client";
import type {
  CreateNotificationInput,
  Notification,
  NotificationRow,
} from "./types";

/**
 * Create a notification.
 * - Skips self-notifications (recipientId === actorId).
 * - Future-proofed for a per-user/per-kind/per-target mute system: today we
 *   only check `profiles.notification_preferences` for a coarse `{kind:false}`
 *   shape. Unknown kinds default to allowed.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<Notification | null> {
  const {
    recipientId,
    kind,
    actorId = null,
    targetType = null,
    targetId = null,
    body = null,
    metadata = {},
  } = input;

  if (!recipientId) throw new Error("recipientId is required");
  if (actorId && actorId === recipientId) return null;

  // Mute check (best-effort — fail open)
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", recipientId)
      .maybeSingle();
    const prefs = ((prof as any)?.notification_preferences ?? {}) as Record<
      string,
      any
    >;
    // Per-kind mute: { [kind]: false } or { mutes: { [kind]: { [targetId]: true } } }
    if (prefs[kind] === false) return null;
    const mutes = prefs.mutes ?? {};
    if (targetId && mutes?.[kind]?.[targetId] === true) return null;
  } catch {
    // ignore — notifications are non-critical
  }

  const payload: any = {
    recipient_id: recipientId,
    actor_id: actorId,
    notification_type: kind,
    body,
    target_type: targetType,
    target_id: targetId,
    metadata,
    // Maintain legacy quick-link columns when caller supplied a content target.
    content_id:
      targetType === "blueprint" || targetType === "blog" || targetType === "bounty"
        ? targetId
        : null,
  };

  const { data, error } = await supabase
    .from("notifications" as any)
    .insert(payload)
    .select(
      "id, recipient_id, actor_id, notification_type, body, target_type, target_id, content_id, project_id, collection_id, metadata, is_read, read_at, created_at"
    )
    .single();
  if (error) throw error;

  const row = data as unknown as NotificationRow;
  return {
    ...row,
    kind: row.notification_type,
    actor: null,
    target: null,
  };
}
