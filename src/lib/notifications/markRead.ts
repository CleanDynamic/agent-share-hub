import { supabase } from "@/integrations/supabase/client";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications" as any)
    .update({ is_read: true } as any)
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications" as any)
    .update({ is_read: true } as any)
    .eq("recipient_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}
