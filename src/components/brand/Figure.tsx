// The figure (UI-P85, refined look): a number the page leads with.
//
// The `figure` role (24px Geist 500, tabular) with its unit beside it in 12 `--text2`, six apart on the baseline. An
// optional label sits above as an eyebrow, with an optional lamp bar before it — the bar says "this one is lit", and
// the figure is printed whether or not it is.

import type { ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE, figure } from "@/lib/theme/type";

import { Eyebrow } from "./Eyebrow";
import { LampBar } from "./LampDot";

export interface FigureProps {
  value: ReactNode;
  /** "xp", "of 100", "%". */
  unit?: ReactNode;
  label?: ReactNode;
  /** A lamp bar before the label. */
  lamp?: boolean;
}

export function Figure({ value, unit, label, lamp = false }: FigureProps) {
  return (
    <div data-ui="figure" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {label !== undefined || lamp ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {lamp ? <LampBar /> : null}
          {label !== undefined ? <Eyebrow>{label}</Eyebrow> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ ...figure, color: t.text }}>{value}</span>
        {unit !== undefined ? (
          <span style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default Figure;
