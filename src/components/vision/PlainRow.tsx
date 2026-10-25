/* SV-02 — a row of plain values (series README, Visual grammar 5).

   Label left, value right, a `--hairline` under every row but the last. Heights are the boards': 40, 44, 48, 52 or 56.
   Numbers are right-aligned and tabular. The last row is the caller's to say (`last`), so a list reads the same
   whether it is one component per row or a map. */

import type { ElementType, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export type PlainRowHeight = 40 | 44 | 48 | 52 | 56;

export interface PlainRowProps {
  label: ReactNode;
  value?: ReactNode;
  height?: PlainRowHeight;
  /** No hairline under it. */
  last?: boolean;
  as?: ElementType;
}

export function PlainRow({ label, value, height = 40, last = false, as: Tag = "div" }: PlainRowProps) {
  return (
    <Tag
      data-ui="plain-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxSizing: "border-box",
        minHeight: height,
        borderBottom: last ? "none" : `1px solid ${t.hairline}`,
        fontFamily: FIGTREE,
        fontSize: 13,
        lineHeight: "normal",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ flexGrow: 1, minWidth: 0, fontWeight: 400, color: t.text2 }}>{label}</span>
      {value !== undefined ? (
        <span style={{ flexShrink: 0, fontWeight: 500, color: t.text, textAlign: "right" }}>{value}</span>
      ) : null}
    </Tag>
  );
}

export default PlainRow;
