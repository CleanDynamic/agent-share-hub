/* UX-15 P4: Notifications. PURE: the switches' state and one callback. One group per area, one switch per kind, each worded from the
   person's side. A switch saves at once (the container writes and says `Saved.`); there is no Save button. Retired kinds have no row.
   The last line says where notifications go. */

import { Switch } from "@/components/ui/switch";
import { PREFERENCE_GROUPS, type NotificationPreferences, type PreferenceKey } from "@/lib/settings/notificationPrefs";

import { Group, Note, SectionPage, SettingRow } from "./SettingParts";

export const NOTIFICATIONS_NOTE = "Notifications appear on your Notifications page. No notification is sent by email.";

export interface NotificationsViewProps {
  prefs: NotificationPreferences;
  onToggle: (key: PreferenceKey, on: boolean) => void;
}

export function NotificationsView({ prefs, onToggle }: NotificationsViewProps) {
  return (
    <SectionPage title="Notifications">
      {PREFERENCE_GROUPS.map((group) => (
        <Group key={group.title} title={group.title}>
          {group.rows.map((row, index) => {
            const id = `pref-${row.key}`;
            return (
              <SettingRow
                key={row.key}
                id={id}
                last={index === group.rows.length - 1}
                label={row.label}
                control={<Switch aria-labelledby={id} checked={prefs[row.key]} onCheckedChange={(on) => onToggle(row.key, on)} />}
              />
            );
          })}
        </Group>
      ))}
      <Note>{NOTIFICATIONS_NOTE}</Note>
    </SectionPage>
  );
}

export default NotificationsView;
