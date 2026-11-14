/* Settings while it loads: the route table's Placeholder for /settings and /settings/<section>, and the cards each section
   draws while its data is on its way. The page's frame (the h1, the list of sections) is the loaded page's own, drawn at once;
   the section is its title and one card per group it will show, each at its fewest rows (`SectionLoading`). */

import { useLocation } from "react-router-dom";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { LINKABLE } from "@/lib/settings/account";
import { PREFERENCE_GROUPS } from "@/lib/settings/notificationPrefs";
import { sectionLabel, sectionOf, type SectionKey } from "@/lib/settings/sections";

import { SectionLoading, type GroupBones } from "./SettingParts";
import { SettingsFrame } from "./SettingsFrame";

/* Each section's cards while it loads, one per group its view draws, each at its fewest rows. Account: Email, Password,
   Sign-in methods (a row for each provider the site offers, linked or not) and Devices, a row with a hint each.
   Notifications: its groups, their rows without hints. Privacy: Your profile's two rows; Blocked people and How blocking
   works, a note each when nobody is blocked. Connected apps: the one group, a note when no app has access. Your data:
   Download and Delete, a row each. Appearance: Theme, one row. */
export const SECTION_BONES: Record<SectionKey, readonly GroupBones[]> = {
  account: [{ rows: 1, hint: true }, { rows: 1, hint: true }, { rows: LINKABLE.length, hint: true }, { rows: 1, hint: true }],
  notifications: PREFERENCE_GROUPS.map((group) => ({ rows: group.rows.length })),
  privacy: [{ rows: 2, hint: true }, { rows: 0 }, { rows: 0 }],
  apps: [{ rows: 0 }],
  data: [{ rows: 1, hint: true }, { rows: 1, hint: true }],
  appearance: [{ rows: 1, hint: true }],
};

/** The Settings page as it stands before its section's data arrives. On a desktop `/settings` shows the first section, as
    the page does; on a phone `/settings` is the list alone. */
export function SettingsLoadingView() {
  const phone = useIsPhone();
  const section = sectionOf(useLocation().pathname.split("/")[2]);
  const shown: SectionKey | null = phone ? section : (section ?? "account");
  return <SettingsFrame section={section}>{shown ? <SectionLoading title={sectionLabel(shown)} groups={SECTION_BONES[shown]} /> : null}</SettingsFrame>;
}

export default SettingsLoadingView;
