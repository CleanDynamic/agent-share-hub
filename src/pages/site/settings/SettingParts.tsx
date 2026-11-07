/* UX-15 P2: the pieces every section is made of. PURE.

   A section is an `h1`, then groups. A group is a `module` box with a `SectionHead` and rows. A row is a label in `text`, one line of
   explanation in `label`, and one control on the right (below, on a phone). Nothing here animates and nothing is new: the box is
   the module recipe, the type is the site's roles, the colours are tokens. */

import type { CSSProperties, ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { SectionHead } from "@/components/vision/SectionHead";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export const sectionTitle: CSSProperties = {
  margin: 0,
  fontFamily: FIGTREE,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.015em",
  color: t.text,
};

/** The section's `h1` and the column the groups sit in (48 between groups, the site's rule). */
export function SectionPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, fontFamily: FIGTREE }}>
      <h1 style={sectionTitle}>{title}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
    </div>
  );
}

/** A `module` box with its head. */
export function Group({ title, meta, children, testId }: { title: string; meta?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <SectionHead title={title} meta={meta} headingLevel={2} />
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  label: ReactNode;
  /** One line under the label. */
  hint?: ReactNode;
  /** The one control or button. */
  control?: ReactNode;
  /** No hairline under it. */
  last?: boolean;
  /** Sits under the row, full width: a form that opened in place. */
  below?: ReactNode;
  id?: string;
}

export function SettingRow({ label, hint, control, last = false, below, id }: SettingRowProps) {
  const phone = useIsPhone();
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${t.hairline}`, padding: "12px 0" }} data-ui="setting-row">
      <div style={{ display: "flex", flexDirection: phone ? "column" : "row", alignItems: phone ? "stretch" : "center", gap: phone ? 8 : 16, minHeight: 32 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div id={id} style={{ fontSize: 13, fontWeight: 500, lineHeight: "20px", color: t.text }}>{label}</div>
          {hint ? <div style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.4, color: t.label, marginTop: 2 }}>{hint}</div> : null}
        </div>
        {control ? <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: phone ? "flex-start" : "flex-end" }}>{control}</div> : null}
      </div>
      {below ? <div style={{ marginTop: 12 }}>{below}</div> : null}
    </div>
  );
}

/** A sentence that is not a setting: the status of a save, a reason a control is off. `label` colour, 12px. */
export function Note({ children, role }: { children: ReactNode; role?: "status" | "alert" }) {
  return (
    <p role={role} style={{ margin: 0, fontSize: 12, fontWeight: 400, lineHeight: 1.4, color: t.label }}>
      {children}
    </p>
  );
}
