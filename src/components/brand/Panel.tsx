// The panel and its head (UI-P09).
//
// TWO SURFACES. `glass` is every reading surface: `--glass` over a `--glass-border`
// hairline, radius 16, `--shadow-card` plus the 1px top highlight
// `--panel-highlight`, and `overflow: hidden`. `flat` is the workspace — compose
// and import only — a solid `--flat` with the same hairline and no shadow, because
// a place you work in is not a thing on display.
//
// NO BLUR. Neither surface sets `backdrop-filter`: panels nest inside panels, and
// glass in this system carries light, never meaning — a panel is a tinted
// surface, not a blurred one. `glass.test.ts` holds the codebase to one blur
// value, and that value belongs to the portalled overlays, which cannot nest.
//
// The padding is the caller's to set: 16px 18px by default, 14px 16px for lists.

import type { CSSProperties, ElementType, ReactNode } from "react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface PanelProps {
  variant?: "glass" | "flat";
  /** CSS padding. 16px 18px by default; lists use 14px 16px. */
  padding?: string;
  as?: ElementType;
  style?: CSSProperties;
  children?: ReactNode;
  className?: never;
}

export function Panel({ variant = "glass", padding = "16px 18px", as: Tag = "section", style, children }: PanelProps) {
  return (
    <Tag
      data-ui="panel"
      data-variant={variant}
      style={{
        position: "relative",
        background: variant === "glass" ? t.glass : t.flat,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.panel,
        padding,
        boxShadow: variant === "glass" ? `${t.shadowCard}, ${t.panelHighlight}` : "none",
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
  /** 16 by default; 13 to 15 where the reference is smaller. */
  titleSize?: 13 | 14 | 15 | 16;
  /** Render the title as a heading of this level. A plain block when absent. */
  headingLevel?: 1 | 2 | 3 | 4;
}

export function PanelHead({ title, subtitle, right, titleSize = 16, headingLevel }: PanelHeadProps) {
  const Title: ElementType = headingLevel ? (`h${headingLevel}` as ElementType) : "div";
  return (
    <div
      data-ui="panel-head"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <Title
          style={{
            margin: 0,
            fontFamily: FIGTREE,
            fontSize: titleSize,
            fontWeight: 600,
            lineHeight: "normal",
            color: t.text,
          }}
        >
          {title}
        </Title>
        {subtitle ? (
          <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>{subtitle}</div>
        ) : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{right}</div> : null}
    </div>
  );
}

export default Panel;
