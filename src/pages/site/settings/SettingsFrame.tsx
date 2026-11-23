/* Synth 13 Part A: two panels, `300px minmax(0, 1fr)` (260 from 761 to 1100). Left: "Settings" 20/600, then the six
   sections as rows; the current one Card-filled, 15/600 Text, `aria-current="page"`; the rest 15 Text 2. Right: the section.
   At 760 and below the list is its own view and each section opens as a page with a back link.

   UX-15 P2: the Settings frame. PURE.

   Desktop: a left list (the page grid's columns 1 to 3) of the six sections (the current one in `text` with a 1px underline and `aria-current="page"`), then the
   section at the site's reading measure. Phone: `/settings` is the list; a section is its own page, without the list.
   `/settings` on a desktop shows the list and the first section beside it, so the page is never empty. */

import type { CSSProperties, ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { PANEL_GAP } from "@/components/shell/pageGrid";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink } from "@/lib/routing/PageLink";
import { SECTIONS, settingsPath, type SectionKey } from "@/lib/settings/sections";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const panel: CSSProperties = { background: t.surface, borderRadius: 12, padding: 16, boxSizing: "border-box", minWidth: 0 };
const title: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text };


const link: CSSProperties = { textDecoration: "none", color: "inherit", display: "block" };

export interface SettingsFrameProps {
  /** The section the address names; null for `/settings`. */
  section: SectionKey | null;
  children?: ReactNode;
}

export function SettingsFrame({ section, children }: SettingsFrameProps) {
  useColumnPanels(true);
  const phone = useIsPhone();
  const wide = useMinWidth(1101);

  if (phone) {
    if (section) return <div style={panel}>{children}</div>;
    return (
      <div style={{ ...panel, display: "flex", flexDirection: "column", gap: 8, fontFamily: FIGTREE }}>
        <h1 style={title}>Settings</h1>
        <nav aria-label="Settings">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {SECTIONS.map((s) => (
              <li key={s.key}>
                <PageLink to={settingsPath(s.key)} style={{ ...link, display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 0" }}>
                  <span style={{ display: "block", flexGrow: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: t.text, fontSize: 15, lineHeight: "20px" }}>{s.label}</span>
                    <span style={{ display: "block", color: t.label, fontSize: 13, lineHeight: "16px" }}>{s.note}</span>
                  </span>
                  <Glyph name="chev" size={12} />
                </PageLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  }

  const current: SectionKey = section ?? "account";
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${wide ? 300 : 260}px minmax(0, 1fr)`, columnGap: PANEL_GAP, alignItems: "start", fontFamily: FIGTREE }}>
      <nav aria-label="Settings" style={{ ...panel, padding: "16px 8px" }}>
        <div aria-hidden="true" style={{ ...title, padding: "0 8px 8px" }}>
          Settings
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map((s) => {
            const isCurrent = s.key === current;
            return (
              <li key={s.key}>
                <PageLink
                  to={settingsPath(s.key)}
                  aria-current={isCurrent ? "page" : undefined}
                  style={{ ...link, minHeight: 40, lineHeight: "20px", padding: "10px 8px", boxSizing: "border-box", borderRadius: 10, background: isCurrent ? t.module : "transparent", fontSize: 15, fontWeight: isCurrent ? 600 : 400, color: isCurrent ? t.text : t.text2 }}
                >
                  {s.label}
                </PageLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div style={{ ...panel, padding: "16px 24px 24px" }}>{children}</div>
    </div>
  );
}

export default SettingsFrame;
