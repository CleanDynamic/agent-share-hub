import { supabase } from "@/integrations/supabase/client";
import { insertNotification } from "@/lib/notifications";

/**
 * Extract @username mentions from text.
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

/**
 * After inserting text with @mentions, resolve usernames to profiles
 * and send 'mention' notifications.
 */
export async function sendMentionNotifications(params: {
  text: string;
  actorId: string;
  contentId?: string | null;
  context: "comment" | "tip" | "description";
}) {
  const usernames = extractMentions(params.text);
  if (usernames.length === 0) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("username", usernames);

  if (!profiles) return;

  // Get actor username for metadata
  const { data: actor } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", params.actorId)
    .maybeSingle();

  for (const profile of profiles) {
    if (profile.id === params.actorId) continue;
    insertNotification({
      recipient_id: profile.id,
      actor_id: params.actorId,
      notification_type: "mention",
      content_id: params.contentId ?? null,
      metadata: {
        mentioner_username: actor?.username || "",
        context: params.context,
        excerpt: params.text.slice(0, 80),
      },
    });
  }
}
