// The eyebrow (UI-P07): the small mono label over a heading, a panel or a value.
//
// DM Mono 11px — 10px inside wall labels and panels — upper case, letter-spacing
// .09em, in `--label`, on one line. `--label` is a ground-measured ink (6.78:1
// on Noon's glass, 6.60:1 on Dusk's), so it is text, unlike the lamp.

import type { CSSProperties, ElementType, ReactNode } from "react";

import { t } from "@/lib/theme/tokens";
import { mono } from "@/lib/theme/type";

export interface EyebrowProps {
  children: ReactNode;
  /** 10 inside wall labels and panels, 11 elsewhere. */
  size?: 10 | 11;
  as?: ElementType;
  style?: CSSProperties;
}

export function Eyebrow({ children, size = 11, as: Tag = "div", style }: EyebrowProps) {
  return (
    <Tag
      data-ui="eyebrow"
      style={{
        ...mono(size, { caps: true }),
        fontWeight: 400,
        lineHeight: "normal",
        color: t.label,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export default Eyebrow;
