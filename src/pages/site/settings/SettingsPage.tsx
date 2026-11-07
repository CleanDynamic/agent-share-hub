/* UX-15 P2: /settings and /settings/:section. The container: it reads the address, picks the section and gives the frame its view. The
   data each view needs is read by the containers beside it (`containers.tsx`) through `src/lib/settings/` only. */

import { Navigate, useParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { usePageReady } from "@/lib/routing/pageReady";
import { sectionOf, settingsPath, type SectionKey } from "@/lib/settings/sections";

import { AppearanceView } from "./AppearanceView";
import { AppsView } from "./AppsView";
import { DataView } from "./DataView";
import { NotificationsView } from "./NotificationsView";
import { PrivacyView } from "./PrivacyView";
import { AccountSection } from "./containers";
import { SettingsFrame } from "./SettingsFrame";

function SectionBody({ section }: { section: SectionKey }) {
  switch (section) {
    case "account":
      return <AccountSection />;
    case "notifications":
      return <NotificationsView />;
    case "privacy":
      return <PrivacyView />;
    case "apps":
      return <AppsView />;
    case "data":
      return <DataView />;
    case "appearance":
      return <AppearanceView />;
  }
}

export function SettingsPage() {
  const { section: param } = useParams();
  const section = sectionOf(param);
  const phone = useIsPhone();
  usePageReady("settings", true);

  // An address with a section that does not exist shows the list.
  if (param && !section) return <Navigate to={settingsPath()} replace />;

  // On a phone `/settings` is the list alone; on a desktop it shows the first section beside the list.
  const shown: SectionKey | null = phone ? section : (section ?? "account");
  return (
    <>
      <SeoHead title="Settings" description="Manage your account, notifications, privacy and data." path={settingsPath(section ?? undefined)} noIndex />
      <SettingsFrame section={section}>{shown ? <SectionBody section={shown} /> : null}</SettingsFrame>
    </>
  );
}

export default SettingsPage;
