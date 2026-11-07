/* UX-15 P2: the Settings frame. PURE.

   Desktop: a 220 left list of the six sections (the current one in `text` with a 1px underline and `aria-current="page"`), then the
   section at the site's reading measure. Phone: `/settings` is the list; a section is its own page, without the list.
   `/settings` on a desktop shows the list and the first section beside it, so the page is never empty. */

import type { CSSProperties, ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PlainRow } from "@/components/vision/PlainRow";
import { PageLink } from "@/lib/routing/PageLink";
import { SECTIONS, settingsPath, type SectionKey } from "@/lib/settings/sections";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, measure } from "@/lib/theme/type";

import { sectionTitle } from "./SettingParts";

const link: CSSProperties = { textDecoration: "none", color: "inherit", display: "block" };

export interface SettingsFrameProps {
  /** The section the address names; null for `/settings`. */
  section: SectionKey | null;
  children?: ReactNode;
}

export function SettingsFrame({ section, children }: SettingsFrameProps) {
  const phone = useIsPhone();

  if (phone) {
    if (section) return <div style={{ ...measure }}>{children}</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={sectionTitle}>Settings</h1>
        <nav aria-label="Settings">
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {SECTIONS.map((s, index) => (
              <li key={s.key}>
                <PageLink to={settingsPath(s.key)} style={{ ...link, minHeight: 48 }}>
                  <PlainRow
                    as="span"
                    height={56}
                    last={index === SECTIONS.length - 1}
                    label={
                      <span style={{ display: "block" }}>
                        <span style={{ display: "block", color: t.text, fontWeight: 500 }}>{s.label}</span>
                        <span style={{ display: "block", color: t.label, fontSize: 12, lineHeight: 1.4 }}>{s.note}</span>
                      </span>
                    }
                    value={<Glyph name="chev" size={12} />}
                  />
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
    <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0, 1fr)", columnGap: 56, alignItems: "start", fontFamily: FIGTREE }}>
      <nav aria-label="Settings">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {SECTIONS.map((s) => {
            const isCurrent = s.key === current;
            return (
              <li key={s.key}>
                <PageLink
                  to={settingsPath(s.key)}
                  aria-current={isCurrent ? "page" : undefined}
                  style={{ ...link, minHeight: 36, lineHeight: "36px", fontSize: 13, fontWeight: isCurrent ? 500 : 400, color: isCurrent ? t.text : t.text2 }}
                >
                  <span style={isCurrent ? { textDecoration: "underline", textUnderlineOffset: 6, textDecorationThickness: 1 } : undefined}>{s.label}</span>
                </PageLink>
              </li>
            );
          })}
        </ul>
      </nav>
      <div style={{ ...measure, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default SettingsFrame;
