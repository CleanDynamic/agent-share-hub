import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the count of unread notifications for the user.
 * Uses the (recipient_id, is_read) index added in the cross-cutting migration.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications" as any)
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}
