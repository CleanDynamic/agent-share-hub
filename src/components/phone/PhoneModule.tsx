// A module on a phone (prompt 17): a Panel block inside the page, margin 8 16, radius 12, padding 16, a 10 gap between its
// children. For a group that must read as one thing: an empty state, a reference. A shade, never a line.

import type { CSSProperties, ReactNode } from "react";

import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";

export interface PhoneModuleProps {
  children?: ReactNode;
  /** Names the block when it is a region of its own. */
  label?: string;
  style?: CSSProperties;
}

export function PhoneModule({ children, label, style }: PhoneModuleProps) {
  return (
    <section
      data-ui="phone-module"
      aria-label={label}
      style={{
        boxSizing: "border-box",
        margin: `${PANEL_GUTTER}px ${PHONE_MARGIN}px`,
        padding: PANEL_PAD,
        borderRadius: PANEL_RADIUS,
        background: t.surface,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export default PhoneModule;
