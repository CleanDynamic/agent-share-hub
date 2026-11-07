// UX-15 P4: reading and writing the notification switches.
//
// The read is the person's own `profiles.notification_preferences`; the write is `set_notification_preference`, which takes a known key
// and merges it into the caller's own row in one statement (no read-modify-write in the browser, no other key accepted).

import { supabase } from "@/integrations/supabase/client";

import { parsePreferences, type NotificationPreferences, type PreferenceKey } from "./notificationPrefs";

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase.from("profiles").select("notification_preferences").eq("id", userId).limit(1).maybeSingle();
  if (error) throw error;
  return parsePreferences((data as { notification_preferences?: unknown } | null)?.notification_preferences);
}

export async function setNotificationPreference(key: PreferenceKey, on: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_notification_preference" as never, { _key: key, _on: on } as never);
  if (error) throw error;
}
