/* Prompts 17 and 18 - /dev/kit/phone?theme=noon|dusk: every shared phone piece and every mobile icon, drawn 390 wide.
   DEV ONLY: registered behind `import.meta.env.DEV` in App.tsx. */

import { useState } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { MOBILE_ICONS, type MobileIconName } from "@/components/brand/mobileIcons";
import {
  ActionSheet,
  BigButton,
  PhoneBottomSheet,
  PhoneField,
  PhoneModule,
  PhonePills,
  PhoneRow,
  PhoneTabs,
  PhoneToast,
  PhoneTopBar,
  SectionFact,
  Shelf,
} from "@/components/phone";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const names = Object.keys(MOBILE_ICONS) as MobileIconName[];
const TABS = [
  { value: "following", label: "Following" },
  { value: "everyone", label: "Everyone" },
];
const PILLS = [
  { value: "all", label: "All" },
  { value: "web", label: "Web app" },
  { value: "agent", label: "Agent" },
  { value: "data", label: "Data" },
];

export default function KitPhone() {
  const theme = useDesignTheme();
  const [tab, setTab] = useState("following");
  const [pill, setPill] = useState<string | null>("all");
  const [sheet, setSheet] = useState(false);
  const [action, setAction] = useState(false);
  return (
    <div data-design-page="phone" data-design-theme={theme} style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: t.bg, color: t.text, fontFamily: FIGTREE, paddingBottom: 48 }}>
      <section data-catalogue="top-bar">
        <PhoneTopBar left="account" centre="logo" viewer={{ name: "Maya Okafor" }} unread right={{ icon: "search", label: "Search" }} theme={theme === "noon" ? "noon" : "dusk"} />
        <PhoneTopBar left="back" leftLabel="Back to Drafts" centre="A long page title that is cut with an ellipsis" right={{ icon: "more", label: "More" }} />
        <PhoneTopBar left="close" centre="Filters" />
      </section>
      <section data-catalogue="tabs-pills">
        <PhoneTabs tabs={TABS} value={tab} onChange={setTab} label="Feed" equal />
        <PhoneTabs tabs={[...TABS, { value: "x", label: "Saved builds" }, { value: "y", label: "Your library" }, { value: "z", label: "Following" }]} value={tab} onChange={setTab} label="Scrolling tabs" />
        <PhonePills pills={PILLS} value={pill} onChange={setPill} label="Kind" />
      </section>
      <section data-catalogue="shelf-rows">
        <SectionFact fact="3 open in your spaces" link={{ label: "See all", to: "#" }} />
        <Shelf label="Spaces" items={[{ id: "1", number: "12", title: "Kit rebuild", line: "4 days ago" }, { id: "2", number: "3", title: "Notes app", line: "Today" }, { id: "3", number: "8", title: "Sessions", line: "This week" }]} />
        <PhoneRow title="Kit rebuild" line="Web app · Made with AI · No coding" lead={{ kind: "icon", icon: "session" }} trail={{ kind: "chevron" }} onSelect={() => undefined} />
        <PhoneRow title="Notes app" line="2 days ago" trail={{ kind: "count", value: 14 }} lead={{ kind: "grip" }} />
        <PhoneModule label="Empty state">
          <p style={{ margin: 0, fontSize: 15, lineHeight: "20px" }}>No drafts yet</p>
          <BigButton main full>Start a build</BigButton>
        </PhoneModule>
      </section>
      <section data-catalogue="fields-buttons" style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <PhoneField label="Title" defaultValue="Kit rebuild" />
        <PhoneField label="What it does" multiline defaultValue="" onExpand={() => undefined} />
        <BigButton full>Cancel</BigButton>
        <BigButton full main>Post</BigButton>
        <BigButton full onClick={() => setSheet(true)}>Open a sheet</BigButton>
        <BigButton full onClick={() => setAction(true)}>Open an action sheet</BigButton>
        <PhoneToast action={{ label: "Undo", onClick: () => undefined }}>Draft moved</PhoneToast>
      </section>
      <section data-catalogue="icons">
        <SectionFact fact={`${names.length} icons`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "0 16px" }}>
          {names.map((name) => (
            <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 0", borderRadius: 8, background: t.module }}>
              <MobileIcon name={name} size={24} />
              <span style={{ fontSize: 13, lineHeight: "16px", color: t.text2 }}>{name}</span>
            </div>
          ))}
        </div>
      </section>
      <PhoneBottomSheet open={sheet} onOpenChange={setSheet} title="Filters" line="2 selected" footer={{ status: "Not saved", actions: <BigButton main>Apply</BigButton> }}>
        <div style={{ padding: "0 16px" }}>
          <PhoneField label="Name" />
        </div>
      </PhoneBottomSheet>
      <ActionSheet open={action} onOpenChange={setAction} title="Delete draft?" explanation="It cannot be undone." action={{ label: "Delete", danger: true, onSelect: () => setAction(false) }} />
    </div>
  );
}
