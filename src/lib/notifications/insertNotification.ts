/**
 * Legacy fire-and-forget notification insert. Kept for backwards
 * compatibility with the many places in the codebase that still call
 * `insertNotification(...)` directly. New code should prefer the typed
 * `notify*` triggers from `./triggers`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertNotification(params: {
  recipient_id: string;
  actor_id?: string | null;
  notification_type: string;
  content_id?: string | null;
  project_id?: string | null;
  collection_id?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    if (params.actor_id && params.actor_id === params.recipient_id) return;
    await supabase.from("notifications" as any).insert({
      recipient_id: params.recipient_id,
      actor_id: params.actor_id ?? null,
      notification_type: params.notification_type,
      content_id: params.content_id ?? null,
      project_id: params.project_id ?? null,
      collection_id: params.collection_id ?? null,
      metadata: params.metadata ?? {},
    } as any);
  } catch {
    /* silent — notifications are non-critical */
  }
}
