// The panel and its head (UI-P09, UI-P09b).
//
// THREE SURFACES.
//   `glass` is LIQUID GLASS (UI-P09b): the `.bg-glass` class in index.css — a refracted edge where the backdrop bends
//   through the panel, over `--glass-fill`, a fill solid enough to read body text on. It is for the page-level panel
//   that is a direct child of the page column and sits on the backdrop, and for nothing else.
//   `plain` is every other reading surface: `--glass` over a `--glass-border` hairline, radius 16, `--shadow-card`
//   plus the 1px top highlight `--panel-highlight`, `overflow: hidden`. Slightly translucent and flat, no blur and
//   no filter. It is what anything that repeats inside a panel or a grid keeps, and it is the default, so a panel
//   is liquid glass only when somebody chose it.
//   `flat` is the workspace — compose and import only — a solid `--flat` with the same hairline and no shadow,
//   because a place you work in is not a thing on display. A working surface does not refract.
//
// THE BLUR BELONGS TO `glass` ALONE, and `glass` never nests: a `.bg-glass` inside another doubles the blur cost
// and reads as fog. In development a nested one warns in the console. `glass.test.ts` holds the codebase to one blur
// value and to the files that may declare one; `src/index.css` is the file for panels.
//
// A glass panel draws its own hairline and fill in `::before`, so the element itself carries neither — only the
// halo and the card shadow, which sit outside the border box. The border is dropped rather than made transparent
// so the pseudo-element's hairline is the panel's edge.
//
// The padding is the caller's to set: 16px 18px by default, 14px 16px for lists. Those are the drawn
// values: since UI-P54 the panel renders whatever padding it is given through the density table, so the
// default is 12px 13px and a list's 10px 12px, and every caller tightened without being edited.

import { useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

import { densePx, denseFont, denseSpace } from "@/lib/theme/density";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

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

/** The class `src/index.css` defines. The only one this module spends. */
const GLASS_CLASS = "bg-glass";

/** Dev only: a liquid-glass panel inside another one doubles the blur cost, so say so. */
function useWarnOnNestedGlass(active: boolean) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || !active) return;
    const parent = ref.current?.parentElement;
    if (parent?.closest(`.${GLASS_CLASS}`)) {
      console.warn(
        '[Panel] surface="glass" is nested inside another liquid-glass panel. Nested glass doubles the blur cost and reads as fog; use surface="plain" for anything inside a panel.',
        ref.current,
      );
    }
  }, [active]);
  return ref;
}

export function Panel({ surface = "plain", padding = "16px 18px", as: Tag = "section", style, children }: PanelProps) {
  const glass = surface === "glass";
  const ref = useWarnOnNestedGlass(glass);
  return (
    <Tag
      ref={ref}
      data-ui="panel"
      data-surface={surface}
      className={glass ? GLASS_CLASS : undefined}
      style={{
        position: "relative",
        background: glass ? "none" : surface === "flat" ? t.flat : t.glass,
        border: glass ? "none" : `1px solid ${t.glassBorder}`,
        borderRadius: r.panel,
        padding: densePx(padding, denseSpace),
        boxShadow: glass
          ? `${t.glassHalo}, ${t.shadowCard}`
          : surface === "flat"
            ? "none"
            : `${t.shadowCard}, ${t.panelHighlight}`,
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

export function PanelHead({ title, subtitle, right, titleSize = 16, headingLevel }: PanelHeadProps) {
  const Title: ElementType = headingLevel ? (`h${headingLevel}` as ElementType) : "div";
  return (
    <div
      data-ui="panel-head"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 9 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <Title
          style={{
            margin: 0,
            fontFamily: FIGTREE,
            fontSize: denseFont(titleSize),
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
      {right ? <div style={{ display: "flex", gap: 4, alignItems: "center" }}>{right}</div> : null}
    </div>
  );
}

export default Panel;
