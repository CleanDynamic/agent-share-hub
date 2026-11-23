/* Synth 06: a card inside a panel (quoted builds, "Rebuilt from" boxes, attached work): Card fill, radius 12,
   12px 14px padding, 4px between lines, no border. Controls inside it are Raised. */

import type { CSSProperties, ElementType, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";

export interface InnerTileProps {
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
}

export function InnerTile({ as: Tag = "div", style, children }: InnerTileProps) {
  return (
    <Tag
      data-ui="inner-tile"
      style={{
        boxSizing: "border-box",
        minWidth: 0,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: t.module,
        border: 0,
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default InnerTile;
