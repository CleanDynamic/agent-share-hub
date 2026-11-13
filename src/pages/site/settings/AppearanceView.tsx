/* UX-15 P8: Appearance. One row: `Theme`, with the site's own Light, Dark, System control. It is the same `ThemeSegmented` the phone's
   account sheet, the footer and the sign-in page draw, bound to the same `ThemeContext` and stored where it is stored today
   (`localStorage`, `bg-theme`), so a choice made here and a choice made there are one choice. The choice applies at once; there is no
   Save. */

import { ThemeSegmented } from "@/components/theme/ThemeSegmented";

import { Group, SectionPage, SettingRow } from "./SettingParts";

export function AppearanceView() {
  return (
    <SectionPage title="Appearance">
      <Group title="Theme">
        <SettingRow last id="pref-theme" label="Theme" hint="Light, Dark, or whatever your device is set to." control={<ThemeSegmented size={28} fontSize={12} />} />
      </Group>
    </SectionPage>
  );
}

export default AppearanceView;
