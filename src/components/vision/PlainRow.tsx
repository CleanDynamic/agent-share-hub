/* Synth 06: a row of plain values. Label left, value right, no hairlines: 12px 16px padding, hover Card. Numbers are
   right-aligned and tabular. `last` is kept so callers compile. */

import { useState, type ElementType, type ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type PlainRowHeight = 40 | 44 | 48 | 52 | 56;

export interface PlainRowProps {
  label: ReactNode;
  value?: ReactNode;
  height?: PlainRowHeight;
  /** Kept for callers; rows have no lines. */
  last?: boolean;
  as?: ElementType;
}

export function PlainRow({ label, value, height = 40, as: Tag = "div" }: PlainRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Tag
      data-ui="plain-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxSizing: "border-box",
        minHeight: height,
        padding: "12px 16px",
        borderRadius: 8,
        background: hovered ? t.module : "transparent",
        fontFamily: FIGTREE,
        fontSize: 15,
        lineHeight: "20px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ flexGrow: 1, minWidth: 0, fontWeight: 600, color: t.text }}>{label}</span>
      {value !== undefined ? (
        <span style={{ flexShrink: 0, fontWeight: 400, color: t.label, textAlign: "right" }}>{value}</span>
      ) : null}
    </Tag>
  );
}

export default PlainRow;
