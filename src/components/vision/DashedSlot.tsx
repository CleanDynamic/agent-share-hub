/* SV-02: an open slot (series README, Visual grammar): transparent, a 1px dashed `--label` edge, radius 6, or 8 for a
   slot as wide as the page (`wide`). It holds a line or an action, never a decoration. */

import type { CSSProperties, ElementType, ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

export interface DashedSlotProps {
  /** A page-width slot: radius 8. */
  wide?: boolean;
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
  /** SV-08: whatever the element it is drawn as takes (`to`, `href`, `data-*`, drag handlers). */
  [attribute: string]: unknown;
}

export function DashedSlot({ wide = false, as: Tag = "div", style, children, ...rest }: DashedSlotProps) {
  return (
    <Tag
      {...rest}
      data-ui="dashed-slot"
      style={{
        boxSizing: "border-box",
        minWidth: 0,
        background: "transparent",
        border: `1px dashed ${t.label}`,
        borderRadius: wide ? r.card : r.control,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default DashedSlot;
