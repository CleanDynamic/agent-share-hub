/* SV-02 — the one boxed tile a page may have (series README, Visual grammar 2): `--module`, 1px `--module-border`,
   radius 8, padding `14px 16px`. Flat paint: no glass, no blur, no shadow. */

import type { CSSProperties, ElementType, ReactNode } from "react";

import { r } from "@/lib/theme/radius";
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
        padding: "14px 16px",
        background: t.module,
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: r.card,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default InnerTile;
