// The tile and the well (UI-P85, refined look).
//
// TILE: a small thing set into a module: `--tile` over a 1px `--tile-border`, radius 6, padding 12.
// WELL: a place that is sunk rather than raised: `--well`, a 1px `--well-border`, `--well-shadow`, radius 6. A map or
// a piece of media adds the dot grid, `radial-gradient(var(--dot-grid) 1px, transparent 1px)` at 16px.
//
// Neither is glass and neither blurs; both are flat paint, so they sit inside anything (RULES §7b).

import type { CSSProperties, ElementType, ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

interface SurfaceProps {
  as?: ElementType;
  padding?: string | number;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Tile({ as: Tag = "div", padding = 12, style, children }: SurfaceProps) {
  return (
    <Tag
      data-ui="tile"
      style={{
        background: t.tile,
        border: `1px solid ${t.tileBorder}`,
        borderRadius: r.control,
        padding,
        boxSizing: "border-box",
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export interface WellProps extends SurfaceProps {
  /** The dot grid, for a map or for media. */
  dots?: boolean;
}

export function Well({ as: Tag = "div", padding, dots = false, style, children }: WellProps) {
  return (
    <Tag
      data-ui="well"
      data-dots={dots ? "" : undefined}
      style={{
        background: t.well,
        border: `1px solid ${t.wellBorder}`,
        boxShadow: t.wellShadow,
        borderRadius: r.control,
        padding,
        boxSizing: "border-box",
        minWidth: 0,
        ...(dots
          ? { backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`, backgroundSize: "16px 16px" }
          : null),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
