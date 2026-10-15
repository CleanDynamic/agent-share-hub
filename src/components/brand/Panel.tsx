// The panel and its head (UI-P09, UI-P85).
//
// ONE RECIPE. `glass` and `plain` both paint the MODULE: `--module` over a 1px `--module-border`, radius `--r-card`
// (8), `--module-shadow`, no blur and no filter. The prop keeps its name so no call site changes, and `data-surface`
// still reports what was asked for. `flat` is the workspace, compose and import only: a solid `--flat` with the
// same hairline and no shadow, because a place you work in is not a thing on display.
//
// The padding is the caller's to set; the default is the module's 16, and the head is `CardHead`'s (13.5/500 over a 12
// subtitle, gap 4).

import type { CSSProperties, ElementType, ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { CardHead } from "./CardHead";

export type PanelSurface = "glass" | "flat" | "plain";

export interface PanelProps {
  surface?: PanelSurface;
  /** CSS padding as the reference drew it, rendered through the density table. 16px 18px by default; lists use 14px 16px. */
  padding?: string;
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
  className?: never;
}

export function Panel({ surface = "plain", padding, as: Tag = "section", style, children }: PanelProps) {
  const asModule = surface !== "flat";
  return (
    <Tag
      data-ui="panel"
      data-surface={surface}
      style={{
        position: "relative",
        background: asModule ? t.module : t.flat,
        border: `1px solid ${asModule ? t.moduleBorder : t.glassBorder}`,
        borderRadius: r.card,
        padding: padding ?? "16px",
        boxShadow: asModule ? t.moduleShadow : "none",
        overflow: "hidden",
        minWidth: 0,
        minHeight: 0,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export interface PanelHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Controls at the right edge, aligned to the top. */
  right?: ReactNode;
  /** 16 by default; 13 to 15 where the reference is smaller. Drawn sizes, rendered through the density table. */
  titleSize?: 13 | 14 | 15 | 16;
  /** Render the title as a heading of this level. A plain block when absent. */
  headingLevel?: 1 | 2 | 3 | 4;
}

export function PanelHead({ title, subtitle, right, headingLevel }: PanelHeadProps) {
  return <CardHead title={title} subtitle={subtitle} action={right} headingLevel={headingLevel} />;
}

export default Panel;
